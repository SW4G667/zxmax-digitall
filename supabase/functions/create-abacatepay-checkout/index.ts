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
    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) throw new Error("ABACATEPAY_API_KEY não configurada");

    const { productName, priceInCents, buyerEmail } = await req.json();
    if (!productName || !priceInCents || !buyerEmail) {
      throw new Error("Dados incompletos para checkout");
    }

    const origin = req.headers.get("origin") || "https://zxmax-digital.lovable.app";

    const response = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        frequency: "ONE_TIME",
        methods: ["PIX"],
        products: [
          {
            externalId: `product_${Date.now()}`,
            name: productName,
            quantity: 1,
            price: priceInCents,
          },
        ],
        returnUrl: `${origin}/?payment=success`,
        completionUrl: `${origin}/?payment=success`,
        customerId: null,
        customer: {
          email: buyerEmail,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || "Erro ao criar cobrança AbacatePay");
    }

    return new Response(JSON.stringify({ url: data.url || data.data?.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("AbacatePay checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
