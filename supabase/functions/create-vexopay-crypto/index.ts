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
    const network = String(body.network || "TRC20");
    const description = body.description || `Pedido #${purchaseId}`;

    if (!purchaseId) throw new Error("Pedido inválido");

    // Check purchase — o valor cobrado é o do banco, nunca o enviado pelo cliente.
    const { data: purchase } = await serviceClient.from("purchases").select("id, buyer_id, status, amount").eq("id", purchaseId).maybeSingle();
    if (!purchase || purchase.buyer_id !== userData.user.id) throw new Error("Pedido não encontrado");
    if (purchase.status !== "pending") throw new Error("Pedido não está pendente");
    const amount = Number(purchase.amount);
    if (!amount || amount < 20 || amount > 3000) throw new Error("Crypto exige pedido entre R$ 20,00 e R$ 3.000,00 (preço + taxa).");
    if (!new Set(["TRC20", "USDC_TRC20", "BTC", "TRX"]).has(network)) {
      throw new Error("Rede de Crypto inválida.");
    }

    // Credenciais da VexoPay existem apenas no ambiente da Edge Function.
    const ci = String(Deno.env.get("VEXOPAY_CLIENT_ID") || "").trim();
    const cs = String(Deno.env.get("VEXOPAY_CLIENT_SECRET") || "").trim();
    let baseUrl = "https://www.vexopay.com.br/api";
    let cryptoEnabled = false;

    try {
      const { data: setting } = await serviceClient.from("app_settings").select("value").eq("key", "vexopay").maybeSingle();
      if (typeof setting?.value?.baseUrl === "string" && setting.value.baseUrl.trim() !== "") {
        baseUrl = setting.value.baseUrl.replace(/\/$/, "");
      }
      cryptoEnabled = setting?.value?.cryptoEnabled === true;
    } catch {}

    if (!ci || !cs || !cryptoEnabled) {
      throw new Error("O pagamento em cripto está temporariamente indisponível: o gateway não está configurado. Avise o suporte.");
    }

    // Contrato documentado: POST /gateway/crypto-create.
    const payload = {
      amount,
      network,
      description: description.slice(0, 120),
    };

    const resp = await fetch(`${baseUrl}/gateway/crypto-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ci, cs },
      body: JSON.stringify(payload),
    });
    const dataRes = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error("A VexoPay não conseguiu gerar esta cobrança Crypto. Tente novamente mais tarde.");

    const invoiceNode = dataRes?.invoice || dataRes?.data || dataRes;
    const chargeId = invoiceNode?.id || dataRes?.id;
    const address = invoiceNode?.address || dataRes?.address;
    const qrPayload = invoiceNode?.qr_payload || dataRes?.qr_payload || invoiceNode?.qrCode || dataRes?.qrCode;
    const expiresAt = invoiceNode?.expires_at || dataRes?.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString();

    if (!chargeId || !address) throw new Error("A VexoPay não devolveu os dados da cobrança Crypto.");
    await serviceClient.from("purchases").update({
      evopay_charge_id: `vexo:${chargeId}`,
      updated_at: new Date().toISOString(),
    }).eq("id", purchaseId);

    try {
      await serviceClient.from("webhook_logs").insert({
        source: "vexopay",
        event_type: "CREATE_CRYPTO",
        status: "created",
        order_id: purchaseId,
        charge_id: chargeId ? String(chargeId) : null,
        payload: { amount, network, expiresAt },
        error: null,
      });
    } catch {}

    return new Response(JSON.stringify({
      success: true,
      id: `vexo:${chargeId}`,
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
