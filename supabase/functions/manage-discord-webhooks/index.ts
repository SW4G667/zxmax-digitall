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

const eventTypes = ["sale_confirmed", "product_question", "product_review"] as const;
type EventType = (typeof eventTypes)[number];
type RequestBody = {
  action?: "list" | "set" | "toggle" | "remove";
  eventType?: EventType;
  webhookUrl?: string;
  active?: boolean;
};

const normalizeDiscordWebhookUrl = (raw: unknown): string | null => {
  if (typeof raw !== "string" || raw.length > 600) return null;
  try {
    const parsed = new URL(raw.trim());
    const allowedHosts = new Set(["discord.com", "discordapp.com", "canary.discord.com", "ptb.discord.com"]);
    if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname.toLowerCase()) || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    const match = /^\/api(?:\/v\d+)?\/webhooks\/(\d{17,20})\/([A-Za-z0-9._-]{20,200})$/.exec(parsed.pathname);
    if (!match) return null;
    return `https://${parsed.hostname.toLowerCase()}${parsed.pathname}`;
  } catch {
    return null;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Serviço indisponível." }, 503);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Autenticação obrigatória." }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "Autenticação obrigatória." }, 401);

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const action = body.action;
  if (action === "list") {
    const { data, error } = await admin
      .from("user_discord_webhooks")
      .select("event_type,active,last_delivery_status,last_delivery_at,updated_at")
      .eq("user_id", authData.user.id)
      .order("event_type", { ascending: true });
    if (error) return json({ error: "Não foi possível carregar as integrações." }, 500);
    return json({ webhooks: data || [] });
  }

  const eventType = body.eventType;
  if (!eventType || !eventTypes.includes(eventType)) return json({ error: "Evento de integração inválido." }, 400);
  if (action !== "set" && action !== "toggle" && action !== "remove") return json({ error: "Ação de integração inválida." }, 400);

  const normalizedUrl = action === "set" ? normalizeDiscordWebhookUrl(body.webhookUrl) : null;
  if (action === "set" && !normalizedUrl) return json({ error: "Informe uma URL HTTPS de webhook Discord válida." }, 400);
  if (action === "toggle" && typeof body.active !== "boolean") return json({ error: "Estado de integração inválido." }, 400);

  const { data, error } = await admin.rpc("manage_user_discord_webhook_internal", {
    _user_id: authData.user.id,
    _event_type: eventType,
    _action: action,
    _webhook_url: normalizedUrl,
    _active: action === "toggle" ? body.active : null,
  });
  if (error) {
    const invalid = error.code === "22023";
    const missing = error.code === "P0002";
    return json({ error: invalid ? "Não foi possível validar esta integração." : missing ? "Destino não encontrado." : "Não foi possível atualizar a integração." }, invalid || missing ? 400 : 500);
  }
  return json({ webhook: data });
});
