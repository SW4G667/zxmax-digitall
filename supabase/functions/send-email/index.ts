import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://zxmax.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type EmailType = "purchase_confirmed" | "new_sale" | "new_question";
type EmailPayload = { type: EmailType; purchaseId?: number; questionId?: number };

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const formatBRL = (value: unknown) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;

const shell = (eyebrow: string, title: string, copy: string, details: string, cta: string, href: string) => `
  <div style="margin:0;padding:32px 16px;background:#080b12;font-family:Arial,Helvetica,sans-serif;color:#edf3ff">
    <div style="max-width:600px;margin:0 auto;border:1px solid #253149;border-radius:22px;overflow:hidden;background:#101522">
      <div style="padding:26px 30px 22px;background:radial-gradient(circle at top right,#123f7f,transparent 52%),#111827">
        <div style="font-size:25px;line-height:1;font-weight:900;letter-spacing:-1.5px">ZX<span style="color:#168cff">MAX</span></div>
        <div style="margin-top:14px;color:#74b8ff;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">${escapeHtml(eyebrow)}</div>
        <h1 style="margin:8px 0 0;font-size:25px;line-height:1.2;color:#fff">${escapeHtml(title)}</h1>
      </div>
      <div style="padding:28px 30px 32px">
        <p style="margin:0;color:#b7c0d2;font-size:15px;line-height:1.6">${copy}</p>
        <div style="margin:22px 0;padding:18px;border-radius:14px;border:1px solid #26354d;background:#0b101a;color:#eaf2ff;font-size:14px;line-height:1.65">${details}</div>
        <a href="${escapeHtml(href)}" style="display:inline-block;border-radius:12px;background:#168cff;color:#fff;padding:14px 20px;text-decoration:none;font-size:14px;font-weight:800">${escapeHtml(cta)}</a>
        <p style="margin:27px 0 0;color:#718098;font-size:12px;line-height:1.55">Esta é uma notificação automática da ZXMAX. Seus dados de contato não são exibidos ao outro usuário.</p>
      </div>
    </div>
  </div>
`;

const paidStatus = new Set(["paid", "delivered", "delivered_pending_confirmation"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "ZXMAX <noreply@zxmax.com.br>";
  const SITE_URL = (Deno.env.get("SITE_URL") || "https://zxmax.vercel.app").replace(/\/+$/, "");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Serviço indisponível." }, 503);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const internalCall = Boolean(token && token === SERVICE_ROLE_KEY);
  let actorId: string | null = null;
  if (!internalCall) {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return json({ error: "Autenticação obrigatória." }, 401);
    actorId = data.user.id;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as EmailPayload;
    const type = body.type;
    if (!(["purchase_confirmed", "new_sale", "new_question"] as const).includes(type)) {
      return json({ error: "Tipo de notificação inválido." }, 400);
    }

    let logId: number;
    let recipient = "";
    let subject = "";
    let html = "";

    if (type === "new_question") {
      const questionId = Number(body.questionId);
      if (!Number.isInteger(questionId) || questionId <= 0) return json({ error: "Pergunta inválida." }, 400);
      const { data: question, error } = await admin
        .from("product_questions")
        .select("id, product_id, author_id, body, products!inner(name, seller_id, seller_email)")
        .eq("id", questionId)
        .maybeSingle();
      if (error || !question) return json({ error: "Pergunta não encontrada." }, 404);
      if (!internalCall && actorId !== question.author_id) return json({ error: "Sem permissão para esta notificação." }, 403);
      const product = Array.isArray((question as any).products) ? (question as any).products[0] : (question as any).products;
      if (!product?.seller_id) return json({ error: "Anúncio inválido." }, 400);
      const { data: sellerProfile } = await admin.from("profiles").select("email").eq("user_id", product.seller_id).maybeSingle();
      recipient = product.seller_email || sellerProfile?.email || "";
      if (!recipient) return json({ error: "Destinatário indisponível." }, 409);
      logId = questionId;
      subject = `Nova pergunta sobre ${escapeHtml(product.name)}`;
      html = shell(
        "Nova pergunta",
        "Você recebeu uma nova pergunta",
        `Um interessado enviou uma pergunta sobre <strong style="color:#fff">${escapeHtml(product.name)}</strong>. Responda dentro da ZXMAX para manter a negociação protegida.`,
        `<strong style="color:#fff">Produto</strong><br>${escapeHtml(product.name)}<br><br><strong style="color:#fff">Pergunta</strong><br>${escapeHtml(question.body)}`,
        "Responder pergunta",
        `${SITE_URL}/produto/${question.product_id}#perguntas`,
      );
    } else {
      const purchaseId = Number(body.purchaseId);
      if (!Number.isInteger(purchaseId) || purchaseId <= 0) return json({ error: "Pedido inválido." }, 400);
      const { data: purchase, error } = await admin
        .from("purchases")
        .select("id, product_id, buyer_id, buyer_email, seller_id, seller_email, amount, status, variation_name")
        .eq("id", purchaseId)
        .maybeSingle();
      if (error || !purchase) return json({ error: "Pedido não encontrado." }, 404);
      if (!internalCall && actorId !== purchase.buyer_id && actorId !== purchase.seller_id) return json({ error: "Sem permissão para esta notificação." }, 403);
      if (!paidStatus.has(String(purchase.status))) return json({ error: "O pagamento ainda não foi confirmado." }, 409);
      const { data: product } = await admin.from("products").select("name").eq("id", purchase.product_id).maybeSingle();
      const productName = product?.name || `Produto #${purchase.product_id}`;
      const { data: buyerProfile } = await admin.from("profiles").select("email").eq("user_id", purchase.buyer_id).maybeSingle();
      const { data: sellerProfile } = await admin.from("profiles").select("email").eq("user_id", purchase.seller_id).maybeSingle();
      recipient = type === "purchase_confirmed"
        ? (purchase.buyer_email || buyerProfile?.email || "")
        : (purchase.seller_email || sellerProfile?.email || "");
      if (!recipient) return json({ error: "Destinatário indisponível." }, 409);
      logId = purchaseId;
      const variation = purchase.variation_name ? `<br><span style="color:#9eacc4">Variação: ${escapeHtml(purchase.variation_name)}</span>` : "";
      const details = `<strong style="color:#fff">${escapeHtml(productName)}</strong>${variation}<br><br><span style="color:#9eacc4">Valor confirmado</span><br><strong style="font-size:18px;color:#fff">${formatBRL(purchase.amount)}</strong>`;
      if (type === "purchase_confirmed") {
        subject = `Pagamento confirmado — ${productName}`;
        html = shell("Pagamento confirmado", "Seu pedido está protegido", `O pagamento do seu pedido foi confirmado. Acompanhe a entrega e converse pelo chat seguro da ZXMAX.`, details, "Abrir pedido e chat", `${SITE_URL}/minhas-compras?order=${purchaseId}`);
      } else {
        subject = `Nova venda — ${productName}`;
        html = shell("Nova venda", "Você realizou uma venda", `O pagamento foi confirmado e o pedido está pronto para atendimento dentro da ZXMAX.`, details, "Ir ao chat do pedido", `${SITE_URL}/minhas-compras?order=${purchaseId}`);
      }
    }

    const { data: previous } = await admin.from("webhook_logs")
      .select("id")
      .eq("source", "email")
      .eq("event_type", type)
      .eq("order_id", logId)
      .eq("status", "sent")
      .maybeSingle();
    if (previous) return json({ already_sent: true });

    if (!RESEND_API_KEY) return json({ skipped: true, reason: "email_provider_not_configured" }, 202);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [recipient], subject, html }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      await admin.from("webhook_logs").insert({ source: "email", event_type: type, status: `error_${response.status}`, order_id: logId, payload: { recipient: type === "new_sale" || type === "new_question" ? "seller" : "buyer", subject }, error: "provider_rejected" });
      return json({ error: "Não foi possível entregar a notificação." }, 502);
    }
    await admin.from("webhook_logs").insert({ source: "email", event_type: type, status: "sent", order_id: logId, charge_id: result.id || null, payload: { recipient: type === "new_sale" || type === "new_question" ? "seller" : "buyer", subject, resend_id: result.id || null }, error: null });
    return json({ sent: true, id: result.id });
  } catch (error) {
    console.error("send-email failure", error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível processar a notificação." }, 500);
  }
});
