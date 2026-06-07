import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("EVOPAY_API_KEY");
    if (!apiKey) throw new Error("EVOPAY_API_KEY não configurada");

    const url = new URL(req.url);
    let id = url.searchParams.get("id");
    if (!id && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }
    if (!id) throw new Error("id da transação é obrigatório");

    const response = await fetch(`https://api.evopay.cash/v1/pix?id=${encodeURIComponent(id)}`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    const data = await response.json();

    if (!response.ok) {
      const msg = data?.message || data?.error || "Erro ao consultar transação";
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }

    return new Response(
      JSON.stringify({ id: data.id, status: data.status, amount: data.amount, clientReference: data.clientReference }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("check-evopay-status error:", error.message || error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao consultar status" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
