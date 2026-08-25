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

/** Fields we persist per provider. Secret fields are never returned to the client. */
const PROVIDERS: Record<string, { secret: string[]; plain: string[] }> = {
  zennithpay: { secret: ["apiKey", "webhookSecret"], plain: ["mode", "enabled", "baseUrl"] },
  evopay: { secret: ["apiKey"], plain: ["mode", "enabled", "baseUrl"] },
  vexopay: { secret: ["clientSecret", "webhookSecret"], plain: ["mode", "enabled", "baseUrl", "clientId"] },
  stripe: { secret: ["secretKey", "webhookSecret"], plain: ["publishableKey", "mode", "enabled"] },
  discord: { secret: ["clientSecret"], plain: ["clientId", "redirectUri", "scopes", "serverLink", "mode", "enabled"] },
};

const mask = (v: unknown) => (typeof v === "string" && v.length > 0 ? "••••••••" : "");

async function testConnection(provider: string, cfg: Record<string, any>) {
  try {
    if (provider === "zennithpay") {
      if (!cfg.apiKey) return { ok: false, message: "API Key (X-API-Key) é obrigatória." };
      const baseUrl = String(cfg.baseUrl || "https://zennithpay.online/api/v1").replace(/\/$/, "");
      const r = await fetch(`${baseUrl}/balance`, {
        headers: { "X-API-Key": String(cfg.apiKey), Accept: "application/json" },
      });
      const body = await r.text();
      return r.ok
        ? { ok: true, message: `Conexão OK com a ZennithPay. ${body.slice(0, 120)}` }
        : { ok: false, message: `ZennithPay respondeu ${r.status}: ${body.slice(0, 200)}` };
    }
    if (provider === "evopay") {
      if (!cfg.apiKey) return { ok: false, message: "API Key é obrigatória." };
      const r = await fetch("https://api.evopay.cash/v1/balance", {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });
      const body = await r.text();
      return r.ok
        ? { ok: true, message: "Conexão OK com a EvoPay." }
        : { ok: false, message: `EvoPay respondeu ${r.status}: ${body.slice(0, 200)}` };
    }
    if (provider === "stripe") {
      if (!cfg.secretKey) return { ok: false, message: "Secret Key (sk_...) é obrigatória." };
      const r = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${cfg.secretKey}` },
      });
      const body = await r.json().catch(() => ({}));
      return r.ok
        ? { ok: true, message: `Conexão OK com a Stripe (${cfg.secretKey.startsWith("sk_live") ? "live" : "test"}).` }
        : { ok: false, message: `Stripe: ${body?.error?.message || r.status}` };
    }
    if (provider === "vexopay") {
      if (!cfg.clientId || !cfg.clientSecret) return { ok: false, message: "Client ID (ci) e Client Secret (cs) são obrigatórios." };
      const baseUrl = String(cfg.baseUrl || "https://www.vexopay.com.br/api").replace(/\/$/, "");
      const headers = { ci: String(cfg.clientId), cs: String(cfg.clientSecret), Accept: "application/json" };
      let last = "";
      for (const path of ["/gateway/balance", "/balance", "/merchant/crypto-fees"]) {
        const r = await fetch(`${baseUrl}${path}`, { headers });
        const body = await r.text();
        if (r.ok) return { ok: true, message: `Conexão OK com a VexoPay. ${body.slice(0, 120)}` };
        last = `VexoPay respondeu ${r.status} em ${path}: ${body.slice(0, 160)}`;
      }
      return { ok: false, message: last || "VexoPay não respondeu." };
    }
    if (provider === "discord") {
      if (!cfg.clientId || !cfg.clientSecret) return { ok: false, message: "Client ID e Client Secret são obrigatórios." };
      const r = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "identify",
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
        }),
      });
      const body = await r.json().catch(() => ({}));
      return r.ok
        ? { ok: true, message: "Credenciais do Discord válidas." }
        : { ok: false, message: `Discord: ${body?.error_description || body?.error || r.status}` };
    }
    return { ok: false, message: "Provedor desconhecido." };
  } catch (e: any) {
    return { ok: false, message: `Falha de rede: ${e?.message || e}` };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: userData, error: userError } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "get";

    // ------------------------------------------------------------------
    // `payment_methods`: disponível para qualquer usuário autenticado.
    // Devolve SOMENTE booleanos — nenhuma chave, nem mascarada. Serve para o
    // checkout não oferecer um meio de pagamento que não está configurado
    // (antes a tela marcava tudo como disponível e o erro só aparecia depois
    // de o comprador já ter criado o pedido).
    //
    // Regras de honestidade (não mascarar falha como "indisponível"):
    // - `v: 2` marca a versão da ação: respostas sem ele são de uma versão
    //   antiga ainda publicada, e o frontend trata como serviço em atualização;
    // - falha ao ler `app_settings` devolve 500 + `code`, nunca `{ all false }`;
    // - a disponibilidade espelha EXATAMENTE a resolução de credenciais que
    //   as funções de cobrança usam (banco `app_settings` primeiro, secret de
    //   ambiente como fallback). Só anunciamos o que pode realmente cobrar.
    // ------------------------------------------------------------------
    if (action === "payment_methods") {
      const { data: rows, error: settingsError } = await admin
        .from("app_settings").select("key, value").in("key", ["zennithpay", "evopay", "vexopay", "stripe"]);
      if (settingsError) {
        console.error("payment_methods: falha ao ler app_settings:", settingsError.message);
        return json(
          {
            error: "Não foi possível verificar as formas de pagamento agora. Tente novamente em instantes.",
            code: "payment_settings_unavailable",
          },
          503,
        );
      }
      const cfg = (key: string): Record<string, any> =>
        (rows || []).find((r: any) => r.key === key)?.value || {};

      // PIX = ZennithPay. Crypto = VexoPay. Cartão/boleto = Stripe.
      // Toggles por função (pixEnabled, cryptoEnabled, withdrawalsEnabled,
      // cardEnabled, boletoEnabled) — legado `enabled` é usado como fallback.
      const zennith = cfg("zennithpay");
      const vexopay = cfg("vexopay");
      const stripe = cfg("stripe");
      const evopay = cfg("evopay");

      const zennithPix = typeof zennith.pixEnabled === "boolean" ? zennith.pixEnabled : zennith.enabled !== false;
      const zennithReady = !!(zennith.apiKey || Deno.env.get("ZENNITH_API_KEY")) && zennithPix;
      const vexoCrypto = typeof vexopay.cryptoEnabled === "boolean" ? vexopay.cryptoEnabled : vexopay.enabled !== false;
      const vexopayReady = !!(
        (vexopay.clientId && vexopay.clientSecret) ||
        (Deno.env.get("VEXOPAY_CLIENT_ID") && Deno.env.get("VEXOPAY_CLIENT_SECRET"))
      ) && vexoCrypto;
      const stripeCard = typeof stripe.cardEnabled === "boolean" ? stripe.cardEnabled : stripe.enabled === true;
      const stripeBoleto = typeof stripe.boletoEnabled === "boolean" ? stripe.boletoEnabled : stripe.boletoEnabled === true;
      const cardReady = !!(stripe.secretKey || Deno.env.get("STRIPE_SECRET_KEY"));

      return json({
        v: 2,
        methods: {
          pix: zennithReady,
          crypto: vexopayReady,
          card: cardReady && stripeCard,
          boleto: cardReady && stripeBoleto,
        },
      });
    }

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Apenas administradores." }, 403);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    if (action === "get") {
      // Make sure the EvoPay webhook always has a secret token configured.
      const { data: evoRow } = await admin.from("app_settings").select("value").eq("key", "evopay").maybeSingle();
      const evoValue: Record<string, any> = { ...(evoRow?.value || {}) };
      if (!evoValue.webhookToken) {
        evoValue.webhookToken = crypto.randomUUID().replace(/-/g, "");
        await admin.from("app_settings").upsert({ key: "evopay", value: evoValue }, { onConflict: "key" });
      }
      const webhookUrl = `${supabaseUrl}/functions/v1/evopay-webhook?token=${evoValue.webhookToken}`;
      const zennithWebhookUrl = `${supabaseUrl}/functions/v1/zennith-webhook`;

      const { data: rows } = await admin
        .from("app_settings")
        .select("key, value")
        .in("key", Object.keys(PROVIDERS));
      const out: Record<string, any> = {};
      for (const [provider, fields] of Object.entries(PROVIDERS)) {
        const value = (rows || []).find((r: any) => r.key === provider)?.value || {};
        const safe: Record<string, any> = {};
        for (const f of fields.plain) safe[f] = value[f] ?? "";
        for (const f of fields.secret) safe[`${f}_masked`] = mask(value[f]);
        out[provider] = safe;
      }
      return json({ integrations: out, webhookUrl, zennithWebhookUrl });
    }

    const provider = String(body.provider || "");
    const fields = PROVIDERS[provider];
    if (!fields) return json({ error: "Provedor inválido." }, 400);

    const { data: existing } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", provider)
      .maybeSingle();
    const current: Record<string, any> = { ...(existing?.value || {}) };
    const incoming = body.values || {};

    // plain fields always overwrite; secret fields only when a new non-empty value is sent
    for (const f of fields.plain) if (incoming[f] !== undefined) current[f] = incoming[f];
    for (const f of fields.secret) {
      if (typeof incoming[f] === "string" && incoming[f].trim() !== "") current[f] = incoming[f].trim();
    }

    if (action === "simulate") {
      await admin.from("webhook_logs").insert({ source: provider, event_type: "SIMULATION", status: "test_ok", payload: { simulated: true, requestedBy: userData.user.id } });
      return json({ ok: true, message: "Evento de teste registrado sem alterar pedidos reais." });
    }

    if (action === "test") {
      const result = await testConnection(provider, current);
      return json(result);
    }

    if (action === "save") {
      const { error } = await admin.from("app_settings").upsert({ key: provider, value: current }, { onConflict: "key" });
      if (error) return json({ error: error.message }, 400);
      const result = body.test ? await testConnection(provider, current) : null;
      return json({ saved: true, test: result });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error: any) {
    console.error("integrations-config error:", error?.message || error);
    return json({ error: error?.message || "Erro inesperado" }, 400);
  }
});
