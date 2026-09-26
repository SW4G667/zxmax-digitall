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
const API = String(Deno.env.get("MAGNUSPAY_BASE_URL") || "https://magnuscash.com.br/api").replace(/\/$/, "");
const normalizeMoney = (value: unknown) => Math.round(Number(value) * 100);

async function notify(admin: any, purchaseId: number) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${service}`, apikey: service };
  await Promise.allSettled([
    fetch(`${url}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "purchase_confirmed", purchaseId }) }),
    fetch(`${url}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "new_sale", purchaseId }) }),
  ]);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: authData, error: authError } = await userClient.auth.getUser(auth.slice(7));
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const purchaseId = Number(body.purchaseId);
    if (!Number.isInteger(purchaseId) || purchaseId <= 0) return json({ error: "Pedido inválido." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: purchase, error: purchaseError } = await admin
      .from("purchases")
      .select("id,buyer_id,status,amount,payment_provider,provider_payment_id,payment_status")
      .eq("id", purchaseId)
      .maybeSingle();

    if (purchaseError || !purchase || purchase.buyer_id !== authData.user.id) return json({ error: "Pedido não encontrado." }, 404);
    if (["paid", "delivered"].includes(String(purchase.status))) {
      return json({ status: "COMPLETED", purchaseStatus: purchase.status, paid: true });
    }
    if (purchase.payment_provider !== "magnuspay_pix" || !purchase.provider_payment_id) {
      return json({ error: "Este pedido não possui cobrança MagnusPay ativa." }, 409);
    }

    const apiKey = String(Deno.env.get("MAGNUSPAY_API_KEY") || "").trim();
    if (!apiKey) return json({ error: "PIX temporariamente indisponível." }, 503);

    const response = await fetch(`${API}/transactions/check`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ transactionId: purchase.provider_payment_id }),
    });
    const raw = await response.text();
    let parsed: any = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }

    if (!response.ok || parsed?.success === false || !parsed?.data) {
      return json({ error: "Não foi possível consultar o pagamento agora." }, 502);
    }

    const data = parsed.data;
    const id = String(data.id || "");
    const status = String(data.status || "").toUpperCase();
    const amountCents = normalizeMoney(data.amount);
    const expectedCents = normalizeMoney(purchase.amount);

    if (id !== String(purchase.provider_payment_id)) return json({ error: "Identificador de pagamento divergente." }, 409);
    if (!Number.isFinite(amountCents) || amountCents !== expectedCents) return json({ error: "Valor confirmado divergente." }, 409);

    if (status === "COMPLETED") {
      const { data: applied, error: applyError } = await admin.rpc("apply_verified_payment_v2", {
        _provider: "magnuspay",
        _event_key: `magnuspay:${id}:COMPLETED`,
        _event_type: "payment.completed",
        _purchase_id: purchase.id,
        _charge_id: id,
        _confirmed_amount: Number(data.amount),
        _payload: parsed,
      });
      if (applyError) throw applyError;
      const result = Array.isArray(applied) ? applied[0] : applied;
      if (result?.applied) void notify(admin, purchase.id);
      return json({ status, purchaseStatus: result?.resulting_status || "paid", paid: true });
    }

    if (status === "EXPIRED" || status === "FAILED") {
      await admin.from("purchases").update({
        payment_status: status === "EXPIRED" ? "expired" : "failed",
        updated_at: new Date().toISOString(),
      }).eq("id", purchase.id).eq("provider_payment_id", id);
    }

    return json({ status, purchaseStatus: purchase.status, paid: false });
  } catch (error) {
    console.error("check-magnuspay-status", error instanceof Error ? error.message : error);
    return json({ error: "Erro inesperado ao consultar o PIX." }, 500);
  }
});
