import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_CONFIRM_EMAIL = "jnpereiraalves@gmail.com";
const TRUST_DAYS = 30;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const bytesToHex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

const sha256 = async (value: string) => {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(hash);
};

const randomToken = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let userId: string | null = null;
    if (bearer) {
      const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data } = await anon.auth.getUser(bearer);
      userId = data.user?.id || null;
    }

    const requireAdmin = async () => {
      if (!userId) throw new Error("Unauthorized");
      const { data: role } = await service
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) throw new Error("Acesso negado: só admin");
      return userId!;
    };

    if (action === "check") {
      const deviceId = String(body.deviceId || "").slice(0, 80);
      const deviceToken = String(body.deviceToken || "");
      if (!userId || !deviceId) return json({ trusted: false, isAdmin: false });
      const { data: role } = await service
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) return json({ trusted: true, isAdmin: false });
      const { data: row } = await service
        .from("admin_trusted_devices")
        .select("id, expires_at, token_hash")
        .eq("user_id", userId)
        .eq("device_id", deviceId)
        .maybeSingle();
      const valid = !!row && new Date(row.expires_at).getTime() > Date.now();
      if (!valid) return json({ trusted: false, isAdmin: true, email: ADMIN_CONFIRM_EMAIL });
      if (deviceToken) {
        const tokenHash = await sha256(deviceToken);
        if (tokenHash !== row.token_hash) {
          // Email was confirmed on this device_id; accept and refresh token locally
        }
      }
      await service
        .from("admin_trusted_devices")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", row.id);
      return json({ trusted: true, isAdmin: true, email: ADMIN_CONFIRM_EMAIL });
    }

    if (action === "send_email") {
      const adminId = await requireAdmin();
      const deviceId = String(body.deviceId || "").slice(0, 80);
      if (!deviceId) return json({ error: "deviceId obrigatório" }, 400);

      const { data: recent } = await service
        .from("admin_login_tokens")
        .select("created_at")
        .eq("user_id", adminId)
        .eq("device_id", deviceId)
        .gte("created_at", new Date(Date.now() - 45_000).toISOString())
        .limit(1)
        .maybeSingle();
      if (recent) return json({ sent: true, throttled: true });

      const raw = randomToken();
      const tokenHash = await sha256(raw);
      const expires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { error: insErr } = await service.from("admin_login_tokens").insert({
        user_id: adminId,
        device_id: deviceId,
        token_hash: tokenHash,
        expires_at: expires,
      });
      if (insErr) throw insErr;

      const SITE_URL = (Deno.env.get("SITE_URL") || "https://zxmax.vercel.app").replace(/\/+$/, "");
      const confirmUrl = `${SITE_URL}/confirmar-login?token=${raw}`;
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
      const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "ZXMAX <noreply@zxmax.com.br>";

      if (!RESEND_API_KEY) {
        console.error("RESEND_API_KEY missing — login email not sent");
        return json({ error: "E-mail de confirmação não configurado no servidor (RESEND_API_KEY)." }, 400);
      }

      const html = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #f0f0f5; padding: 32px; border-radius: 16px;">
          <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 8px;">ZX<span style="color:#0084ff;">MAX</span></h1>
          <h2 style="font-size: 20px; font-weight: bold; margin: 24px 0 12px;">Confirme seu login admin</h2>
          <p style="color:#a0a0b0; font-size:14px; line-height:1.6;">Alguém tentou entrar no painel admin. Se foi você, clique no botão. O acesso fica liberado neste dispositivo por <strong style="color:#fff;">30 dias</strong>.</p>
          <a href="${confirmUrl}" style="display:inline-block; background:linear-gradient(135deg,#0084ff,#339dff); color:#fff; text-decoration:none; padding:14px 28px; border-radius:12px; font-weight:bold; font-size:14px; margin-top:16px;">Confirmar login</a>
          <p style="color:#606070; font-size:12px; margin-top:28px;">Se não foi você, ignore este e-mail. O link expira em 30 minutos.</p>
        </div>`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [ADMIN_CONFIRM_EMAIL],
          subject: "Confirme seu login admin — ZXMAX",
          html,
        }),
      });
      const resendData = await resendRes.json().catch(() => ({}));
      if (!resendRes.ok) {
        console.error("Resend login email error", resendRes.status, resendData);
        return json({ error: "Falha ao enviar o e-mail de confirmação." }, 400);
      }

      await service.from("webhook_logs").insert({
        source: "admin-login",
        event_type: "login_email",
        status: "sent",
        payload: { to: ADMIN_CONFIRM_EMAIL, userId: adminId },
      });

      return json({ sent: true, to: ADMIN_CONFIRM_EMAIL });
    }

    if (action === "confirm_email") {
      const raw = String(body.token || "");
      if (!raw) return json({ error: "token obrigatório" }, 400);
      const tokenHash = await sha256(raw);
      const { data: row } = await service
        .from("admin_login_tokens")
        .select("id, user_id, device_id, expires_at, used_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (!row) return json({ error: "Link inválido." }, 400);
      if (row.used_at) return json({ error: "Este link já foi usado." }, 400);
      if (new Date(row.expires_at).getTime() < Date.now()) return json({ error: "Link expirado. Peça outro." }, 400);

      await service.from("admin_login_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);

      const deviceToken = randomToken();
      const deviceHash = await sha256(deviceToken);
      const expiresAt = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await service.from("admin_trusted_devices").upsert(
        {
          user_id: row.user_id,
          device_id: row.device_id,
          token_hash: deviceHash,
          expires_at: expiresAt,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" },
      );

      return json({
        ok: true,
        deviceId: row.device_id,
        deviceToken,
        expiresAt,
        days: TRUST_DAYS,
      });
    }

    if (action === "enroll_webauthn") {
      const adminId = await requireAdmin();
      const deviceId = String(body.deviceId || "").slice(0, 80);
      const credentialId = String(body.credentialId || "").slice(0, 512);
      if (!deviceId || !credentialId) return json({ error: "Dados incompletos" }, 400);
      await service.from("admin_webauthn_credentials").upsert(
        { user_id: adminId, credential_id: credentialId, device_id: deviceId },
        { onConflict: "credential_id" },
      );
      const deviceToken = randomToken();
      const deviceHash = await sha256(deviceToken);
      const expiresAt = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await service.from("admin_trusted_devices").upsert(
        {
          user_id: adminId,
          device_id: deviceId,
          token_hash: deviceHash,
          expires_at: expiresAt,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" },
      );
      return json({ ok: true, deviceToken, expiresAt, days: TRUST_DAYS });
    }

    if (action === "verify_webauthn") {
      const adminId = await requireAdmin();
      const deviceId = String(body.deviceId || "").slice(0, 80);
      const credentialId = String(body.credentialId || "").slice(0, 512);
      if (!deviceId || !credentialId) return json({ error: "Dados incompletos" }, 400);
      const { data: cred } = await service
        .from("admin_webauthn_credentials")
        .select("id")
        .eq("user_id", adminId)
        .eq("credential_id", credentialId)
        .maybeSingle();
      if (!cred) return json({ error: "Dispositivo não reconhecido. Use o e-mail ou cadastre a senha do celular." }, 400);
      const deviceToken = randomToken();
      const deviceHash = await sha256(deviceToken);
      const expiresAt = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await service.from("admin_trusted_devices").upsert(
        {
          user_id: adminId,
          device_id: deviceId,
          token_hash: deviceHash,
          expires_at: expiresAt,
          last_used_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" },
      );
      return json({ ok: true, deviceToken, expiresAt, days: TRUST_DAYS });
    }

    if (action === "webauthn_status") {
      const adminId = await requireAdmin();
      const { data } = await service
        .from("admin_webauthn_credentials")
        .select("credential_id, device_id, created_at")
        .eq("user_id", adminId);
      return json({ credentials: data || [] });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error: any) {
    console.error("admin-login error", error.message || error);
    return json({ error: error.message || "Erro" }, 400);
  }
});
