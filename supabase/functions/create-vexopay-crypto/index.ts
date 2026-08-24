import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await anonClient.auth.getUser(token);
    if (!userData.user) throw new Error("Unauthorized");

    const body = await req.json();
    const purchaseId = Number(body.purchaseId);
    const amount = Number(body.amount);
    const network = body.network || "TRC20";
    const description = body.description || `Pedido #${purchaseId}`;

    if (!purchaseId || !amount || amount < 2) throw new Error("Dados inválidos (mín R$2)");

    // Check purchase
    const { data: purchase } = await serviceClient.from("purchases").select("id, buyer_id, status, amount").eq("id", purchaseId).maybeSingle();
    if (!purchase || purchase.buyer_id !== userData.user.id) throw new Error("Pedido não encontrado");
    if (purchase.status !== "pending") throw new Error("Pedido não está pendente");

    // VexoPay credentials: app_settings.vexopay (clientId/clientSecret/baseUrl)
    let ci = Deno.env.get("VEXOPAY_CLIENT_ID");
    let cs = Deno.env.get("VEXOPAY_CLIENT_SECRET");
    let baseUrl = "https://www.vexopay.com.br/api";

    try {
      const { data: setting } = await serviceClient.from("app_settings").select("value").eq("key", "vexopay").maybeSingle();
      if (setting?.value?.clientId) ci = setting.value.clientId;
      if (setting?.value?.clientSecret) cs = setting.value.clientSecret;
      if (typeof setting?.value?.baseUrl === "string" && setting.value.baseUrl.trim() !== "") {
        baseUrl = setting.value.baseUrl.replace(/\/$/, "");
      }
    } catch {}

    if (!ci || !cs) {
      throw new Error("O pagamento em cripto está temporariamente indisponível: o gateway não está configurado. Avise o suporte.");
    }

    // Docs: POST /gateway/crypto-create ou POST /crypto-create
    const payload = {
      amount,
      network,
      description: description.slice(0, 120),
    };

    const candidates = ["/gateway/crypto-create", "/crypto-create"];
    let lastError = "";
    let dataRes: any = null;

    for (const path of candidates) {
      const resp = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ci: ci, cs: cs },
        body: JSON.stringify(payload),
      });
      const resBody = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        lastError = resBody?.message || resBody?.error || `HTTP ${resp.status} em ${path}`;
        continue;
      }
      dataRes = resBody;
      break;
    }

    if (!dataRes) throw new Error(lastError || "Erro ao criar cobrança Crypto na VexoPay");

    const invoiceNode = dataRes?.invoice || dataRes?.data || dataRes;
    const chargeId = invoiceNode?.id || dataRes?.id;
    const address = invoiceNode?.address || dataRes?.address;
    const qrPayload = invoiceNode?.qr_payload || dataRes?.qr_payload || invoiceNode?.qrCode || dataRes?.qrCode;
    const expiresAt = invoiceNode?.expires_at || dataRes?.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString();

    if (chargeId) {
      await serviceClient.from("purchases").update({
        evopay_charge_id: `vexo:${chargeId}`,
        updated_at: new Date().toISOString(),
      }).eq("id", purchaseId);
    }

    try {
      await serviceClient.from("webhook_logs").insert({
        source: "vexopay",
        event_type: "CREATE_CRYPTO",
        status: "created",
        order_id: purchaseId,
        charge_id: chargeId ? String(chargeId) : null,
        payload: dataRes,
        error: null,
      });
    } catch {}

    return new Response(JSON.stringify({
      success: true,
      id: chargeId ? `vexo:${chargeId}` : null,
      address,
      amount: invoiceNode?.amount || amount,
      qrCode: qrPayload,
      network,
      expiresAt,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("create-vexopay-crypto error", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
