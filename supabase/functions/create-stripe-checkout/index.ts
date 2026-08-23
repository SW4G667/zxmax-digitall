import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await anonClient.auth.getUser(token);
    if (!userData.user) throw new Error("Unauthorized");

    const body = await req.json();
    const purchaseId = Number(body.purchaseId);
    const amount = Number(body.amount);
    const paymentMethod = body.paymentMethod || "card"; // card, boleto, etc.

    if (!purchaseId || !amount || amount < 2) throw new Error("Dados inválidos");

    const { data: purchase } = await serviceClient.from("purchases").select("id, buyer_id, status").eq("id", purchaseId).maybeSingle();
    if (!purchase || purchase.buyer_id !== userData.user.id) throw new Error("Pedido não encontrado");
    if (purchase.status !== "pending") throw new Error("Pedido não está pendente");

    // Stripe credentials
    let secretKey = Deno.env.get("STRIPE_SECRET_KEY");
    try {
      const { data: setting } = await serviceClient.from("app_settings").select("value").eq("key", "stripe").maybeSingle();
      if (setting?.value?.secretKey) secretKey = setting.value.secretKey;
    } catch {}

    if (!secretKey) throw new Error("Stripe não configurado");

    // Create Stripe Checkout Session
    // Using Stripe API directly via fetch
    const siteUrl = Deno.env.get("SITE_URL") || "https://zxmax.vercel.app";
    
    const params = new URLSearchParams();
    params.append("payment_method_types[]", paymentMethod === "boleto" ? "boleto" : "card");
    params.append("line_items[0][price_data][currency]", "brl");
    params.append("line_items[0][price_data][product_data][name]", body.productName || `Pedido #${purchaseId}`);
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
    params.append("line_items[0][quantity]", "1");
    params.append("mode", "payment");
    params.append("success_url", `${siteUrl}/minhas-compras?order=${purchaseId}&payment=success`);
    params.append("cancel_url", `${siteUrl}/minhas-compras?order=${purchaseId}&payment=canceled`);
    params.append("client_reference_id", String(purchaseId));
    params.append("metadata[purchaseId]", String(purchaseId));

    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const stripeData = await stripeResp.json().catch(() => ({}));

    if (!stripeResp.ok) {
      console.error("Stripe error", stripeResp.status, stripeData);
      throw new Error(stripeData?.error?.message || "Erro ao criar checkout Stripe");
    }

    await serviceClient.from("webhook_logs").insert({
      source: "stripe",
      event_type: "CREATE_CHECKOUT",
      status: "created",
      order_id: purchaseId,
      charge_id: stripeData.id,
      payload: stripeData,
      error: null,
    });

    return new Response(JSON.stringify({
      success: true,
      id: stripeData.id,
      url: stripeData.url,
      amount,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("create-stripe-checkout error", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
