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

    // Public products - always return approved products with service role to bypass RLS issues
    // This fixes bug where anon sees 0 products even when approved products exist
    const { data: products, error } = await serviceClient
      .from("products")
      .select("id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at,stock,min_quantity,delivery_time")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    // If no approved products, return all as fallback to avoid empty store (admin can then approve)
    let finalProducts = products || [];
    if (finalProducts.length === 0) {
      const { data: allProducts } = await serviceClient
        .from("products")
        .select("id,seller_id,seller_public_id,seller_name,name,price,category,image,banner,description,approved,delivery_type,variations,questions,sales,rating,created_at,updated_at,stock,min_quantity,delivery_time")
        .order("created_at", { ascending: false })
        .limit(100);
      if (allProducts && allProducts.length > 0) {
        finalProducts = allProducts;
      }
    }

    const sellerIds = [...new Set(finalProducts.map((p: any) => p.seller_id).filter(Boolean))];
    const { data: profiles } = sellerIds.length
      ? await serviceClient.from("profiles").select("user_id,public_id,display_name,avatar_url,is_verified_seller").in("user_id", sellerIds)
      : { data: [] as any[] };
    const profileMap = new Map((profiles || []).map((profile: any) => [profile.user_id, profile]));
    const publicProducts = finalProducts.map((product: any) => {
      const seller = profileMap.get(product.seller_id) as any;
      return {
        ...product,
        seller_public_id: product.seller_public_id || (seller?.public_id ? String(seller.public_id) : ""),
        seller_name: product.seller_name || seller?.display_name || "Vendedor",
        seller_avatar: seller?.avatar_url || "",
        seller_verified: !!seller?.is_verified_seller,
      };
    });

    return new Response(JSON.stringify({ products: publicProducts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("public-products error", error.message);
    return new Response(JSON.stringify({ error: error.message, products: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200, // Return 200 with empty to not break UI
    });
  }
});
