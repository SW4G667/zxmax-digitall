import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EVOPAY_BASE = "https://api.evopay.cash/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    // Configuração Evopay - lida de app_settings e secrets
    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "evopay").maybeSingle();
    const cfg = (setting?.value || {}) as Record<string, unknown>;
    const apiKey = String(Deno.env.get("EVOPAY_API_KEY") || "").trim();
    const pixEnabled = typeof cfg.pixEnabled === "boolean" ? cfg.pixEnabled : cfg.enabled !== false;
    // Por padrão, se não houver configuração, consideramos habilitado se houver API key
    const effectiveEnabled = cfg.pixEnabled === undefined ? !!apiKey : pixEnabled;

    if (!apiKey || !effectiveEnabled) {
      return json({ error: "O PIX via Evopay está temporariamente indisponível. Avise o suporte.", code: "evopay_not_configured" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const purchaseId = Number(body.purchaseId);
    if (!purchaseId || Number.isNaN(purchaseId)) return json({ error: "Pedido inválido" }, 400);

    const { data: purchase, error: purchaseError } = await admin
      .from("purchases")
      .select("id, product_id, buyer_id, buyer_email, status, amount, evopay_charge_id, pix_qr_code, pix_expires_at, payment_provider")
      .eq("id", purchaseId)
      .maybeSingle();

    if (purchaseError || !purchase) return json({ error: "Pedido não encontrado" }, 404);
    if (purchase.buyer_id !== userData.user.id) return json({ error: "Você só pode pagar seus próprios pedidos" }, 403);
    if (purchase.status !== "pending") return json({ error: "Este pedido não está pendente" }, 400);

    // Se já existe um charge válido da Evopay e ainda não expirou, reutiliza
    const existingExpiresAt = purchase.pix_expires_at ? new Date(purchase.pix_expires_at).getTime() : 0;
    if (
      purchase.evopay_charge_id &&
      String(purchase.evopay_charge_id).startsWith("evopay:") &&
      purchase.pix_qr_code &&
      existingExpiresAt > Date.now()
    ) {
      return json({
        id: purchase.evopay_charge_id,
        status: "PENDING",
        amount: Number(purchase.amount),
        qrCodeText: purchase.pix_qr_code,
        expiresAt: purchase.pix_expires_at,
        qrCodeUrl: null,
        qrCodeBase64: null,
      });
    }

    const amount = Number(purchase.amount);
    if (!Number.isFinite(amount) || amount < 2) {
      return json({ error: "Valor mínimo para PIX é R$ 2,00" }, 400);
    }

    const { data: product } = await admin.from("products").select("name").eq("id", purchase.product_id).maybeSingle();
    const { data: buyerProfile } = await admin.from("profiles").select("display_name, email").eq("user_id", userData.user.id).maybeSingle();

    const document = String(body.payerDocument || "").replace(/\D/g, "");
    if (![11, 14].includes(document.length)) {
      return json({ error: "Informe um CPF/CNPJ válido para gerar o PIX" }, 400);
    }

    const buyerName = String(buyerProfile?.display_name || userData.user.email?.split("@")[0] || "Comprador").slice(0, 80);
    const buyerEmail = String(buyerProfile?.email || userData.user.email || "").slice(0, 120);

    const referenceId = `zxmax-purchase-${purchaseId}`;
    const callbackUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/evopay-webhook`;

    const payload: Record<string, unknown> = {
      amount,
      callbackUrl,
      clientReference: referenceId,
      generatedName: buyerName.replace(/[^A-Za-zÀ-ÿ\s]/g, " ").trim() || "Comprador",
      generatedDocument: document,
      expiresIn: 1800, // 30 minutos
    };
    if (buyerEmail && buyerEmail.includes("@")) {
      payload.generatedEmail = buyerEmail;
    }

    const resp = await fetch(`${EVOPAY_BASE}/pix/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({} as Record<string, unknown>));
    if (!resp.ok) {
      console.error("create-evopay-pix failed", resp.status, data);
      const msg = typeof (data as any)?.message === "string" ? (data as any).message : "";
      if (resp.status === 401) {
        return json({ error: "Credencial Evopay inválida. Avise o suporte.", code: "evopay_auth_failed" }, 400);
      }
      if (resp.status === 403) {
        return json({ error: "Permissão DEPOSIT não habilitada no token Evopay.", code: "evopay_forbidden" }, 400);
      }
      return json({ error: `Não foi possível gerar o PIX: ${msg || "tente novamente"}`.slice(0, 180), code: "pix_provider_unavailable" }, 400);
    }

    const node = (data as any)?.data && typeof (data as any).data === "object" ? (data as any).data : data as Record<string, unknown>;
    const qrCodeText = String(node.qrCodeText || node.qr_code_text || node.qrCode || node.copyPaste || "");
    const transactionId = String(node.id || "");
    if (!qrCodeText || !transactionId) {
      return json({ error: "Não foi possível gerar o código PIX neste momento. Tente novamente.", code: "pix_code_unavailable" }, 400);
    }

    const chargeId = `evopay:${transactionId}`;
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const qrCodeUrl = typeof node.qrCodeUrl === "string" ? node.qrCodeUrl : null;
    const qrCodeBase64 = typeof node.qrCodeBase64 === "string" ? node.qrCodeBase64 : null;

    await admin.from("purchases").update({
      evopay_charge_id: chargeId,
      pix_qr_code: qrCodeText,
      pix_expires_at: expiresAt,
      payment_provider: "evopay_pix",
      updated_at: new Date().toISOString(),
    }).eq("id", purchaseId);

    try {
      await admin.from("webhook_logs").insert({
        source: "evopay",
        event_type: "CREATE_PIX",
        status: "created",
        order_id: purchaseId,
        charge_id: chargeId,
        payload: { referenceId, amount, transactionId },
        error: null,
      });
    } catch { /* ignore */ }

    return json({
      id: chargeId,
      status: String(node.status || "PENDING"),
      amount,
      qrCodeText,
      expiresAt,
      qrCodeUrl,
      qrCodeBase64,
    });
  } catch (error: any) {
    console.error("create-evopay-pix error:", error?.message || error);
    return json({ error: error?.message || "Erro ao criar cobrança Pix" }, 400);
  }
});
