import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ---- Authenticate the webhook call -------------------------------------
  // EvoPay is configured with a URL that carries a secret token (see the admin
  // panel, "APIs & Credenciais"). Without a valid token nothing is processed.
  const { data: evoSetting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "evopay")
    .maybeSingle();

  const expectedToken: string | undefined = (evoSetting?.value as any)?.webhookToken;
  const providedToken =
    new URL(req.url).searchParams.get("token") || req.headers.get("x-webhook-token") || "";

  if (!expectedToken || providedToken !== expectedToken) {
    console.warn("evopay-webhook rejected: invalid or missing token");
    await admin.from("webhook_logs").insert({
      source: "evopay",
      event_type: "AUTH",
      status: "rejected",
      order_id: null,
      charge_id: null,
      payload: null,
      error: expectedToken ? "Token do webhook inválido" : "Token do webhook não configurado no painel",
    });
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = (evoSetting?.value as any)?.apiKey || Deno.env.get("EVOPAY_API_KEY");

  let event: any = null;
  try {
    event = await req.json();
    console.log("EvoPay webhook received:", JSON.stringify(event));

    const status: string = event.status;
    const type: string = event.type;
    const clientReference: string | undefined = event.clientReference;
    const chargeId: string | undefined = event.id;
    const purchaseId = clientReference ? Number(clientReference) : NaN;

    let logStatus = status || "received";

    // Never trust the payload alone: confirm the charge directly with EvoPay.
    let confirmed = false;
    if (type === "DEPOSIT" && status === "COMPLETED" && chargeId && apiKey) {
      try {
        const verify = await fetch(`https://api.evopay.cash/v1/pix?id=${encodeURIComponent(chargeId)}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const verifyData = await verify.json().catch(() => ({}));
        confirmed = verify.ok &&
          (verifyData?.status === "COMPLETED" || verifyData?.status === "PAID") &&
          String(verifyData?.id || "") === chargeId &&
          String(verifyData?.clientReference || "") === clientReference;
        if (!confirmed) console.warn("evopay-webhook: charge not confirmed by API", chargeId, verifyData?.status);
      } catch (e) {
        console.error("evopay-webhook verification failed", e);
      }
    }

    // Only act on completed deposits (cash-in) confirmed by the EvoPay API
    if (confirmed && clientReference && !Number.isNaN(purchaseId)) {
      // Fetch purchase + product to decide auto delivery
      const { data: purchase } = await admin
        .from("purchases")
        .select("id, product_id, status, messages, evopay_charge_id, amount")
        .eq("id", purchaseId)
        .maybeSingle();

      if (purchase && purchase.status === "pending" && (!purchase.evopay_charge_id || purchase.evopay_charge_id === chargeId)) {
        const confirmedAmount = Number(event.amount);
        if (!Number.isFinite(confirmedAmount) || confirmedAmount !== Number(purchase.amount)) throw new Error("Valor confirmado diverge do pedido");
        const { data: applied, error: applyError } = await admin.rpc("apply_verified_payment", {
          _provider: "evopay", _event_key: `${chargeId}:${type}:${status}`, _event_type: type,
          _purchase_id: purchaseId, _charge_id: chargeId, _confirmed_amount: confirmedAmount, _payload: event,
        });
        if (applyError) throw applyError;
        logStatus = applied?.[0]?.resulting_status || "processed";
      } else {
        logStatus = purchase ? `ignored (already ${purchase.status})` : "ignored (purchase not found)";
      }
    }

    if (type === "DEPOSIT" && status === "COMPLETED" && !confirmed) {
      logStatus = "unverified (não confirmado pela API EvoPay)";
    }

    // Record the event for admin debugging
    await admin.from("webhook_logs").insert({
      source: "evopay",
      event_type: type || null,
      status: logStatus,
      order_id: Number.isNaN(purchaseId) ? null : purchaseId,
      charge_id: chargeId || null,
      payload: event,
      error: null,
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("evopay-webhook error:", error.message || error);
    try {
      await admin.from("webhook_logs").insert({
        source: "evopay",
        event_type: event?.type || null,
        status: "error",
        order_id: null,
        charge_id: event?.id || null,
        payload: event,
        error: error?.message || String(error),
      });
    } catch (_e) { /* ignore logging failure */ }
    // Always return 200 so EvoPay doesn't retry forever on parse issues
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
