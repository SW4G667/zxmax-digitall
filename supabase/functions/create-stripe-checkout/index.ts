import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Erro com código estável, para o frontend poder reagir sem parsear texto. */
class CheckoutError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

/** Traduz os erros mais comuns da Stripe para algo acionável em português. */
function translateStripeError(body: Record<string, any>, status: number): CheckoutError {
  const err = body?.error ?? {};
  const code = String(err.code ?? err.type ?? "stripe_error");
  const raw = String(err.message ?? "");

  if (status === 401) {
    return new CheckoutError(
      "stripe_invalid_key",
      "A Secret Key da Stripe foi recusada. Confira a chave em Admin → APIs (precisa ser a Secret Key, começando com sk_).",
    );
  }
  if (/payment_method_types/i.test(raw) && /boleto/i.test(raw)) {
    return new CheckoutError(
      "stripe_boleto_disabled",
      "O Boleto não está habilitado nesta conta Stripe. Ative-o no painel da Stripe (Settings → Payment methods) ou use PIX.",
    );
  }
  if (/currency/i.test(raw) && /brl/i.test(raw)) {
    return new CheckoutError(
      "stripe_currency",
      "Esta conta Stripe não aceita cobranças em BRL. É necessária uma conta Stripe brasileira.",
    );
  }
  if (/activate|account.*not.*enabled|capabilities/i.test(raw)) {
    return new CheckoutError(
      "stripe_account_pending",
      "A conta Stripe ainda não está ativada para receber pagamentos. Conclua o cadastro no painel da Stripe.",
    );
  }
  if (code === "amount_too_small") {
    return new CheckoutError("stripe_amount", "Valor abaixo do mínimo aceito pela Stripe para esta moeda.");
  }
  return new CheckoutError("stripe_error", raw || `A Stripe recusou a cobrança (HTTP ${status}).`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new CheckoutError("unauthorized", "Sua sessão expirou. Entre novamente para concluir a compra.", 401);
    }
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData.user) {
      throw new CheckoutError("unauthorized", "Sua sessão expirou. Entre novamente para concluir a compra.", 401);
    }

    const body = await req.json().catch(() => ({}));
    const purchaseId = Number(body.purchaseId);
    const paymentMethod = body.paymentMethod === "boleto" ? "boleto" : "card";

    if (!Number.isFinite(purchaseId) || purchaseId <= 0) {
      throw new CheckoutError("invalid_order", "Pedido inválido.");
    }

    // ------------------------------------------------------------------
    // Anti price tampering: o valor cobrado vem SEMPRE do banco, nunca do
    // corpo da requisição. O cliente não decide quanto vai pagar.
    // ------------------------------------------------------------------
    const { data: purchase } = await serviceClient
      .from("purchases")
      .select("id, buyer_id, status, amount")
      .eq("id", purchaseId)
      .maybeSingle();

    if (!purchase || purchase.buyer_id !== userData.user.id) {
      throw new CheckoutError("order_not_found", "Pedido não encontrado.", 404);
    }
    if (purchase.status !== "pending") {
      throw new CheckoutError("order_not_pending", "Este pedido já foi processado.", 409);
    }

    const amount = Number(purchase.amount);
    if (!Number.isFinite(amount) || amount < 2) {
      throw new CheckoutError("invalid_amount", "Valor do pedido inválido.");
    }

    // ------------------------------------------------------------------
    // Credenciais
    // ------------------------------------------------------------------
    const secretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const { data: setting } = await serviceClient
      .from("app_settings").select("value").eq("key", "stripe").maybeSingle();
    const stripeConfig = (setting?.value || {}) as Record<string, unknown>;
    const enabled = paymentMethod === "boleto" ? stripeConfig.boletoEnabled === true : stripeConfig.cardEnabled === true;

    if (!enabled) {
      throw new CheckoutError("stripe_disabled", paymentMethod === "boleto" ? "O boleto está desativado no momento. Use PIX." : "O pagamento com cartão está desativado no momento. Use PIX.");
    }
    if (!secretKey) {
      throw new CheckoutError(
        "stripe_not_configured",
        "O pagamento Stripe ainda não foi configurado. Um administrador deve adicionar as secrets no ambiente seguro e concluir o webhook.",
      );
    }
    if (!/^sk_(test|live)_/.test(secretKey)) {
      // Erro clássico: colar a Publishable Key (pk_) no lugar da Secret Key.
      throw new CheckoutError(
        "stripe_wrong_key",
        "A chave cadastrada não é uma Secret Key da Stripe. Ela deve começar com sk_test_ ou sk_live_ (a pk_ é pública e não serve).",
      );
    }

    // ------------------------------------------------------------------
    // Checkout Session
    // ------------------------------------------------------------------
    const siteUrl = (Deno.env.get("SITE_URL") || "https://zxmax.vercel.app").replace(/\/$/, "");
    const params = new URLSearchParams();
    params.append("payment_method_types[]", paymentMethod);
    params.append("line_items[0][price_data][currency]", "brl");
    params.append("line_items[0][price_data][product_data][name]", String(body.productName || `Pedido #${purchaseId}`).slice(0, 120));
    params.append("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
    params.append("line_items[0][quantity]", "1");
    params.append("mode", "payment");
    params.append("success_url", `${siteUrl}/minhas-compras?order=${purchaseId}&payment=success&session_id={CHECKOUT_SESSION_ID}`);
    params.append("cancel_url", `${siteUrl}/minhas-compras?order=${purchaseId}&payment=canceled`);
    params.append("client_reference_id", String(purchaseId));
    params.append("metadata[purchaseId]", String(purchaseId));
    if (userData.user.email) params.append("customer_email", userData.user.email);
    // Boleto exige nome e endereço do pagador.
    if (paymentMethod === "boleto") {
      params.append("billing_address_collection", "required");
      const expiresAfterDays = Number(stripeConfig.boletoExpiresAfterDays);
      params.append("payment_method_options[boleto][expires_after_days]", String(Number.isInteger(expiresAfterDays) && expiresAfterDays >= 0 && expiresAfterDays <= 60 ? expiresAfterDays : 3));
    }

    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        // Chave de idempotência: reenviar o mesmo pedido não duplica cobrança.
        "Idempotency-Key": `zxmax-${purchaseId}-${paymentMethod}`,
      },
      body: params.toString(),
    });

    const stripeData = await stripeResp.json().catch(() => ({}));

    if (!stripeResp.ok || !stripeData?.url) {
      // Log completo no servidor; o cliente recebe só a versão traduzida.
      console.error("stripe checkout failed", stripeResp.status, JSON.stringify(stripeData?.error ?? {}));
      await serviceClient.from("webhook_logs").insert({
        source: "stripe", event_type: "CREATE_CHECKOUT", status: "error",
        order_id: purchaseId, charge_id: null, payload: stripeData,
        error: String(stripeData?.error?.message ?? `HTTP ${stripeResp.status}`),
      });
      throw translateStripeError(stripeData, stripeResp.status);
    }

    // O webhook compara esta referência antes de liberar o pedido. Sem ela,
    // uma sessão Stripe nunca pode marcar uma compra arbitrária como paga.
    const { error: chargeUpdateError } = await serviceClient
      .from("purchases")
      .update({ evopay_charge_id: `stripe:${stripeData.id}` })
      .eq("id", purchaseId)
      .eq("status", "pending");
    if (chargeUpdateError) {
      console.error("stripe charge reference failed", chargeUpdateError.message);
      throw new CheckoutError("stripe_reference", "Não foi possível preparar a confirmação segura do pedido. Tente novamente.", 503);
    }

    await serviceClient.from("webhook_logs").insert({
      source: "stripe", event_type: "CREATE_CHECKOUT", status: "created",
      order_id: purchaseId, charge_id: `stripe:${stripeData.id}`, payload: { id: stripeData.id, payment_method: paymentMethod }, error: null,
    });

    return json({ success: true, id: stripeData.id, url: stripeData.url, amount });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error("create-stripe-checkout error", error instanceof Error ? error.message : error);
    return json({ error: "Não foi possível iniciar o pagamento. Tente novamente.", code: "unexpected" }, 500);
  }
});
