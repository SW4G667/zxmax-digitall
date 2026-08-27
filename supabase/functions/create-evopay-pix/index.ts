import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: authData } = await userClient.auth.getUser(auth.slice(7));
    if (!authData.user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const clientId = String(Deno.env.get("VEXOPAY_CLIENT_ID") || "").trim();
    const clientSecret = String(Deno.env.get("VEXOPAY_CLIENT_SECRET") || "").trim();
    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "vexopay").maybeSingle();
    const config = (setting?.value || {}) as Record<string, unknown>;
    const enabled = config.pixEnabled === true;
    const baseUrl = "https://www.vexopay.com.br/api";
    if (!enabled || !clientId || !clientSecret) return json({ error: "PIX temporariamente indisponível.", code: "pix_not_configured" }, 400);

    const body = await req.json().catch(() => ({}));
    const purchaseId = Number(body.purchaseId);
    if (!Number.isInteger(purchaseId) || purchaseId <= 0) return json({ error: "Pedido inválido" }, 400);
    const { data: purchase } = await admin.from("purchases").select("id,product_id,buyer_id,buyer_email,status,amount,evopay_charge_id,pix_qr_code,pix_expires_at,payment_provider").eq("id", purchaseId).maybeSingle();
    if (!purchase || purchase.buyer_id !== authData.user.id) return json({ error: "Pedido não encontrado" }, 404);
    if (purchase.status !== "pending") return json({ error: "Este pedido não está pendente" }, 400);
    if (purchase.payment_provider && purchase.payment_provider !== "vexopay_pix") return json({ error: "O pedido foi criado para outro método de pagamento." }, 400);
    const activeCharge = purchase.pix_expires_at ? new Date(purchase.pix_expires_at).getTime() > Date.now() : false;
    if (activeCharge && String(purchase.evopay_charge_id || "").startsWith("vexo:") && purchase.pix_qr_code) {
      return json({ id: purchase.evopay_charge_id, status: "PENDING", amount: Number(purchase.amount), qrCodeText: purchase.pix_qr_code, expiresAt: purchase.pix_expires_at, qrCodeUrl: null });
    }
    const { data: profile } = await admin.from("profiles").select("display_name").eq("user_id", authData.user.id).maybeSingle();
    const document = String(body.payerDocument || "").replace(/\D/g, "");
    if (![11, 14].includes(document.length)) return json({ error: "Informe um CPF/CNPJ válido para gerar o PIX" }, 400);
    const { data: product } = await admin.from("products").select("name").eq("id", purchase.product_id).maybeSingle();
    const response = await fetch(`${baseUrl}/gateway/pix-create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ci: clientId, cs: clientSecret },
      body: JSON.stringify({ amount: Number(purchase.amount), payerName: profile?.display_name || authData.user.email?.split("@")[0] || "Comprador", payerDocument: document, description: String(product?.name || `Pedido #${purchase.id}`).slice(0, 120) }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: "Não foi possível gerar o PIX neste momento. Tente novamente mais tarde.", code: "pix_provider_unavailable" }, 400);
    const node = payload?.data ?? payload?.invoice ?? payload ?? {};
    const qrCodeText = node.copyPaste ?? node.qrCodeText ?? node.qrCode ?? node.qrcode ?? node.qr_code ?? node.pixCopiaECola ?? node.payload ?? node.emv;
    const transactionId = node.transactionId ?? node.id ?? node.txid ?? node.transaction_id ?? node.chargeId ?? node.charge_id;
    if (typeof qrCodeText !== "string" || !qrCodeText || !transactionId) return json({ error: "Não foi possível gerar o código PIX neste momento. Tente novamente.", code: "pix_code_unavailable" }, 400);
    const expiresAt = typeof node.expiresAt === "string" ? node.expiresAt : typeof node.expires_at === "string" ? node.expires_at : new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const chargeId = `vexo:${transactionId}`;
    await admin.from("purchases").update({ evopay_charge_id: chargeId, pix_qr_code: qrCodeText, pix_expires_at: expiresAt, updated_at: new Date().toISOString() }).eq("id", purchaseId);
    await admin.from("webhook_logs").insert({ source: "vexopay", event_type: "CREATE_PIX", status: "created", order_id: purchaseId, charge_id: String(transactionId), payload: { amount: Number(purchase.amount) } });
    return json({ id: chargeId, status: String(node.status || "PENDING"), amount: Number(purchase.amount), qrCodeText, expiresAt, qrCodeUrl: typeof node.qrCodeUrl === "string" ? node.qrCodeUrl : null });
  } catch (error: any) {
    console.error("create-vexopay-pix", error?.message || error);
    return json({ error: "Não foi possível gerar o PIX neste momento. Tente novamente mais tarde." }, 500);
  }
});
