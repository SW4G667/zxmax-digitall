import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const API = String(Deno.env.get("MAGNUSPAY_BASE_URL") || "https://magnuscash.com.br/api").replace(/\/$/, "");

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function signature(secret: string, raw: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyRemote(apiKey: string, transactionId: string) {
  const response = await fetch(`${API}/transactions/check`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ transactionId }),
  });
  const body = await response.json().catch(() => ({} as any));
  return { ok: response.ok && body?.success !== false, body };
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const raw = await req.text();
  const apiKey = String(Deno.env.get("MAGNUSPAY_API_KEY") || "").trim();
  if (!apiKey) return json({ error: "Webhook not configured" }, 503);

  const received = String(req.headers.get("X-Magnus-Signature") || "").replace(/^(sha256=|v1=)/i, "").trim().toLowerCase();
  if (!received) return json({ error: "Unauthorized" }, 401);
  const expected = await signature(apiKey, raw);
  if (!safeEqual(received, expected)) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const event = raw ? JSON.parse(raw) : {};
    const data = event?.data && typeof event.data === "object" ? event.data : {};
    const providerId = String(data.id || "");
    const status = String(data.status || "").toUpperCase();
    if (!providerId) return json({ received: true });

    const { data: purchase } = await admin.from("purchases")
      .select("id,amount,status,payment_status,provider_payment_id,payment_provider")
      .eq("payment_provider", "magnuspay_pix")
      .eq("provider_payment_id", providerId)
      .maybeSingle();

    if (!purchase) return json({ received: true });

    if (status === "COMPLETED" || String(event?.event || "") === "payment.completed") {
      const verified = await verifyRemote(apiKey, providerId);
      const remote = verified.body?.data;
      if (!verified.ok || String(remote?.id || "") !== providerId) return json({ error: "Provider verification failed" }, 409);

      const amountCents = Math.round(Number(remote?.amount) * 100);
      const expectedCents = Math.round(Number(purchase.amount) * 100);
      if (!Number.isFinite(amountCents) || amountCents !== expectedCents) return json({ error: "Amount mismatch" }, 409);

      const { error } = await admin.rpc("apply_verified_payment_v2", {
        _provider: "magnuspay",
        _event_key: `magnuspay:${providerId}:COMPLETED`,
        _event_type: "payment.completed",
        _purchase_id: purchase.id,
        _charge_id: providerId,
        _confirmed_amount: Number(remote.amount),
        _payload: event,
      });
      if (error) throw error;
    } else if (status === "EXPIRED" || status === "FAILED" || status === "CANCELLED") {
      await admin.from("purchases").update({
        payment_status: status === "EXPIRED" ? "expired" : status === "FAILED" ? "failed" : "cancelled",
        updated_at: new Date().toISOString(),
      }).eq("id", purchase.id).eq("provider_payment_id", providerId);
    }

    await admin.from("webhook_logs").insert({
      source: "magnuspay",
      event_type: String(event?.event || status || "webhook"),
      status: "processed",
      order_id: purchase.id,
      charge_id: providerId,
      payload: event,
      error: null,
    }).catch(() => {});

    return json({ received: true });
  } catch (error) {
    console.error("magnuspay-webhook", error instanceof Error ? error.message : error);
    return json({ error: "Webhook processing failed" }, 500);
  }
});
