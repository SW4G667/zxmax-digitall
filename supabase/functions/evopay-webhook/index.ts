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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let event: any = null;
  try {
    event = await req.json();
    console.log("EvoPay webhook received:", JSON.stringify(event));

    const status: string = event.status;
    const type: string = event.type;
    const clientReference: string | undefined = event.clientReference;
    const chargeId: string | undefined = event.id;
    const purchaseId = clientReference ? Number(clientReference) : NaN;

    let logStatus = status || "received";

    // Only act on completed deposits (cash-in)
    if (type === "DEPOSIT" && status === "COMPLETED" && clientReference && !Number.isNaN(purchaseId)) {
      // Fetch purchase + product to decide auto delivery
      const { data: purchase } = await admin
        .from("purchases")
        .select("id, product_id, status, messages, evopay_charge_id")
        .eq("id", purchaseId)
        .maybeSingle();

      if (purchase && purchase.status === "pending" && (!purchase.evopay_charge_id || purchase.evopay_charge_id === chargeId)) {
        const { data: product } = await admin
          .from("products")
          .select("delivery_type, sales")
          .eq("id", purchase.product_id)
          .maybeSingle();

        const { data: delivery } = await admin
          .from("product_delivery")
          .select("delivery_content")
          .eq("product_id", purchase.product_id)
          .maybeSingle();

        let newStatus = "paid";
        let messages = Array.isArray(purchase.messages) ? purchase.messages : [];

        if (product?.delivery_type === "auto" && delivery?.delivery_content) {
          newStatus = "delivered";
          messages = [
            ...messages,
            { from: "System", text: `📦 ENTREGA_AUTO: ${delivery.delivery_content}`, date: new Date().toISOString() },
          ];
        }

        await admin.from("purchases").update({ status: newStatus, messages }).eq("id", purchaseId);
        if (product) {
          await admin.from("products").update({ sales: (product.sales || 0) + 1 }).eq("id", purchase.product_id);
        }
        logStatus = newStatus;
        console.log(`Purchase ${purchaseId} marked as ${newStatus}`);
      } else {
        logStatus = purchase ? `ignored (already ${purchase.status})` : "ignored (purchase not found)";
      }
    }

    // Record the event for admin debugging
    await admin.from("webhook_logs").insert({
      source: "evopay",
      event_type: type || null,
      status: logStatus,
      order_id: Number.isNaN(purchaseId) ? null : purchaseId,
      charge_id: chargeId || null,
      payload: event,
      error: null,
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("evopay-webhook error:", error.message || error);
    try {
      await admin.from("webhook_logs").insert({
        source: "evopay",
        event_type: event?.type || null,
        status: "error",
        order_id: null,
        charge_id: event?.id || null,
        payload: event,
        error: error?.message || String(error),
      });
    } catch (_e) { /* ignore logging failure */ }
    // Always return 200 so EvoPay doesn't retry forever on parse issues
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
