import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://zxmax.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const safeReason = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 500);

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
    const token = authorization.slice(7);
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Autenticação obrigatória." }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const productId = Number(body.productId);
    const approved = body.approved;
    const reason = safeReason(body.reason);
    if (!Number.isInteger(productId) || productId <= 0 || typeof approved !== "boolean") {
      return json({ error: "Dados de moderação inválidos." }, 400);
    }
    if (!approved && reason.length < 3) return json({ error: "Informe um motivo de ao menos 3 caracteres." }, 400);

    // O RPC mantém a fonte de autorização e a auditoria no banco, usando o JWT
    // do operador em vez da chave de serviço.
    const { data: product, error: moderationError } = await authClient.rpc("moderate_product", {
      _product_id: productId,
      _approved: approved,
      _reason: approved ? null : reason,
    });
    if (moderationError || !product) {
      console.error("moderate-product", moderationError?.code || "not_found");
      return json({ error: "Não foi possível concluir a moderação do anúncio." }, moderationError?.code === "42501" ? 403 : 400);
    }

    const updatedAt = String((product as Record<string, unknown>).updated_at || "");
    const emailPayload = {
      type: approved ? "product_approved" : "product_rejected",
      productId,
      reason: approved ? undefined : reason,
      moderationKey: `${productId}:${approved ? "approved" : "rejected"}:${updatedAt}`,
    };
    let notification = "skipped";
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });
      const delivery = await response.json().catch(() => ({} as Record<string, unknown>));
      notification = delivery.sent === true ? "sent" : delivery.already_sent === true ? "already_sent" : "skipped";
    } catch {
      // A decisão no banco já foi auditada; indisponibilidade de e-mail não pode
      // revertê-la nem revelar detalhes do provedor ao operador.
      notification = "skipped";
    }

    return json({ product: { id: productId, approved, name: (product as Record<string, unknown>).name || "Anúncio" }, notification });
  } catch (error) {
    console.error("moderate-product unexpected", error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível processar a moderação." }, 500);
  }
});
