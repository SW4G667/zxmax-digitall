import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

// A área de pedidos usa IDs públicos da contraparte. E-mail não é necessário
// para acompanhar uma compra e não deve retornar ao navegador nesse contrato.
const PURCHASE_COLUMNS = "id,product_id,buyer_id,buyer_public_id,seller_id,seller_public_id,status,amount,payment_provider,messages,reviewed,review_stars,review_comment,variation_name,created_at,updated_at,evopay_charge_id,pix_qr_code,pix_expires_at,delivered_pending_at,refund_reason,refunded_at,seller_released,released_at";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "Serviço indisponível" }, 503);

  const userClient = createClient(supabaseUrl, anonKey);
  const { data: auth, error: authError } = await userClient.auth.getUser(authHeader.slice(7));
  if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: adminRole, error: roleError } = await admin.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
  if (roleError) return json({ error: "Não foi possível validar a sessão." }, 503);

  let query = admin.from("purchases").select(PURCHASE_COLUMNS).order("created_at", { ascending: false });
  if (adminRole !== true) query = query.or(`buyer_id.eq.${auth.user.id},seller_id.eq.${auth.user.id}`);

  const { data, error } = await query;
  if (error) {
    console.error("[get-my-purchases] query failed", error.message);
    return json({ error: "Não foi possível carregar seus pedidos." }, 503);
  }

  const purchases = (data ?? []).map((purchase) => {
    // O código PIX e o identificador de cobrança são necessários somente para
    // o comprador retomar o próprio pagamento pendente; o vendedor não os vê.
    if (adminRole !== true && purchase.buyer_id !== auth.user.id) {
      const { evopay_charge_id: _chargeId, pix_qr_code: _pixCode, pix_expires_at: _pixExpires, ...safePurchase } = purchase;
      return safePurchase;
    }
    return purchase;
  });

  return json({ purchases });
});
