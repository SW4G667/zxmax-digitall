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
const MAGNUS = "https://api.magnuspay.com.br";

function pixKeyType(raw: string): "CPF" | "CNPJ" | "EMAIL" | "TELEFONE" | "RANDOM" {
  const value = raw.trim();
  const digits = value.replace(/\D/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "EMAIL";
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  if (/^\+?[0-9 ()-]{10,20}$/.test(value)) return "TELEFONE";
  return "RANDOM";
}

async function resolveKey(admin: any) {
  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "magnuspay").maybeSingle();
  const mode = String(setting?.value?.mode || "production").toLowerCase();
  if (mode === "sandbox") {
    const { data: sandboxKey, error } = await admin.rpc("get_gateway_secret_server", { _name: "zxmax_pix_sandbox_api_key" });
    if (!error && sandboxKey) return String(sandboxKey).trim();
  }
  return String(Deno.env.get("MAGNUSPAY_API_KEY") || "").trim();
}

async function checkWithdrawal(key: string, transactionId: string) {
  const response = await fetch(`${MAGNUS}/transactions/check`, {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ transactionId }),
  });
  const raw = await response.text();
  let parsed: any = {};
  try { parsed = raw ? JSON.parse(raw) : {}; } catch { parsed = {}; }
  return { response, parsed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

    const { data: authData, error: authError } = await userClient.auth.getUser(authHeader.slice(7));
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", authData.user.id).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Apenas administradores podem processar saques." }, 403);

    const body = await req.json().catch(() => ({}));
    const withdrawalId = Number(body.withdrawalId);
    if (!Number.isInteger(withdrawalId) || withdrawalId <= 0) return json({ error: "Saque inválido." }, 400);

    const { data: withdrawal, error: withdrawalError } = await admin.from("withdrawals")
      .select("id,user_id,amount,fee,net_amount,status,pix_key,provider_tx_id")
      .eq("id", withdrawalId).maybeSingle();
    if (withdrawalError || !withdrawal) return json({ error: "Saque não encontrado." }, 404);
    if (withdrawal.status === "approved") {
      return json({ success: true, alreadyProcessed: true, id: withdrawal.provider_tx_id || null, status: "COMPLETED" });
    }
    if (withdrawal.status !== "pending") return json({ error: "Este saque não está pendente." }, 409);

    const net = Number(withdrawal.net_amount);
    const configuredFee = Number(withdrawal.fee || 0);
    const pixKey = String(withdrawal.pix_key || "").trim();
    if (!Number.isFinite(net) || net <= 0 || !pixKey) return json({ error: "Dados do saque estão incompletos." }, 409);

    const availableRpc = await userClient.rpc("withdrawable_balance", { _user_id: withdrawal.user_id, _exclude_id: withdrawal.id });
    if (availableRpc.error) return json({ error: "Não foi possível validar o saldo do saque." }, 409);
    if (Number(withdrawal.amount) > Number(availableRpc.data || 0)) return json({ error: "Saldo disponível insuficiente para este saque." }, 409);

    const key = await resolveKey(admin);
    if (!key) return json({ error: "MagnusPay não está configurada no servidor." }, 503);

    // Reconcile a previously submitted payout before doing anything else.
    if (withdrawal.provider_tx_id) {
      const checked = await checkWithdrawal(key, String(withdrawal.provider_tx_id));
      if (checked.response.status === 429) return json({ error: "Limite temporário do gateway. Aguarde e tente novamente." }, 429);
      if (!checked.response.ok || checked.parsed?.success === false || !checked.parsed?.data) {
        return json({ error: "Não foi possível consultar o saque no gateway agora." }, 502);
      }
      const node = checked.parsed.data;
      const id = String(node.id || node.transactionId || "");
      const type = String(node.type || "").toUpperCase();
      const status = String(node.status || "").toUpperCase();
      if (id !== String(withdrawal.provider_tx_id) || (type && type !== "WITHDRAW")) {
        return json({ error: "O gateway retornou dados divergentes para este saque." }, 409);
      }

      if (status === "COMPLETED") {
        const { data: approved, error: approveError } = await userClient.rpc("approve_withdrawal", {
          _id: withdrawal.id,
          _provider_tx: String(withdrawal.provider_tx_id),
        });
        if (approveError) return json({ error: "Saque concluído no gateway, mas a confirmação local precisa ser reconciliada." }, 503);
        await admin.from("withdrawal_events").insert({
          withdrawal_id: withdrawal.id, event_type: "provider_completed",
          actor_id: authData.user.id, note: String(withdrawal.provider_tx_id),
        });
        return json({ success: true, id: String(withdrawal.provider_tx_id), status: "COMPLETED", withdrawalStatus: approved?.status || "approved" });
      }

      if (status === "FAILED") {
        await admin.from("withdrawal_events").insert({
          withdrawal_id: withdrawal.id, event_type: "provider_failed",
          actor_id: authData.user.id, note: String(withdrawal.provider_tx_id),
        });
        return json({ error: "O gateway marcou este saque como falho. Recuse a solicitação para o usuário reenviar." }, 409);
      }
      return json({ success: true, id: String(withdrawal.provider_tx_id), status: status || "PENDING", withdrawalStatus: "pending" });
    }

    // The live fee endpoint is the source of truth for the active Magnus route.
    const feeResponse = await fetch(`${MAGNUS}/transactions/fees`, {
      headers: { "X-API-Key": key, Accept: "application/json" },
    });
    const feeRaw = await feeResponse.text();
    let feePayload: any = {};
    try { feePayload = feeRaw ? JSON.parse(feeRaw) : {}; } catch { feePayload = {}; }
    if (!feeResponse.ok || feePayload?.success === false || !feePayload?.data?.withdraw) {
      return json({ error: "Não foi possível consultar a taxa atual de saque da MagnusPay." }, 502);
    }

    const liveFee = Number(feePayload.data.withdraw.fixed);
    const providerMin = Number(feePayload.data.withdraw.minWithdraw);
    const providerMax = Number(feePayload.data.withdraw.maxWithdraw);
    if (!Number.isFinite(liveFee) || liveFee < 0) return json({ error: "Taxa de saque inválida retornada pelo gateway." }, 502);
    if (configuredFee + 0.0001 < liveFee) {
      return json({
        error: `A taxa configurada no ZXMAX (R$ ${configuredFee.toFixed(2).replace(".", ",")}) é menor que a taxa atual da MagnusPay (R$ ${liveFee.toFixed(2).replace(".", ",")}). Ajuste a taxa no painel antes de processar.`,
        code: "withdraw_fee_too_low",
        providerFee: liveFee,
      }, 409);
    }

    // Magnus deducts its fee from the requested amount. Add that fee so the
    // recipient receives exactly withdrawal.net_amount shown by ZXMAX.
    const providerGross = Math.round((net + liveFee) * 100) / 100;
    if (Number.isFinite(providerMin) && providerGross < providerMin) {
      return json({ error: `O gateway exige saque mínimo de R$ ${providerMin.toFixed(2).replace(".", ",")}.` }, 409);
    }
    if (Number.isFinite(providerMax) && providerGross > providerMax) {
      return json({ error: `O gateway aceita no máximo R$ ${providerMax.toFixed(2).replace(".", ",")} por saque.` }, 409);
    }

    const response = await fetch(`${MAGNUS}/wallet/withdraw`, {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        amount: providerGross,
        pixKey,
        pixKeyType: pixKeyType(pixKey),
      }),
    });
    const raw = await response.text();
    let provider: any = {};
    try { provider = raw ? JSON.parse(raw) : {}; } catch { provider = {}; }
    if (response.status === 429) return json({ error: "Limite temporário do gateway. Aguarde e tente novamente." }, 429);
    if (!response.ok || provider?.success === false || !provider?.data) {
      const detail = String(provider?.message || `MagnusPay respondeu HTTP ${response.status}`).slice(0, 180);
      await admin.from("withdrawal_events").insert({
        withdrawal_id: withdrawal.id, event_type: "provider_error",
        actor_id: authData.user.id, note: detail,
      });
      return json({ error: "O gateway não aceitou o saque. Nenhum saldo foi marcado como pago." }, 502);
    }

    const node = provider.data;
    const providerTx = String(node.transactionId || node.id || "").trim();
    const providerStatus = String(node.status || "PENDING").toUpperCase();
    if (!providerTx) return json({ error: "O gateway aceitou a solicitação sem retornar identificador de saque." }, 502);

    // Persist the provider ID immediately. A retry reconciles this exact payout
    // and therefore cannot create a second transfer.
    const { error: bindError } = await admin.from("withdrawals")
      .update({ provider_tx_id: providerTx, updated_at: new Date().toISOString() })
      .eq("id", withdrawal.id).eq("status", "pending").is("provider_tx_id", null);
    if (bindError) {
      await admin.from("withdrawal_events").insert({
        withdrawal_id: withdrawal.id, event_type: "provider_accepted_db_pending",
        actor_id: authData.user.id, note: providerTx,
      });
      return json({ error: "O gateway aceitou o saque, mas a vinculação local precisa de reconciliação. Não envie outro saque." }, 503);
    }

    await admin.from("withdrawal_events").insert({
      withdrawal_id: withdrawal.id, event_type: "provider_submitted",
      actor_id: authData.user.id,
      note: `${providerTx} · gateway fee R$ ${liveFee.toFixed(2)} · payout R$ ${net.toFixed(2)}`,
    });

    if (providerStatus === "COMPLETED") {
      const { data: approved, error: approveError } = await userClient.rpc("approve_withdrawal", { _id: withdrawal.id, _provider_tx: providerTx });
      if (approveError) return json({ error: "Saque concluído no gateway, mas a confirmação local precisa ser reconciliada." }, 503);
      return json({ success: true, id: providerTx, status: "COMPLETED", withdrawalStatus: approved?.status || "approved" });
    }

    return json({ success: true, id: providerTx, status: providerStatus || "PENDING", withdrawalStatus: "pending", providerFee: liveFee });
  } catch (error) {
    console.error("process-withdrawal", error instanceof Error ? error.message : error);
    return json({ error: "Erro inesperado ao processar o saque." }, 500);
  }
});
