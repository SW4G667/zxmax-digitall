import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-callback-attempt",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EVOPAY_BASE = "https://api.evopay.cash/v1";

function extractPurchaseId(clientReference: unknown, fallback?: string): number | null {
  const ref = String(clientReference || fallback || "");
  // zxmax-purchase-123 or zxmax-withdraw-123
  const m = ref.match(/zxmax-purchase-(\d+)/);
  if (m) {
    const id = Number(m[1]);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  return null;
}

function extractWithdrawId(clientReference: unknown): number | null {
  const ref = String(clientReference || "");
  const m = ref.match(/zxmax-withdraw-(\d+)/);
  if (m) {
    const id = Number(m[1]);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const rawBody = await req.text();

  try {
    const apiKey = String(Deno.env.get("EVOPAY_API_KEY") || "").trim();
    if (!apiKey) {
      console.warn("evopay-webhook: EVOPAY_API_KEY missing, processing without verification");
    }

    let event: Record<string, unknown>;
    try {
      event = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      event = {};
    }

    const id = String((event as any).id || "");
    const type = String((event as any).type || "").toUpperCase(); // DEPOSIT or WITHDRAW
    const status = String((event as any).status || "").toUpperCase();
    const amount = Number((event as any).amount);
    const clientReference = String((event as any).clientReference || "");
    const paidAt = (event as any).paidAt ? String((event as any).paidAt) : null;

    const purchaseId = extractPurchaseId(clientReference);
    const withdrawId = extractWithdrawId(clientReference);
    const chargeId = id ? `evopay:${id}` : clientReference ? `evopay:${clientReference}` : null;

    // Log inicial sempre
    const logPayload = {
      id,
      type,
      status,
      amount,
      clientReference,
      raw: rawBody.slice(0, 4000),
    };

    // Se for saque, apenas loga e atualiza se necessário
    if (type === "WITHDRAW") {
      try {
        if (withdrawId) {
          // Tenta atualizar withdrawal com provider tx se completou
          if (["COMPLETED", "PAID"].includes(status)) {
            await admin.from("withdrawals").update({
              status: "approved",
              provider_tx: id,
            }).eq("id", withdrawId);
          } else if (["CANCELED", "FAILED", "ERROR"].includes(status)) {
            await admin.from("withdrawals").update({
              status: "rejected",
              rejection_reason: (event as any).cancellationReason || "Falha no processamento do Pix",
            }).eq("id", withdrawId);
          }
        }
      } catch (e) {
        console.error("evopay withdraw log update failed", e);
      }

      await admin.from("webhook_logs").insert({
        source: "evopay",
        event_type: `WITHDRAW_${status || "UNKNOWN"}`,
        status: status || "received",
        order_id: withdrawId,
        charge_id: id || null,
        payload: event,
        error: null,
      });

      return json({ received: true });
    }

    // DEPOSIT flow
    let verified = false;
    let confirmedAmount = amount;
    let confirmedStatus = status;

    // Verificação via API oficial da Evopay - nunca confiar apenas no payload
    if (apiKey && id) {
      try {
        // Tenta primeiro GET /pix/?id=
        let verifyResp = await fetch(`${EVOPAY_BASE}/pix/?id=${encodeURIComponent(id)}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
        });
        let verifyBody: any = await verifyResp.json().catch(() => ({}));
        if (!verifyResp.ok) {
          // Fallback para /user/transactions/{id}
          verifyResp = await fetch(`${EVOPAY_BASE}/user/transactions/${encodeURIComponent(id)}`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
          });
          verifyBody = await verifyResp.json().catch(() => ({}));
        }

        if (verifyResp.ok) {
          const node = verifyBody?.data && typeof verifyBody.data === "object" ? verifyBody.data : verifyBody;
          const vStatus = String(node.status || "").toUpperCase();
          const vAmount = Number(node.amount);
          if (vStatus) confirmedStatus = vStatus;
          if (Number.isFinite(vAmount)) confirmedAmount = vAmount;
          if (["COMPLETED", "PAID"].includes(vStatus)) {
            verified = true;
          } else if (["PENDING"].includes(vStatus) && ["COMPLETED", "PAID"].includes(status)) {
            // Se webhook diz COMPLETED mas API ainda PENDING, aguardar próxima tentativa
            verified = false;
          }
        } else {
          console.warn("evopay verify failed", verifyResp.status, verifyBody);
        }
      } catch (e) {
        console.error("evopay verify exception", e);
      }
    }

    // Se não conseguiu verificar mas payload é COMPLETED, ainda tenta processar mas marca como unverified
    const isPaid = ["COMPLETED", "PAID"].includes(confirmedStatus) || ["COMPLETED", "PAID"].includes(status);
    let logStatus = confirmedStatus || status || "received";

    if (isPaid && purchaseId && chargeId) {
      // Para garantir, se não verificou via API, tenta verificar via clientReference também
      if (!verified && apiKey) {
        try {
          const refResp = await fetch(`${EVOPAY_BASE}/pix/?clientReference=${encodeURIComponent(clientReference)}`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
          });
          const refBody = await refResp.json().catch(() => ({}));
          if (refResp.ok) {
            const node = refBody?.data && typeof refBody.data === "object" ? refBody.data : refBody;
            const vStatus = String(node.status || "").toUpperCase();
            if (["COMPLETED", "PAID"].includes(vStatus)) verified = true;
          }
        } catch {}
      }

      // Se tem API key, exige verificação; se não tem key (dev), permite processar com payload
      const canProcess = verified || !apiKey;

      if (canProcess) {
        const { data: applied, error: applyError } = await admin.rpc("apply_verified_payment", {
          _provider: "evopay",
          _event_key: `${chargeId}:${confirmedStatus}:${paidAt || ""}`,
          _event_type: `evopay_${confirmedStatus.toLowerCase()}`,
          _purchase_id: purchaseId,
          _charge_id: chargeId,
          _confirmed_amount: Number.isFinite(confirmedAmount) ? Math.round(confirmedAmount * 100) / 100 : amount,
          _payload: event,
        });

        if (applyError) throw applyError;
        logStatus = (applied as any)?.[0]?.resulting_status || "processed";

        // Envia e-mails de confirmação (não bloqueante)
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const headers = { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers,
            body: JSON.stringify({ type: "purchase_confirmed", purchaseId }),
          }).catch(() => {});
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers,
            body: JSON.stringify({ type: "new_sale", purchaseId }),
          }).catch(() => {});
        } catch { /* ignore */ }
      } else {
        logStatus = "unverified";
      }
    }

    // Trata reembolso
    if (purchaseId && ["WAITING_FOR_REFUND", "REFUNDED"].includes(confirmedStatus)) {
      const refundStatus = String((event as any).refundStatus || "").toUpperCase();
      const refundReason = String((event as any).refundDescription || (event as any).refundReason || "Reembolso Evopay");
      if (confirmedStatus === "REFUNDED" || refundStatus === "COMPLETED") {
        await admin.from("purchases").update({
          status: "refunded",
          refund_reason: refundReason.slice(0, 500),
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", purchaseId);
        logStatus = "refunded";
      }
    }

    await admin.from("webhook_logs").insert({
      source: "evopay",
      event_type: type ? `${type}_${confirmedStatus || status}` : (event as any).event_type || "DEPOSIT",
      status: logStatus,
      order_id: purchaseId,
      charge_id: chargeId || id || null,
      payload: event,
      error: logStatus === "unverified" ? "Pagamento não verificado via API" : null,
    });

    return json({ received: true });
  } catch (error: any) {
    console.error("evopay-webhook error:", error?.message || error);
    try {
      await admin.from("webhook_logs").insert({
        source: "evopay",
        event_type: "error",
        status: "error",
        payload: rawBody ? { raw: rawBody.slice(0, 2000) } : null,
        error: error?.message || String(error),
      });
    } catch { /* ignore */ }
    // Sempre retorna 200 para Evopay não ficar re-tentando em caso de erro interno nosso que não é do pagamento
    return json({ received: true });
  }
});
