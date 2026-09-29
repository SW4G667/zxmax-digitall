import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const normalizeLanguage = (locale: unknown) => {
  const raw = String(locale || "").trim().toLowerCase();
  const language = raw.split(/[-_]/)[0].replace(/[^a-z]/g, "");
  return language || "pt";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: auth, error: authError } = await userClient.auth.getUser(authHeader.slice(7));
    if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const messageId = String(body.messageId || "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(messageId)) return json({ error: "Mensagem inválida." }, 400);

    const { data: message, error: messageError } = await admin.from("order_messages")
      .select("id,order_id,sender_id,body")
      .eq("id", messageId).maybeSingle();
    if (messageError || !message || !message.body) return json({ error: "Mensagem não encontrada." }, 404);
    if (message.sender_id === auth.user.id) return json({ error: "Sua própria mensagem não precisa de tradução." }, 409);

    const { data: purchase, error: purchaseError } = await admin.from("purchases")
      .select("id,buyer_id,seller_id")
      .eq("id", message.order_id).maybeSingle();
    if (purchaseError || !purchase) return json({ error: "Pedido não encontrado." }, 404);

    const { data: adminRole } = await admin.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    const participant = purchase.buyer_id === auth.user.id || purchase.seller_id === auth.user.id || adminRole === true;
    if (!participant) return json({ error: "Sem permissão." }, 403);

    const ids = [auth.user.id, message.sender_id].filter(Boolean);
    const { data: profiles } = await admin.from("profiles")
      .select("user_id,locale,country_code")
      .in("user_id", ids);
    const mine = (profiles || []).find((p: any) => p.user_id === auth.user.id);
    const theirs = (profiles || []).find((p: any) => p.user_id === message.sender_id);
    const target = normalizeLanguage(mine?.locale || "pt-BR");
    const source = normalizeLanguage(theirs?.locale || "auto");
    const myCountry = String(mine?.country_code || "").toUpperCase();
    const theirCountry = String(theirs?.country_code || "").toUpperCase();

    if (source === target && (!myCountry || !theirCountry || myCountry === theirCountry)) {
      return json({ translated: message.body, original: true, targetLanguage: target });
    }

    const { data: cached } = await admin.from("message_translations")
      .select("translated_text,detected_language")
      .eq("message_id", message.id)
      .eq("target_language", target)
      .maybeSingle();
    if (cached?.translated_text) {
      return json({ translated: cached.translated_text, detectedLanguage: cached.detected_language, targetLanguage: target, cached: true });
    }

    const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
    endpoint.searchParams.set("client", "gtx");
    endpoint.searchParams.set("sl", "auto");
    endpoint.searchParams.set("tl", target);
    endpoint.searchParams.set("dt", "t");
    endpoint.searchParams.set("q", String(message.body).slice(0, 1000));

    const response = await fetch(endpoint.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return json({ error: "A tradução está temporariamente indisponível." }, 503);
    const payload = await response.json().catch(() => null);
    const translated = Array.isArray(payload?.[0])
      ? payload[0].map((part: any) => String(part?.[0] || "")).join("").trim()
      : "";
    const detected = String(payload?.[2] || source || "").slice(0, 12);
    if (!translated) return json({ error: "Não foi possível traduzir esta mensagem." }, 502);

    await admin.from("message_translations").upsert({
      message_id: message.id,
      target_language: target,
      translated_text: translated,
      detected_language: detected || null,
    }, { onConflict: "message_id,target_language" });

    return json({ translated, detectedLanguage: detected || null, targetLanguage: target });
  } catch (error) {
    console.error("translate-order-message", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível traduzir esta mensagem agora." }, 500);
  }
});
