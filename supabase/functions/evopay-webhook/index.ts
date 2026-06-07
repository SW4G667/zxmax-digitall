import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const event = await req.json();
    console.log("EvoPay webhook received:", JSON.stringify(event));

    const status: string = event.status;
    const type: string = event.type;
    const clientReference: string | undefined = event.clientReference;

    // Only act on completed deposits (cash-in)
    if (type === "DEPOSIT" && status === "COMPLETED" && clientReference) {
      const purchaseId = Number(clientReference);
      if (!Number.isNaN(purchaseId)) {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        // Fetch purchase + product to decide auto delivery
        const { data: purchase } = await admin
          .from("purchases")
          .select("id, product_id, status, messages")
          .eq("id", purchaseId)
          .maybeSingle();

        if (purchase && purchase.status === "pending") {
          const { data: product } = await admin
            .from("products")
            .select("delivery_type, delivery_content, sales")
            .eq("id", purchase.product_id)
            .maybeSingle();

          let newStatus = "paid";
          let messages = Array.isArray(purchase.messages) ? purchase.messages : [];

          if (product?.delivery_type === "auto" && product?.delivery_content) {
            newStatus = "delivered";
            messages = [
              ...messages,
              { from: "System", text: `📦 ENTREGA_AUTO: ${product.delivery_content}`, date: new Date().toISOString() },
            ];
          }

          await admin.from("purchases").update({ status: newStatus, messages }).eq("id", purchaseId);
          if (product) {
            await admin.from("products").update({ sales: (product.sales || 0) + 1 }).eq("id", purchase.product_id);
          }
          console.log(`Purchase ${purchaseId} marked as ${newStatus}`);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("evopay-webhook error:", error.message || error);
    // Always return 200 so EvoPay doesn't retry forever on parse issues
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
