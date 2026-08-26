import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  orderId: z.number().int().positive(),
  action: z.enum([
    "confirm_delivery",        // vendedor confirma entrega -> delivered_pending_confirmation
    "confirm_receipt",         // comprador confirma recebimento -> delivered (liberação imediata)
    "seller_refund",           // vendedor reembolsa comprador -> refunded
    "open_dispute",            // comprador abre disputa -> dispute
    "approve",                 // admin aprova -> delivered
    "revert",                  // admin reverte -> paid
    "check_auto_release",      // verifica e processa auto-liberações de 3 dias
  ]),
  reason: z.string().trim().optional(),
});

const containsExternalContact = (text: string): boolean => {
  const clean = text.toLowerCase();
  if (!clean) return false;
  if (/(whats|zap|wpp|whasapp|vatsapp|discord|disc|\.gg\/|telegram|t\.me|insta|instagram|email|e-mail|gmail|hotmail|yahoo|outlook|telefone|celular|fone)/.test(clean)) return true;
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(clean)) return true;
  if (/(https?:\/\/|www\.|[a-z0-9-]+\.(com|br|net|org|io|me|gg))/.test(clean)) return true;
  if (/(\+?55\s*)?(\(?\d{2}\)?\s*)?\d{4,5}[-\s.]?\d{4}/.test(clean)) return true;
  return false;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: auth, error: authError } = await userClient.auth.getUser(authHeader.slice(7));
    if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return json({ error: "Dados inválidos", fields: parsed.error.flatten().fieldErrors }, 400);
    }

    const { orderId, action, reason } = parsed.data;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: order } = await admin
      .from("purchases")
      .select("id, buyer_id, seller_id, status, amount, payment_provider, evopay_charge_id, messages")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return json({ error: "Pedido não encontrado" }, 404);

    const { data: adminRole } = await admin.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    const isAdmin = adminRole === true;
    const isSeller = auth.user.id === order.seller_id;
    const isBuyer = auth.user.id === order.buyer_id;

    const now = new Date().toISOString();
    let messages = Array.isArray(order.messages) ? order.messages : [];

    if (action === "confirm_delivery") {
      // Vendedor confirma entrega -> status delivered_pending_confirmation
      if (!isSeller && !isAdmin) return json({ error: "Apenas o vendedor pode marcar a entrega do pedido." }, 403);
      if (order.status !== "paid") return json({ error: "O pedido só pode ser marcado como entregue quando estiver em status pago." }, 400);

      const autoReleaseDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const formattedDate = autoReleaseDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
        " às " + autoReleaseDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      messages = [
        ...messages,
        {
          from: "System",
          text: `📦 O vendedor marcou o pedido como entregue! Aguardando confirmação do comprador.\nLiberação automática para o vendedor em ${formattedDate}.`,
          date: now,
        },
      ];

      const { error } = await admin
        .from("purchases")
        .update({
          status: "delivered_pending_confirmation",
          delivered_pending_at: now,
          messages,
          updated_at: now,
        })
        .eq("id", order.id);

      if (error) throw error;
      return json({ success: true, status: "delivered_pending_confirmation", autoReleaseAt: autoReleaseDate.toISOString() });
    }

    if (action === "confirm_receipt") {
      // Comprador confirma recebimento -> status delivered (liberação imediata)
      if (!isBuyer && !isAdmin) return json({ error: "Apenas o comprador pode confirmar o recebimento do produto." }, 403);
      if (!["paid", "delivered_pending_confirmation"].includes(order.status)) {
        return json({ error: "Este pedido não está aguardando confirmação de recebimento." }, 400);
      }

      messages = [
        ...messages,
        {
          from: "System",
          text: "✅ Comprador confirmou o recebimento do produto. Dinheiro liberado para o vendedor!",
          date: now,
        },
      ];

      const { error } = await admin
        .from("purchases")
        .update({
          status: "delivered",
          seller_released: true,
          released_at: now,
          messages,
          updated_at: now,
        })
        .eq("id", order.id);

      if (error) throw error;
      return json({ success: true, status: "delivered", releasedAt: now });
    }

    if (action === "seller_refund") {
      // Vendedor reembolsa comprador
      if (!isSeller && !isAdmin) return json({ error: "Apenas o vendedor do pedido ou um administrador pode realizar o reembolso." }, 403);
      if (["refunded", "cancelled"].includes(order.status)) {
        return json({ error: "Este pedido já foi reembolsado ou cancelado." }, 400);
      }
      if (order.status === "pending") {
        return json({ error: "Não é possível reembolsar um pedido pendente de pagamento." }, 400);
      }

      const cleanReason = (reason || "").trim();
      if (cleanReason.length < 10) {
        return json({ error: "O motivo do reembolso deve ter pelo menos 10 caracteres." }, 400);
      }
      if (containsExternalContact(cleanReason)) {
        return json({ error: "Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, links ou telefone)." }, 400);
      }

      const provider = String(order.payment_provider || order.evopay_charge_id || "desconhecido");
      return json({
        error: `O reembolso por ${provider} exige endpoint oficial, confirmação verificável do provedor e conciliação antes de alterar o pedido.`,
      }, 409);
    }

    if (action === "open_dispute") {
      if (!isBuyer && !isAdmin) return json({ error: "Apenas o comprador pode abrir uma disputa." }, 403);
      if (!["paid", "delivered", "delivered_pending_confirmation"].includes(order.status)) {
        return json({ error: "Disputa não permitida para este status do pedido." }, 400);
      }
      if (!reason || reason.trim().length < 10) {
        return json({ error: "O motivo da disputa deve ter pelo menos 10 caracteres." }, 400);
      }

      messages = [...messages, { from: "System", text: `⚠️ DISPUTA ABERTA: ${reason.trim()}`, date: now }];

      const { error } = await admin
        .from("purchases")
        .update({ status: "dispute", messages, updated_at: now })
        .eq("id", order.id);

      if (error) throw error;
      return json({ success: true, status: "dispute" });
    }

    if (action === "approve" || action === "revert") {
      if (!isAdmin) return json({ error: "Apenas administradores." }, 403);
      if (action === "approve" && !["paid", "dispute", "delivered_pending_confirmation"].includes(order.status)) {
        return json({ error: "Transição não permitida." }, 409);
      }
      if (action === "revert" && order.status !== "dispute") return json({ error: "Transição não permitida." }, 409);

      const nextStatus = action === "approve" ? "delivered" : "paid";
      const { error } = await admin
        .from("purchases")
        .update({
          status: nextStatus,
          seller_released: action === "approve",
          released_at: action === "approve" ? now : null,
          messages,
          updated_at: now,
        })
        .eq("id", order.id);

      if (error) throw error;
      return json({ success: true, status: nextStatus });
    }

    if (action === "check_auto_release") {
      if (!isAdmin) return json({ error: "Apenas administradores podem executar a liberação automática manualmente." }, 403);
      const { data: count, error } = await admin.rpc("process_auto_release_orders");
      if (error) throw error;
      return json({ success: true, autoReleasedCount: count || 0 });
    }

    return json({ error: "Ação não reconhecida" }, 400);
  } catch (error) {
    console.error("order-action error:", error);
    return json({ error: error instanceof Error ? error.message : "Erro inesperado" }, 400);
  }
});
