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

const DISCORD_API = "https://discord.com/api/v10";

function inviteCode(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === "discord.gg") return url.pathname.split("/").filter(Boolean)[0] || null;
    if (host === "discord.com" || host === "www.discord.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      const index = parts.findIndex((part) => part === "invite");
      return index >= 0 ? parts[index + 1] || null : null;
    }
  } catch {
    return null;
  }
  return null;
}

async function getConfiguredDiscord(admin: any) {
  const { data } = await admin.from("app_settings").select("value").eq("key", "site_branding").maybeSingle();
  const inviteUrl = String(data?.value?.supportUrl || "https://discord.gg/zxmax").trim();
  const code = inviteCode(inviteUrl);
  if (!code) return { inviteUrl, guildId: null as string | null };

  const response = await fetch(`${DISCORD_API}/invites/${encodeURIComponent(code)}?with_counts=false&with_expiration=false`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return { inviteUrl, guildId: null as string | null };
  const payload = await response.json().catch(() => ({}));
  return { inviteUrl, guildId: payload?.guild?.id ? String(payload.guild.id) : null };
}

async function discordUser(providerToken: string) {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${providerToken}`, Accept: "application/json" },
  });
  if (!response.ok) return null;
  return await response.json().catch(() => null);
}

async function isGuildMember(providerToken: string, guildId: string) {
  let after = "";
  for (let page = 0; page < 5; page++) {
    const url = new URL(`${DISCORD_API}/users/@me/guilds`);
    url.searchParams.set("limit", "200");
    if (after) url.searchParams.set("after", after);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${providerToken}`, Accept: "application/json" },
    });
    if (!response.ok) return { ok: false, member: false, scopeError: response.status === 401 || response.status === 403 };

    const guilds = await response.json().catch(() => []);
    if (!Array.isArray(guilds)) return { ok: false, member: false, scopeError: false };
    if (guilds.some((guild: any) => String(guild?.id || "") === guildId)) {
      return { ok: true, member: true, scopeError: false };
    }
    if (guilds.length < 200) break;
    after = String(guilds[guilds.length - 1]?.id || "");
    if (!after) break;
  }
  return { ok: true, member: false, scopeError: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Faça login para continuar." }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const client = createClient(url, anonKey, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, serviceKey);

    const { data: authData, error: authError } = await client.auth.getUser(auth.slice(7));
    if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401);
    const user = authData.user;
    const emailConfirmed = Boolean((user as any).email_confirmed_at || (user as any).confirmed_at);

    const { data: role } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isAdmin = role === true;
    const configured = await getConfiguredDiscord(admin);

    const { data: profile } = await admin
      .from("profiles")
      .select("discord_user_id,discord_guild_id,discord_member_verified_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const membershipCurrent = Boolean(
      profile?.discord_member_verified_at &&
      profile?.discord_user_id &&
      configured.guildId &&
      String(profile.discord_guild_id || "") === configured.guildId
    );

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");

    if (action === "status") {
      return json({
        emailConfirmed,
        discordMember: isAdmin || membershipCurrent,
        isAdmin,
        inviteUrl: configured.inviteUrl,
        configured: Boolean(configured.guildId),
      });
    }

    if (action !== "verify") return json({ error: "Ação inválida." }, 400);
    if (!emailConfirmed && !isAdmin) return json({ error: "Confirme seu e-mail antes de verificar o Discord.", code: "email_unconfirmed" }, 403);
    if (isAdmin) return json({ verified: true, emailConfirmed: true, discordMember: true, isAdmin: true, inviteUrl: configured.inviteUrl });
    if (!configured.guildId) {
      return json({ error: "O servidor do Discord ainda não está configurado corretamente.", code: "discord_server_not_configured", inviteUrl: configured.inviteUrl }, 503);
    }

    const providerToken = String(body.providerToken || "").trim();
    if (!providerToken || providerToken.length > 4096) {
      return json({ error: "Autorize o Discord novamente para concluir a verificação.", code: "discord_oauth_required", inviteUrl: configured.inviteUrl }, 400);
    }

    const discord = await discordUser(providerToken);
    if (!discord?.id) {
      return json({ error: "Não foi possível validar sua conta do Discord. Autorize novamente.", code: "discord_oauth_invalid", inviteUrl: configured.inviteUrl }, 401);
    }

    // The Discord access token must belong to an identity actually linked to
    // the authenticated ZXMAX account. A random third-party token is rejected.
    const { data: fullUser } = await admin.auth.admin.getUserById(user.id);
    const linked = (fullUser?.user?.identities || []).some((identity: any) => {
      if (identity?.provider !== "discord") return false;
      const providerId = String(identity?.identity_data?.sub || identity?.identity_data?.id || "");
      return providerId === String(discord.id);
    });
    if (!linked) {
      return json({ error: "Esse Discord não está vinculado à sua conta ZXMAX.", code: "discord_identity_mismatch", inviteUrl: configured.inviteUrl }, 403);
    }

    const membership = await isGuildMember(providerToken, configured.guildId);
    if (!membership.ok) {
      return json({
        error: membership.scopeError
          ? "Autorize o acesso aos seus servidores do Discord e tente novamente."
          : "Não foi possível consultar o Discord agora.",
        code: membership.scopeError ? "discord_scope_required" : "discord_unavailable",
        inviteUrl: configured.inviteUrl,
      }, membership.scopeError ? 403 : 503);
    }

    if (!membership.member) {
      return json({
        verified: false,
        emailConfirmed: true,
        discordMember: false,
        code: "not_member",
        error: "Entre no servidor da ZXMAX e depois verifique novamente.",
        inviteUrl: configured.inviteUrl,
      });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        discord_user_id: String(discord.id),
        discord_guild_id: configured.guildId,
        discord_member_verified_at: now,
      })
      .eq("user_id", user.id);
    if (updateError) return json({ error: "Não foi possível salvar a verificação do Discord." }, 500);

    return json({
      verified: true,
      emailConfirmed: true,
      discordMember: true,
      discordUserId: String(discord.id),
      inviteUrl: configured.inviteUrl,
      verifiedAt: now,
    });
  } catch (error) {
    console.error("discord-membership", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível verificar o Discord agora." }, 500);
  }
});
