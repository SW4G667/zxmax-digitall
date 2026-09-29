import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: userData } = await userClient.auth.getUser(auth.slice(7));
  if (!userData.user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const messageId = String(body.messageId || "");
  if (!messageId) return json({ error: "Mensagem inválida." }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: message } = await admin.from("order_messages").select("id,order_id,sender_id,body")
    .eq("id", messageId).maybeSingle();
  if (!message?.body || message.sender_id === userData.user.id) return json({ error: "Mensagem não traduzível." }, 400);

  const { data: purchase } = await admin.from("purchases").select("buyer_id,seller_id").eq("id", message.order_id).maybeSingle();
  if (!purchase || (purchase.buyer_id !== userData.user.id && purchase.seller_id !== userData.user.id)) {
    return json({ error: "Pedido não encontrado." }, 404);
  }

  const { data: profile } = await admin.from("profiles").select("locale").eq("user_id", userData.user.id).maybeSingle();
  const requested = String(body.targetLanguage || profile?.locale || "pt-BR");
  const target = requested.toLowerCase().split(/[-_]/)[0].replace(/[^a-z]/g, "").slice(0, 8) || "pt";

  try {
    const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
    endpoint.searchParams.set("client", "gtx");
    endpoint.searchParams.set("sl", "auto");
    endpoint.searchParams.set("tl", target);
    endpoint.searchParams.set("dt", "t");
    endpoint.searchParams.set("q", String(message.body).slice(0, 1000));
    const response = await fetch(endpoint, { headers: { "User-Agent": "ZXMAX/1.0" } });
    if (!response.ok) return json({ error: "Tradução indisponível." }, 502);
    const payload = await response.json();
    const translated = Array.isArray(payload?.[0])
      ? payload[0].map((part: any) => String(part?.[0] || "")).join("").trim()
      : "";
    return translated ? json({ translated, translatedText: translated, targetLanguage: target }) : json({ error: "Tradução indisponível." }, 502);
  } catch {
    return json({ error: "Tradução indisponível." }, 502);
  }
});
