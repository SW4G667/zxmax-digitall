import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, stripe-signature" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((item) => item.toString(16).padStart(2, "0")).join("");
const safeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i += 1) out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return out === 0;
};
const sign = async (secret: string, payload: string) => {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
};

function parseSignature(value: string) {
  const parts = value.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1] || "";
  const signatures = parts.filter(([key]) => key === "v1").map(([, signature]) => signature || "");
  return { timestamp, signatures };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const raw = await req.text();
  try {
    const webhookSecret = String(Deno.env.get("STRIPE_WEBHOOK_SECRET") || "").trim();
    const secretKey = String(Deno.env.get("STRIPE_SECRET_KEY") || "").trim();
    const received = req.headers.get("stripe-signature") || "";
    const { timestamp, signatures } = parseSignature(received);
    const millis = Number(timestamp) * 1000;
    if (!webhookSecret || !secretKey || !timestamp || !signatures.length || !Number.isFinite(millis) || Math.abs(Date.now() - millis) > 5 * 60 * 1000) {
      return json({ error: "Unauthorized" }, 401);
    }
    const expected = await sign(webhookSecret, `${timestamp}.${raw}`);
    if (!signatures.some((value) => safeEqual(expected, value))) return json({ error: "Unauthorized" }, 401);

    const event = JSON.parse(raw) as Record<string, any>;
    const eventType = String(event.type || "unknown");
    const sessionId = String(event?.data?.object?.id || "");
    const eventId = String(event.id || `${eventType}:${sessionId}`);
    if (!sessionId.startsWith("cs_")) return json({ received: true });

    const stripeResponse = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const session = await stripeResponse.json().catch(() => ({} as Record<string, unknown>));
    if (!stripeResponse.ok) throw new Error("stripe_session_lookup_failed");

    const purchaseId = Number((session as any).client_reference_id || (session as any).metadata?.purchaseId);
    const amount = Math.round(Number((session as any).amount_total) || 0) / 100;
    const paymentStatus = String((session as any).payment_status || "");
    const chargeId = `stripe:${sessionId}`;
    const payload = { eventId, type: eventType, sessionId, purchaseId, paymentStatus, amount };
    let logStatus = paymentStatus || "received";

    const completed = eventType === "checkout.session.completed" || eventType === "checkout.session.async_payment_succeeded";
    if (completed && paymentStatus === "paid" && Number.isFinite(purchaseId) && purchaseId > 0 && amount > 0) {
      const { data: applied, error } = await admin.rpc("apply_verified_payment", {
        _provider: "stripe",
        _event_key: eventId,
        _event_type: eventType,
        _purchase_id: purchaseId,
        _charge_id: chargeId,
        _confirmed_amount: amount,
        _payload: payload,
      });
      if (error) throw error;
      logStatus = applied?.[0]?.resulting_status || "processed";
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const headers = { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
        await fetch(`${supabaseUrl}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "purchase_confirmed", purchaseId }) });
        await fetch(`${supabaseUrl}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "new_sale", purchaseId }) });
      } catch { /* e-mail nunca altera o resultado do pagamento */ }
      try {
        const { data: purchase } = await admin.from("purchases").select("seller_id").eq("id", purchaseId).maybeSingle();
        if (purchase?.seller_id) {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          await fetch(`${supabaseUrl}/functions/v1/deliver-discord-webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
            body: JSON.stringify({ userId: purchase.seller_id, eventType: "sale_confirmed", eventId: purchaseId }),
          });
        }
      } catch { /* Discord nunca altera a confirmação financeira */ }
    } else if (eventType === "checkout.session.async_payment_failed") {
      logStatus = "payment_failed";
    }

    await admin.from("webhook_logs").insert({ source: "stripe", event_type: eventType, status: logStatus, order_id: Number.isFinite(purchaseId) ? purchaseId : null, charge_id: chargeId, payload, error: null });
    return json({ received: true });
  } catch (error: any) {
    console.error("stripe-webhook", error?.message || error);
    try { await admin.from("webhook_logs").insert({ source: "stripe", event_type: "error", status: "error", payload: { size: raw.length }, error: error?.message || String(error) }); } catch { /* noop */ }
    // Após uma assinatura válida, não confirmar a entrega em caso de erro interno.
    // A Stripe repetirá o evento; apply_verified_payment é idempotente por eventId.
    return json({ error: "Temporary webhook processing failure" }, 500);
  }
});
