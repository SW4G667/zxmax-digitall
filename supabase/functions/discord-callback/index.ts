import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Fluxo legado desativado. A versão anterior trocava o código OAuth manualmente
 * e devolvia uma senha temporária ao navegador, o que não é aceitável. O login
 * Discord agora é realizado exclusivamente pelo provedor OAuth do Supabase.
 */
serve((request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });
  return new Response(
    JSON.stringify({
      error: "discord_oauth_managed_by_supabase",
      message: "O login com Discord é gerenciado pelo Supabase Auth. Configure o provedor Discord no painel de autenticação do projeto.",
    }),
    { status: 410, headers },
  );
});
