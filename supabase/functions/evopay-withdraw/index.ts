import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// EvoPay não faz parte dos provedores suportados. Nunca aceitará credenciais ou saques.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(JSON.stringify({ error: "Integração EvoPay desativada. Use ZennithPay ou VexoPay." }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
