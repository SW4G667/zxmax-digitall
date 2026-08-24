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

    // Credenciais — mesma resolução de integrations-config/create-evopay-pix:
    // painel (app_settings) primeiro, secret de ambiente como fallback.
    let apiKey = Deno.env.get("EVOPAY_API_KEY");
    let evopayEnabled = true;
    try {
      const { data: setting } = await admin.from("app_settings").select("value").eq("key", "evopay").maybeSingle();
      if (setting?.value?.apiKey) apiKey = setting.value.apiKey;
      evopayEnabled = setting?.value?.enabled !== false;
    } catch (_e) { /* fallback to secret */ }

    let vexoCi = Deno.env.get("VEXOPAY_CLIENT_ID");
    let vexoCs = Deno.env.get("VEXOPAY_CLIENT_SECRET");
    let vexoBaseUrl: string | undefined;
    try {
      const { data: vexoRow } = await admin.from("app_settings").select("value").eq("key", "vexopay").maybeSingle();
      const v = vexoRow?.value || {};
      if (v.clientId) vexoCi = v.clientId;
      if (v.clientSecret) vexoCs = v.clientSecret;
      if (typeof v.baseUrl === "string" && v.baseUrl.trim() !== "") vexoBaseUrl = v.baseUrl.replace(/\/$/, "");
    } catch (_e) { /* fallback to secrets */ }

    const url = new URL(req.url);
    let id = url.searchParams.get("id");
    if (!id && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      id = body.id;
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

    // ------------------------------------------------------------------
    // Cobranças criadas pela VexoPay usam o prefixo `vexo:` no id — o status
    // é consultado lá, com os mesmos headers ci/cs da criação.
    // ------------------------------------------------------------------
    if (String(id).startsWith("vexo:")) {
      if (!vexoCi || !vexoCs) {
        return new Response(JSON.stringify({ error: "Gateway de cripto/PIX não configurado para consulta." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const baseUrl = vexoBaseUrl || "https://www.vexopay.com.br/api";
      const txid = String(id).slice("vexo:".length);
      const statusPaths = [`/gateway/status?id=`, `/gateway/transaction-get?id=`, `/transaction?id=`];
      let lastStatusError = "";
      for (const p of statusPaths) {
        const resp = await fetch(`${baseUrl}${p}${encodeURIComponent(txid)}`, {
          headers: { ci: String(vexoCi), cs: String(vexoCs), Accept: "application/json" },
        });
        const body = await resp.json().catch(() => ({} as any));
        if (!resp.ok) {
          lastStatusError = `VexoPay ${resp.status} em ${p}`;
          continue;
        }
        const node = body?.data ?? body ?? {};
        const raw = String(node.status ?? node.situation ?? node.payment_status ?? "PENDING").toUpperCase();
        const status =
          /PAID|COMPLETED|CONFIRMED|APPROVED|SUCCESS/.test(raw) ? "COMPLETED"
          : /EXPIRED/.test(raw) ? "EXPIRED"
          : /CANCEL/.test(raw) ? "CANCELED"
          : /FAIL|ERROR/.test(raw) ? "FAILED"
          : "PENDING";
        return new Response(
          JSON.stringify({ id: String(id), status, amount: node.amount ?? null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
      throw new Error(lastStatusError || "Não foi possível consultar o status agora.");
    }

    if (!apiKey || !evopayEnabled) {
      return new Response(JSON.stringify({ error: "Gateway de PIX não configurado para consulta." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
