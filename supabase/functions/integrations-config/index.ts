import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const DEFAULTS = {
  zennithpay: { pixEnabled: false, pixFee: 0.9 },
  vexopay: { pixEnabled: false, cryptoEnabled: false, pixFee: 1.2 },
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
    const { data: rows, error } = await admin.from("app_settings").select("key,value").in("key", ["zennithpay", "vexopay", "stripe"]);
    if (error) return json({ error: "Não foi possível consultar a configuração de pagamentos.", code: "payment_settings_unavailable" }, 503);
    const row = <T extends keyof typeof DEFAULTS>(name: T) => {
      const raw = (rows || []).find((item: any) => item.key === name)?.value;
      const { baseUrl: _legacyBaseUrl, ...safeValues } = raw && typeof raw === "object" ? raw : {};
      return { ...DEFAULTS[name], ...safeValues };
    };
    const zennith = row("zennithpay");
    const vexopay = row("vexopay");
    const stripe = row("stripe");
    const zennithReady = Boolean(Deno.env.get("ZENNITH_API_KEY"));
    const vexoReady = Boolean(Deno.env.get("VEXOPAY_CLIENT_ID") && Deno.env.get("VEXOPAY_CLIENT_SECRET"));
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

    if (action === "payment_methods") return json({
      v: 3,
      methods: {
        zennith_pix: zennithReady && zennith.pixEnabled === true,
        vexopay_pix: vexoReady && vexopay.pixEnabled === true,
        crypto: vexoReady && vexopay.cryptoEnabled === true,
        card: stripeReady && stripe.cardEnabled === true,
        boleto: stripeReady && stripe.boletoEnabled === true,
      },
      fees: { zennith_pix: clampFee(zennith.pixFee, 0.9), vexopay_pix: clampFee(vexopay.pixFee, 1.2) },
    });

    const { data: hasAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!hasAdmin) return json({ error: "Apenas administradores." }, 403);
    const secretStatus = {
      ZENNITH_API_KEY: zennithReady,
      ZENNITH_WEBHOOK_SECRET: Boolean(Deno.env.get("ZENNITH_WEBHOOK_SECRET")),
      VEXOPAY_CLIENT_ID: Boolean(Deno.env.get("VEXOPAY_CLIENT_ID")),
      VEXOPAY_CLIENT_SECRET: Boolean(Deno.env.get("VEXOPAY_CLIENT_SECRET")),
      VEXOPAY_WEBHOOK_SECRET: Boolean(Deno.env.get("VEXOPAY_WEBHOOK_SECRET")),
      STRIPE_SECRET_KEY: Boolean(Deno.env.get("STRIPE_SECRET_KEY")),
      STRIPE_WEBHOOK_SECRET: Boolean(Deno.env.get("STRIPE_WEBHOOK_SECRET")),
    };
    if (action === "get") return json({
      integrations: { zennithpay: zennith, vexopay, stripe },
      secretStatus,
      discord: {
        enabled: discordEnabled,
        providerCallback: `${Deno.env.get("SUPABASE_URL")}/auth/v1/callback`,
        appCallback: `${siteUrl}/auth/callback`,
      },
    });
    const provider = body.provider === "vexopay" ? "vexopay" : body.provider === "zennithpay" ? "zennithpay" : body.provider === "stripe" ? "stripe" : null;
    if (!provider) return json({ error: "Provedor inválido." }, 400);
    if (action === "save") {
      const incoming = body.values || {};
      const current = row(provider);
      const next = provider === "stripe"
        ? {
          cardEnabled: incoming.cardEnabled === true,
          boletoEnabled: incoming.boletoEnabled === true,
          boletoExpiresAfterDays: Number.isInteger(Number(incoming.boletoExpiresAfterDays)) && Number(incoming.boletoExpiresAfterDays) >= 0 && Number(incoming.boletoExpiresAfterDays) <= 60 ? Number(incoming.boletoExpiresAfterDays) : current.boletoExpiresAfterDays,
        }
        : {
          pixEnabled: incoming.pixEnabled === true,
          pixFee: clampFee(incoming.pixFee, current.pixFee),
          ...(provider === "vexopay" ? { cryptoEnabled: incoming.cryptoEnabled === true } : {}),
        };
      const { error: saveError } = await admin.from("app_settings").upsert({ key: provider, value: next }, { onConflict: "key" });
      if (saveError) return json({ error: "Não foi possível salvar a configuração." }, 400);
      await admin.from("admin_audit_log").insert({ actor_id: user.id, action: "gateway.config_updated", target_table: "app_settings", target_id: provider, metadata: provider === "stripe" ? { cardEnabled: next.cardEnabled, boletoEnabled: next.boletoEnabled, boletoExpiresAfterDays: next.boletoExpiresAfterDays } : { pixEnabled: next.pixEnabled, pixFee: next.pixFee, cryptoEnabled: (next as any).cryptoEnabled ?? false } });
      return json({ saved: true });
    }
    if (action === "test") {
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
