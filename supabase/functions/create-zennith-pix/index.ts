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

const DEFAULT_BASE = "https://zennithpay.online/api/v1";

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

    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "zennithpay").maybeSingle();
    const cfg = (setting?.value || {}) as Record<string, unknown>;
    // Nunca ler credencial do banco: a API Key fica exclusivamente nos secrets
    // da função Edge e não pode ser acessada pela interface administrativa.
    const apiKey = String(Deno.env.get("ZENNITH_API_KEY") || "").trim();
    const baseUrl = String(cfg.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    const pixEnabled = typeof cfg.pixEnabled === "boolean" ? cfg.pixEnabled : cfg.enabled !== false;
    if (!apiKey || !pixEnabled) {
      return json({ error: "O PIX está temporariamente indisponível. Avise o suporte.", code: "zennith_not_configured" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const purchaseId = Number(body.purchaseId);
    if (!purchaseId || Number.isNaN(purchaseId)) return json({ error: "Pedido inválido" }, 400);

    const { data: purchase, error: purchaseError } = await admin
      .from("purchases")
      .select("id, product_id, buyer_id, buyer_email, status, amount, evopay_charge_id, pix_qr_code, pix_expires_at")
      .eq("id", purchaseId)
      .maybeSingle();

    if (purchaseError || !purchase) return json({ error: "Pedido não encontrado" }, 404);
    if (purchase.buyer_id !== userData.user.id) return json({ error: "Você só pode pagar seus próprios pedidos" }, 403);
    if (purchase.status !== "pending") return json({ error: "Este pedido não está pendente" }, 400);

    const existingExpiresAt = purchase.pix_expires_at ? new Date(purchase.pix_expires_at).getTime() : 0;
    if (
      purchase.evopay_charge_id &&
      String(purchase.evopay_charge_id).startsWith("zennith:") &&
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
      });
    }

    const amount = Number(purchase.amount);
    if (!Number.isFinite(amount) || amount < 2) {
      return json({ error: "Valor mínimo para PIX é R$ 2,00" }, 400);
    }

    const { data: product } = await admin.from("products").select("name").eq("id", purchase.product_id).maybeSingle();
    const { data: buyerProfile } = await admin.from("profiles").select("display_name,cpf").eq("user_id", userData.user.id).maybeSingle();
    const document = String(buyerProfile?.cpf || body.payerDocument || "").replace(/\D/g, "");
    if (![11, 14].includes(document.length)) {
      return json({ error: "Cadastre um CPF/CNPJ válido no perfil antes de pagar" }, 400);
    }

    const referenceId = `zxmax-purchase-${purchaseId}`;
    const payload = {
      amount,
      description: String(product?.name || `Pedido #${purchaseId}`).slice(0, 120),
      reference_id: referenceId,
      customer: {
        name: String(buyerProfile?.display_name || userData.user.email?.split("@")[0] || "Comprador").slice(0, 80),
        document,
      },
      metadata: { purchase_id: String(purchaseId), platform: "zxmax" },
    };

    const resp = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": apiKey,
        "X-Idempotency-Key": referenceId,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({} as Record<string, unknown>));
    if (!resp.ok) {
      const detail = String(data?.detail || data?.error || data?.message || `ZennithPay ${resp.status}`);
      console.error("create-zennith-pix failed", resp.status, data);
      return json({ error: `Não foi possível gerar o PIX: ${detail.slice(0, 180)}` }, 400);
    }

    const node = (data?.data && typeof data.data === "object" ? data.data : data) as Record<string, unknown>;
    const qrCodeText = String(
      node.pix_copy_paste || node.pixCopyPaste || node.copy_paste || node.emv || node.qr_code || "",
    );
    if (!qrCodeText) {
      return json({ error: "A ZennithPay não devolveu o código Pix. Tente novamente." }, 400);
    }

    const chargeId = `zennith:${referenceId}`;
    const expiresAt = typeof node.expires_at === "string"
      ? node.expires_at
      : new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const qrCodeUrl = typeof node.pix_qr_code_url === "string"
      ? node.pix_qr_code_url
      : typeof node.pix_qr_code_base64 === "string"
        ? node.pix_qr_code_base64
        : null;

    await admin.from("purchases").update({
      evopay_charge_id: chargeId,
      pix_qr_code: qrCodeText,
      pix_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", purchaseId);

    try {
      await admin.from("webhook_logs").insert({
        source: "zennithpay",
        event_type: "CREATE_PIX",
        status: "created",
        order_id: purchaseId,
        charge_id: chargeId,
        payload: { referenceId, amount, response: data },
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
    });
  } catch (error: any) {
    console.error("create-zennith-pix error:", error?.message || error);
    return json({ error: error?.message || "Erro ao criar cobrança Pix" }, 400);
  }
});
