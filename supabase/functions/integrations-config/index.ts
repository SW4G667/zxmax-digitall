import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Max-Age": "86400" };
const json = (body: unknown, status = 200, cache = "no-store") => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": cache } });

const MAGNUSPAY_API = "https://api.magnuspay.com.br";

const DEFAULTS = {
  magnuspay: { pixEnabled: true, pixFee: 0 },
  zennithpay: { pixEnabled: false, pixFee: 0.9 },
  vexopay: { pixEnabled: false, cryptoEnabled: false, pixFee: 1.2 },
  stripe: { cardEnabled: false, boletoEnabled: false, boletoExpiresAfterDays: 3 },
  platform: { buyer_fee: 0.9 },
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

async function resolvePrimaryPixKey(admin: any, config: any) {
  const mode = String(config?.mode || "production").toLowerCase();
  if (mode === "sandbox") {
    const { data: sandboxKey, error } = await admin.rpc("get_gateway_secret_server", { _name: "zxmax_pix_sandbox_api_key" });
    if (!error && sandboxKey) return String(sandboxKey).trim();
  }
  return String(Deno.env.get("MAGNUSPAY_API_KEY") || "").trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "get");
    const keys = ["magnuspay", "zennithpay", "vexopay", "stripe", "platform"];
    const { data: rows, error } = await admin.from("app_settings").select("key,value").in("key", keys);
    if (error) return json({ error: "Não foi possível consultar a configuração de pagamentos." }, 503);

    const row = <T extends keyof typeof DEFAULTS>(name: T) => {
      const raw = (rows || []).find((item: any) => item.key === name)?.value;
      return { ...DEFAULTS[name], ...(raw && typeof raw === "object" ? raw : {}) };
    };

    const magnus = row("magnuspay");
    const zennith = row("zennithpay");
    const vexopay = row("vexopay");
    const stripe = row("stripe");
    const platform = row("platform");

    const magnusApiKey = await resolvePrimaryPixKey(admin, magnus);
    const magnusReady = Boolean(magnusApiKey);
    const zennithReady = Boolean(Deno.env.get("ZENNITH_API_KEY"));
    const vexoReady = Boolean(Deno.env.get("VEXOPAY_CLIENT_ID") && Deno.env.get("VEXOPAY_CLIENT_SECRET"));
    const stripeReady = Boolean(Deno.env.get("STRIPE_SECRET_KEY") && Deno.env.get("STRIPE_WEBHOOK_SECRET"));

    const selectedPix = magnusReady && magnus.pixEnabled === true
      ? "magnuspay_pix"
      : zennithReady && zennith.pixEnabled === true
        ? "zennith_pix"
        : vexoReady && vexopay.pixEnabled === true
          ? "vexopay_pix"
          : null;

    const baseBuyerFee = clampFee((platform as any).buyer_fee, 0.9);

    if (action === "payment_methods") return json({
      v: 5,
      methods: {
        magnuspay_pix: selectedPix === "magnuspay_pix",
        zennith_pix: selectedPix === "zennith_pix",
        vexopay_pix: selectedPix === "vexopay_pix",
        crypto: vexoReady && vexopay.cryptoEnabled === true,
        card: stripeReady && stripe.cardEnabled === true,
        boleto: stripeReady && stripe.boletoEnabled === true,
      },
      selectedPix,
      fees: {
        magnuspay_pix: Math.round((baseBuyerFee + clampFee(magnus.pixFee, 0)) * 100) / 100,
        zennith_pix: Math.round((baseBuyerFee + clampFee(zennith.pixFee, 0.9)) * 100) / 100,
        vexopay_pix: Math.round((baseBuyerFee + clampFee(vexopay.pixFee, 1.2)) * 100) / 100,
        crypto: baseBuyerFee,
        card: baseBuyerFee,
        boleto: baseBuyerFee,
      },
    }, 200, "public, max-age=15");

    const user = await caller(req);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: hasAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!hasAdmin) return json({ error: "Apenas administradores." }, 403);

    const secretStatus = {
      MAGNUSPAY_API_KEY: magnusReady,
      MAGNUSPAY_WEBHOOK_SECRET: Boolean(Deno.env.get("MAGNUSPAY_WEBHOOK_SECRET")),
      ZENNITH_API_KEY: zennithReady,
      VEXOPAY_CLIENT_ID: Boolean(Deno.env.get("VEXOPAY_CLIENT_ID")),
      VEXOPAY_CLIENT_SECRET: Boolean(Deno.env.get("VEXOPAY_CLIENT_SECRET")),
      STRIPE_SECRET_KEY: Boolean(Deno.env.get("STRIPE_SECRET_KEY")),
      STRIPE_WEBHOOK_SECRET: Boolean(Deno.env.get("STRIPE_WEBHOOK_SECRET")),
    };

    if (action === "get") return json({
      integrations: { magnuspay: magnus, zennithpay: zennith, vexopay, stripe },
      secretStatus,
    });

    const provider = body.provider === "magnuspay" || body.provider === "zennithpay" || body.provider === "vexopay" || body.provider === "stripe"
      ? body.provider as keyof typeof DEFAULTS
      : null;
    if (!provider) return json({ error: "Provedor inválido." }, 400);

    if (action === "save") {
      const incoming = body.values || {};
      const current = row(provider);
      const next = provider === "stripe"
        ? {
            cardEnabled: incoming.cardEnabled === true,
            boletoEnabled: incoming.boletoEnabled === true,
            boletoExpiresAfterDays: Number.isInteger(Number(incoming.boletoExpiresAfterDays)) ? Math.max(0, Math.min(60, Number(incoming.boletoExpiresAfterDays))) : current.boletoExpiresAfterDays,
          }
        : {
            pixEnabled: incoming.pixEnabled === true,
            pixFee: clampFee(incoming.pixFee, (current as any).pixFee),
            ...(provider === "vexopay" ? { cryptoEnabled: incoming.cryptoEnabled === true } : {}),
            ...(provider === "magnuspay" ? { mode: String((current as any).mode || "production") } : {}),
          };

      const { error: saveError } = await admin.from("app_settings").upsert({ key: provider, value: next }, { onConflict: "key" });
      if (saveError) return json({ error: "Não foi possível salvar a configuração." }, 400);

      if (provider !== "stripe" && (next as any).pixEnabled === true) {
        for (const other of ["magnuspay", "zennithpay", "vexopay"] as const) {
          if (other === provider) continue;
          const otherCurrent = row(other);
          await admin.from("app_settings").upsert({ key: other, value: { ...otherCurrent, pixEnabled: false } }, { onConflict: "key" });
        }
      }
      return json({ saved: true });
    }

    if (action === "test") {
      if (provider === "magnuspay") {
        const apiKey = magnusApiKey;
        if (!apiKey) return json({ ok: false, message: "A credencial do PIX principal não está configurada no servidor." });

        const response = await fetch(MAGNUSPAY_API + "/transactions/fees", {
          method: "GET",
          headers: { "X-API-Key": apiKey, Accept: "application/json" },
        });
        const raw = await response.text();
        let parsed: any = {};
        try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }

        if (!response.ok || parsed?.success === false) {
          return json({
            ok: false,
            message: String(parsed?.message || ("O provedor PIX respondeu HTTP " + response.status + ".")).slice(0, 220),
            status: response.status,
          });
        }

        const fees = parsed?.data || {};
        const minDeposit = Number(fees.minDeposit || 0);
        return json({
          ok: true,
          message: "PIX principal conectado. Depósito mínimo: R$ " + minDeposit.toFixed(2).replace(".", ",") + ".",
          provider: {
            route: fees.route || null,
            gateway: fees.gateway || null,
            minDeposit: fees.minDeposit ?? null,
            maxDeposit: fees.maxDeposit ?? null,
            feeToCustomerForced: fees.feeToCustomerForced ?? null,
          },
        });
      }
      if (provider === "zennithpay" && !zennithReady) return json({ ok: false, message: "ZENNITH_API_KEY não configurada." });
      if (provider === "vexopay" && !vexoReady) return json({ ok: false, message: "Credenciais VexoPay não configuradas." });
      if (provider === "stripe" && !stripeReady) return json({ ok: false, message: "Credenciais Stripe não configuradas." });
      return json({ ok: true, message: "Credenciais detectadas no servidor." });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("integrations-config", error instanceof Error ? error.message : error);
    return json({ error: "Erro inesperado ao configurar integrações." }, 500);
  }
});
