import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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
    const abacateApiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!abacateApiKey) {
      throw new Error("ABACATEPAY_API_KEY nao configurada");
    }

    const { productName, priceInCents, buyerEmail, productId } = await req.json();

    if (!productName || !priceInCents || !buyerEmail) {
      throw new Error("Dados incompletos para checkout");
    }

    const origin = req.headers.get("origin") || "https://zxmax-digital.lovable.app";

    // Chamada para a API do AbacatePay
    const response = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${abacateApiKey}`,
      },
      body: JSON.stringify({
        frequency: "ONE_TIME",
        methods: ["PIX"],
        products: [
          {
            externalId: productId || "prod_1",
            name: productName,
            quantity: 1,
            unitPrice: priceInCents, // AbacatePay usa centavos
          },
        ],
        returnUrl: `${origin}/?payment=success`,
        completionUrl: `${origin}/?payment=success`,
        customerId: buyerEmail, // Opcional, mas util
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("AbacatePay error response:", data);
      throw new Error(data.message || "Erro ao criar cobranca no AbacatePay");
    }

    return new Response(JSON.stringify({ url: data.data.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
