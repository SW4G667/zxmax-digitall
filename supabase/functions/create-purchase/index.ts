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
    if (!productId || Number.isNaN(productId)) return json({ error: "Produto inválido" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, seller_id, seller_email, seller_public_id, price, approved, variations")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product || !product.approved) return json({ error: "Produto indisponível" }, 404);

    const variations = Array.isArray(product.variations) ? product.variations : [];
    const variation = variationName ? variations.find((v: any) => v?.name === variationName) : null;
    const amount = Number(variation ? variation.price : product.price);
    if (!amount || Number.isNaN(amount) || amount < 5) {
      return json({ error: "O preço mínimo de um produto é R$ 5,00" }, 400);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("public_id, email")
      .eq("user_id", user.id)
      .maybeSingle();

    const purchasePayload = {
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
      variation_name: variationName,
    };

    const { data: purchase, error: purchaseError } = await admin
      .from("purchases")
      .insert(purchasePayload)
      .select("id,product_id,buyer_id,buyer_email,buyer_public_id,seller_id,seller_email,seller_public_id,status,amount,messages,reviewed,review_stars,review_comment,variation_name,created_at,updated_at,evopay_charge_id,pix_qr_code,pix_expires_at")
      .maybeSingle();

    if (purchaseError || !purchase) throw purchaseError || new Error("Falha ao criar pedido");

    return json({ purchase });
  } catch (error: any) {
    console.error("create-purchase error:", error?.message || error);
    return json({ error: error?.message || "Erro ao criar pedido" }, 400);
  }
});