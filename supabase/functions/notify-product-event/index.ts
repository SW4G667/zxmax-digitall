import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "https://zxmax.vercel.app", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const allowed = new Set(["product_question", "product_review"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Serviço indisponível." }, 503);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Autenticação obrigatória." }, 401);
  const admin = createClient(url, serviceKey);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Autenticação obrigatória." }, 401);
  const body = await req.json().catch(() => ({}));
  const eventType = String(body.eventType || "");
  const eventId = Number(body.eventId);
  if (!allowed.has(eventType) || !Number.isInteger(eventId) || eventId <= 0) return json({ error: "Evento inválido." }, 400);

  let ownerId = "";
  if (eventType === "product_question") {
    const { data, error } = await admin.from("product_questions").select("id,author_id,products!inner(seller_id)").eq("id", eventId).maybeSingle();
    const product = Array.isArray((data as any)?.products) ? (data as any)?.products[0] : (data as any)?.products;
    if (error || !data || data.author_id !== authData.user.id || !product?.seller_id) return json({ error: "Evento indisponível." }, 404);
    ownerId = product.seller_id;
  } else {
    const { data, error } = await admin.from("product_reviews").select("id,buyer_id,seller_id").eq("id", eventId).maybeSingle();
    if (error || !data || data.buyer_id !== authData.user.id || !data.seller_id) return json({ error: "Evento indisponível." }, 404);
    ownerId = data.seller_id;
  }

  const response = await fetch(`${url}/functions/v1/deliver-discord-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
    body: JSON.stringify({ userId: ownerId, eventType, eventId }),
  });
  if (!response.ok && response.status !== 202) return json({ error: "O evento foi registrado, mas a notificação não foi entregue." }, 202);
  return json({ accepted: true });
});
