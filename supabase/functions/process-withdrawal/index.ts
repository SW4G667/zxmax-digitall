import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const DEFAULT_BASE = "https://zennithpay.online/api/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const token = authHeader.slice(7);
    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { data: role } = await admin.from("user_roles")
      .select("role").eq("user_id", authData.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Apenas administradores podem processar saques." }, 403);

    const body = await req.json().catch(() => ({}));
    const withdrawalId = Number(body.withdrawalId);
    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) return json({ error: "Saque inválido." }, 400);

    const { data: withdrawal, error: withdrawalError } = await admin.from("withdrawals")
      .select("id,user_id,amount,fee,net_amount,status,pix_key,provider_tx_id")
      .eq("id", withdrawalId).maybeSingle();
    if (withdrawalError || !withdrawal) return json({ error: "Saque não encontrado." }, 404);

    if (withdrawal.status === "approved") {
      return json({ success: true, alreadyProcessed: true, id: withdrawal.provider_tx_id || null, status: "APPROVED" });
    }
    if (withdrawal.status !== "pending") return json({ error: "Este saque não está pendente." }, 409);

    const net = Number(withdrawal.net_amount);
    const pixKey = String(withdrawal.pix_key || "").trim();
    if (!Number.isFinite(net) || net <= 0 || !pixKey) return json({ error: "Dados do saque estão incompletos." }, 409);

    const availableRpc = await userClient.rpc("withdrawable_balance", {
      _user_id: withdrawal.user_id,
      _exclude_id: withdrawal.id,
    });
    if (availableRpc.error) return json({ error: "Não foi possível validar o saldo do saque." }, 409);
    if (Number(withdrawal.amount) > Number(availableRpc.data || 0)) return json({ error: "Saldo disponível insuficiente para este saque." }, 409);

    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "zennithpay").maybeSingle();
    const cfg = (setting?.value || {}) as Record<string, unknown>;
    const apiKey = String(Deno.env.get("ZENNITH_API_KEY") || "").trim();
    const baseUrl = String(cfg.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    const enabled = typeof cfg.withdrawalsEnabled === "boolean" ? cfg.withdrawalsEnabled : cfg.enabled !== false;
    if (!apiKey || !enabled) return json({ error: "O serviço de saque está temporariamente indisponível." }, 503);

    const reference = `zxmax-withdraw-${withdrawal.id}`;
    const response = await fetch(`${baseUrl}/withdrawals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": apiKey,
        "X-Idempotency-Key": reference,
      },
      body: JSON.stringify({
        amount: net,
        reference_id: reference,
        pix_key: pixKey,
        metadata: { platform: "zxmax", withdrawal: reference },
      }),
    });

    const provider = await response.json().catch(() => ({} as Record<string, unknown>));
    if (!response.ok) {
      const detail = String(provider?.detail || provider?.error || provider?.message || "Falha no provedor de saque.").slice(0, 180);
      await admin.from("withdrawal_events").insert({
        withdrawal_id: withdrawal.id,
        event_type: "provider_error",
        actor_id: authData.user.id,
        note: detail,
      });
      return json({ error: "O provedor não concluiu o saque. Nenhum saldo foi marcado como pago." }, 502);
    }

    const node = (provider?.data && typeof provider.data === "object" ? provider.data : provider) as Record<string, unknown>;
    const providerTx = String(node.id || node.reference_id || reference);
    const providerStatus = String(node.status || "PROCESSING").toUpperCase();

    const { data: approved, error: approveError } = await userClient.rpc("approve_withdrawal", {
      _id: withdrawal.id,
      _provider_tx: providerTx,
    });
    if (approveError) {
      await admin.from("withdrawal_events").insert({
        withdrawal_id: withdrawal.id,
        event_type: "provider_accepted_db_pending",
        actor_id: authData.user.id,
        note: providerTx,
      });
      return json({ error: "O provedor aceitou o saque, mas a confirmação local precisa ser reconciliada. Tente novamente; o identificador evita saque duplicado." }, 503);
    }

    return json({
      success: true,
      id: providerTx,
      status: providerStatus,
      withdrawalStatus: approved?.status || "approved",
    });
  } catch (error) {
    console.error("process-withdrawal", error instanceof Error ? error.message : error);
    return json({ error: "Erro inesperado ao processar o saque." }, 500);
  }
});
