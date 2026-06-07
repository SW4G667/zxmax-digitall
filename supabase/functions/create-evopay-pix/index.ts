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
    const apiKey = Deno.env.get("EVOPAY_API_KEY");
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
