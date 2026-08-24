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

    // VexoPay credentials — mesma precedência de integrations-config/payment_methods:
    // o painel do admin salva em app_settings.vexopay (clientId/clientSecret/baseUrl);
    // os secrets de ambiente são apenas fallback. Antes este código lia
    // app_settings.evopay.vexoCi/vexoCs — campos que o painel nunca grava — então a
    // cobrança falhava mesmo com as credenciais cadastradas.
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

    // Create crypto invoice via VexoPay gateway
    // Docs: POST /api/gateway/crypto-create { amount, network, description }
    const payload = {
      amount,
      network,
      description: description.slice(0, 120),
      clientReference: String(purchaseId),
    };

    console.log("Creating VexoPay crypto invoice", payload);

    const resp = await fetch(`${baseUrl}/gateway/crypto-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ci": ci,
        "cs": cs,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({}));
    console.log("VexoPay crypto response", resp.status, JSON.stringify(data));

    if (!resp.ok) throw new Error(data?.message || data?.error || "Erro ao criar cobrança Crypto");

    // Save charge id if returned
    if (data?.data?.id || data?.id) {
      const chargeId = data?.data?.id || data?.id;
      await serviceClient.from("purchases").update({
        evopay_charge_id: String(chargeId),
        updated_at: new Date().toISOString(),
      }).eq("id", purchaseId);
    }

    await serviceClient.from("webhook_logs").insert({
      source: "vexopay",
      event_type: "CREATE_CRYPTO",
      status: "created",
      order_id: purchaseId,
      charge_id: data?.data?.id || data?.id || null,
      payload: data,
      error: null,
    });

    return new Response(JSON.stringify({
      success: true,
      id: data?.data?.id || data?.id,
      address: data?.data?.address || data?.address,
      amount: data?.data?.amount || amount,
      qrCode: data?.data?.qr_payload || data?.qr_payload || data?.data?.qrCode || null,
      network: network,
      expiresAt: data?.data?.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("create-vexopay-crypto error", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 });
  }
});
