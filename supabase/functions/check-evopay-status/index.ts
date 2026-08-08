import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let apiKey = Deno.env.get("EVOPAY_API_KEY");
    let vexoValue: Record<string, any> = {};
    try {
      const { data: settings } = await admin.from("app_settings").select("key,value").in("key", ["evopay", "vexopay"]);
      const evoValue: Record<string, any> = (settings?.find((row) => row.key === "evopay")?.value as any) || {};
      vexoValue = (settings?.find((row) => row.key === "vexopay")?.value as any) || {};
      if (evoValue.apiKey && (evoValue.mode === "manual" || !apiKey)) apiKey = evoValue.apiKey;
    } catch (_e) { /* fallback to secret */ }

    const url = new URL(req.url);
    let id = url.searchParams.get("id");
    let provider = url.searchParams.get("provider") || "evopay";
    if (!id && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      id = body.id;
      provider = body.provider === "vexopay" ? "vexopay" : "evopay";
    }
    if (!id) throw new Error("id da transação é obrigatório");

    const { data: purchase } = await admin
      .from("purchases")
      .select("id, buyer_id, seller_id, evopay_charge_id")
      .eq("evopay_charge_id", id)
      .maybeSingle();
    if (!purchase || (purchase.buyer_id !== userData.user.id && purchase.seller_id !== userData.user.id)) {
      return new Response(JSON.stringify({ error: "Transação não encontrada para este usuário" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const useVexoPay = provider === "vexopay";
    if (useVexoPay && (!vexoValue.clientId || !vexoValue.clientSecret)) throw new Error("Credenciais VexoPay não configuradas");
    if (!useVexoPay && !apiKey) throw new Error("API Key EvoPay não configurada");
    const baseUrl = useVexoPay ? String(vexoValue.baseUrl || "https://api.vexopay.com.br").replace(/\/$/, "") : "https://api.evopay.cash/v1";
    const response = await fetch(`${baseUrl}/pix?id=${encodeURIComponent(id)}`, {
      headers: useVexoPay
        ? { ci: String(vexoValue.clientId), cs: String(vexoValue.clientSecret) }
        : { "Authorization": `Bearer ${apiKey}` },
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
