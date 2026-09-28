import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function normalizeBrazilPhone(value: unknown): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^55\d{10,11}$/.test(digits)) return "+" + digits;
  if (/^\d{10,11}$/.test(digits)) return "+55" + digits;
  return null;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anon);
    const { data: authData, error: authError } = await userClient.auth.getUser(auth.slice(7));
    if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);

    const admin = createClient(supabaseUrl, service);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const phone = normalizeBrazilPhone(body.phone);
    if (!phone) return json({ error: "Informe um número brasileiro válido com DDD." }, 400);

    const accountSid = String(Deno.env.get("TWILIO_ACCOUNT_SID") || "").trim();
    const authToken = String(Deno.env.get("TWILIO_AUTH_TOKEN") || "").trim();
    const serviceSid = String(Deno.env.get("TWILIO_VERIFY_SERVICE_SID") || "").trim();
    if (!accountSid || !authToken || !serviceSid) {
      return json({
        error: "A verificação por SMS ainda não foi configurada no servidor.",
        code: "sms_not_configured",
      }, 503);
    }

    const basic = "Basic " + btoa(accountSid + ":" + authToken);
    const phoneHash = await sha256(phone);

    if (action === "start") {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const minuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      const [{ count: recentCount }, { count: minuteCount }] = await Promise.all([
        admin.from("phone_verification_events").select("id", { count: "exact", head: true })
          .eq("user_id", authData.user.id).eq("event_type", "start").gte("created_at", hourAgo),
        admin.from("phone_verification_events").select("id", { count: "exact", head: true })
          .eq("user_id", authData.user.id).eq("event_type", "start").gte("created_at", minuteAgo),
      ]);
      if ((minuteCount || 0) > 0) return json({ error: "Aguarde 60 segundos antes de pedir outro código." }, 429);
      if ((recentCount || 0) >= 5) return json({ error: "Muitas tentativas. Aguarde antes de solicitar outro código." }, 429);

      const response = await fetch(
        "https://verify.twilio.com/v2/Services/" + encodeURIComponent(serviceSid) + "/Verifications",
        {
          method: "POST",
          headers: {
            Authorization: basic,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: phone, Channel: "sms" }),
        },
      );
      const raw = await response.text();
      let provider: any = {};
      try { provider = raw ? JSON.parse(raw) : {}; } catch { provider = {}; }
      if (!response.ok) {
        console.warn("phone-verification start", response.status, provider?.code || "");
        return json({ error: "Não foi possível enviar o SMS agora. Confira o número e tente novamente." }, 502);
      }

      await admin.from("phone_verification_events").insert({
        user_id: authData.user.id,
        phone_hash: phoneHash,
        event_type: "start",
      });
      return json({ sent: true, status: String(provider?.status || "pending") });
    }

    if (action === "check") {
      const code = String(body.code || "").replace(/\D/g, "");
      if (!/^\d{4,10}$/.test(code)) return json({ error: "Digite o código recebido por SMS." }, 400);

      const response = await fetch(
        "https://verify.twilio.com/v2/Services/" + encodeURIComponent(serviceSid) + "/VerificationCheck",
        {
          method: "POST",
          headers: {
            Authorization: basic,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: phone, Code: code }),
        },
      );
      const raw = await response.text();
      let provider: any = {};
      try { provider = raw ? JSON.parse(raw) : {}; } catch { provider = {}; }

      const approved = response.ok && String(provider?.status || "").toLowerCase() === "approved";
      if (!approved) {
        await admin.from("phone_verification_events").insert({
          user_id: authData.user.id,
          phone_hash: phoneHash,
          event_type: "failed",
        });
        return json({ error: "Código inválido ou expirado." }, 400);
      }

      const now = new Date().toISOString();
      const { error: profileError } = await admin.from("profiles").update({
        phone,
        phone_verified_at: now,
        updated_at: now,
      }).eq("user_id", authData.user.id);
      if (profileError) throw profileError;

      await admin.from("phone_verification_events").insert({
        user_id: authData.user.id,
        phone_hash: phoneHash,
        event_type: "approved",
      });
      return json({ verified: true, phoneMasked: phone.slice(0, 5) + "*****" + phone.slice(-2) });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("phone-verification", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível concluir a verificação por SMS." }, 500);
  }
});
