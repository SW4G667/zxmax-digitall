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
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate the caller is authenticated and use the verified identity only.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let apiKey = Deno.env.get("EVOPAY_API_KEY");
    let evoValue: Record<string, any> = {};
    try {
      const { data: setting } = await serviceClient.from("app_settings").select("value").eq("key", "evopay").maybeSingle();
      evoValue = (setting?.value as any) || {};
      if (evoValue.apiKey && (evoValue.mode === "manual" || !apiKey)) {
        apiKey = evoValue.apiKey;
      }
    } catch (_e) { /* fallback to secret */ }
    if (!apiKey) throw new Error("EVOPAY_API_KEY não configurada");

    const body = await req.json();
    const purchaseId = Number(body.purchaseId);
    if (!purchaseId || Number.isNaN(purchaseId)) throw new Error("Pedido inválido");

    const { data: purchase, error: purchaseError } = await serviceClient
      .from("purchases")
      .select("id, product_id, buyer_id, buyer_email, status, amount, evopay_charge_id, pix_qr_code, pix_expires_at")
      .eq("id", purchaseId)
      .maybeSingle();

    if (purchaseError || !purchase) throw new Error("Pedido não encontrado");
    if (purchase.buyer_id !== userData.user.id) throw new Error("Você só pode pagar seus próprios pedidos");
    if (purchase.status !== "pending") throw new Error("Este pedido não está pendente");

    const existingExpiresAt = purchase.pix_expires_at ? new Date(purchase.pix_expires_at).getTime() : 0;
    if (purchase.evopay_charge_id && purchase.pix_qr_code && existingExpiresAt > Date.now()) {
      return new Response(JSON.stringify({
        id: purchase.evopay_charge_id,
        status: "PENDING",
        amount: Number(purchase.amount),
        qrCodeText: purchase.pix_qr_code,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const value = Number(purchase.amount);
    const { data: product } = await serviceClient
      .from("products")
      .select("name")
      .eq("id", purchase.product_id)
      .maybeSingle();
    const productName = product?.name || `Pedido #${purchase.id}`;
    const buyerEmail = userData.user.email || purchase.buyer_email;
    if (!productName || !value || value < 5 || !buyerEmail) {
      throw new Error("Dados incompletos para a cobrança PIX");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookToken = setting?.value?.webhookToken;
    if (!webhookToken) throw new Error("Webhook EvoPay ainda não foi configurado pelo administrador");
    const callbackUrl = `${supabaseUrl}/functions/v1/evopay-webhook?token=${encodeURIComponent(webhookToken)}`;
    const { data: buyerProfile } = await serviceClient.from("profiles").select("display_name,cpf").eq("user_id", userData.user.id).maybeSingle();
    const buyerDocument = String(buyerProfile?.cpf || "").replace(/\D/g, "");
    if (![11, 14].includes(buyerDocument.length)) throw new Error("Cadastre um CPF válido no perfil antes de pagar");

    const payload = {
      amount: value,
      callbackUrl,
      generatedName: buyerProfile?.display_name || buyerEmail.split("@")[0],
      generatedEmail: buyerEmail,
      generatedDocument: buyerDocument,
      expiresIn: 3600,
      clientReference: String(purchaseId ?? `order_${Date.now()}`),
    };

    console.log("Creating EvoPay PIX charge:", JSON.stringify(payload));

    const response = await fetch("https://api.evopay.cash/v1/pix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("EvoPay response", response.status, JSON.stringify(data));

    // Log the charge creation attempt for admin debugging
    try {
      await serviceClient.from("webhook_logs").insert({
        source: "evopay",
        event_type: "CREATE_PIX",
        status: response.ok ? "created" : `error_${response.status}`,
        order_id: purchaseId ? Number(purchaseId) : null,
        charge_id: data?.id || null,
        payload: data,
        error: response.ok ? null : (typeof (data?.message || data?.error) === "string" ? (data.message || data.error) : JSON.stringify(data)),
      });
    } catch (_e) { /* ignore logging failure */ }

    if (!response.ok) {
      const msg = data?.message || data?.error || "Erro ao criar cobrança PIX";
      throw new Error(`EvoPay (${response.status}): ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    await serviceClient.from("purchases").update({
      evopay_charge_id: data.id,
      pix_qr_code: data.qrCodeText,
      pix_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", purchaseId);

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        amount: data.amount,
        qrCodeText: data.qrCodeText,
        expiresAt,
        qrCodeUrl: data.qrCodeUrl || (data.id ? `https://api.evopay.cash/v1/pix/qr-code/${data.id}` : null),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("create-evopay-pix error:", error.message || error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro desconhecido ao criar cobrança" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
