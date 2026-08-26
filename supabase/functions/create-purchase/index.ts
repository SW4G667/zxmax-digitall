import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const ROBUX_CATEGORY = "Robux e Gift Cards";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function packageUnits(product: { category?: string; variations?: { name?: string }[] }): number {
  if (product.category !== ROBUX_CATEGORY) return 1;
  const label = product.variations?.[0]?.name ?? "";
  const digits = String(label).replace(/\D/g, "");
  const units = Number.parseInt(digits, 10);
  return Number.isFinite(units) && units > 0 ? units : 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const user = userData.user;
    const body = await req.json().catch(() => ({}));
    const productId = Number(body.productId);
    const variationName = typeof body.variationName === "string" ? body.variationName : null;
    const requestedQty = Number(body.quantity);
    const paymentMethod = ["zennith_pix", "vexopay_pix", "crypto", "card", "boleto"].includes(String(body.paymentMethod)) ? String(body.paymentMethod) : null;
    if (!productId || Number.isNaN(productId)) return json({ error: "Produto inválido" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: gatewayRows } = await admin.from("app_settings").select("key,value").in("key", ["zennithpay", "vexopay", "stripe"]);
    const gateway = (key: string) => (gatewayRows || []).find((row: any) => row.key === key)?.value || {};
    const configuredFee = paymentMethod === "zennith_pix"
      ? Number(gateway("zennithpay").pixFee)
      : paymentMethod === "vexopay_pix"
        ? Number(gateway("vexopay").pixFee)
        : 0;
    const buyerFee = Number.isFinite(configuredFee) && configuredFee >= 0 && configuredFee <= 1000 ? roundMoney(configuredFee) : 0;
    const stripe = gateway("stripe") as Record<string, unknown>;
    const stripeReady = Boolean(Deno.env.get("STRIPE_SECRET_KEY") && Deno.env.get("STRIPE_WEBHOOK_SECRET"));
    if (paymentMethod === "card" && (!stripeReady || stripe.cardEnabled !== true)) {
      return json({ error: "Cartão indisponível no momento. Escolha PIX ou tente mais tarde." }, 503);
    }
    if (paymentMethod === "boleto" && (!stripeReady || stripe.boletoEnabled !== true)) {
      return json({ error: "Boleto indisponível no momento. Escolha PIX ou tente mais tarde." }, 503);
    }

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, seller_id, seller_email, seller_public_id, price, approved, variations, category, stock, min_quantity")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product || !product.approved) return json({ error: "Produto indisponível" }, 404);
    if (product.seller_id === user.id) return json({ error: "Você não pode comprar o próprio anúncio." }, 400);

    const variations = Array.isArray(product.variations) ? product.variations : [];
    const variation = variationName ? variations.find((v: any) => v?.name === variationName) : null;
    const unitPrice = Number(variation ? variation.price : product.price);
    if (!unitPrice || Number.isNaN(unitPrice) || unitPrice < 2) {
      return json({ error: "O preço mínimo de um produto é R$ 2,00" }, 400);
    }

    const isRobux = product.category === ROBUX_CATEGORY;
    const units = packageUnits(product);
    const minQty = Number(product.min_quantity) > 0 ? Number(product.min_quantity) : (isRobux ? units : 1);
    const quantity = Number.isFinite(requestedQty) && requestedQty > 0 ? requestedQty : (isRobux ? units : 1);
    if (quantity < minQty) {
      return json({ error: `Quantidade mínima: ${minQty}` }, 400);
    }
    const stock = product.stock == null ? null : Number(product.stock);
    if (stock != null && Number.isFinite(stock) && quantity > stock) {
      return json({ error: `Estoque disponível: ${stock}` }, 400);
    }

    const safeProductAmount = isRobux
      ? roundMoney((quantity / units) * Number(product.price))
      : roundMoney(unitPrice);
    const amount = roundMoney(safeProductAmount + buyerFee);
    if (amount < 2) return json({ error: "Valor mínimo do pedido é R$ 2,00." }, 400);

    const { data: profile } = await admin
      .from("profiles")
      .select("public_id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    const purchasePayload: Record<string, unknown> = {
      product_id: productId,
      buyer_id: user.id,
      buyer_email: user.email || profile?.email || "",
      buyer_public_id: String(profile?.public_id || ""),
      seller_id: product.seller_id,
      seller_email: product.seller_email || "",
      seller_public_id: product.seller_public_id || "",
      status: "pending",
      amount,
      messages: [],
      variation_name: variationName || (isRobux ? `${quantity} Robux` : null),
      payment_provider: paymentMethod,
    };

    const withExtras = {
      ...purchasePayload,
      product_amount: safeProductAmount,
      buyer_fee: buyerFee,
      quantity,
    };

    let purchase: any = null;
    let purchaseError: any = null;
    ({ data: purchase, error: purchaseError } = await admin
      .from("purchases")
      .insert(withExtras)
      .select("id,product_id,buyer_id,buyer_email,buyer_public_id,seller_id,seller_email,seller_public_id,status,amount,messages,reviewed,review_stars,review_comment,variation_name,created_at,updated_at,evopay_charge_id,pix_qr_code,pix_expires_at,product_amount,buyer_fee,quantity")
      .maybeSingle());

    if (purchaseError) {
      const retry = await admin
        .from("purchases")
        .insert(purchasePayload)
        .select("id,product_id,buyer_id,buyer_email,buyer_public_id,seller_id,seller_email,seller_public_id,status,amount,messages,reviewed,review_stars,review_comment,variation_name,created_at,updated_at,evopay_charge_id,pix_qr_code,pix_expires_at")
        .maybeSingle();
      purchase = retry.data;
      purchaseError = retry.error;
    }

    if (purchaseError || !purchase) throw purchaseError || new Error("Falha ao criar pedido");

    return json({
      purchase: {
        ...purchase,
        product_amount: purchase.product_amount ?? safeProductAmount,
        buyer_fee: purchase.buyer_fee ?? buyerFee,
        quantity: purchase.quantity ?? quantity,
      },
    });
  } catch (error: any) {
    console.error("create-purchase error:", error?.message || error);
    return json({ error: error?.message || "Erro ao criar pedido" }, 400);
  }
});
