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

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Apenas administradores podem processar saques" }, 403);

    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "zennithpay").maybeSingle();
    const cfg = (setting?.value || {}) as Record<string, unknown>;
    // Credenciais nunca são lidas de app_settings: ficam somente no Secret Vault.
    const apiKey = String(Deno.env.get("ZENNITH_API_KEY") || "").trim();
    const baseUrl = String(cfg.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    const withdrawalsEnabled = typeof cfg.withdrawalsEnabled === "boolean" ? cfg.withdrawalsEnabled : cfg.enabled !== false;
    if (!apiKey || !withdrawalsEnabled) return json({ error: "Saques via ZennithPay não estão ativos no momento." }, 400);

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const pixKey = String(body.pixKey || "").trim();
    const clientReference = String(body.clientReference || `zxmax-withdraw-${Date.now()}`);
    if (!Number.isFinite(amount) || amount <= 0 || !pixKey) {
      return json({ error: "Informe o valor líquido e a chave Pix." }, 400);
    }

    const payload = {
      amount,
      reference_id: clientReference,
      pix_key: pixKey,
      metadata: { platform: "zxmax", withdrawal: clientReference },
    };

    const resp = await fetch(`${baseUrl}/withdrawals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": apiKey,
        "X-Idempotency-Key": clientReference,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json().catch(() => ({} as Record<string, unknown>));
    if (!resp.ok) {
      const detail = String(data?.detail || data?.error || data?.message || `ZennithPay ${resp.status}`);
      console.error("zennith-withdraw failed", resp.status, data);
      return json({ error: `Falha no saque: ${detail.slice(0, 180)}` }, 400);
    }

    const node = (data?.data && typeof data.data === "object" ? data.data : data) as Record<string, unknown>;
    return json({
      id: String(node.id || node.reference_id || clientReference),
      status: String(node.status || "PROCESSING"),
      amount: Number(node.amount || amount),
    });
  } catch (error: any) {
    console.error("zennith-withdraw error:", error?.message || error);
    return json({ error: error?.message || "Erro ao processar saque" }, 400);
  }
});
