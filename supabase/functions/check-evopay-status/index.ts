import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const round = (value: unknown) => Math.round(Number(value) * 100) / 100;

function normalizedStatus(value: unknown) {
  const status = String(value || "pending").toLowerCase();
  if (["paid", "completed", "confirmed", "approved"].includes(status)) return "COMPLETED";
  if (["expired", "cancelled", "canceled"].includes(status)) return "EXPIRED";
  if (["failed", "refunded"].includes(status)) return "FAILED";
  return "PENDING";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: authData } = await userClient.auth.getUser(authorization.slice(7));
    if (!authData.user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({} as Record<string, unknown>)) : {};
    const chargeId = String(url.searchParams.get("id") || body.id || "").trim();
    if (!chargeId) return json({ error: "Id da transação é obrigatório." }, 400);

    const { data: purchase } = await admin
      .from("purchases")
      .select("id,buyer_id,seller_id,evopay_charge_id,amount,status,payment_provider")
      .eq("evopay_charge_id", chargeId)
      .maybeSingle();
    if (!purchase || (purchase.buyer_id !== authData.user.id && purchase.seller_id !== authData.user.id)) {
      return json({ error: "Transação não encontrada para este usuário." }, 403);
    }

    const provider = String(purchase.payment_provider || "");
    const { data: configRow } = await admin.from("app_settings").select("key,value").in("key", ["zennithpay", "vexopay"]);
    const configuration = (key: string) => ((configRow || []).find((row: any) => row.key === key)?.value || {}) as Record<string, unknown>;
    let providerStatus: string;
    let providerAmount: number;

    if (provider === "zennith_pix" && chargeId.startsWith("zennith:")) {
      const key = String(Deno.env.get("ZENNITH_API_KEY") || "").trim();
      const zennith = configuration("zennithpay");
      if (!key || zennith.pixEnabled !== true) return json({ error: "Gateway ZennithPay indisponível para consulta." }, 503);
      const baseUrl = "https://zennithpay.online/api/v1";
      const reference = chargeId.slice("zennith:".length);
      const response = await fetch(`${baseUrl}/payments/${encodeURIComponent(reference)}/status`, { headers: { Accept: "application/json", "X-API-Key": key } });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) throw new Error("zennith_status_lookup_failed");
      const node = (payload.data || payload) as Record<string, unknown>;
      providerStatus = normalizedStatus(node.status);
      providerAmount = round(node.amount);
    } else if (["vexopay_pix", "crypto"].includes(provider) && chargeId.startsWith("vexo:")) {
      const ci = String(Deno.env.get("VEXOPAY_CLIENT_ID") || "").trim();
      const cs = String(Deno.env.get("VEXOPAY_CLIENT_SECRET") || "").trim();
      const vexo = configuration("vexopay");
      const enabled = provider === "vexopay_pix" ? vexo.pixEnabled === true : vexo.cryptoEnabled === true;
      if (!ci || !cs || !enabled) return json({ error: "Gateway VexoPay indisponível para consulta." }, 503);
      const baseUrl = "https://www.vexopay.com.br/api";
      const transaction = chargeId.slice("vexo:".length);
      const statusPath = provider === "vexopay_pix"
        ? `/gateway/pix-status?transactionId=${encodeURIComponent(transaction)}`
        : `/gateway/crypto-status?id=${encodeURIComponent(transaction)}`;
      const response = await fetch(`${baseUrl}${statusPath}`, { headers: { Accept: "application/json", ci, cs } });
      const payload = await response.json().catch(() => ({} as Record<string, unknown>));
      if (!response.ok) throw new Error("vexopay_status_lookup_failed");
      const node = (payload.data || payload.invoice || payload) as Record<string, unknown>;
      providerStatus = normalizedStatus(node.status);
      providerAmount = round(node.amount);
    } else {
      return json({ error: "Provedor de pagamento não é elegível para consulta." }, 400);
    }

    const expectedAmount = round(purchase.amount);
    if (providerStatus === "COMPLETED" && Number.isFinite(providerAmount) && providerAmount === expectedAmount) {
      const { error } = await admin.rpc("apply_verified_payment", {
        _provider: provider === "zennith_pix" ? "zennithpay" : "vexopay",
        _event_key: `${chargeId}:poll:paid`,
        _event_type: "poll",
        _purchase_id: purchase.id,
        _charge_id: chargeId,
        _confirmed_amount: providerAmount,
        _payload: { polled: true, status: providerStatus, amount: providerAmount },
      });
      if (error) throw error;
    }

    return json({ id: chargeId, status: providerStatus, amount: Number.isFinite(providerAmount) ? providerAmount : null });
  } catch (error: any) {
    console.error("check-payment-status", error?.message || error);
    return json({ error: "Não foi possível consultar o status do pagamento agora." }, 502);
  }
});
