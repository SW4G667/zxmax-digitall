import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const EVOPAY_BASE = "https://api.evopay.cash/v1";

// Detecta tipo de chave Pix conforme documentação Evopay
function detectPixType(pixKey: string, explicitType?: string): string {
  if (explicitType) {
    const t = explicitType.toLowerCase();
    if (["cpf", "cnpj", "email", "phone", "evp"].includes(t)) return t;
  }
  const key = pixKey.trim();
  // EVP - chave aleatória é UUID v4
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return "evp";
  if (key.includes("@")) return "email";
  // Telefone: +55... ou 11 dígitos com 9 no início do número (celular)
  const digits = key.replace(/\D/g, "");
  if (key.startsWith("+")) return "phone";
  if (/^\d{14}$/.test(digits)) return "cnpj";
  if (/^\d{11}$/.test(digits)) {
    // Heurística: se começa com DDD válido e tem 9 como primeiro dígito do número, pode ser telefone
    // Mas para segurança, assumimos CPF para 11 dígitos, a menos que o usuário tenha dito phone
    // Vamos diferenciar: telefones brasileiros com DDD tem padrão, mas CPF também tem 11.
    // Como Evopay aceita phone como 11 dígitos, vamos usar regra: se for 11 e terceiro dígito é 9 e DDD entre 11-91, é phone
    // Caso contrário CPF
    const ddd = Number(digits.slice(0, 2));
    const third = digits[2];
    if (ddd >= 11 && ddd <= 91 && third === "9") {
      // Pode ser celular, mas ainda ambíguo. Vamos preferir CPF, mas se a chave Pix do usuário foi cadastrada como telefone, o admin pode enviar pixType
      // Para evitar erro, vamos retornar cpf por padrão, mas tentar phone se detectar padrão de celular e não for CPF válido?
      // Simplificação: retorna cpf, mas se explicitamente parecer telefone (ex: 119...), retorna phone
      // Para não quebrar, vamos verificar se é um CPF válido? CPF tem dígitos verificadores.
      // Se não for CPF válido, assume phone
      const isValidCpf = (cpf: string) => {
        if (/^(\d)\1{10}$/.test(cpf)) return false;
        let sum = 0;
        for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
        let d1 = 11 - (sum % 11);
        if (d1 >= 10) d1 = 0;
        if (d1 !== Number(cpf[9])) return false;
        sum = 0;
        for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
        let d2 = 11 - (sum % 11);
        if (d2 >= 10) d2 = 0;
        return d2 === Number(cpf[10]);
      };
      if (!isValidCpf(digits)) return "phone";
      return "cpf";
    }
    return "cpf";
  }
  if (/^\d{10}$/.test(digits)) return "phone";
  // Se não identificou, tenta EVP como fallback (chave aleatória pode não ter traços em alguns bancos)
  if (digits.length >= 20) return "evp";
  return "evp";
}

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

    // Verifica se é admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json({ error: "Apenas administradores podem processar saques" }, 403);

    const { data: setting } = await admin.from("app_settings").select("value").eq("key", "evopay").maybeSingle();
    const cfg = (setting?.value || {}) as Record<string, unknown>;
    const apiKey = String(Deno.env.get("EVOPAY_API_KEY") || "").trim();
    const withdrawalsEnabled = typeof cfg.withdrawalsEnabled === "boolean" ? cfg.withdrawalsEnabled : cfg.enabled !== false;

    if (!apiKey) return json({ error: "Credencial Evopay não configurada. Defina EVOPAY_API_KEY nos secrets." }, 400);
    if (!withdrawalsEnabled) return json({ error: "Saques via Evopay não estão ativos." }, 400);

    const body = await req.json().catch(() => ({}));
    const amount = Number(body.amount);
    const pixKey = String(body.pixKey || "").trim();
    const clientReference = String(body.clientReference || `zxmax-withdraw-${Date.now()}`);
    const explicitType = body.pixType ? String(body.pixType) : undefined;
    const description = String(body.description || `Saque ZXMAX ${clientReference}`).slice(0, 120);

    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Informe o valor líquido do saque." }, 400);
    }
    if (!pixKey) {
      return json({ error: "Informe a chave Pix para o saque." }, 400);
    }

    const pixType = detectPixType(pixKey, explicitType);
    const callbackUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/evopay-webhook`;

    const payload = {
      amount,
      pixKey,
      pixType,
      callbackUrl,
      description,
      clientReference,
    };

    const resp = await fetch(`${EVOPAY_BASE}/withdraw/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => ({} as Record<string, unknown>));
    if (!resp.ok) {
      console.error("evopay-withdraw failed", resp.status, data);
      const detail = String((data as any)?.message || (data as any)?.error || `Evopay ${resp.status}`);
      return json({ error: `Falha no saque Evopay: ${detail.slice(0, 180)}` }, 400);
    }

    const node = (data as any)?.data && typeof (data as any).data === "object" ? (data as any).data : data as Record<string, unknown>;
    const txId = String(node.id || clientReference);

    try {
      await admin.from("webhook_logs").insert({
        source: "evopay",
        event_type: "CREATE_WITHDRAW",
        status: String(node.status || "PENDING"),
        order_id: clientReference.startsWith("zxmax-withdraw-") ? Number(clientReference.replace("zxmax-withdraw-", "")) || null : null,
        charge_id: txId,
        payload: { amount, pixKey, pixType, clientReference },
        error: null,
      });
    } catch { /* ignore */ }

    return json({
      id: txId,
      status: String(node.status || "PENDING"),
      amount: Number(node.amount || amount),
      pixKey: String((node as any).withdrawPixKey || pixKey),
      pixType: String((node as any).withdrawPixType || pixType),
    });
  } catch (error: any) {
    console.error("evopay-withdraw error:", error?.message || error);
    return json({ error: error?.message || "Erro ao processar saque Evopay" }, 400);
  }
});
