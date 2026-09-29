import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

// A área de pedidos usa IDs públicos da contraparte. E-mail não é necessário
// para acompanhar uma compra e não deve retornar ao navegador nesse contrato.
const PURCHASE_COLUMNS = "id,product_id,buyer_id,buyer_public_id,seller_id,seller_public_id,status,amount,payment_provider,provider_payment_id,payment_status,provider_amount,provider_fee,provider_net_amount,provider_checked_at,messages,reviewed,review_stars,review_comment,variation_id,variation_name,quantity,product_amount,buyer_fee,created_at,updated_at,evopay_charge_id,pix_qr_code,pix_expires_at,delivered_pending_at,refund_reason,refunded_at,seller_released,released_at";


const MAGNUSPAY_API = "https://api.magnuspay.com.br";
const MAGNUSPAY_PAID_STATUSES = new Set(["COMPLETED", "PAID", "CONFIRMED", "APPROVED"]);
const cents = (value: unknown) => Math.round(Number(value) * 100);

async function notifyConfirmed(supabaseUrl: string, serviceKey: string, purchaseId: number) {
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  await Promise.allSettled([
    fetch(`${supabaseUrl}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "purchase_confirmed", purchaseId }) }),
    fetch(`${supabaseUrl}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "new_sale", purchaseId }) }),
  ]);
}

async function reconcileMagnusPurchase(admin: any, supabaseUrl: string, serviceKey: string, purchase: any) {
  if (
    purchase?.status !== "pending" ||
    purchase?.payment_provider !== "magnuspay_pix" ||
    !purchase?.provider_payment_id
  ) return false;

  // Avoid turning every screen refresh into a provider request.
  const lastChecked = purchase.provider_checked_at ? new Date(purchase.provider_checked_at).getTime() : 0;
  if (lastChecked && Date.now() - lastChecked < 8000) return false;

  const apiKey = String(Deno.env.get("MAGNUSPAY_API_KEY") || "").trim();
  if (!apiKey) return false;

  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(`${MAGNUSPAY_API}/transactions/check`, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ transactionId: purchase.provider_payment_id }),
    });
    const raw = await response.text();
    let parsed: any = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }

    await admin.from("purchases").update({ provider_checked_at: checkedAt }).eq("id", purchase.id);

    if (!response.ok || parsed?.success === false || !parsed?.data) return false;

    const data = parsed.data;
    const id = String(data.id || data.transactionId || "").trim();
    const status = String(data.status || "").toUpperCase();
    const providerAmount = Number(data.amount);
    const expectedAmount = purchase.provider_amount == null ? Number(purchase.amount) : Number(purchase.provider_amount);

    if (id !== String(purchase.provider_payment_id)) return false;
    if (!Number.isFinite(providerAmount) || cents(providerAmount) !== cents(expectedAmount)) return false;

    if (MAGNUSPAY_PAID_STATUSES.has(status)) {
      const { data: applied, error } = await admin.rpc("apply_verified_payment_v2", {
        _provider: "magnuspay",
        _event_key: `magnuspay:${id}:${status}`,
        _event_type: "transaction.completed",
        _purchase_id: purchase.id,
        _charge_id: id,
        _confirmed_amount: providerAmount,
        _payload: parsed,
      });
      if (error) {
        console.error("[get-my-purchases:reconcile] apply failed", error.message);
        return false;
      }
      const result = Array.isArray(applied) ? applied[0] : applied;
      if (result?.applied) void notifyConfirmed(supabaseUrl, serviceKey, purchase.id);
      return Boolean(result?.applied || result?.resulting_status !== "pending");
    }

    if (["EXPIRED", "FAILED", "CANCELED", "CANCELLED"].includes(status)) {
      await admin.from("purchases").update({
        payment_status: status === "EXPIRED" ? "expired" : "failed",
        provider_checked_at: checkedAt,
        updated_at: checkedAt,
      }).eq("id", purchase.id).eq("provider_payment_id", id);
      return true;
    }
  } catch (error) {
    console.warn("[get-my-purchases:reconcile]", error instanceof Error ? error.message : error);
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Serviço indisponível" }, 503);

  const userClient = createClient(supabaseUrl, anonKey);
  const { data: auth, error: authError } = await userClient.auth.getUser(authHeader.slice(7));
  if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: adminRole, error: roleError } = await admin.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
  if (roleError) return json({ error: "Não foi possível validar a sessão." }, 503);

  const loadRows = async () => {
    let query = admin.from("purchases").select(PURCHASE_COLUMNS).order("created_at", { ascending: false });
    if (adminRole !== true) query = query.or(`buyer_id.eq.${auth.user.id},seller_id.eq.${auth.user.id}`);
    return await query;
  };

  let { data, error } = await loadRows();
  if (error) {
    console.error("[get-my-purchases] query failed", error.message);
    return json({ error: "Não foi possível carregar seus pedidos." }, 503);
  }

  // Self-healing payment status: buyers do not need to keep the PIX modal open.
  // When either participant opens the order area, reconcile only the newest
  // MagnusPay pending charges and only when the provider throttle allows it.
  const candidates = (data ?? [])
    .filter((purchase: any) => purchase.status === "pending" && purchase.payment_provider === "magnuspay_pix" && purchase.provider_payment_id)
    .slice(0, 3);
  let reconciled = false;
  for (const purchase of candidates) {
    reconciled = (await reconcileMagnusPurchase(admin, supabaseUrl, serviceKey, purchase)) || reconciled;
  }
  if (reconciled) {
    const refreshed = await loadRows();
    if (!refreshed.error) data = refreshed.data;
  }

  const purchases = (data ?? []).map((purchase) => {
    // O código PIX e o identificador de cobrança são necessários somente para
    // o comprador retomar o próprio pagamento pendente; o vendedor não os vê.
    if (adminRole !== true && purchase.buyer_id !== auth.user.id) {
      const { evopay_charge_id: _chargeId, pix_qr_code: _pixCode, pix_expires_at: _pixExpires, ...safePurchase } = purchase;
      return safePurchase;
    }
    return purchase;
  });

  return json({ purchases });
});
