import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const API = String(Deno.env.get("MAGNUSPAY_BASE_URL") || "https://magnuspay.onrender.com/api").replace(/\/$/, "");
const normalizeMoney = (value: unknown) => Math.round(Number(value) * 100);

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function base64(bytes: ArrayBuffer) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary);
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function hmac(secret: string, raw: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
}
async function verifyOptionalSignature(req: Request, raw: string) {
  const secret = String(Deno.env.get("MAGNUSPAY_WEBHOOK_SECRET") || "").trim();
  if (!secret) return true;

  const receivedRaw = String(
    req.headers.get("X-Magnus-Signature")
    || req.headers.get("X-Webhook-Signature")
    || req.headers.get("X-Signature")
    || "",
  ).trim();
  if (!receivedRaw) return false;

  const received = receivedRaw.replace(/^(sha256=|v1=)/i, "").trim();
  const signature = await hmac(secret, raw);
  const expectedHex = hex(signature).toLowerCase();
  const expectedB64 = base64(signature);
  return safeEqual(received.toLowerCase(), expectedHex) || safeEqual(received, expectedB64);
}
async function verifyWithMagnus(apiKey: string, transactionId: string) {
  const response = await fetch(`${API}/transactions/check`, {
    method: "POST",
    headers: { "X-API-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ transactionId }),
  });
  const body = await response.json().catch(() => ({} as any));
  return {
    ok: response.ok && body?.success !== false && body?.data,
    data: body?.data || {},
    code: body?.code || null,
    message: body?.message || null,
  };
}
async function notify(purchaseId: number) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${service}`, apikey: service };
  await Promise.allSettled([
    fetch(`${url}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "purchase_confirmed", purchaseId }) }),
    fetch(`${url}/functions/v1/send-email`, { method: "POST", headers, body: JSON.stringify({ type: "new_sale", purchaseId }) }),
  ]);
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const raw = await req.text();
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const apiKey = String(Deno.env.get("MAGNUSPAY_API_KEY") || "").trim();
    if (!apiKey) return json({ error: "Webhook not configured" }, 503);

    const signatureOk = await verifyOptionalSignature(req, raw);
    if (!signatureOk) {
      await admin.from("webhook_logs").insert({
        source: "magnuspay", event_type: "AUTH", status: "rejected",
        payload: null, error: "Assinatura do webhook inválida",
      }).catch(() => {});
      return json({ error: "Unauthorized" }, 401);
    }

    const event = raw ? JSON.parse(raw) : {};
    const data = event?.data && typeof event.data === "object" ? event.data : event;
    const eventName = String(event?.event || event?.type || data?.event || "").trim();
    const providerId = String(data?.id || data?.transactionId || data?.transaction_id || "").trim();

    if (!providerId) return json({ received: true });

    const { data: purchase } = await admin.from("purchases")
      .select("id,amount,status,payment_status,provider_payment_id,payment_provider")
      .eq("payment_provider", "magnuspay_pix")
      .eq("provider_payment_id", providerId)
      .maybeSingle();

    if (!purchase) return json({ received: true });

    // Nunca confia no status recebido para liberar ou cancelar valor. O evento
    // apenas dispara uma nova consulta autenticada diretamente à MagnusPay.
    const verified = await verifyWithMagnus(apiKey, providerId);
    const node = verified.data || {};
    const verifiedId = String(node?.id || node?.transactionId || node?.transaction_id || "");
    const verifiedStatus = String(node?.status || "").toUpperCase();
    const verifiedAmount = normalizeMoney(node?.amount);
    const expectedAmount = normalizeMoney(purchase.amount);

    if (!verified.ok || verifiedId !== providerId || !Number.isFinite(verifiedAmount) || verifiedAmount !== expectedAmount) {
      await admin.from("webhook_logs").insert({
        source: "magnuspay", event_type: eventName || "webhook", status: "unverified",
        order_id: purchase.id, charge_id: providerId,
        payload: { event, providerCode: verified.code }, error: String(verified.message || "Confirmação server-to-server divergente").slice(0, 500),
      }).catch(() => {});
      return json({ received: true });
    }

    if (verifiedStatus === "COMPLETED") {
      const { data: applied, error: applyError } = await admin.rpc("apply_verified_payment_v2", {
        _provider: "magnuspay",
        _event_key: `magnuspay:${providerId}:COMPLETED`,
        _event_type: eventName || "payment.completed",
        _purchase_id: purchase.id,
        _charge_id: providerId,
        _confirmed_amount: Number(node.amount),
        _payload: event,
      });
      if (applyError) throw applyError;
      const result = Array.isArray(applied) ? applied[0] : applied;
      if (result?.applied) void notify(purchase.id);

      await admin.from("webhook_logs").insert({
        source: "magnuspay", event_type: eventName || "payment.completed",
        status: result?.resulting_status || "processed", order_id: purchase.id,
        charge_id: providerId, payload: event, error: null,
      }).catch(() => {});
      return json({ received: true });
    }

    if (verifiedStatus === "EXPIRED" || verifiedStatus === "FAILED") {
      await admin.from("purchases").update({
        payment_status: verifiedStatus === "FAILED" ? "failed" : "expired",
        updated_at: new Date().toISOString(),
      }).eq("id", purchase.id).eq("provider_payment_id", providerId);

      await admin.from("webhook_logs").insert({
        source: "magnuspay", event_type: eventName || verifiedStatus,
        status: verifiedStatus, order_id: purchase.id,
        charge_id: providerId, payload: event, error: null,
      }).catch(() => {});
    }

    return json({ received: true });
  } catch (error) {
    console.error("magnuspay-webhook", error instanceof Error ? error.message : error);
    await admin.from("webhook_logs").insert({
      source: "magnuspay", event_type: "error", status: "error",
      payload: null, error: error instanceof Error ? error.message.slice(0, 500) : "unknown",
    }).catch(() => {});
    return json({ received: true });
  }
});
