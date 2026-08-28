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

type EmailType = "purchase_confirmed" | "new_sale" | "new_question" | "product_approved" | "product_rejected" | "product_removed";
type EmailPayload = {
  type: EmailType;
  purchaseId?: number;
  questionId?: number;
  productId?: number;
  moderationKey?: string;
  reason?: string;
  productName?: string;
  sellerId?: string;
};

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const formatBRL = (value: unknown) => `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;

const shell = (eyebrow: string, title: string, copy: string, details: string, cta: string, href: string) => `
  <div style="margin:0;padding:0;width:100%;background:#070b13;font-family:Arial,Helvetica,sans-serif;color:#edf3ff">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(`${eyebrow} · ${title}`)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;padding:32px 16px;background:radial-gradient(circle at 100% 0,#0b376e 0,transparent 34%),#070b13">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;overflow:hidden;border:1px solid #26354d;border-radius:22px;background:#101722">
          <tr><td style="padding:28px 30px 24px;background:linear-gradient(135deg,#111a2b,#0c1420 58%,#102d56)">
            <div style="font-size:26px;line-height:1;font-weight:900;letter-spacing:-1.5px;color:#ffffff">ZX<span style="color:#1f91ff">MAX</span></div>
            <div style="display:inline-block;margin-top:18px;border:1px solid #1e5f9f;border-radius:999px;padding:7px 10px;background:#0d2540;color:#81c4ff;font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:12px 0 0;color:#ffffff;font-size:26px;line-height:1.2;letter-spacing:-.4px">${escapeHtml(title)}</h1>
          </td></tr>
          <tr><td style="padding:30px">
            <p style="margin:0;color:#c3cede;font-size:15px;line-height:1.7">${copy}</p>
            <div style="margin:24px 0;border:1px solid #273955;border-radius:14px;background:#0a101a;padding:18px;color:#edf3ff;font-size:14px;line-height:1.7">${details}</div>
            <a href="${escapeHtml(href)}" aria-label="${escapeHtml(cta)}" style="display:inline-block;border-radius:12px;background:#168cff;color:#ffffff;padding:14px 20px;text-decoration:none;font-size:14px;font-weight:800">${escapeHtml(cta)} <span aria-hidden="true">→</span></a>
            <div style="margin-top:28px;border-top:1px solid #26354d;padding-top:18px;color:#8696ad;font-size:12px;line-height:1.6">Esta é uma notificação automática da ZXMAX. Seus dados de contato não são exibidos ao outro usuário. Para sua segurança, conclua qualquer ação somente dentro da plataforma.</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>
`;

const paidStatus = new Set(["paid", "delivered", "delivered_pending_confirmation"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const EMAIL_FROM = String(Deno.env.get("EMAIL_FROM") || "").trim();
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
    if (!(["purchase_confirmed", "new_sale", "new_question", "product_approved", "product_rejected", "product_removed"] as const).includes(type)) {
      return json({ error: "Tipo de notificação inválido." }, 400);
    }
    // Payment confirmation and sale notices originate only after a verified
    // provider webhook. A buyer or seller must not be able to resend them.
    if ((type === "purchase_confirmed" || type === "new_sale" || type === "product_approved" || type === "product_rejected" || type === "product_removed") && !internalCall) {
      return json({ error: "Este tipo de notificação é processado pelo servidor." }, 403);
    }

    let logId: number;
    let recipient = "";
    let subject = "";
    let html = "";
    let text = "";
    let idempotencyKey: string | null = null;

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
      subject = `Nova pergunta sobre ${String(product.name || "seu produto")}`;
      html = shell(
        "Nova pergunta",
        "Você recebeu uma nova pergunta",
        `Um interessado enviou uma pergunta sobre <strong style="color:#fff">${escapeHtml(product.name)}</strong>. Responda dentro da ZXMAX para manter a negociação protegida.`,
        `<strong style="color:#fff">Produto</strong><br>${escapeHtml(product.name)}<br><br><strong style="color:#fff">Pergunta</strong><br>${escapeHtml(question.body)}`,
        "Responder pergunta",
        `${SITE_URL}/produto/${question.product_id}#perguntas`,
      );
      text = `Nova pergunta sobre ${String(product.name || "seu produto")}\n\nPergunta: ${String(question.body || "")}\n\nResponda dentro da ZXMAX: ${SITE_URL}/produto/${question.product_id}#perguntas`;
    } else if (type === "product_approved" || type === "product_rejected" || type === "product_removed") {
      const productId = Number(body.productId);
      const moderationKey = String(body.moderationKey || "").trim().slice(0, 200);
      const reason = String(body.reason || "").trim().replace(/\s+/g, " ").slice(0, 500);
      if (!Number.isInteger(productId) || productId <= 0 || !moderationKey) return json({ error: "Notificação de moderação inválida." }, 400);
      if ((type === "product_rejected" || type === "product_removed") && reason.length < 3) return json({ error: "Motivo de moderação inválido." }, 400);
      const { data: product, error } = type === "product_removed"
        ? { data: { name: String(body.productName || "").trim().slice(0, 160), seller_id: String(body.sellerId || "").trim() }, error: null }
        : await admin.from("products").select("id, name, seller_id").eq("id", productId).maybeSingle();
      if (error || !product?.seller_id || !product?.name) return json({ error: "Anúncio não encontrado." }, 404);
      const { data: sellerProfile } = await admin.from("profiles").select("email").eq("user_id", product.seller_id).maybeSingle();
      recipient = sellerProfile?.email || "";
      if (!recipient) return json({ error: "Destinatário indisponível." }, 409);
      logId = productId;
      idempotencyKey = moderationKey;
      const productName = String(product.name || "seu anúncio");
      const approved = type === "product_approved";
      const removed = type === "product_removed";
      subject = `${approved ? "Anúncio aprovado" : removed ? "Anúncio retirado" : "Anúncio reprovado"} — ${productName}`;
      const details = approved
        ? `<strong style="color:#fff">Produto</strong><br>${escapeHtml(productName)}<br><br><strong style="color:#fff">Status</strong><br><span style="color:#83efb6">Aprovado e disponível na vitrine</span>`
        : `<strong style="color:#fff">Produto</strong><br>${escapeHtml(productName)}<br><br><strong style="color:#fff">Motivo informado pela moderação</strong><br>${escapeHtml(reason)}`;
      html = shell(
        approved ? "Anúncio aprovado" : removed ? "Anúncio retirado" : "Anúncio reprovado",
        approved ? "Seu anúncio foi aprovado" : removed ? "Seu anúncio foi retirado" : "Seu anúncio precisa de ajustes",
        approved
          ? "Sua publicação passou pela revisão e já pode ser encontrada na ZXMAX."
          : removed ? "Uma revisão administrativa retirou este anúncio da vitrine. Consulte o motivo e ajuste a publicação antes de reenviá-la."
          : "Seu anúncio foi retirado da vitrine. Ajuste o que for necessário e publique novamente quando estiver de acordo com as regras.",
        details,
        approved ? "Ver meus anúncios" : "Revisar meus anúncios",
        `${SITE_URL}/minhas-compras?scope=sales`,
      );
      text = approved
        ? `Seu anúncio foi aprovado.\n\nProduto: ${productName}\nStatus: aprovado e disponível na vitrine.\n\nAcesse seus anúncios: ${SITE_URL}/minhas-compras?scope=sales`
        : `Seu anúncio foi ${removed ? "retirado" : "reprovado"}.\n\nProduto: ${productName}\nMotivo: ${reason}\n\nRevise seus anúncios: ${SITE_URL}/minhas-compras?scope=sales`;
    } else {
      const purchaseId = Number(body.purchaseId);
      if (!Number.isInteger(purchaseId) || purchaseId <= 0) return json({ error: "Pedido inválido." }, 400);
      const { data: purchase, error } = await admin
        .from("purchases")
        .select("id, product_id, buyer_id, buyer_email, seller_id, seller_email, amount, status, variation_name")
        .eq("id", purchaseId)
        .maybeSingle();
      if (error || !purchase) return json({ error: "Pedido não encontrado." }, 404);
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
        text = `Pagamento confirmado\n\nProduto: ${productName}${purchase.variation_name ? `\nVariação: ${purchase.variation_name}` : ""}\nValor confirmado: ${formatBRL(purchase.amount)}\n\nAcompanhe o pedido: ${SITE_URL}/minhas-compras?order=${purchaseId}`;
      } else {
        subject = `Nova venda — ${productName}`;
        html = shell("Nova venda", "Você realizou uma venda", `O pagamento foi confirmado e o pedido está pronto para atendimento dentro da ZXMAX.`, details, "Ir ao chat do pedido", `${SITE_URL}/minhas-compras?order=${purchaseId}`);
        text = `Nova venda\n\nProduto: ${productName}${purchase.variation_name ? `\nVariação: ${purchase.variation_name}` : ""}\nValor confirmado: ${formatBRL(purchase.amount)}\n\nAcesse o pedido: ${SITE_URL}/minhas-compras?order=${purchaseId}`;
      }
    }

    let previousQuery = admin.from("webhook_logs")
      .select("id")
      .eq("source", "email")
      .eq("event_type", type)
      .eq("order_id", logId)
      .eq("status", "sent");
    if (idempotencyKey) previousQuery = previousQuery.eq("charge_id", idempotencyKey);
    const { data: previous } = await previousQuery.limit(1).maybeSingle();
    if (previous) return json({ already_sent: true });

    if (!RESEND_API_KEY) return json({ skipped: true, reason: "email_provider_not_configured" }, 202);
    if (!EMAIL_FROM) return json({ skipped: true, reason: "email_sender_not_configured" }, 202);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [recipient], subject, html, text }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      await admin.from("webhook_logs").insert({ source: "email", event_type: type, status: `error_${response.status}`, order_id: logId, charge_id: idempotencyKey, payload: { recipient: type === "new_sale" || type === "new_question" || type === "product_approved" || type === "product_rejected" || type === "product_removed" ? "seller" : "buyer", subject }, error: "provider_rejected" });
      return json({ error: "Não foi possível entregar a notificação." }, 502);
    }
    await admin.from("webhook_logs").insert({ source: "email", event_type: type, status: "sent", order_id: logId, charge_id: idempotencyKey || result.id || null, payload: { recipient: type === "new_sale" || type === "new_question" || type === "product_approved" || type === "product_rejected" || type === "product_removed" ? "seller" : "buyer", subject, resend_id: result.id || null }, error: null });
    return json({ sent: true, id: result.id });
  } catch (error) {
    console.error("send-email failure", error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível processar a notificação." }, 500);
  }
});
