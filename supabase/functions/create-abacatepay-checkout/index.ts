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
    console.log("AbacatePay checkout request received");
    
    const apiKey = Deno.env.get("ABACATEPAY_API_KEY");
    if (!apiKey) {
      console.error("ABACATEPAY_API_KEY not configured");
      throw new Error("ABACATEPAY_API_KEY não configurada");
    }
    
    console.log("API Key found, processing request...");

    const { productName, priceInCents, buyerEmail } = await req.json();
    console.log("Request data:", { productName, priceInCents, buyerEmail });
    
    if (!productName || !priceInCents || !buyerEmail) {
      console.error("Incomplete data:", { productName, priceInCents, buyerEmail });
      throw new Error("Dados incompletos para checkout");
    }

    const origin = req.headers.get("origin") || "https://zxmax-digital.lovable.app";
    console.log("Using origin:", origin);

    const payload: Record<string, unknown> = {
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
      customer: {
        email: buyerEmail,
        name: buyerEmail.split("@")[0],
        cellphone: "11999999999",
        taxId: "11144477735",
      },
    };

    console.log("Sending payload to AbacatePay:", JSON.stringify(payload, null, 2));

    const response = await fetch("https://api.abacatepay.com/v1/billing/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("AbacatePay response status:", response.status);
    
    const data = await response.json();
    console.log("AbacatePay response data:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error("AbacatePay API error:", data);
      const errorMessage = data.error?.message || data.error || data.message || "Erro ao criar cobrança AbacatePay";
      throw new Error(`AbacatePay Error (${response.status}): ${errorMessage}`);
    }

    const checkoutUrl = data.url || data.data?.url;
    if (!checkoutUrl) {
      console.error("No checkout URL in response:", data);
      throw new Error("Nenhuma URL de checkout retornada pela AbacatePay");
    }

    console.log("Checkout URL generated successfully:", checkoutUrl);
    
    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("AbacatePay checkout error:", error.message || error);
    console.error("Full error:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Erro desconhecido ao criar checkout",
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 400 
      },
    );
  }
});
