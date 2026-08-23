import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, redirectUri } = await req.json();

    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Missing code parameter" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Try to get Discord credentials from app_settings first (admin panel), fallback to env
    let clientId = Deno.env.get("DISCORD_CLIENT_ID") || "1485093454517371070";
    let clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET");
    
    try {
      const { data: discordSetting } = await adminClient.from("app_settings").select("value").eq("key", "discord").maybeSingle();
      if (discordSetting?.value?.clientId) clientId = discordSetting.value.clientId;
      if (discordSetting?.value?.clientSecret) clientSecret = discordSetting.value.clientSecret;
    } catch {}

    if (!clientSecret) {
      console.error("Discord secret not configured");
      return new Response(JSON.stringify({ success: false, error: "Discord não configurado no servidor. Configure em Admin → APIs & Credenciais ou secrets." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Allowlist - include vercel preview domains automatically
    const defaultAllows = "https://zxmax.vercel.app,https://zxmax-digitall.vercel.app,http://localhost:8080,http://127.0.0.1:8080,http://localhost:5173";
    const envAllows = Deno.env.get("DISCORD_ALLOWED_REDIRECTS") || defaultAllows;
    const allowedList = envAllows.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);

    const requested = (redirectUri || "").replace(/\/+$/, "");
    
    // Allow any *.vercel.app subdomain automatically (fix for preview deployments)
    const isVercelPreview = requested.includes(".vercel.app");
    let finalRedirectUri = requested;

    if (!isVercelPreview) {
      const exactMatch = allowedList.find((s) => s === requested);
      finalRedirectUri = exactMatch || "https://zxmax.vercel.app/";
      if (requested && finalRedirectUri.replace(/\/+$/, "") !== requested) {
        console.warn("Redirect URI not in allowlist, using default. Requested:", requested, "Allowed:", allowedList);
      }
    } else {
      console.log("Allowing Vercel preview redirect:", requested);
    }

    console.log("Exchanging Discord code, clientId:", clientId, "redirectUri:", finalRedirectUri);

    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: finalRedirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("Discord token status:", tokenRes.status, "data:", JSON.stringify(tokenData).slice(0, 500));

    if (!tokenRes.ok) {
      console.error("Discord token error", tokenData);
      throw new Error(`Discord: ${tokenData.error_description || tokenData.error || "Erro ao trocar code por token"} - Verifique se Redirect URI em https://discord.com/developers/applications/${clientId}/oauth2/general está igual a ${finalRedirectUri}`);
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

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const email = discordUser.email || `discord_${discordUser.id}@zxmax.local`;
    const displayName = discordUser.global_name || discordUser.username || `Discord ${discordUser.id}`;
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

    // Find existing user
    const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = allUsers?.find((u: any) => u.email === email || u.user_metadata?.discord_id === discordUser.id);

    if (existingUser) {
      const password = crypto.randomUUID();
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
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

      return new Response(JSON.stringify({
        success: true,
        password,
        user: { id: existingUser.id, email: existingUser.email, display_name: displayName, avatar_url: avatarUrl },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const password = crypto.randomUUID();
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName, avatar_url: avatarUrl, discord_id: discordUser.id },
      });
      if (createError) throw createError;

      const userId = newUser.user.id;
      await supabaseAdmin.from("profiles").update({ display_name: displayName, avatar_url: avatarUrl } as any).eq("user_id", userId);

      return new Response(JSON.stringify({
        success: true,
        password,
        user: { id: userId, email, display_name: displayName, avatar_url: avatarUrl },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error: any) {
    console.error("Discord callback error:", error.message);
    return new Response(JSON.stringify({ success: false, error: error.message, details: error.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
