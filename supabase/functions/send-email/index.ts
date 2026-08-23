import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface EmailPayload {
  type: "purchase_confirmed" | "new_sale";
  purchaseId: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "ZXMAX <noreply@zxmax.com.br>";
    const SITE_URL = Deno.env.get("SITE_URL") || "https://zxmax.vercel.app";

    if (!RESEND_API_KEY) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return json({ skipped: true, reason: "RESEND_API_KEY not configured" });
    }

    const body = (await req.json().catch(() => ({}))) as EmailPayload;
    const purchaseId = Number(body.purchaseId);
    const type = body.type || "purchase_confirmed";

    if (!purchaseId || Number.isNaN(purchaseId)) return json({ error: "purchaseId inválido" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: check if we already sent email for this purchase+type
    const { data: existingLog } = await admin
      .from("webhook_logs")
      .select("id")
      .eq("source", "email")
      .eq("event_type", type)
      .eq("order_id", purchaseId)
      .eq("status", "sent")
      .maybeSingle();

    if (existingLog) {
      console.log(`Email already sent for ${type} purchase ${purchaseId}`);
      return json({ already_sent: true });
    }

    const { data: purchase, error: purchaseErr } = await admin
      .from("purchases")
      .select("id, product_id, buyer_id, buyer_email, seller_id, seller_email, amount, status, variation_name")
      .eq("id", purchaseId)
      .maybeSingle();

    if (purchaseErr || !purchase) return json({ error: "Pedido não encontrado" }, 404);

    const { data: product } = await admin
      .from("products")
      .select("name, image")
      .eq("id", purchase.product_id)
      .maybeSingle();

    const productName = product?.name || `Produto #${purchase.product_id}`;
    const amount = Number(purchase.amount).toFixed(2);

    // Fetch profiles for names
    const { data: buyerProfile } = await admin
      .from("profiles")
      .select("display_name, email")
      .eq("user_id", purchase.buyer_id)
      .maybeSingle();

    const { data: sellerProfile } = await admin
      .from("profiles")
      .select("display_name, email")
      .eq("user_id", purchase.seller_id)
      .maybeSingle();

    let to: string;
    let subject: string;
    let html: string;
    const orderLink = `${SITE_URL.replace(/\/+$/, "")}/minhas-compras?order=${purchaseId}`;

    if (type === "purchase_confirmed") {
      to = purchase.buyer_email || buyerProfile?.email || "";
      if (!to) return json({ error: "Email do comprador não encontrado" }, 400);
      subject = `Pagamento confirmado - ${productName}`;
      html = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #f0f0f5; padding: 32px; border-radius: 16px;">
          <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 8px;">ZX<span style="color: #0084ff;">MAX</span></h1>
          <h2 style="font-size: 20px; font-weight: bold; margin: 24px 0 12px;">Pagamento confirmado! 🎉</h2>
          <p style="color: #a0a0b0; font-size: 14px; line-height: 1.6;">Seu pagamento de <strong style="color: #fff;">R$ ${amount}</strong> para <strong style="color: #fff;">${productName}</strong> foi confirmado.</p>
          ${purchase.variation_name ? `<p style="color: #a0a0b0; font-size: 13px;">Variação: ${purchase.variation_name}</p>` : ""}
          <div style="background: #15151f; border: 1px solid #23232f; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #a0a0b0;">Pedido #${purchaseId}</p>
            <p style="margin: 4px 0 0; font-size: 18px; font-weight: 900; color: #fff;">${productName}</p>
          </div>
          <a href="${orderLink}" style="display: inline-block; background: linear-gradient(135deg, #0084ff, #339dff); color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; margin-top: 12px;">Ver produto / chat</a>
          <p style="color: #606070; font-size: 12px; margin-top: 32px;">Este é um e-mail automático. Se você não reconhece esta compra, entre em contato com o suporte.</p>
        </div>
      `;
    } else {
      // new_sale for seller
      to = purchase.seller_email || sellerProfile?.email || "";
      if (!to) return json({ error: "Email do vendedor não encontrado" }, 400);
      subject = `Nova venda! - ${productName}`;
      html = `
        <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #f0f0f5; padding: 32px; border-radius: 16px;">
          <h1 style="font-size: 24px; font-weight: 900; margin-bottom: 8px;">ZX<span style="color: #0084ff;">MAX</span></h1>
          <h2 style="font-size: 20px; font-weight: bold; margin: 24px 0 12px;">Nova venda! 💰</h2>
          <p style="color: #a0a0b0; font-size: 14px; line-height: 1.6;">Você vendeu <strong style="color: #fff;">${productName}</strong> por <strong style="color: #fff;">R$ ${amount}</strong>.</p>
          ${purchase.variation_name ? `<p style="color: #a0a0b0; font-size: 13px;">Variação: ${purchase.variation_name}</p>` : ""}
          <p style="color: #a0a0b0; font-size: 13px;">Comprador: ${buyerProfile?.display_name || purchase.buyer_email}</p>
          <div style="background: #15151f; border: 1px solid #23232f; border-radius: 12px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #a0a0b0;">Pedido #${purchaseId}</p>
            <p style="margin: 4px 0 0; font-size: 18px; font-weight: 900; color: #fff;">${productName}</p>
          </div>
          <a href="${orderLink}" style="display: inline-block; background: linear-gradient(135deg, #00c950, #00e05a); color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: bold; font-size: 14px; margin-top: 12px;">Ir ao chat</a>
          <p style="color: #606070; font-size: 12px; margin-top: 32px;">Lembre-se de entregar o produto o mais rápido possível para manter sua reputação.</p>
        </div>
      `;
    }

    // Send via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
      }),
    });

    const resendData = await resendRes.json().catch(() => ({}));

    if (!resendRes.ok) {
      console.error("Resend error", resendRes.status, resendData);
      await admin.from("webhook_logs").insert({
        source: "email",
        event_type: type,
        status: `error_${resendRes.status}`,
        order_id: purchaseId,
        payload: { to, subject },
        error: JSON.stringify(resendData),
      });
      return json({ error: "Falha ao enviar email", details: resendData }, 400);
    }

    await admin.from("webhook_logs").insert({
      source: "email",
      event_type: type,
      status: "sent",
      order_id: purchaseId,
      charge_id: resendData.id || null,
      payload: { to, subject, resend_id: resendData.id },
      error: null,
    });

    console.log(`Email ${type} sent to ${to} for purchase ${purchaseId}`);

    return json({ sent: true, id: resendData.id });
  } catch (error: any) {
    console.error("send-email error", error.message || error);
    return json({ error: error.message || "Erro ao enviar email" }, 400);
  }
});
