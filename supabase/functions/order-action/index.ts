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
    "confirm_delivery",
    "confirm_receipt",
    "seller_refund",
    "open_dispute",
    "send_message",
    "approve",
    "revert",
    "check_auto_release",
  ]),
  reason: z.string().trim().optional(),
  message: z.string().trim().min(1).max(1000).optional(),
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

const EVOPAY_BASE = "https://api.evopay.cash/v1";

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

    const { orderId, action, reason, message } = parsed.data;
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

    if (action === "send_message") {
      if (!isBuyer && !isSeller && !isAdmin) return json({ error: "Apenas participantes do pedido podem enviar mensagens." }, 403);
      if (order.status === "pending") return json({ error: "Mensagens ficam disponíveis após a confirmação do pagamento." }, 409);
      const cleanMessage = message?.trim() || "";
      if (!cleanMessage) return json({ error: "Mensagem obrigatória." }, 400);
      if (containsExternalContact(cleanMessage)) {
        return json({ error: "Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, links ou telefone)." }, 400);
      }

      const from = isAdmin ? "Administração" : isSeller ? "Vendedor" : "Comprador";
      messages = [...messages, { from, text: cleanMessage, date: now }];
      const { error } = await admin
        .from("purchases")
        .update({ messages, updated_at: now })
        .eq("id", order.id);
      if (error) throw error;
      return json({ success: true, message: messages.at(-1) });
    }

    if (action === "confirm_delivery") {
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

      const provider = String(order.payment_provider || "");
      const chargeId = String(order.evopay_charge_id || "");

      // Evopay Pix - reembolso via API oficial
      if (provider === "evopay_pix" && chargeId.startsWith("evopay:")) {
        const apiKey = String(Deno.env.get("EVOPAY_API_KEY") || "").trim();
        if (!apiKey) return json({ error: "Credencial Evopay não configurada para reembolso." }, 503);

        const transactionId = chargeId.slice("evopay:".length);
        // Verifica se transação existe e está COMPLETED antes de reembolsar
        try {
          const verifyResp = await fetch(`${EVOPAY_BASE}/user/transactions/${encodeURIComponent(transactionId)}`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
          });
          const verifyBody = await verifyResp.json().catch(() => ({}));
          if (!verifyResp.ok) {
            const detail = String((verifyBody as any)?.message || `Transação não encontrada`);
            return json({ error: `Não foi possível verificar a transação para reembolso: ${detail}` }, 400);
          }
          const node = (verifyBody as any)?.data || verifyBody;
          const vStatus = String(node.status || "").toUpperCase();
          if (!["COMPLETED", "PAID"].includes(vStatus)) {
            return json({ error: `Só é possível reembolsar depósitos com status COMPLETED. Atual: ${vStatus}` }, 400);
          }
        } catch (e) {
          console.error("evopay refund verify failed", e);
          return json({ error: "Falha ao verificar transação para reembolso." }, 502);
        }

        // Solicita reembolso
        try {
          const refundResp = await fetch(`${EVOPAY_BASE}/user/refund/${encodeURIComponent(transactionId)}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ description: cleanReason.slice(0, 500) }),
          });
          const refundBody = await refundResp.json().catch(() => ({}));
          if (!refundResp.ok) {
            const detail = String((refundBody as any)?.message || (refundBody as any)?.error || `Evopay ${refundResp.status}`);
            console.error("evopay refund failed", refundResp.status, refundBody);
            return json({ error: `Falha no reembolso Evopay: ${detail.slice(0, 180)}` }, 400);
          }

          // Log do reembolso
          try {
            await admin.from("webhook_logs").insert({
              source: "evopay",
              event_type: "REFUND_REQUESTED",
              status: String((refundBody as any)?.status || "WAITING_FOR_REFUND"),
              order_id: order.id,
              charge_id: chargeId,
              payload: { transactionId, reason: cleanReason, response: refundBody },
              error: null,
            });
          } catch {}

          // Atualiza pedido para refunded via RPC oficial (mantém auditoria)
          const { data: refundResult, error: refundError } = await admin.rpc("seller_refund_order", {
            _order_id: order.id,
            _reason: cleanReason,
          });
          if (refundError) throw refundError;

          return json({ success: true, status: "refunded", provider: "evopay", refund: refundBody });
        } catch (e: any) {
          console.error("evopay refund exception", e);
          return json({ error: e?.message || "Erro ao processar reembolso Evopay" }, 400);
        }
      }

      // Outros provedores ainda exigem implementação específica
      return json({
        error: `O reembolso por ${provider || "este método"} ainda exige endpoint oficial. No momento apenas Evopay Pix possui reembolso automático implementado.`,
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
