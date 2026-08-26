import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// A rota permanece publicada apenas para registrar chamadas herdadas. Ela não
// processa nenhum evento nem altera pedidos: a antiga integração EvoPay foi
// removida do ZXMAX e não pode voltar a ficar ativa por configuração acidental.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    await admin.from("webhook_logs").insert({ source: "evopay", event_type: "deprecated_endpoint", status: "rejected", payload: null, error: "EvoPay foi desativada; use as rotas configuradas de ZennithPay ou VexoPay." });
  } catch { /* a resposta segura não depende do log */ }
  return new Response(JSON.stringify({ error: "Integração EvoPay desativada" }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
