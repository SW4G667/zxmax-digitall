import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    let apiKey = Deno.env.get("EVOPAY_API_KEY");

    // Only admins can trigger payouts
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", claimsData.claims.sub)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem processar saques" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve API key: prefer admin-configured key (manual mode) over the secret
    try {
      const { data: setting } = await admin.from("app_settings").select("value").eq("key", "evopay").maybeSingle();
      if (setting?.value?.mode === "manual" && setting?.value?.apiKey) {
        apiKey = setting.value.apiKey;
      }
    } catch (_e) { /* fallback to secret */ }
    if (!apiKey) throw new Error("EVOPAY_API_KEY não configurada");

    const body = await req.json();
    const { amount, pixKey, pixType, description, clientReference } = body;
    const value = Number(amount);
    if (!value || value <= 0 || !pixKey || !pixType) {
      throw new Error("Dados incompletos para o saque (amount, pixKey, pixType)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const payload = {
      amount: value,
      pixKey,
      pixType,
      description: description || "Saque ZXMAX",
      callbackUrl: `${supabaseUrl}/functions/v1/evopay-webhook`,
      clientReference: String(clientReference ?? `withdraw_${Date.now()}`),
    };

    console.log("Creating EvoPay withdraw:", JSON.stringify(payload));

    const response = await fetch("https://api.evopay.cash/v1/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    console.log("EvoPay withdraw response", response.status, JSON.stringify(data));

    if (!response.ok) {
      const msg = data?.message || data?.error || "Erro ao processar saque";
      throw new Error(`EvoPay (${response.status}): ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    }

    return new Response(
      JSON.stringify({ id: data.id, status: data.status, amount: data.amount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("evopay-withdraw error:", error.message || error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido ao processar saque" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
