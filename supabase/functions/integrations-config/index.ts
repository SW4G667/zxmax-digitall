import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const DEFAULTS = {
  zennithpay: { pixEnabled: false, pixFee: 0.9 },
  vexopay: { pixEnabled: false, cryptoEnabled: false, pixFee: 1.2 },
  evopay: { pixEnabled: false, pixFee: 0.9, withdrawalsEnabled: true },
  stripe: { cardEnabled: false, boletoEnabled: false, boletoExpiresAfterDays: 3 },
};
const clampFee = (value: unknown, fallback: number) => {
  const fee = Number(value);
  return Number.isFinite(fee) && fee >= 0 && fee <= 1000 ? Math.round(fee * 100) / 100 : fallback;
};

async function caller(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data } = await client.auth.getUser(auth.slice(7));
  return data.user ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const user = await caller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "get");
    const { data: rows, error } = await admin.from("app_settings").select("key,value").in("key", ["zennithpay", "vexopay", "evopay", "stripe"]);
    if (error) return json({ error: "Não foi possível consultar a configuração de pagamentos.", code: "payment_settings_unavailable" }, 503);
    const row = <T extends keyof typeof DEFAULTS>(name: T) => {
      const raw = (rows || []).find((item: any) => item.key === name)?.value;
      const { baseUrl: _legacyBaseUrl, ...safeValues } = raw && typeof raw === "object" ? raw : {};
      return { ...DEFAULTS[name], ...safeValues };
    };
    const zennith = row("zennithpay");
    const vexopay = row("vexopay");
    const evopay = row("evopay");
    const stripe = row("stripe");
    const zennithReady = Boolean(Deno.env.get("ZENNITH_API_KEY"));
    const vexoReady = Boolean(Deno.env.get("VEXOPAY_CLIENT_ID") && Deno.env.get("VEXOPAY_CLIENT_SECRET"));
    const evopayReady = Boolean(Deno.env.get("EVOPAY_API_KEY"));
    const stripeReady = Boolean(Deno.env.get("STRIPE_SECRET_KEY") && Deno.env.get("STRIPE_WEBHOOK_SECRET"));
    const siteUrl = String(Deno.env.get("SITE_URL") || "https://zxmax.vercel.app").replace(/\/$/, "");
    let discordEnabled = false;
    try {
      const authSettings = await fetch(`${Deno.env.get("SUPABASE_URL")}/auth/v1/settings`, {
        headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")! },
      });
      const settings = await authSettings.json().catch(() => ({} as Record<string, any>));
      discordEnabled = settings?.external?.discord === true;
    } catch { /* indisponibilidade de status não deve afetar pagamentos */ }

    // PIX é uma única forma de pagamento para o comprador.
    // Prioridade determinística: Evopay > Zennith > VexoPay
    // Se uma configuração legada deixar múltiplos ativos, Evopay tem precedência.
    const evopayPixActive = evopayReady && (evopay as any).pixEnabled === true;
    const zennithPixActive = zennithReady && zennith.pixEnabled === true;
    const vexopayPixActive = vexoReady && vexopay.pixEnabled === true;
    let selectedPix: string | null = null;
    if (evopayPixActive) selectedPix = "evopay_pix";
    else if (zennithPixActive) selectedPix = "zennith_pix";
    else if (vexopayPixActive) selectedPix = "vexopay_pix";

    if (action === "payment_methods") return json({
      v: 4,
      methods: {
        evopay_pix: selectedPix === "evopay_pix",
        zennith_pix: selectedPix === "zennith_pix",
        vexopay_pix: selectedPix === "vexopay_pix",
        crypto: vexoReady && vexopay.cryptoEnabled === true,
        card: stripeReady && stripe.cardEnabled === true,
        boleto: stripeReady && stripe.boletoEnabled === true,
      },
      fees: {
        evopay_pix: clampFee((evopay as any).pixFee, 0.9),
        zennith_pix: clampFee(zennith.pixFee, 0.9),
        vexopay_pix: clampFee(vexopay.pixFee, 1.2),
      },
    });

    const { data: hasAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!hasAdmin) return json({ error: "Apenas administradores." }, 403);
    const secretStatus = {
      EVOPAY_API_KEY: evopayReady,
      ZENNITH_API_KEY: zennithReady,
      ZENNITH_WEBHOOK_SECRET: Boolean(Deno.env.get("ZENNITH_WEBHOOK_SECRET")),
      VEXOPAY_CLIENT_ID: Boolean(Deno.env.get("VEXOPAY_CLIENT_ID")),
      VEXOPAY_CLIENT_SECRET: Boolean(Deno.env.get("VEXOPAY_CLIENT_SECRET")),
      VEXOPAY_WEBHOOK_SECRET: Boolean(Deno.env.get("VEXOPAY_WEBHOOK_SECRET")),
      STRIPE_SECRET_KEY: Boolean(Deno.env.get("STRIPE_SECRET_KEY")),
      STRIPE_WEBHOOK_SECRET: Boolean(Deno.env.get("STRIPE_WEBHOOK_SECRET")),
    };
    if (action === "get") return json({
      integrations: { evopay, zennithpay: zennith, vexopay, stripe },
      secretStatus,
      discord: {
        enabled: discordEnabled,
        providerCallback: `${Deno.env.get("SUPABASE_URL")}/auth/v1/callback`,
        appCallback: `${siteUrl}/auth/callback`,
      },
    });
    const provider = body.provider === "vexopay" ? "vexopay" : body.provider === "zennithpay" ? "zennithpay" : body.provider === "evopay" ? "evopay" : body.provider === "stripe" ? "stripe" : null;
    if (!provider) return json({ error: "Provedor inválido." }, 400);
    if (action === "save") {
      const incoming = body.values || {};
      const current = row(provider as any);
      const next = provider === "stripe"
        ? {
          cardEnabled: incoming.cardEnabled === true,
          boletoEnabled: incoming.boletoEnabled === true,
          boletoExpiresAfterDays: Number.isInteger(Number(incoming.boletoExpiresAfterDays)) && Number(incoming.boletoExpiresAfterDays) >= 0 && Number(incoming.boletoExpiresAfterDays) <= 60 ? Number(incoming.boletoExpiresAfterDays) : (current as any).boletoExpiresAfterDays,
        }
        : provider === "evopay"
          ? {
            pixEnabled: incoming.pixEnabled === true,
            pixFee: clampFee(incoming.pixFee, (current as any).pixFee),
            withdrawalsEnabled: incoming.withdrawalsEnabled !== false,
          }
          : {
            pixEnabled: incoming.pixEnabled === true,
            pixFee: clampFee((incoming as any).pixFee, (current as any).pixFee),
            ...(provider === "vexopay" ? { cryptoEnabled: incoming.cryptoEnabled === true } : {}),
          };
      const { error: saveError } = await admin.from("app_settings").upsert({ key: provider, value: next }, { onConflict: "key" });
      if (saveError) return json({ error: "Não foi possível salvar a configuração." }, 400);
      // Ao escolher PIX em um provedor, desligue o PIX nos outros. Crypto segue independente.
      if (provider !== "stripe" && (next as any).pixEnabled === true) {
        const allPixProviders: Array<keyof typeof DEFAULTS> = ["evopay", "zennithpay", "vexopay"];
        for (const otherProvider of allPixProviders) {
          if (otherProvider === provider) continue;
          const otherCurrent = row(otherProvider);
          const { error: otherSaveError } = await admin.from("app_settings").upsert({
            key: otherProvider,
            value: { ...otherCurrent, pixEnabled: false },
          }, { onConflict: "key" });
          if (otherSaveError) return json({ error: "Não foi possível manter a seleção PIX exclusiva." }, 400);
        }
      }
      await admin.from("admin_audit_log").insert({ actor_id: user.id, action: "gateway.config_updated", target_table: "app_settings", target_id: provider, metadata: provider === "stripe" ? { cardEnabled: (next as any).cardEnabled, boletoEnabled: (next as any).boletoEnabled, boletoExpiresAfterDays: (next as any).boletoExpiresAfterDays } : { pixEnabled: (next as any).pixEnabled, pixFee: (next as any).pixFee, cryptoEnabled: (next as any).cryptoEnabled ?? false, withdrawalsEnabled: (next as any).withdrawalsEnabled ?? true } });
      return json({ saved: true });
    }
    if (action === "test") {
      if (provider === "evopay" && !evopayReady) return json({ ok: false, message: "A secret EVOPAY_API_KEY ainda não foi configurada no Supabase." });
      if (provider === "zennithpay" && !zennithReady) return json({ ok: false, message: "A secret ZENNITH_API_KEY ainda não foi configurada no Supabase." });
      if (provider === "vexopay" && !vexoReady) return json({ ok: false, message: "As secrets da VexoPay ainda não foram configuradas no Supabase." });
      if (provider === "stripe" && !stripeReady) return json({ ok: false, message: "As secrets STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET ainda não foram configuradas no Supabase." });
      return json({ ok: true, message: "Credenciais detectadas no servidor. Nenhuma cobrança foi criada." });
    }
    return json({ error: "Ação inválida." }, 400);
  } catch (error: any) {
    console.error("integrations-config", error?.message || error);
    return json({ error: "Erro inesperado ao configurar integrações." }, 500);
  }
});
