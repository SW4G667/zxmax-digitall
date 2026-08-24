import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Erro de configuração: mensagem já amigável, sem nomear secrets internos. */
class PixConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PixConfigError";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate the caller is authenticated and use the verified identity only.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // Credenciais — VexoPay é o gateway primário de PIX/Crypto (decisão do
    // dono); a EvoPay permanece como fallback automático quando configurada.
    // A resolução aqui precisa ser IDÊNTICA à de `integrations-config`
    // (action payment_methods): painel (app_settings) primeiro, secret de
    // ambiente como fallback — só anunciamos o que consegue realmente cobrar.
    // ------------------------------------------------------------------
    let evoApiKey = Deno.env.get("EVOPAY_API_KEY");
    let setting: { value: any } | null = null;
    try {
      const { data } = await serviceClient.from("app_settings").select("value").eq("key", "evopay").maybeSingle();
      setting = data as { value: any } | null;
      if (setting?.value?.apiKey) {
        evoApiKey = setting.value.apiKey;
      }
    } catch (_e) { /* fallback to secret */ }
    const evopayReady = !!evoApiKey && setting?.value?.enabled !== false;

    let vexoCi = Deno.env.get("VEXOPAY_CLIENT_ID");
    let vexoCs = Deno.env.get("VEXOPAY_CLIENT_SECRET");
    let vexoBaseUrl: string | undefined;
    let vexoEnabled = true;
    try {
      const { data: vexoRow } = await serviceClient.from("app_settings").select("value").eq("key", "vexopay").maybeSingle();
      const v = vexoRow?.value || {};
      if (v.clientId) vexoCi = v.clientId;
      if (v.clientSecret) vexoCs = v.clientSecret;
      if (typeof v.baseUrl === "string" && v.baseUrl.trim() !== "") vexoBaseUrl = v.baseUrl.replace(/\/$/, "");
      vexoEnabled = v.enabled !== false;
    } catch (_e) { /* fallback to secrets */ }
    const vexopayReady = !!vexoCi && !!vexoCs && vexoEnabled;

    if (setting?.value?.enabled === false && !vexopayReady) {
      throw new PixConfigError("O PIX está desativado no momento. Escolha outra forma de pagamento.");
    }
    if (!evopayReady && !vexopayReady) {
      throw new PixConfigError("O PIX está temporariamente indisponível: nenhum gateway configurado. Avise o suporte.");
    }

    const body = await req.json();
    const purchaseId = Number(body.purchaseId);
    if (!purchaseId || Number.isNaN(purchaseId)) throw new Error("Pedido inválido");

    const { data: purchase, error: purchaseError } = await serviceClient
      .from("purchases")
      .select("id, product_id, buyer_id, buyer_email, status, amount, evopay_charge_id, pix_qr_code, pix_expires_at")
      .eq("id", purchaseId)
      .maybeSingle();

    if (purchaseError || !purchase) throw new Error("Pedido não encontrado");
    if (purchase.buyer_id !== userData.user.id) throw new Error("Você só pode pagar seus próprios pedidos");
    if (purchase.status !== "pending") throw new Error("Este pedido não está pendente");

    const existingExpiresAt = purchase.pix_expires_at ? new Date(purchase.pix_expires_at).getTime() : 0;
    if (purchase.evopay_charge_id && purchase.pix_qr_code && existingExpiresAt > Date.now()) {
      const existingId = String(purchase.evopay_charge_id);
      return new Response(JSON.stringify({
        id: existingId,
        status: "PENDING",
        amount: Number(purchase.amount),
        qrCodeText: purchase.pix_qr_code,
        expiresAt: purchase.pix_expires_at,
        // QR em URL só existe na EvoPay; cobranças `vexo:` renderizam o QR
        // localmente a partir do copia-e-cola (PixPaymentModal já faz isso).
        qrCodeUrl: existingId.startsWith("vexo:") ? null : `https://api.evopay.cash/v1/pix/qr-code/${existingId}`,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
    }

    const value = Number(purchase.amount);
    const { data: product } = await serviceClient
      .from("products")
      .select("name")
      .eq("id", purchase.product_id)
      .maybeSingle();
    const productName = product?.name || `Pedido #${purchase.id}`;
    const buyerEmail = userData.user.email || purchase.buyer_email;
    if (!productName || !value || value < 2 || !buyerEmail) {
      throw new Error("Dados incompletos para a cobrança PIX (mínimo R$2)");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const { data: buyerProfile } = await serviceClient.from("profiles").select("display_name,cpf").eq("user_id", userData.user.id).maybeSingle();
    const buyerDocument = String(buyerProfile?.cpf || "").replace(/\D/g, "");
    if (![11, 14].includes(buyerDocument.length)) throw new Error("Cadastre um CPF válido no perfil antes de pagar");

    // ------------------------------------------------------------------
    // VexoPay — gateway primário de PIX (mesmo do Crypto). A doc pública
    // documenta o padrão `/gateway/<recurso>-create` com headers ci/cs;
    // tentamos os caminhos do padrão e normalizamos a resposta. Ids ganham
    // o prefixo `vexo:` para o polling saber em qual gateway consultar.
    // ------------------------------------------------------------------
    if (vexopayReady) {
      const baseUrl = vexoBaseUrl || "https://www.vexopay.com.br/api";
      const vexoPayload = {
        amount: value,
        description: String(productName).slice(0, 120),
        clientReference: String(purchaseId ?? `order_${Date.now()}`),
        payer: {
          name: buyerProfile?.display_name || buyerEmail.split("@")[0],
          email: buyerEmail,
          document: buyerDocument,
        },
        expiresIn: 3600,
      };
      const vexoHeaders = {
        "Content-Type": "application/json",
        Accept: "application/json",
        ci: String(vexoCi),
        cs: String(vexoCs),
      };
      const candidates = ["/gateway/pix-create", "/gateway/pix", "/pix/create"];
      let lastVexoError = "";
      for (const path of candidates) {
        const resp = await fetch(`${baseUrl}${path}`, { method: "POST", headers: vexoHeaders, body: JSON.stringify(vexoPayload) });
        const body = await resp.json().catch(() => ({} as any));
        if (!resp.ok) {
          lastVexoError = `VexoPay ${resp.status} em ${path}`;
          continue; // tenta o próximo caminho do padrão do gateway
        }
        const node = body?.data ?? body ?? {};
        const qrCodeText: unknown =
          node.qrCodeText ?? node.qrCode ?? node.qrcode ?? node.qr_code ??
          node.pixCopiaECola ?? node.copyPaste ?? node.payload ?? node.emv ?? null;
        const txid: unknown = node.id ?? node.txid ?? node.transactionId ?? node.transaction_id ?? node.chargeId ?? node.charge_id ?? null;
        if (typeof qrCodeText !== "string" || qrCodeText === "" || txid == null) {
          lastVexoError = `VexoPay: resposta sem QR Code/ID em ${path}`;
          continue;
        }
        const chargeId = `vexo:${txid}`;
        const expiresAt: string =
          typeof node.expiresAt === "string" ? node.expiresAt
          : typeof node.expires_at === "string" ? node.expires_at
          : new Date(Date.now() + 3600 * 1000).toISOString();
        const qrCodeUrl: string | null =
          typeof node.qrCodeUrl === "string" ? node.qrCodeUrl
          : typeof node.qrcode_url === "string" ? node.qrcode_url
          : typeof node.qrcode_base64 === "string" && node.qrcode_base64.startsWith("data:") ? node.qrcode_base64
          : null;

        await serviceClient.from("purchases").update({
          evopay_charge_id: chargeId,
          pix_qr_code: qrCodeText,
          pix_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }).eq("id", purchaseId);

        try {
          await serviceClient.from("webhook_logs").insert({
            source: "vexopay",
            event_type: "CREATE_PIX",
            status: "created",
            order_id: purchaseId ? Number(purchaseId) : null,
            charge_id: String(txid),
            payload: { path, amount: value, clientReference: vexoPayload.clientReference },
            error: null,
          });
        } catch (_e) { /* ignore logging failure */ }

        return new Response(
          JSON.stringify({ id: chargeId, status: "PENDING", amount: value, qrCodeText, expiresAt, qrCodeUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
        );
      }
      console.error("VexoPay PIX creation failed:", lastVexoError);
      // VexoPay falhou: se a EvoPay estiver configurada, segue para o fallback
      // abaixo; senão o erro é honesto.
      if (!evopayReady) {
        throw new Error("O gateway de PIX não respondeu agora. Tente novamente em instantes.");
      }
    }

    // ------------------------------------------------------------------
    // EvoPay — fallback do PIX (fluxo original).
    // ------------------------------------------------------------------
    // If the admin hasn't set a webhook token yet, auto-generate a strong one
    // and persist it. This avoids breaking the whole PIX flow on a fresh deploy.
    let webhookToken: string | undefined = setting?.value?.webhookToken;
    if (!webhookToken) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      webhookToken = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const nextValue = { ...(setting?.value || {}), webhookToken };
      const { error: upsertErr } = await serviceClient
        .from("app_settings")
        .upsert({ key: "evopay", value: nextValue }, { onConflict: "key" });
      if (upsertErr) {
        console.error("Could not persist webhook token", upsertErr);
        throw new Error("Não foi possível configurar o webhook de pagamento. Contate o admin.");
      }
      setting = { value: nextValue };
    }
    const callbackUrl = `${supabaseUrl}/functions/v1/evopay-webhook?token=${encodeURIComponent(webhookToken)}`;

    const payload = {
      amount: value,
      callbackUrl,
      generatedName: buyerProfile?.display_name || buyerEmail.split("@")[0],
      generatedEmail: buyerEmail,
      generatedDocument: buyerDocument,
      expiresIn: 3600,
      clientReference: String(purchaseId ?? `order_${Date.now()}`),
    };

    console.log("Creating EvoPay PIX charge:", JSON.stringify(payload));

    const response = await fetch("https://api.evopay.cash/v1/pix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${evoApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("EvoPay response", response.status, JSON.stringify(data));

    // Log the charge creation attempt for admin debugging
    try {
      await serviceClient.from("webhook_logs").insert({
        source: "evopay",
        event_type: "CREATE_PIX",
        status: response.ok ? "created" : `error_${response.status}`,
        order_id: purchaseId ? Number(purchaseId) : null,
        charge_id: data?.id || null,
        payload: data,
        error: response.ok ? null : (typeof (data?.message || data?.error) === "string" ? (data.message || data.error) : JSON.stringify(data)),
      });
    } catch (_e) { /* ignore logging failure */ }

    if (!response.ok) {
      const msg = data?.message || data?.error || "Erro ao criar cobrança PIX";
      throw new Error(`EvoPay (${response.status}): ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    }

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    await serviceClient.from("purchases").update({
      evopay_charge_id: data.id,
      pix_qr_code: data.qrCodeText,
      pix_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq("id", purchaseId);

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        amount: data.amount,
        qrCodeText: data.qrCodeText,
        expiresAt,
        qrCodeUrl: data.qrCodeUrl || (data.id ? `https://api.evopay.cash/v1/pix/qr-code/${data.id}` : null),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("create-evopay-pix error:", error.message || error);
    const isConfig = error instanceof PixConfigError;
    return new Response(
      JSON.stringify({
        error: error.message || "Erro desconhecido ao criar cobrança",
        code: isConfig ? "evopay_not_configured" : "pix_charge_failed",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
    );
  }
});
