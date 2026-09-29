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
    "confirm_receipt",         // comprador confirma recebimento -> delivered; saldo segue retenção
    "seller_refund",           // vendedor inicia reembolso -> comprador informa destino PIX
    "submit_refund_details",    // comprador confirma e informa titular + chave PIX
    "complete_refund",          // vendedor confirma que o PIX foi enviado
    "open_dispute",            // comprador abre disputa -> dispute
    "send_message",            // participantes enviam mensagem autorizada ao pedido
    "approve",                 // admin aprova -> delivered
    "revert",                  // admin reverte -> paid
    "check_auto_release",      // conclui pedidos vencidos e libera saldos cujo prazo acabou
  ]),
  reason: z.string().trim().optional(),
  message: z.string().trim().min(1).max(1000).optional(),
  accountHolderName: z.string().trim().max(120).optional(),
  pixKey: z.string().trim().max(180).optional(),
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

async function notifyOrderEmail(type: string, purchaseId: number) {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return;
  try {
    const response = await fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ type, purchaseId }),
    });
    if (!response.ok && response.status !== 202) {
      console.warn("order email not delivered", type, purchaseId, response.status);
    }
  } catch (error) {
    console.warn("order email failed", type, purchaseId, error instanceof Error ? error.message : "unknown");
  }
}

async function notifyOrderEmails(types: string[], purchaseId: number) {
  await Promise.all(types.map((type) => notifyOrderEmail(type, purchaseId)));
}

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

    const { orderId, action, reason, message, accountHolderName, pixKey } = parsed.data;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: order } = await admin
      .from("purchases")
      .select("id, buyer_id, seller_id, status, amount, payment_provider, evopay_charge_id, messages, funds_available_at, seller_released")
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
      // Vendedor confirma entrega -> status delivered_pending_confirmation
      if (!isSeller && !isAdmin) return json({ error: "Apenas o vendedor pode marcar a entrega do pedido." }, 403);
      if (order.status !== "paid") return json({ error: "O pedido só pode ser marcado como entregue quando estiver em status pago." }, 400);

      const autoCloseDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const formattedCloseDate = autoCloseDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
        " às " + autoCloseDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const fundsDate = order.funds_available_at ? new Date(order.funds_available_at) : null;
      const fundsText = fundsDate && Number.isFinite(fundsDate.getTime())
        ? " O saldo da venda continua retido até " + fundsDate.toLocaleDateString("pt-BR") + "."
        : " O saldo continua no período de segurança da carteira.";

      messages = [
        ...messages,
        {
          from: "System",
          text: `📦 O vendedor marcou o pedido como entregue. O comprador pode confirmar ou abrir disputa. Sem ação, o pedido é concluído automaticamente em ${formattedCloseDate}.${fundsText}`,
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
      await notifyOrderEmail("delivery_marked", Number(order.id));
      return json({ success: true, status: "delivered_pending_confirmation", autoCloseAt: autoCloseDate.toISOString(), fundsAvailableAt: order.funds_available_at || null });
    }

    if (action === "confirm_receipt") {
      // Confirma a entrega, mas NÃO antecipa o saldo do vendedor. O prazo de
      // segurança configurado (5–7 dias) é preservado no banco.
      if (!isBuyer && !isAdmin) return json({ error: "Apenas o comprador pode confirmar o recebimento do produto." }, 403);
      if (!["paid", "delivered_pending_confirmation"].includes(order.status)) {
        return json({ error: "Este pedido não está aguardando confirmação de recebimento." }, 400);
      }

      messages = [
        ...messages,
        {
          from: "System",
          text: "✅ Comprador confirmou o recebimento. Pedido concluído; o saldo do vendedor continua seguindo o prazo de segurança da carteira.",
          date: now,
        },
      ];

      const { error } = await admin
        .from("purchases")
        .update({
          status: "delivered",
          seller_released: false,
          released_at: null,
          messages,
          updated_at: now,
        })
        .eq("id", order.id);

      if (error) throw error;
      await notifyOrderEmails(["receipt_confirmed_buyer", "receipt_confirmed_seller"], Number(order.id));
      return json({ success: true, status: "delivered", fundsAvailableAt: order.funds_available_at || null });
    }

    if (action === "seller_refund") {
      if (!isSeller && !isAdmin) return json({ error: "Apenas o vendedor do pedido ou um administrador pode solicitar o reembolso." }, 403);
      if (["refunded", "cancelled"].includes(order.status)) return json({ error: "Este pedido já foi reembolsado ou cancelado." }, 400);
      if (order.status === "pending") return json({ error: "Não é possível reembolsar um pedido pendente de pagamento." }, 400);
      const cleanReason = (reason || "").trim();
      if (cleanReason.length < 10) return json({ error: "O motivo do reembolso deve ter pelo menos 10 caracteres." }, 400);
      if (containsExternalContact(cleanReason)) return json({ error: "Não é permitido enviar contatos externos no motivo do reembolso." }, 400);

      const { data: existing } = await admin.from("refund_requests").select("id,status").eq("purchase_id", order.id).maybeSingle();
      if (existing && existing.status !== "cancelled") return json({ success: true, status: existing.status, refundPending: true });

      const { error: requestError } = await admin.from("refund_requests").upsert({
        purchase_id: order.id, buyer_id: order.buyer_id, seller_id: order.seller_id,
        reason: cleanReason, status: "awaiting_buyer_details", account_holder_name: null,
        pix_key: null, details_submitted_at: null, paid_at: null, updated_at: now,
      }, { onConflict: "purchase_id" });
      if (requestError) throw requestError;

      messages = [...messages, { from: "System", text: "↩️ O vendedor solicitou um reembolso. Comprador: use o botão “Confirmar reembolso” neste pedido para informar, com segurança, o nome do titular e a chave PIX de destino.", date: now }];
      const { error: updateError } = await admin.from("purchases").update({
        refund_reason: cleanReason, messages, updated_at: now,
      }).eq("id", order.id);
      if (updateError) throw updateError;
      await notifyOrderEmails(["refund_buyer", "refund_seller"], Number(order.id));
      return json({ success: true, status: "awaiting_buyer_details", refundPending: true });
    }

    if (action === "submit_refund_details") {
      if (!isBuyer) return json({ error: "Apenas o comprador pode confirmar os dados do reembolso." }, 403);
      const holderName = String(accountHolderName || "").trim().replace(/\s+/g, " ");
      const refundPixKey = String(pixKey || "").trim();
      if (holderName.length < 5 || holderName.length > 120) return json({ error: "Informe o nome completo do titular exatamente como consta no banco." }, 400);
      if (refundPixKey.length < 5 || refundPixKey.length > 180) return json({ error: "Informe uma chave PIX válida." }, 400);
      const { data: request } = await admin.from("refund_requests").select("id,status").eq("purchase_id", order.id).eq("buyer_id", auth.user.id).maybeSingle();
      if (!request) return json({ error: "Não existe solicitação de reembolso para este pedido." }, 404);
      if (request.status === "paid") return json({ error: "Este reembolso já foi concluído." }, 409);
      const { error } = await admin.from("refund_requests").update({
        account_holder_name: holderName, pix_key: refundPixKey, status: "ready_to_pay",
        details_submitted_at: now, updated_at: now,
      }).eq("id", request.id);
      if (error) throw error;
      messages = [...messages, { from: "System", text: "✅ O comprador confirmou os dados bancários do reembolso. Os dados PIX ficam visíveis somente aos participantes autorizados do pedido.", date: now }];
      await admin.from("purchases").update({ messages, updated_at: now }).eq("id", order.id);
      return json({ success: true, status: "ready_to_pay" });
    }

    if (action === "complete_refund") {
      if (!isSeller && !isAdmin) return json({ error: "Apenas o vendedor ou a administração pode concluir o reembolso." }, 403);
      const { data: request } = await admin.from("refund_requests").select("id,status").eq("purchase_id", order.id).maybeSingle();
      if (!request || request.status !== "ready_to_pay") return json({ error: "Os dados do comprador ainda não foram confirmados." }, 409);
      // This action records a refund only after the seller confirms the transfer
      // was actually sent. It never credits the internal ZXMAX wallet.
      const { error: reqError } = await admin.from("refund_requests").update({ status: "paid", paid_at: now, updated_at: now }).eq("id", request.id);
      if (reqError) throw reqError;
      messages = [...messages, { from: "System", text: "✅ O vendedor marcou o reembolso PIX como enviado. O valor não foi creditado na carteira ZXMAX.", date: now }];
      const { error: orderError } = await admin.from("purchases").update({
        status: "refunded", refunded_at: now, seller_released: false, released_at: null, messages, updated_at: now,
      }).eq("id", order.id);
      if (orderError) throw orderError;
      await notifyOrderEmails(["refund_buyer", "refund_seller"], Number(order.id));
      return json({ success: true, status: "refunded" });
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
      await notifyOrderEmails(["dispute_opened_buyer", "dispute_opened_seller"], Number(order.id));
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
          seller_released: false,
          released_at: null,
          messages,
          updated_at: now,
        })
        .eq("id", order.id);

      if (error) throw error;
      if (order.status === "dispute") {
        await notifyOrderEmails(["dispute_resolved_buyer", "dispute_resolved_seller"], Number(order.id));
      }
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
