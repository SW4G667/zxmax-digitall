import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://zxmax.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = req.headers.get("Authorization") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Serviço indisponível." }, 503);
  if (!authorization.startsWith("Bearer ")) return json({ error: "Autenticação obrigatória." }, 401);

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const productId = Number(body.productId);
    const reason = String(body.reason ?? "").trim().replace(/\s+/g, " ").slice(0, 500);
    if (!Number.isInteger(productId) || productId <= 0 || reason.length < 3) {
      return json({ error: "Informe um ID de anúncio e um motivo válido." }, 400);
    }

    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await client.auth.getUser(authorization.slice(7));
    if (userError || !userData.user) return json({ error: "Autenticação obrigatória." }, 401);

    const { data, error } = await client.rpc("admin_remove_product", { _product_id: productId, _reason: reason });
    if (error || !data) {
      console.error("admin-remove-product", error?.code || "unknown");
      return json({ error: "Não foi possível retirar este anúncio." }, error?.code === "42501" ? 403 : 400);
    }

    const removed = data as Record<string, unknown>;
    let notification = "skipped";
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "product_removed",
          productId,
          productName: String(removed.name || "seu anúncio"),
          sellerId: String(removed.seller_id || ""),
          reason,
          moderationKey: `${productId}:removed:${String(removed.status || "unknown")}`,
        }),
      });
      const delivery = await response.json().catch(() => ({} as Record<string, unknown>));
      notification = delivery.sent === true ? "sent" : delivery.already_sent === true ? "already_sent" : "skipped";
    } catch {
      // A decisão de retirada já está auditada; indisponibilidade de e-mail não a reverte.
      notification = "skipped";
    }

    return json({ product: { id: productId, status: removed.status, name: removed.name }, notification });
  } catch (error) {
    console.error("admin-remove-product unexpected", error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível processar a retirada." }, 500);
  }
});
