import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-zennith-event, x-zennith-delivery, x-zennith-timestamp, x-zennith-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DEFAULT_BASE = "https://zennithpay.online/api/v1";

function hexFromBuffer(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return hexFromBuffer(sig);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const rawBody = await req.text();

  try {
    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "zennithpay").maybeSingle();
    const cfg = (setting?.value || {}) as Record<string, unknown>;
    const apiKey = String(cfg.apiKey || Deno.env.get("ZENNITH_API_KEY") || "").trim();
    const webhookSecret = String(cfg.webhookSecret || Deno.env.get("ZENNITH_WEBHOOK_SECRET") || "").trim();
    const baseUrl = String(cfg.baseUrl || DEFAULT_BASE).replace(/\/$/, "");

    const timestamp = req.headers.get("x-zennith-timestamp") || "";
    const signature = (req.headers.get("x-zennith-signature") || "").replace(/^sha256=/i, "").trim().toLowerCase();
    const eventName = req.headers.get("x-zennith-event") || "";

    if (webhookSecret) {
      if (!timestamp || !signature) {
        await admin.from("webhook_logs").insert({
          source: "zennithpay", event_type: "AUTH", status: "rejected",
          payload: null, error: "Assinatura ou timestamp ausente",
        });
        return json({ error: "Unauthorized" }, 401);
      }
      const age = Math.abs(Date.now() - Date.parse(timestamp));
      if (!Number.isFinite(age) || age > 5 * 60 * 1000) {
        return json({ error: "Timestamp expirado" }, 401);
      }
      const expected = await hmacHex(webhookSecret, `${timestamp}.${rawBody}`);
      if (!timingSafeEqual(expected, signature)) {
        await admin.from("webhook_logs").insert({
          source: "zennithpay", event_type: "AUTH", status: "rejected",
          payload: null, error: "Assinatura HMAC inválida",
        });
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const event = rawBody ? JSON.parse(rawBody) : {};
    const data = (event?.data && typeof event.data === "object" ? event.data : event) as Record<string, unknown>;
    const status = String(data.status || event.status || "").toUpperCase();
    const metadata = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as Record<string, unknown>;
    const rawRef = String(data.reference_id || event.reference_id || "");
    const gatewayId = String(data.id || event.id || "");
    const fromRef = rawRef.startsWith("zxmax-purchase-") ? Number(rawRef.slice("zxmax-purchase-".length)) : NaN;
    const fromMeta = Number(metadata.purchase_id);
    const purchaseId = Number.isFinite(fromRef) && fromRef > 0
      ? fromRef
      : (Number.isFinite(fromMeta) && fromMeta > 0 ? fromMeta : Number(String(rawRef).replace(/^zxmax-purchase-/, "")));
    const chargeId = Number.isFinite(purchaseId) && purchaseId > 0 ? `zennith:zxmax-purchase-${purchaseId}` : null;
    const kind = String(event.event || eventName || "unknown");

    let logStatus = status || kind;

    const isPaid = kind === "payment.paid" || status === "PAID" || status === "COMPLETED";
    if (isPaid && apiKey && Number.isFinite(purchaseId) && purchaseId > 0 && chargeId) {
      const lookup = rawRef || gatewayId;
      let verify = await fetch(`${baseUrl}/payments/${encodeURIComponent(lookup)}/status`, {
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
      });
      if (!verify.ok && gatewayId && gatewayId !== lookup) {
        verify = await fetch(`${baseUrl}/payments/${encodeURIComponent(gatewayId)}/status`, {
          headers: { "X-API-Key": apiKey, Accept: "application/json" },
        });
      }
      const verifyBody = await verify.json().catch(() => ({} as Record<string, unknown>));
      const node = (verifyBody?.data && typeof verifyBody.data === "object" ? verifyBody.data : verifyBody) as Record<string, unknown>;
      const confirmedStatus = String(node.status || "").toUpperCase();
      const confirmedAmount = Math.round(Number(node.amount ?? data.amount) * 100) / 100;
      const confirmed = verify.ok && (confirmedStatus === "PAID" || confirmedStatus === "COMPLETED") && Number.isFinite(confirmedAmount);

      if (confirmed) {
        const { data: applied, error: applyError } = await admin.rpc("apply_verified_payment", {
          _provider: "zennithpay",
          _event_key: `${chargeId}:${kind}:${confirmedStatus}`,
          _event_type: kind,
          _purchase_id: purchaseId,
          _charge_id: chargeId,
          _confirmed_amount: confirmedAmount,
          _payload: event,
        });
        if (applyError) throw applyError;
        logStatus = applied?.[0]?.resulting_status || "processed";

        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const headers = { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST", headers, body: JSON.stringify({ type: "purchase_confirmed", purchaseId }),
          }).catch(() => {});
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST", headers, body: JSON.stringify({ type: "new_sale", purchaseId }),
          }).catch(() => {});
        } catch { /* ignore email */ }
      } else {
        logStatus = "unverified";
      }
    }

    await admin.from("webhook_logs").insert({
      source: "zennithpay",
      event_type: kind,
      status: logStatus,
      order_id: Number.isFinite(purchaseId) ? purchaseId : null,
      charge_id: chargeId,
      payload: event,
      error: null,
    });

    return json({ received: true });
  } catch (error: any) {
    console.error("zennith-webhook error:", error?.message || error);
    try {
      await admin.from("webhook_logs").insert({
        source: "zennithpay",
        event_type: "error",
        status: "error",
        payload: rawBody ? { raw: rawBody.slice(0, 2000) } : null,
        error: error?.message || String(error),
      });
    } catch { /* ignore */ }
    return json({ received: true });
  }
});
