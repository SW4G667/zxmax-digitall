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
    console.log("Discord callback received with code:", code?.substring(0, 10) + "...");
    
    if (!code) {
      throw new Error("Missing code parameter");
    }

    const clientId = "1485093454517371070";
    const clientSecret = Deno.env.get("DISCORD_CLIENT_SECRET");
    if (!clientSecret) {
      console.error("DISCORD_CLIENT_SECRET not configured");
      throw new Error("DISCORD_CLIENT_SECRET not configured");
    }

    const finalRedirectUri = redirectUri || "https://zxmax-digital-uqwt.onrender.com/";
    console.log("Using redirect URI:", finalRedirectUri);

    // Exchange code for access token
    console.log("Exchanging code for Discord access token...");
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
    console.log("Discord token response status:", tokenRes.status);
    
    if (!tokenRes.ok) {
      console.error("Discord token error response:", tokenData);
      throw new Error(`Discord token error (${tokenRes.status}): ${tokenData.error_description || tokenData.error || "Unknown error"}`);
    }
    
    if (tokenData.error) {
      console.error("Discord token error:", tokenData);
      throw new Error(`Discord token error: ${tokenData.error_description || tokenData.error}`);
    }

    if (!tokenData.access_token) {
      console.error("No access token in response:", tokenData);
      throw new Error("No access token returned from Discord");
    }

    // Get Discord user profile
    console.log("Fetching Discord user profile...");
    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    
    const discordUser = await userRes.json();
    console.log("Discord user response status:", userRes.status);
    
    if (!userRes.ok) {
      console.error("Discord user fetch error:", discordUser);
      throw new Error(`Failed to fetch Discord user (${userRes.status}): ${discordUser.message || "Unknown error"}`);
    }

    if (!discordUser.id) {
      console.error("No Discord user ID in response:", discordUser);
      throw new Error("Failed to fetch Discord user ID");
    }

    console.log("Discord user fetched successfully:", discordUser.id);

    // Use Supabase admin client to create/find user
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase environment variables not configured");
      throw new Error("Supabase environment variables not configured");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const email = discordUser.email || `discord_${discordUser.id}@zxmax.local`;
    const displayName = discordUser.global_name || discordUser.username || `Discord User ${discordUser.id}`;
    const avatarUrl = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName)}`;

    console.log("Looking up user with email:", email);

    // Try to find existing user by email or Discord ID
    const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error("Error listing users:", listError);
      throw listError;
    }

    const existingUser = allUsers?.find(
      (u: any) => u.email === email || u.user_metadata?.discord_id === discordUser.id
    );

    if (existingUser) {
      console.log("Existing user found:", existingUser.id);
      const userId = existingUser.id;
      
      // Generate a session directly for existing user
      console.log("Generating magic link for existing user...");
      const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: existingUser.email!,
      });
      
      if (sessionError) {
        console.error("Error generating magic link:", sessionError);
        throw sessionError;
      }

      const sessionToken = sessionData.properties?.hashed_token || "";
      const sessionExpiresAt = sessionData.properties?.expires_at || new Date(Date.now() + 3600000).toISOString();

      console.log("Magic link generated successfully");
      return new Response(JSON.stringify({
        success: true,
        access_token: sessionToken,
        expires_at: sessionExpiresAt,
        token_type: "magiclink",
        user: { id: userId, email: existingUser.email, display_name: displayName, avatar_url: avatarUrl },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    } else {
      // Create new user with Discord info
      console.log("Creating new user with email:", email);
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
      
      if (createError) {
        console.error("Error creating user:", createError);
        throw createError;
      }
      
      const userId = newUser.user.id;
      console.log("New user created:", userId);

      // Update profile with Discord info
      console.log("Updating profile with Discord info...");
      const { error: updateError } = await supabaseAdmin.from("profiles").update({
        display_name: displayName,
        avatar_url: avatarUrl,
      }).eq("user_id", userId);
      
      if (updateError) {
        console.error("Error updating profile:", updateError);
        // Don't throw, continue anyway
      }

      console.log("New user setup completed successfully");
      return new Response(JSON.stringify({
        success: true,
        password,
        user: { id: userId, email, display_name: displayName, avatar_url: avatarUrl },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }
  } catch (error: any) {
    console.error("Discord callback error:", error.message || error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || "Unknown error occurred",
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 400 
      },
    );
  }
});
