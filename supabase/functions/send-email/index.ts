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

type EmailType = "purchase_created" | "purchase_confirmed" | "new_sale" | "delivery_marked" | "receipt_confirmed_buyer" | "receipt_confirmed_seller" | "refund_buyer" | "refund_seller" | "dispute_opened_buyer" | "dispute_opened_seller" | "dispute_resolved_buyer" | "dispute_resolved_seller" | "new_question" | "new_review" | "product_approved" | "product_rejected" | "product_removed";
type EmailPayload = {
  type: EmailType;
  purchaseId?: number;
  questionId?: number;
  reviewId?: number;
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

type Branding = { siteName: string; logoUrl: string; supportUrl: string };

const safeHttpsUrl = (value: unknown) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const shell = (branding: Branding, eyebrow: string, title: string, copy: string, details: string, cta: string, href: string) => `
  <div style="margin:0;padding:0;width:100%;background:#070b13;font-family:Arial,Helvetica,sans-serif;color:#edf3ff">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(`${eyebrow} · ${title}`)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;padding:32px 16px;background:radial-gradient(circle at 100% 0,#0b376e 0,transparent 34%),#070b13">
      <tr><td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;overflow:hidden;border:1px solid #26354d;border-radius:22px;background:#101722">
          <tr><td style="padding:28px 30px 24px;background:linear-gradient(135deg,#111a2b,#0c1420 58%,#102d56)">
            ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.siteName)}" width="150" style="display:block;max-width:150px;height:auto;border:0;outline:none;text-decoration:none" />` : `<div style="font-size:26px;line-height:1;font-weight:900;letter-spacing:-1.2px;color:#ffffff">${escapeHtml(branding.siteName)}</div>`}
            <div style="display:inline-block;margin-top:18px;border:1px solid #1e5f9f;border-radius:999px;padding:7px 10px;background:#0d2540;color:#81c4ff;font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase">${escapeHtml(eyebrow)}</div>
            <h1 style="margin:12px 0 0;color:#ffffff;font-size:26px;line-height:1.2;letter-spacing:-.4px">${escapeHtml(title)}</h1>
          </td></tr>
          <tr><td style="padding:30px">
            <p style="margin:0;color:#c3cede;font-size:15px;line-height:1.7">${copy}</p>
            <div style="margin:24px 0;border:1px solid #273955;border-radius:14px;background:#0a101a;padding:18px;color:#edf3ff;font-size:14px;line-height:1.7">${details}</div>
            <a href="${escapeHtml(href)}" aria-label="${escapeHtml(cta)}" style="display:inline-block;border-radius:12px;background:#168cff;color:#ffffff;padding:14px 20px;text-decoration:none;font-size:14px;font-weight:800">${escapeHtml(cta)} <span aria-hidden="true">→</span></a>
            <div style="margin-top:28px;border-top:1px solid #26354d;padding-top:18px;color:#8696ad;font-size:12px;line-height:1.6">Esta é uma notificação automática da ${escapeHtml(branding.siteName)}. Seus dados de contato não são exibidos ao outro usuário. Para sua segurança, conclua qualquer ação somente dentro da plataforma.${branding.supportUrl ? ` <a href="${escapeHtml(branding.supportUrl)}" style="color:#81c4ff;text-decoration:none">Precisa de ajuda?</a>` : ""}</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>
`;

const paidStatus = new Set(["paid", "delivered", "delivered_pending_confirmation"]);
const sellerRecipientTypes = new Set<EmailType>(["new_sale", "receipt_confirmed_seller", "refund_seller", "dispute_opened_seller", "dispute_resolved_seller"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  const EMAIL_FROM = String(Deno.env.get("EMAIL_FROM") || "").trim();
  const EMAIL_REPLY_TO = String(Deno.env.get("EMAIL_REPLY_TO") || "ZXMAX-DIGITAL@proton.me").trim();
  const SITE_URL = (Deno.env.get("SITE_URL") || "https://zxmax.vercel.app").replace(/\/+$/, "");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Serviço indisponível." }, 503);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: brandingRow } = await admin.from("app_settings").select("value").eq("key", "site_branding").maybeSingle();
  const brandingValue = (brandingRow?.value && typeof brandingRow.value === "object" ? brandingRow.value : {}) as Record<string, unknown>;
  const branding: Branding = {
    siteName: String(brandingValue.siteName || "ZXMAX").trim().slice(0, 80) || "ZXMAX",
    logoUrl: safeHttpsUrl(brandingValue.logoUrl),
    supportUrl: safeHttpsUrl(brandingValue.supportUrl),
  };
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
    if (!(["purchase_created", "purchase_confirmed", "new_sale", "delivery_marked", "receipt_confirmed_buyer", "receipt_confirmed_seller", "refund_buyer", "refund_seller", "dispute_opened_buyer", "dispute_opened_seller", "dispute_resolved_buyer", "dispute_resolved_seller", "new_question", "new_review", "product_approved", "product_rejected", "product_removed"] as const).includes(type)) {
      return json({ error: "Tipo de notificação inválido." }, 400);
    }
    // Payment confirmation and sale notices originate only after a verified
    // provider webhook. A buyer or seller must not be able to resend them.
    if (type !== "new_question" && !internalCall) {
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
        branding,
        "Nova pergunta",
        "Você recebeu uma nova pergunta",
        `Um interessado enviou uma pergunta sobre <strong style="color:#fff">${escapeHtml(product.name)}</strong>. Responda dentro da ${escapeHtml(branding.siteName)} para manter a negociação protegida.`,
        `<strong style="color:#fff">Produto</strong><br>${escapeHtml(product.name)}<br><br><strong style="color:#fff">Pergunta</strong><br>${escapeHtml(question.body)}`,
        "Responder pergunta",
        `${SITE_URL}/produto/${question.product_id}#perguntas`,
      );
      text = `Nova pergunta sobre ${String(product.name || "seu produto")}\n\nPergunta: ${String(question.body || "")}\n\nResponda dentro da ${branding.siteName}: ${SITE_URL}/produto/${question.product_id}#perguntas`;
    } else if (type === "new_review") {
      const reviewId = Number(body.reviewId);
      if (!Number.isInteger(reviewId) || reviewId <= 0) return json({ error: "Avaliação inválida." }, 400);
      const { data: review, error } = await admin
        .from("product_reviews")
        .select("id, product_id, seller_id, stars, comment, products!inner(name)")
        .eq("id", reviewId)
        .maybeSingle();
      if (error || !review?.seller_id) return json({ error: "Avaliação não encontrada." }, 404);
      const product = Array.isArray((review as any).products) ? (review as any).products[0] : (review as any).products;
      const { data: sellerProfile } = await admin.from("profiles").select("email").eq("user_id", review.seller_id).maybeSingle();
      recipient = sellerProfile?.email || "";
      if (!recipient) return json({ error: "Destinatário indisponível." }, 409);
      logId = reviewId;
      const productName = String(product?.name || `Produto #${review.product_id}`);
      const stars = Math.max(1, Math.min(5, Number(review.stars || 0)));
      const starsLabel = "★".repeat(stars) + "☆".repeat(5 - stars);
      subject = `Nova avaliação recebida — ${productName}`;
      html = shell(
        branding,
        "Nova avaliação",
        "Seu produto recebeu uma avaliação",
        `Um comprador avaliou <strong style="color:#fff">${escapeHtml(productName)}</strong>. Acompanhe sua reputação diretamente pela plataforma.`,
        `<strong style="color:#fff">Produto</strong><br>${escapeHtml(productName)}<br><br><strong style="color:#fff">Nota</strong><br><span style="font-size:20px;color:#ffcc66;letter-spacing:2px">${escapeHtml(starsLabel)}</span><br><br><strong style="color:#fff">Comentário</strong><br>${escapeHtml(review.comment || "Sem comentário.")}`,
        "Ver avaliações",
        `${SITE_URL}/produto/${review.product_id}#avaliacoes`,
      );
      text = `Nova avaliação recebida\n\nProduto: ${productName}\nNota: ${stars}/5\nComentário: ${String(review.comment || "Sem comentário.")}\n\nVer avaliações: ${SITE_URL}/produto/${review.product_id}#avaliacoes`;
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
        branding,
        approved ? "Anúncio aprovado" : removed ? "Anúncio retirado" : "Anúncio reprovado",
        approved ? "Seu anúncio foi aprovado" : removed ? "Seu anúncio foi retirado" : "Seu anúncio precisa de ajustes",
        approved
          ? `Sua publicação passou pela revisão e já pode ser encontrada na ${escapeHtml(branding.siteName)}.`
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
        .select("id, product_id, buyer_id, buyer_email, seller_id, seller_email, amount, status, variation_name, payment_provider, payment_status")
        .eq("id", purchaseId)
        .maybeSingle();
      if (error || !purchase) return json({ error: "Pedido não encontrado." }, 404);

      const allowedStatuses: Partial<Record<EmailType, Set<string>>> = {
        purchase_created: new Set(["pending", "paid", "delivered_pending_confirmation", "delivered", "dispute"]),
        purchase_confirmed: paidStatus,
        new_sale: paidStatus,
        delivery_marked: new Set(["delivered_pending_confirmation", "delivered", "dispute"]),
        receipt_confirmed_buyer: new Set(["delivered"]),
        receipt_confirmed_seller: new Set(["delivered"]),
        refund_buyer: new Set(["refunded"]),
        refund_seller: new Set(["refunded"]),
        dispute_opened_buyer: new Set(["dispute"]),
        dispute_opened_seller: new Set(["dispute"]),
        dispute_resolved_buyer: new Set(["paid", "delivered"]),
        dispute_resolved_seller: new Set(["paid", "delivered"]),
      };
      const allowed = allowedStatuses[type];
      if (!allowed?.has(String(purchase.status))) return json({ error: "O status atual do pedido não permite esta notificação." }, 409);

      const { data: product } = await admin.from("products").select("name").eq("id", purchase.product_id).maybeSingle();
      const productName = product?.name || `Produto #${purchase.product_id}`;
      const { data: buyerProfile } = await admin.from("profiles").select("email").eq("user_id", purchase.buyer_id).maybeSingle();
      const { data: sellerProfile } = await admin.from("profiles").select("email").eq("user_id", purchase.seller_id).maybeSingle();
      const sellerRecipient = sellerRecipientTypes.has(type);
      recipient = sellerRecipient
        ? (purchase.seller_email || sellerProfile?.email || "")
        : (purchase.buyer_email || buyerProfile?.email || "");
      if (!recipient) return json({ error: "Destinatário indisponível." }, 409);
      logId = purchaseId;

      const variation = purchase.variation_name
        ? `<br><span style="color:#9eacc4">Variação: ${escapeHtml(purchase.variation_name)}</span>`
        : "";
      const amountLabel = type === "purchase_created" ? "Valor do pedido" : "Valor confirmado";
      const details = `<strong style="color:#fff">${escapeHtml(productName)}</strong>${variation}<br><br><span style="color:#9eacc4">Pedido</span><br><strong style="color:#fff">#${purchaseId}</strong><br><br><span style="color:#9eacc4">${amountLabel}</span><br><strong style="font-size:18px;color:#fff">${formatBRL(purchase.amount)}</strong>`;
      const orderUrl = `${SITE_URL}/minhas-compras?order=${purchaseId}`;

      if (type === "purchase_created") {
        subject = `Pedido #${purchaseId} criado — ${productName}`;
        html = shell(
        branding,
          "Pedido criado",
          "Seu pedido foi reservado",
          `O pedido foi criado e está aguardando a confirmação do pagamento. Use somente a cobrança exibida dentro da ${escapeHtml(branding.siteName)}.`,
          details,
          "Continuar pagamento",
          orderUrl,
        );
        text = `Pedido #${purchaseId} criado\n\nProduto: ${productName}\nValor: ${formatBRL(purchase.amount)}\nStatus: aguardando pagamento.\n\nContinue pela ${branding.siteName}: ${orderUrl}`;
      } else if (type === "purchase_confirmed") {
        subject = `Pagamento confirmado — ${productName}`;
        html = shell(
        branding,
          "Pagamento confirmado",
          "Seu pedido está protegido",
          "O pagamento foi confirmado com segurança. Acompanhe a entrega e converse somente pelo chat do pedido.",
          details,
          "Abrir pedido e chat",
          orderUrl,
        );
        text = `Pagamento confirmado\n\nPedido: #${purchaseId}\nProduto: ${productName}\nValor confirmado: ${formatBRL(purchase.amount)}\n\nAcompanhe: ${orderUrl}`;
      } else if (type === "new_sale") {
        subject = `Nova venda — ${productName}`;
        html = shell(
        branding,
          "Nova venda",
          "Você realizou uma venda",
          `O pagamento foi confirmado e o pedido está pronto para atendimento. Faça a entrega e mantenha toda a conversa dentro da ${escapeHtml(branding.siteName)}.`,
          details,
          "Atender pedido",
          orderUrl,
        );
        text = `Nova venda\n\nPedido: #${purchaseId}\nProduto: ${productName}\nValor confirmado: ${formatBRL(purchase.amount)}\n\nAtenda o pedido: ${orderUrl}`;
      } else if (type === "delivery_marked") {
        subject = `Entrega sinalizada — pedido #${purchaseId}`;
        html = shell(
        branding,
          "Entrega sinalizada",
          "O vendedor marcou o pedido como entregue",
          "Confira o produto com atenção antes de confirmar o recebimento. Se houver algum problema, use o chat ou abra uma disputa dentro da plataforma.",
          details,
          "Verificar entrega",
          orderUrl,
        );
        text = `Entrega sinalizada\n\nPedido: #${purchaseId}\nProduto: ${productName}\n\nConfira antes de confirmar o recebimento: ${orderUrl}`;
      } else if (type === "receipt_confirmed_buyer") {
        subject = `Pedido #${purchaseId} concluído`;
        html = shell(
        branding,
          "Pedido concluído",
          "Recebimento confirmado",
          `Sua confirmação foi registrada e o pedido foi concluído. Você pode revisar os detalhes e avaliar a experiência pela ${escapeHtml(branding.siteName)}.`,
          details,
          "Ver pedido",
          orderUrl,
        );
        text = `Pedido #${purchaseId} concluído\n\nProduto: ${productName}\nRecebimento confirmado.\n\nVer pedido: ${orderUrl}`;
      } else if (type === "receipt_confirmed_seller") {
        subject = `Venda concluída — pedido #${purchaseId}`;
        html = shell(
        branding,
          "Venda concluída",
          "O comprador confirmou o recebimento",
          "O pedido foi concluído e a liberação do valor ao vendedor foi registrada pela plataforma.",
          details,
          "Ver venda",
          orderUrl,
        );
        text = `Venda concluída\n\nPedido: #${purchaseId}\nProduto: ${productName}\nO recebimento foi confirmado e a liberação foi registrada.\n\nVer venda: ${orderUrl}`;
      } else if (type === "refund_buyer" || type === "refund_seller") {
        const sellerCopy = type === "refund_seller";
        subject = sellerCopy
          ? `Reembolso concluído — pedido #${purchaseId}`
          : `Seu reembolso foi concluído — pedido #${purchaseId}`;
        html = shell(
          branding,
          "Reembolso concluído",
          sellerCopy ? "O reembolso desta venda foi registrado" : "O valor do pedido foi devolvido",
          sellerCopy
            ? "O pedido foi reembolsado e o registro financeiro foi atualizado. Consulte os detalhes dentro da plataforma."
            : `O reembolso foi processado pela ${escapeHtml(branding.siteName)}. Consulte o pedido para ver o status e os detalhes do crédito.`,
          details,
          "Ver pedido",
          orderUrl,
        );
        text = sellerCopy
          ? `Reembolso concluído\n\nPedido: #${purchaseId}\nProduto: ${productName}\n\nVer pedido: ${orderUrl}`
          : `Seu reembolso foi concluído\n\nPedido: #${purchaseId}\nProduto: ${productName}\n\nVer pedido: ${orderUrl}`;
      } else if (type === "dispute_resolved_buyer" || type === "dispute_resolved_seller") {
        const sellerCopy = type === "dispute_resolved_seller";
        const released = String(purchase.status) === "delivered";
        subject = `Disputa resolvida — pedido #${purchaseId}`;
        html = shell(
          branding,
          "Disputa resolvida",
          "A análise deste pedido foi concluída",
          released
            ? (sellerCopy ? "A disputa foi encerrada e o pedido foi concluído com liberação registrada para o vendedor." : "A disputa foi encerrada e o pedido foi concluído pela plataforma.")
            : "A disputa foi encerrada e o pedido voltou ao status pago para continuidade do atendimento, sem liberação automática neste momento.",
          details,
          "Ver decisão e pedido",
          orderUrl,
        );
        text = `Disputa resolvida\n\nPedido: #${purchaseId}\nProduto: ${productName}\nResultado: ${released ? "pedido concluído" : "pedido retornou ao status pago"}\n\nVer pedido: ${orderUrl}`;
      } else {
        const sellerCopy = type === "dispute_opened_seller";
        subject = `Disputa aberta — pedido #${purchaseId}`;
        html = shell(
        branding,
          "Disputa aberta",
          sellerCopy ? "Uma disputa foi aberta nesta venda" : "Sua disputa foi registrada",
          sellerCopy
            ? "O pedido entrou em análise. Não tente resolver a situação fora da plataforma; mantenha evidências e mensagens no chat do pedido."
            : `A disputa foi registrada e o pedido entrou em análise. Mantenha evidências e mensagens dentro da ${escapeHtml(branding.siteName)}.`,
          details,
          "Acompanhar disputa",
          orderUrl,
        );
        text = `Disputa aberta\n\nPedido: #${purchaseId}\nProduto: ${productName}\nStatus: em análise.\n\nAcompanhe pela ${branding.siteName}: ${orderUrl}`;
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

    if (!RESEND_API_KEY || !EMAIL_FROM) {
      const reason = !RESEND_API_KEY ? "email_provider_not_configured" : "email_sender_not_configured";
      await admin.from("webhook_logs").insert({
        source: "email",
        event_type: type,
        status: "skipped_config",
        order_id: logId,
        charge_id: idempotencyKey,
        payload: { recipient: sellerRecipientTypes.has(type) || type === "new_question" || type === "new_review" || type === "product_approved" || type === "product_rejected" || type === "product_removed" ? "seller" : "buyer", subject },
        error: reason,
      });
      return json({ skipped: true, reason }, 202);
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `zxmax-${type}-${logId}-${idempotencyKey || "v1"}` },
      body: JSON.stringify({ from: EMAIL_FROM, to: [recipient], reply_to: EMAIL_REPLY_TO || undefined, subject, html, text }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      await admin.from("webhook_logs").insert({ source: "email", event_type: type, status: `error_${response.status}`, order_id: logId, charge_id: idempotencyKey, payload: { recipient: sellerRecipientTypes.has(type) || type === "new_question" || type === "new_review" || type === "product_approved" || type === "product_rejected" || type === "product_removed" ? "seller" : "buyer", subject }, error: "provider_rejected" });
      return json({ error: "Não foi possível entregar a notificação." }, 502);
    }
    await admin.from("webhook_logs").insert({ source: "email", event_type: type, status: "sent", order_id: logId, charge_id: idempotencyKey || result.id || null, payload: { recipient: sellerRecipientTypes.has(type) || type === "new_question" || type === "new_review" || type === "product_approved" || type === "product_rejected" || type === "product_removed" ? "seller" : "buyer", subject, resend_id: result.id || null }, error: null });
    return json({ sent: true, id: result.id });
  } catch (error) {
    console.error("send-email failure", error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível processar a notificação." }, 500);
  }
});
