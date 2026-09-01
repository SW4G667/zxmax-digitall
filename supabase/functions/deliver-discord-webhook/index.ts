import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const events = new Set(["sale_confirmed", "product_question", "product_review"]);
const paid = new Set(["paid", "delivered", "delivered_pending_confirmation"]);
const uuid = /^[0-9a-f-]{36}$/i;

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Service unavailable" }, 503);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token !== serviceKey) return json({ error: "Unauthorized" }, 401);
  const admin = createClient(url, serviceKey);
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  const eventType = String(body.eventType || "");
  const eventId = Number(body.eventId);
  if (!uuid.test(userId) || !events.has(eventType) || !Number.isInteger(eventId) || eventId <= 0) return json({ error: "Invalid event" }, 400);

  let eventKey = `${eventType}:${eventId}`;
  let title = "Notificação ZXMAX";
  let description = "Há uma nova atualização na ZXMAX.";
  let fields: Array<{ name: string; value: string; inline?: boolean }> = [];

  if (eventType === "sale_confirmed") {
    const { data: purchase, error } = await admin.from("purchases").select("id,product_id,seller_id,amount,status").eq("id", eventId).maybeSingle();
    if (error || !purchase || purchase.seller_id !== userId || !paid.has(String(purchase.status))) return json({ error: "Event unavailable" }, 404);
    const { data: product } = await admin.from("products").select("name").eq("id", purchase.product_id).maybeSingle();
    title = "Venda confirmada";
    description = "Um pagamento foi confirmado e o pedido está disponível para atendimento dentro da ZXMAX.";
    fields = [{ name: "Produto", value: String(product?.name || `Anúncio #${purchase.product_id}`).slice(0, 256) }, { name: "Pedido", value: `#${purchase.id}`, inline: true }, { name: "Valor confirmado", value: `R$ ${Number(purchase.amount || 0).toFixed(2).replace(".", ",")}`, inline: true }];
  } else if (eventType === "product_question") {
    const { data: question, error } = await admin.from("product_questions").select("id,product_id,author_id,products!inner(name,seller_id)").eq("id", eventId).maybeSingle();
    const product = Array.isArray((question as any)?.products) ? (question as any)?.products[0] : (question as any)?.products;
    if (error || !question || product?.seller_id !== userId) return json({ error: "Event unavailable" }, 404);
    title = "Nova pergunta";
    description = "Uma pergunta foi registrada em um anúncio seu. Responda dentro da ZXMAX.";
    fields = [{ name: "Produto", value: String(product?.name || `Anúncio #${question.product_id}`).slice(0, 256) }, { name: "Pergunta", value: "Conteúdo disponível somente dentro da ZXMAX." }];
  } else {
    const { data: review, error } = await admin.from("product_reviews").select("id,product_id,seller_id,stars").eq("id", eventId).maybeSingle();
    if (error || !review || review.seller_id !== userId) return json({ error: "Event unavailable" }, 404);
    const { data: product } = await admin.from("products").select("name").eq("id", review.product_id).maybeSingle();
    title = "Nova avaliação";
    description = "Uma avaliação válida foi registrada para uma venda concluída.";
    fields = [{ name: "Produto", value: String(product?.name || `Anúncio #${review.product_id}`).slice(0, 256) }, { name: "Nota", value: `${review.stars}/5`, inline: true }];
  }

  const { data: targetRows, error: targetError } = await admin.rpc("get_user_discord_webhook_delivery_target", { _user_id: userId, _event_type: eventType });
  const target = Array.isArray(targetRows) ? targetRows[0] : targetRows;
  if (targetError || !target?.webhook_id || !target.webhook_url) return json({ skipped: true, reason: "destination_not_configured" }, 202);
  const { data: claimed, error: claimError } = await admin.rpc("claim_user_discord_webhook_delivery", { _webhook_id: target.webhook_id, _user_id: userId, _event_type: eventType, _event_key: eventKey });
  if (claimError) return json({ error: "Delivery unavailable" }, 503);
  if (!claimed) return json({ already_sent: true });

  const response = await fetch(target.webhook_url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "ZXMAX-Notifications/1.0" }, body: JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [{ title, description, color: 5793266, fields, footer: { text: "ZXMAX · aviso automático" }, timestamp: new Date().toISOString() }] }) });
  const retryAfter = Number(response.headers.get("retry-after"));
  const status = response.status === 404 ? "disabled_not_found" : response.status === 429 ? "rate_limited" : response.ok ? "sent" : "failed";
  await admin.rpc("complete_user_discord_webhook_delivery", { _webhook_id: target.webhook_id, _event_key: eventKey, _status: status, _provider_status: response.status, _retry_after_seconds: Number.isFinite(retryAfter) ? retryAfter : null });
  if (response.ok) return json({ sent: true });
  return json({ delivered: false, status }, response.status === 429 ? 202 : 502);
});

function serve(handler: (req: Request) => Promise<Response>) {
  Deno.serve(handler);
}
