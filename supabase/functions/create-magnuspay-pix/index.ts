import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const MAGNUSPAY_API = "https://api.magnuspay.com.br";
const PIX_TTL_MS = 15 * 60 * 1000;

const rateInfo = (response: Response) => ({
  limit: response.headers.get("RateLimit-Limit") || response.headers.get("X-RateLimit-Limit"),
  remaining: response.headers.get("RateLimit-Remaining") || response.headers.get("X-RateLimit-Remaining"),
  reset: response.headers.get("RateLimit-Reset"),
  retryAfter: response.headers.get("Retry-After"),
});

async function writeMagnusLog(client: any, row: Record<string, unknown>) {
  try {
    const { error } = await client.from("webhook_logs").insert(row);
    if (error) console.warn("magnuspay log insert failed", error.message);
  } catch (error) {
    console.warn("magnuspay log insert failed", error instanceof Error ? error.message : "unknown");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userError } = await userClient.auth.getUser(auth.slice(7));
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const purchaseId = Number(body.purchaseId);
    if (!Number.isInteger(purchaseId) || purchaseId <= 0) return json({ error: "Pedido inválido." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: purchase, error: purchaseError } = await admin
      .from("purchases")
      .select("id,buyer_id,status,amount,payment_provider,provider_payment_id,payment_status,pix_qr_code,pix_expires_at")
      .eq("id", purchaseId)
      .maybeSingle();

    if (purchaseError || !purchase || purchase.buyer_id !== userData.user.id) {
      return json({ error: "Pedido não encontrado." }, 404);
    }
    if (String(purchase.status) !== "pending") {
      return json({ error: "Este pedido não está aguardando pagamento." }, 409);
    }
    if (purchase.payment_provider && purchase.payment_provider !== "magnuspay_pix") {
      return json({ error: "Forma de pagamento incompatível com PIX MagnusPay." }, 409);
    }

    const stillValid = purchase.payment_status === "pending"
      && purchase.provider_payment_id
      && purchase.pix_qr_code
      && (!purchase.pix_expires_at || new Date(purchase.pix_expires_at).getTime() > Date.now());

    if (stillValid) {
      return json({
        id: String(purchase.provider_payment_id),
        transactionId: String(purchase.provider_payment_id),
        status: "PENDING",
        amount: Number(purchase.amount),
        qrCodeText: String(purchase.pix_qr_code),
        qrCodeUrl: null,
        expiresAt: purchase.pix_expires_at,
        reused: true,
      });
    }

    const apiKey = String(Deno.env.get("MAGNUSPAY_API_KEY") || "").trim();
    if (!apiKey) return json({ error: "MAGNUSPAY_API_KEY não está configurada no servidor." }, 503);

    const amount = Math.round(Number(purchase.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 1) {
      return json({ error: "A MagnusPay exige pagamento mínimo de R$ 1,00." }, 400);
    }

    const payerName = typeof body.buyerName === "string" ? body.buyerName.trim().slice(0, 120) : "";
    const payerDocument = typeof body.payerDocument === "string"
      ? body.payerDocument.replace(/\D/g, "").slice(0, 14)
      : "";

    const providerPayload: Record<string, unknown> = {
      amount,
      description: `ZXMAX pedido #${purchase.id}`,
      // Mantém o valor do checkout exato. A taxa da própria Magnus é descontada
      // do recebedor, em vez de surgir como cobrança invisível para o cliente.
      feeToCustomer: false,
    };
    if (payerName) providerPayload.payerName = payerName;
    if (payerDocument.length === 11 || payerDocument.length === 14) providerPayload.payerDocument = payerDocument;

    const response = await fetch(`${MAGNUSPAY_API}/transactions/create`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(providerPayload),
    });

    const raw = await response.text();
    let parsed: any = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }
    const limits = rateInfo(response);

    if (response.status === 429) {
      await writeMagnusLog(admin, {
        source: "magnuspay",
        event_type: "CREATE_PIX",
        status: "rate_limited",
        order_id: purchase.id,
        payload: { endpoint: "/transactions/create", limits },
        error: "Rate limit da MagnusPay atingido",
      });
      return json({
        error: "A MagnusPay atingiu o limite temporário de requisições. Aguarde e tente novamente.",
        code: "magnus_rate_limited",
        retryAfter: limits.retryAfter || limits.reset,
      }, 429);
    }

    if (!response.ok || parsed?.success === false) {
      const providerMessage = String(parsed?.message || `MagnusPay respondeu HTTP ${response.status}`).slice(0, 500);
      await writeMagnusLog(admin, {
        source: "magnuspay",
        event_type: "CREATE_PIX",
        status: `error_${response.status}`,
        order_id: purchase.id,
        payload: {
          endpoint: "/transactions/create",
          code: parsed?.code || null,
          contentType: response.headers.get("content-type"),
          limits,
        },
        error: providerMessage,
      });
      return json({
        error: providerMessage,
        code: parsed?.code || `magnus_http_${response.status}`,
      }, 502);
    }

    const data = parsed?.data && typeof parsed.data === "object" ? parsed.data : {};
    const transactionId = String(data.transactionId || data.id || "").trim();
    const copyPaste = String(data.copyPaste || data.pixCode || data.qrCode || "").trim();
    const qrCodeUrl = data.qrcodeUrl || data.qrCodeUrl || null;
    const qrCodeBase64 = data.qrCodeBase64 || null;
    const paymentLink = data.paymentLink || null;

    if (!transactionId || !copyPaste) {
      await writeMagnusLog(admin, {
        source: "magnuspay",
        event_type: "CREATE_PIX",
        status: "invalid_response",
        order_id: purchase.id,
        payload: {
          endpoint: "/transactions/create",
          keys: Object.keys(data).slice(0, 30),
          success: parsed?.success,
          limits,
        },
        error: "Resposta da MagnusPay sem transactionId ou copyPaste",
      });
      return json({
        error: "A MagnusPay criou uma resposta incompleta para o PIX. Tente novamente.",
        code: "magnus_invalid_response",
      }, 502);
    }

    // A documentação atual informa expiração automática em 15 minutos.
    const expiresAt = new Date(Date.now() + PIX_TTL_MS).toISOString();

    const { error: saveError } = await admin.from("purchases").update({
      payment_provider: "magnuspay_pix",
      provider_payment_id: transactionId,
      payment_status: "pending",
      pix_qr_code: copyPaste,
      pix_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", purchase.id).eq("buyer_id", userData.user.id);

    if (saveError) {
      await writeMagnusLog(admin, {
        source: "magnuspay",
        event_type: "CREATE_PIX",
        status: "local_save_failed",
        order_id: purchase.id,
        charge_id: transactionId,
        payload: { endpoint: "/transactions/create" },
        error: saveError.message,
      });
      return json({ error: "PIX criado, mas não foi possível vinculá-lo ao pedido." }, 500);
    }

    await writeMagnusLog(admin, {
      source: "magnuspay",
      event_type: "CREATE_PIX",
      status: "created",
      order_id: purchase.id,
      charge_id: transactionId,
      payload: {
        endpoint: "/transactions/create",
        status: "PENDING",
        externalId: data.externalId || null,
        providerAmount: data.amount ?? null,
        platformFee: data.platformFee ?? null,
        netAmount: data.netAmount ?? null,
        limits,
      },
      error: null,
    });

    return json({
      id: transactionId,
      transactionId,
      status: "PENDING",
      amount: Number(data.amount ?? amount),
      qrCodeText: copyPaste,
      qrCodeUrl: qrCodeUrl ? String(qrCodeUrl) : null,
      qrCodeBase64: qrCodeBase64 ? String(qrCodeBase64) : null,
      paymentLink: paymentLink ? String(paymentLink) : null,
      expiresAt,
    }, 201);
  } catch (error) {
    console.error("create-magnuspay-pix", error instanceof Error ? error.message : error);
    return json({ error: "Erro inesperado ao gerar o PIX." }, 500);
  }
});
