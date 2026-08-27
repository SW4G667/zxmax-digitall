import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/** Columns safe to expose publicly. `seller_email` and `delivery_content` are
 * intentionally absent — this endpoint is reachable by anonymous visitors. */
const PUBLIC_COLUMNS =
  "id,seller_id,seller_public_id,seller_name,name,price,category,image,banner," +
  "description,approved,delivery_type,variations,questions,sales,rating," +
  "created_at,updated_at,stock,min_quantity,delivery_time";

const LEGACY_COLUMNS =
  "id,seller_id,seller_public_id,seller_name,name,price,category,image,banner," +
  "description,approved,delivery_type,variations,questions,sales,rating," +
  "created_at,updated_at";

const MAX_LIMIT = 100;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Service role bypasses RLS, so the `approved = true` filter here IS the
    // access-control boundary. It must never be relaxed: an earlier version
    // fell back to returning every row (including other sellers' pending
    // listings) whenever the approved set was empty.
    let products: unknown[] | null = null;
    let lastError: unknown = null;

    for (const columns of [PUBLIC_COLUMNS, LEGACY_COLUMNS]) {
      const { data, error } = await serviceClient
        .from("products")
        .select(columns)
        .eq("approved", true)
        .order("created_at", { ascending: false })
        .limit(MAX_LIMIT);
      if (!error) { products = data ?? []; break; }
      lastError = error;
    }

    if (products === null) throw lastError ?? new Error("catalog unavailable");

    // Old product rows may predate seller_public_id. Enrich only with the
    // public identifier from profiles; do not expose contact data.
    const sellerIds = [...new Set(
      products.map((product: any) => String(product?.seller_id || "")).filter(Boolean),
    )];
    const publicIds = new Map<string, string>();
    if (sellerIds.length) {
      const { data: profiles, error: profileError } = await serviceClient
        .from("profiles")
        .select("user_id, public_id")
        .in("user_id", sellerIds);
      if (profileError) throw profileError;
      for (const profile of profiles || []) {
        if (profile.user_id && profile.public_id) publicIds.set(String(profile.user_id), String(profile.public_id));
      }
    }
    const enrichedProducts = products.map((product: any) => ({
      ...product,
      seller_public_id: product.seller_public_id || publicIds.get(String(product.seller_id)) || null,
    }));

    return new Response(JSON.stringify({ products: enrichedProducts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=15" },
    });
  } catch (error) {
    // Log server-side only; the client gets a flag, never the raw message.
    console.error("public-products error", error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({ products: [], unavailable: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 503,
    });
  }
});
