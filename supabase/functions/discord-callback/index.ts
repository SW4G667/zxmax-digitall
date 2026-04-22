import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, redirectUri } = await req.json();
    if (!code) throw new Error("Missing code parameter");

    const clientId = "1485093454517371070";
    const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET");
    if (!clientSecret) throw new Error("DISCORD_CLIENT_SECRET not configured");

    const finalRedirectUri = redirectUri || "https://zxmax-digital.lovable.app/";

    // Exchange code for access token
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
    if (tokenData.error) throw new Error(`Discord token error: ${tokenData.error_description || tokenData.error}`);

    // Get Discord user profile
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    if (!discordUser.id) throw new Error("Failed to fetch Discord user");

    // Use Supabase admin client to create/find user
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const email = discordUser.email || `discord_${discordUser.id}@zxmax.local`;
    const displayName = discordUser.global_name || discordUser.username || `Discord User ${discordUser.id}`;
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

    // Try to find existing user by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: any) => u.email === email || u.user_metadata?.discord_id === discordUser.id
    );

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      // Generate a magic link for login
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: existingUser.email!,
      });
      if (linkError) throw linkError;

      return new Response(JSON.stringify({
        success: true,
        access_token: linkData.properties?.hashed_token,
        token_type: "magiclink",
        user: { id: userId, email: existingUser.email, display_name: displayName, avatar_url: avatarUrl },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Create new user
      const password = crypto.randomUUID();
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          avatar_url: avatarUrl,
          discord_id: discordUser.id,
        },
      });
      if (createError) throw createError;
      userId = newUser.user.id;

      // Update profile with Discord info
      await supabaseAdmin.from("profiles").update({
        display_name: displayName,
        avatar_url: avatarUrl,
      }).eq("user_id", userId);

      // Generate magic link
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      if (linkError) throw linkError;

      return new Response(JSON.stringify({
        success: true,
        access_token: linkData.properties?.hashed_token,
        token_type: "magiclink",
        user: { id: userId, email, display_name: displayName, avatar_url: avatarUrl },
        password,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error: any) {
    console.error("Discord callback error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
