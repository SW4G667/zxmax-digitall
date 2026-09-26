import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const API = String(Deno.env.get("MAGNUSPAY_BASE_URL") || "https://magnuscash.com.br/api").replace(/\/$/, "");

const unwrap = (body: any) => body?.data && typeof body.data === "object" ? body.data : body || {};
const first = (obj: any, keys: string[]) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

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

    if (purchaseError || !purchase || purchase.buyer_id !== userData.user.id) return json({ error: "Pedido não encontrado." }, 404);
    if (String(purchase.status) !== "pending") return json({ error: "Este pedido não está aguardando pagamento." }, 409);
    if (purchase.payment_provider && purchase.payment_provider !== "magnuspay_pix") {
      return json({ error: "Forma de pagamento incompatível com PIX MagnusPay." }, 409);
    }

    const stillValid = purchase.payment_status === "pending"
      && purchase.provider_payment_id
      && purchase.pix_qr_code
      && (!purchase.pix_expires_at || new Date(purchase.pix_expires_at).getTime() > Date.now());

    if (stillValid) {
      return json({
        id: purchase.provider_payment_id,
        status: "PENDING",
        amount: Number(purchase.amount),
        qrCodeText: purchase.pix_qr_code,
        qrCodeUrl: null,
        expiresAt: purchase.pix_expires_at,
        reused: true,
      });
    }

    const apiKey = String(Deno.env.get("MAGNUSPAY_API_KEY") || "").trim();
    if (!apiKey) return json({ error: "PIX temporariamente indisponível." }, 503);

    const amount = Math.round(Number(purchase.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount < 0.01) return json({ error: "Valor do pedido inválido." }, 400);

    const webhookUrl = `${Deno.env.get("SUPABASE_URL")!}/functions/v1/magnuspay-webhook`;
    const response = await fetch(`${API}/transactions/create`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        amount,
        description: `ZXMAX pedido #${purchase.id}`,
        externalId: `zxmax-purchase-${purchase.id}`,
        webhookUrl,
      }),
    });

    const raw = await response.text();
    let parsed: any = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }

    if (!response.ok || parsed?.success === false) {
      await admin.from("webhook_logs").insert({
        source: "magnuspay",
        event_type: "CREATE_PIX",
        status: `error_${response.status}`,
        order_id: purchase.id,
        payload: { code: parsed?.code || null },
        error: String(parsed?.message || "Falha ao criar PIX").slice(0, 500),
      }).catch(() => {});
      return json({ error: String(parsed?.message || "Não foi possível gerar o PIX.").slice(0, 240) }, 502);
    }

    const data = unwrap(parsed);
    const id = String(first(data, ["id", "transaction_id", "transactionId", "uuid"]) || "");
    const qrCodeText = String(first(data, ["pix_code", "pixCode", "qr_code", "qrCode", "copyPaste", "copy_paste", "copia_cola", "brcode"]) || "");
    const qrCodeUrl = first(data, ["qr_code_url", "qrCodeUrl", "qr_url", "qrUrl"]);
    const rawExpires = first(data, ["expires_at", "expiresAt", "expiration", "pix_expires_at"]);

    if (!id || !qrCodeText) return json({ error: "A MagnusPay respondeu sem os dados necessários do PIX." }, 502);

    let expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    if (rawExpires) {
      const date = new Date(String(rawExpires));
      if (Number.isFinite(date.getTime())) expiresAt = date.toISOString();
    }

    const { error: saveError } = await admin.from("purchases").update({
      payment_provider: "magnuspay_pix",
      provider_payment_id: id,
      payment_status: "pending",
      pix_qr_code: qrCodeText,
      pix_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", purchase.id).eq("buyer_id", userData.user.id);
    if (saveError) return json({ error: "PIX criado, mas não foi possível vincular ao pedido." }, 500);

    return json({ id, status: String(first(data, ["status"]) || "pending"), amount, qrCodeText, qrCodeUrl: qrCodeUrl ? String(qrCodeUrl) : null, expiresAt });
  } catch (error) {
    console.error("create-magnuspay-pix", error instanceof Error ? error.message : error);
    return json({ error: "Erro inesperado ao gerar o PIX." }, 500);
  }
});