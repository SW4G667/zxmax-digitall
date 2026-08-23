import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    // Discord credentials come from the admin panel (app_settings.discord) —
    // environment variables are only a fallback. Nothing is hardcoded here.
    const readDiscordSettings = async () => {
      let value: Record<string, any> = {};
      try {
        const { data } = await adminClient.from("app_settings").select("value").eq("key", "discord").maybeSingle();
        value = (data?.value as Record<string, any>) || {};
      } catch {}
      return {
        clientId: String(value.clientId || Deno.env.get("DISCORD_CLIENT_ID") || "").trim(),
        clientSecret: String(value.clientSecret || Deno.env.get("DISCORD_CLIENT_SECRET") || "").trim(),
        redirectUri: String(value.redirectUri || "").trim(),
        scopes: String(value.scopes || "identify email").trim(),
      };
    };

    // Public, read-only config for the login button (secret is NEVER returned).
    if (action === "config") {
      const cfg = await readDiscordSettings();
      return json({
        success: true,
        config: {
          clientId: cfg.clientId,
          redirectUri: cfg.redirectUri,
          scopes: cfg.scopes,
          configured: !!cfg.clientId,
        },
      });
    }

    const { code, redirectUri } = body;

    if (!code || typeof code !== "string") {
      return json({ success: false, error: "Missing code parameter" }, 400);
    }

    const cfg = await readDiscordSettings();

    // Mensagens claras quando falta credencial (pedido do admin).
    if (!cfg.clientId) {
      return json(
        { success: false, error: "Client ID do Discord não configurado. Cadastre em Admin → APIs & Credenciais (Discord OAuth)." },
        400
      );
    }
    if (!cfg.clientSecret) {
      return json(
        { success: false, error: "Client Secret do Discord não configurado. Cadastre em Admin → APIs & Credenciais (Discord OAuth)." },
        400
      );
    }

    // A redirect_uri da troca TEM que ser exatamente a mesma enviada na
    // autorização. O client manda a string exata que usou (salva no
    // sessionStorage); nunca reescrevemos para outro domínio — antes o servidor
    // trocava para o domínio padrão e o Discord respondia "invalid_grant".
    const finalRedirectUri = String(redirectUri || cfg.redirectUri || "").trim();
    if (!finalRedirectUri) {
      return json(
        { success: false, error: "Redirect URI do Discord não definida. Salve a Redirect URI em Admin → APIs & Credenciais." },
        400
      );
    }

    console.log("Exchanging Discord code, clientId:", cfg.clientId, "redirectUri:", finalRedirectUri);

    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: finalRedirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("Discord token status:", tokenRes.status, "data:", JSON.stringify(tokenData).slice(0, 500));

    if (!tokenRes.ok) {
      console.error("Discord token error", tokenData);
      const hint =
        tokenData.error === "invalid_grant"
          ? `Código expirado/já usado OU Redirect URI diferente da autorização. No Discord Developer Portal (oauth2), cadastre exatamente: ${finalRedirectUri}`
          : "";
      throw new Error(`Discord: ${tokenData.error_description || tokenData.error || "Erro ao trocar code por token"}${hint ? " — " + hint : ""}`);
    }

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(`Discord token error: ${tokenData.error_description || tokenData.error || "sem access_token"}`);
    }

    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    if (!userRes.ok || !discordUser.id) {
      console.error("Discord user fetch failed", discordUser);
      throw new Error(`Falha ao buscar usuário Discord: ${discordUser.message || "sem id"}`);
    }

    console.log("Discord user ok", discordUser.id, discordUser.username);

    const email = discordUser.email || `discord_${discordUser.id}@zxmax.local`;
    const displayName = discordUser.global_name || discordUser.username || `Discord ${discordUser.id}`;
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

    // Find existing user
    const { data: { users: allUsers }, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = allUsers?.find((u: any) => u.email === email || u.user_metadata?.discord_id === discordUser.id);

    if (existingUser) {
      const password = crypto.randomUUID();
      const { error: updErr } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        password,
        email_confirm: true,
        user_metadata: {
          ...(existingUser.user_metadata || {}),
          display_name: displayName,
          avatar_url: avatarUrl,
          discord_id: discordUser.id,
        },
      });
      if (updErr) throw updErr;

      return json({
        success: true,
        password,
        user: { id: existingUser.id, email: existingUser.email, display_name: displayName, avatar_url: avatarUrl },
      });
    } else {
      const password = crypto.randomUUID();
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName, avatar_url: avatarUrl, discord_id: discordUser.id },
      });
      if (createError) throw createError;

      const userId = newUser.user.id;
      await adminClient.from("profiles").update({ display_name: displayName, avatar_url: avatarUrl } as any).eq("user_id", userId);

      return json({
        success: true,
        password,
        user: { id: userId, email, display_name: displayName, avatar_url: avatarUrl },
      });
    }
  } catch (error: any) {
    console.error("Discord callback error:", error.message);
    return json({ success: false, error: error.message, details: error.toString() }, 400);
  }
});
