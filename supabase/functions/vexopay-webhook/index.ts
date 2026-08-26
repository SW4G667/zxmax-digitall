import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const paid = (status: unknown) => String(status || "").toLowerCase() === "paid";
const documentedEvents = new Set(["payment.completed", "payment.failed", "payment.expired"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const eventType = String(body.event || "unknown");
    const eventData = (body.data || {}) as Record<string, unknown>;
    const transactionId = String(eventData.transactionId || eventData.id || "").trim();
    if (!transactionId) return json({ error: "Missing transaction id" }, 400);
    if (!documentedEvents.has(eventType)) return json({ error: "Unsupported webhook event" }, 400);

    const chargeId = `vexo:${transactionId}`;
    const { data: purchase } = await admin
      .from("purchases")
      .select("id,status,amount,payment_provider,evopay_charge_id")
      .eq("evopay_charge_id", chargeId)
      .maybeSingle();
    if (!purchase || !["vexopay_pix", "crypto"].includes(String(purchase.payment_provider))) return json({ received: true });

    const ci = String(Deno.env.get("VEXOPAY_CLIENT_ID") || "").trim();
    const cs = String(Deno.env.get("VEXOPAY_CLIENT_SECRET") || "").trim();
    if (!ci || !cs) throw new Error("vexopay_not_configured");

    const { data: configRow } = await admin.from("app_settings").select("value").eq("key", "vexopay").maybeSingle();
    const config = (configRow?.value || {}) as Record<string, unknown>;
    const enabled = purchase.payment_provider === "vexopay_pix" ? config.pixEnabled === true : config.cryptoEnabled === true;
    if (!enabled) throw new Error("vexopay_disabled");
    const baseUrl = typeof config.baseUrl === "string" && config.baseUrl.startsWith("https://") ? config.baseUrl.replace(/\/$/, "") : "https://www.vexopay.com.br/api";
    const statusPath = purchase.payment_provider === "vexopay_pix"
      ? `/gateway/pix-status?transactionId=${encodeURIComponent(transactionId)}`
      : `/gateway/crypto-status?id=${encodeURIComponent(transactionId)}`;
    const response = await fetch(`${baseUrl}${statusPath}`, { headers: { Accept: "application/json", ci, cs } });
    const providerBody = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) throw new Error("vexopay_status_lookup_failed");
    const statusNode = (providerBody.data || providerBody.invoice || providerBody) as Record<string, unknown>;
    const status = String(statusNode.status || "pending").toLowerCase();
    const amount = Math.round(Number(statusNode.amount) * 100) / 100;

    if (eventType === "payment.completed" && paid(status) && Number.isFinite(amount) && amount === Math.round(Number(purchase.amount) * 100) / 100) {
      const { error } = await admin.rpc("apply_verified_payment", {
        _provider: "vexopay",
        _event_key: `${chargeId}:${eventType}`,
        _event_type: eventType,
        _purchase_id: purchase.id,
        _charge_id: chargeId,
        _confirmed_amount: amount,
        _payload: { eventType, transactionId, status, amount },
      });
      if (error) throw error;
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
        await fetch(`${supabaseUrl}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "purchase_confirmed", purchaseId: purchase.id }) });
        await fetch(`${supabaseUrl}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "new_sale", purchaseId: purchase.id }) });
      } catch { /* notificação não altera a confirmação de pagamento */ }
    }

    await admin.from("webhook_logs").insert({ source: "vexopay", event_type: eventType, status, order_id: purchase.id, charge_id: chargeId, payload: { transactionId, amount: Number.isFinite(amount) ? amount : null }, error: null });
    return json({ received: true });
  } catch (error: any) {
    console.error("vexopay-webhook", error?.message || error);
    return json({ error: "Temporary webhook processing failure" }, 500);
  }
});
