import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const MAGNUS = "https://api.magnuspay.com.br";
const PAID = new Set(["COMPLETED", "PAID", "CONFIRMED", "APPROVED", "SUCCESS", "SUCCEEDED", "SETTLED"]);

async function apiKey(admin: any) {
  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "magnuspay").maybeSingle();
  const mode = String(setting?.value?.mode || "production").toLowerCase();
  if (mode === "sandbox") {
    const { data: sandboxKey, error } = await admin.rpc("get_gateway_secret_server", { _name: "zxmax_pix_sandbox_api_key" });
    if (!error && sandboxKey) return String(sandboxKey).trim();
  }
  return String(Deno.env.get("MAGNUSPAY_API_KEY") || "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método inválido." }, 405);

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Faça login para continuar." }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, service);
    const { data: userData, error: userError } = await userClient.auth.getUser(auth.slice(7));
    if (userError || !userData.user) return json({ error: "Sessão inválida." }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "create") {
      const { data: profile } = await admin.from("profiles").select("verification_status").eq("user_id", user.id).maybeSingle();
      if (profile?.verification_status !== "approved") {
        return json({ error: "Aprovação de documentos é obrigatória para criar cobranças.", code: "documents_required" }, 403);
      }

      const amount = Math.round(Number(body.amount) * 100) / 100;
      const description = String(body.description || "").trim().slice(0, 120);
      if (!Number.isFinite(amount) || amount < 2 || amount > 5000) return json({ error: "Valor permitido: R$ 2,00 a R$ 5.000,00." }, 400);
      if (description.length < 4) return json({ error: "Informe uma descrição válida para a cobrança." }, 400);

      const key = await apiKey(admin);
      if (!key) return json({ error: "O PIX não está configurado no servidor." }, 503);

      const { data: created, error: createError } = await admin.from("merchant_charges").insert({
        owner_id: user.id,
        amount,
        description,
        status: "creating",
      }).select("id").single();
      if (createError || !created?.id) return json({ error: "Não foi possível registrar a cobrança." }, 500);

      const response = await fetch(`${MAGNUS}/transactions/create`, {
        method: "POST",
        headers: { "X-API-Key": key, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          amount,
          description: `ZXMAX cobrança #${created.id} - ${description}`,
          feeToCustomer: false,
        }),
      });
      const raw = await response.text();
      let parsed: any = {};
      try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }

      if (!response.ok || parsed?.success === false) {
        await admin.from("merchant_charges").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", created.id);
        if (response.status === 429) return json({ error: "O gateway atingiu o limite temporário. Aguarde um pouco e tente novamente." }, 429);
        return json({ error: "O gateway não conseguiu criar a cobrança agora." }, 502);
      }

      const node = parsed?.data && typeof parsed.data === "object" ? parsed.data : {};
      const providerId = String(node.transactionId || node.id || "").trim();
      const qrCode = String(node.copyPaste || node.pixCode || node.qrCode || "").trim();
      if (!providerId || !qrCode) {
        await admin.from("merchant_charges").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", created.id);
        return json({ error: "O gateway retornou uma cobrança incompleta." }, 502);
      }

      const expiresRaw = node.expiresAt || node.expires_at;
      const expiresDate = expiresRaw ? new Date(String(expiresRaw)) : new Date(Date.now() + 15 * 60 * 1000);
      const providerAmount = Number(node.amount ?? amount);
      const providerFee = Number(node.platformFee ?? node.fee ?? 0);
      const providerNet = Number(node.netAmount ?? amount);
      const { error: saveError } = await admin.from("merchant_charges").update({
        provider_payment_id: providerId,
        provider_amount: Number.isFinite(providerAmount) ? providerAmount : amount,
        provider_fee: Number.isFinite(providerFee) ? providerFee : null,
        provider_net_amount: Number.isFinite(providerNet) ? providerNet : null,
        pix_qr_code: qrCode,
        status: "pending",
        expires_at: Number.isFinite(expiresDate.getTime()) ? expiresDate.toISOString() : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", created.id).eq("owner_id", user.id);
      if (saveError) return json({ error: "Cobrança criada, mas não foi possível vinculá-la à conta." }, 500);

      return json({ charge: { id: Number(created.id), amount, description, status: "pending", qrCode, providerPaymentId: providerId } }, 201);
    }

    if (action === "check") {
      const chargeId = Number(body.chargeId);
      if (!Number.isInteger(chargeId) || chargeId <= 0) return json({ error: "Cobrança inválida." }, 400);
      const { data: charge } = await admin.from("merchant_charges")
        .select("id,owner_id,amount,description,status,provider_payment_id,provider_amount,provider_fee,provider_net_amount,pix_qr_code,expires_at")
        .eq("id", chargeId).eq("owner_id", user.id).maybeSingle();
      if (!charge) return json({ error: "Cobrança não encontrada." }, 404);
      if (charge.status === "paid") return json({ paid: true, status: "paid" });
      if (!charge.provider_payment_id) return json({ error: "Cobrança sem identificador do gateway." }, 409);

      const key = await apiKey(admin);
      if (!key) return json({ error: "O PIX não está configurado no servidor." }, 503);
      const response = await fetch(`${MAGNUS}/transactions/check`, {
        method: "POST",
        headers: { "X-API-Key": key, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ transactionId: charge.provider_payment_id }),
      });
      const raw = await response.text();
      let parsed: any = {};
      try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }
      if (response.status === 429) return json({ error: "Muitas consultas ao gateway. Aguarde alguns instantes." }, 429);
      if (!response.ok || parsed?.success === false || !parsed?.data) return json({ error: "Não foi possível consultar a cobrança agora." }, 502);

      const node = parsed.data;
      const providerId = String(node.id || node.transactionId || "").trim();
      const status = String(node.status || node.transactionStatus || node.paymentStatus || "").toUpperCase();
      const providerAmount = Number(node.amount ?? node.totalAmount);
      const expectedAmount = Number(charge.provider_amount ?? charge.amount);
      if (providerId !== String(charge.provider_payment_id)) return json({ error: "Identificador divergente no gateway." }, 409);
      if (!Number.isFinite(providerAmount) || Math.round(providerAmount * 100) !== Math.round(expectedAmount * 100)) {
        return json({ error: "O valor confirmado pelo gateway é diferente da cobrança." }, 409);
      }

      if (PAID.has(status)) {
        const providerFee = Number(node.platformFee ?? node.fee ?? charge.provider_fee ?? 0);
        const providerNet = Number(node.netAmount ?? charge.provider_net_amount ?? charge.amount);
        const { data: gatewaySetting } = await admin.from("app_settings").select("value").eq("key", "merchant_gateway").maybeSingle();
        const depositFeePercent = Math.max(0, Math.min(50, Number(gatewaySetting?.value?.depositFeePercent || 0)));
        const netBeforePlatform = Number.isFinite(providerNet) && providerNet > 0 ? Math.min(Number(charge.amount), providerNet) : Number(charge.amount);
        const platformFee = Math.round((Number(charge.amount) * depositFeePercent / 100) * 100) / 100;
        const credit = Math.max(0, Math.round((netBeforePlatform - platformFee) * 100) / 100);
        if (credit <= 0) return json({ error: "A taxa configurada deixou a cobrança sem valor líquido para crédito." }, 409);

        const { error: ledgerError } = await admin.from("wallet_ledger").upsert({
          user_id: user.id,
          amount: Math.round(credit * 100) / 100,
          kind: "merchant_charge_credit",
          purchase_id: null,
          description: `Cobrança #${charge.id} confirmada - ${String(charge.description).slice(0, 120)}`,
          dedupe_key: `merchant_charge:${charge.id}:paid`,
          available_at: new Date().toISOString(),
        }, { onConflict: "dedupe_key", ignoreDuplicates: true });
        if (ledgerError) {
          return json({ error: "Pagamento confirmado, mas o crédito da carteira precisa ser reconciliado.", code: "wallet_credit_pending" }, 503);
        }

        await admin.from("merchant_charges").update({
          status: "paid",
          provider_amount: providerAmount,
          provider_fee: Number.isFinite(providerFee) ? providerFee : null,
          provider_net_amount: Number.isFinite(providerNet) ? providerNet : null,
          platform_fee: platformFee,
          credited_amount: credit,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", charge.id).eq("owner_id", user.id);
        return json({ paid: true, status: "paid", credited: credit, platformFee, depositFeePercent });
      }

      const expired = status === "EXPIRED" || (charge.expires_at && new Date(charge.expires_at).getTime() < Date.now());
      const failed = status === "FAILED" || status === "CANCELLED" || status === "CANCELED";
      if (expired || failed) {
        await admin.from("merchant_charges").update({ status: expired ? "expired" : "failed", updated_at: new Date().toISOString() }).eq("id", charge.id);
      }
      return json({ paid: false, status: expired ? "expired" : failed ? "failed" : "pending" });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("merchant-charge", error instanceof Error ? error.message : error);
    return json({ error: "Erro inesperado na cobrança." }, 500);
  }
});
