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
    // Resolve API key: prefer admin-configured key (app_settings) when in manual mode, else secret
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    let apiKey = Deno.env.get("EVOPAY_API_KEY");
    try {
      const { data: setting } = await serviceClient.from("app_settings").select("value").eq("key", "evopay").maybeSingle();
      if (setting?.value?.mode === "manual" && setting?.value?.apiKey) {
        apiKey = setting.value.apiKey;
      }
    } catch (_e) { /* fallback to secret */ }
    if (!apiKey) throw new Error("EVOPAY_API_KEY não configurada");

    // Validate the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { purchaseId, productName, amount, buyerEmail, buyerName, buyerDocument } = body;

    const value = Number(amount);
    if (!productName || !value || value <= 0 || !buyerEmail) {
      throw new Error("Dados incompletos para a cobrança PIX");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/evopay-webhook`;

    const payload = {
      amount: value,
      callbackUrl,
      generatedName: buyerName || buyerEmail.split("@")[0],
      generatedEmail: buyerEmail,
      generatedDocument: (buyerDocument || "11144477735").replace(/\D/g, ""),
      expiresIn: 3600,
      clientReference: String(purchaseId ?? `order_${Date.now()}`),
    };

    console.log("Creating EvoPay PIX charge:", JSON.stringify(payload));

    const response = await fetch("https://api.evopay.cash/v1/pix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("EvoPay response", response.status, JSON.stringify(data));

    // Log the charge creation attempt for admin debugging
    try {
      await serviceClient.from("webhook_logs").insert({
        source: "evopay",
        event_type: "CREATE_PIX",
        status: response.ok ? "created" : `error_${response.status}`,
        order_id: purchaseId ? Number(purchaseId) : null,
        charge_id: data?.id || null,
        payload: data,
        error: response.ok ? null : (typeof (data?.message || data?.error) === "string" ? (data.message || data.error) : JSON.stringify(data)),
      });
    } catch (_e) { /* ignore logging failure */ }

    if (!response.ok) {
      const msg = data?.message || data?.error || "Erro ao criar cobrança PIX";
      throw new Error(`EvoPay (${response.status}): ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    }

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        amount: data.amount,
        qrCodeText: data.qrCodeText,
        qrCodeUrl: data.qrCodeUrl || (data.id ? `https://api.evopay.cash/v1/pix/qr-code/${data.id}` : null),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("create-evopay-pix error:", error.message || error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido ao criar cobrança" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
