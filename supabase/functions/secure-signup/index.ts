import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESERVED_ADMIN_EMAIL = "admin@keybot.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Ambiente do Supabase nao configurado corretamente.");
    }

    const { email, password, displayName } = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(displayName || "").trim();

    if (!normalizedEmail || !password || !normalizedName) {
      return new Response(JSON.stringify({ error: "Dados incompletos para criar conta." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Se for o email de admin, criamos com email_confirm: true automaticamente
    const isSpecialAdmin = normalizedEmail === RESERVED_ADMIN_EMAIL;

    const { data, error } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: isSpecialAdmin, // Pula confirmação apenas para este email
      user_metadata: {
        display_name: normalizedName,
      },
    });

    if (error) {
      const message = error.message.includes("already registered")
        ? "Este email ja esta cadastrado. Faca login."
        : error.message;

      return new Response(JSON.stringify({ error: message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Se for o email especial, já promovemos a admin no banco
    if (isSpecialAdmin && data.user) {
      await supabase
        .from('users')
        .upsert({
          id: data.user.id,
          email: normalizedEmail,
          display_name: normalizedName,
          role: 'admin',
          updated_at: new Date().toISOString()
        });
    }

    return new Response(JSON.stringify({ success: true, skipVerification: isSpecialAdmin }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Secure signup error:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno ao criar conta.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
