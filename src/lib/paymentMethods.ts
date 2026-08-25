/**
 * Classifica a resposta da Edge Function `integrations-config`
 * (action `payment_methods`) para o checkout.
 *
 * O checkout precisa diferenciar CINCO situações, e nenhuma delas pode ser
 * confundida com "gateway não configurado":
 *
 *  1. ok              — métodos devolvidos (algum pode ser false de verdade);
 *  2. outdated        — função publicada é antiga (não conhece a ação): cai no
 *                       gate de admin (403) ou não devolve `methods`;
 *  3. settingsFailed  — função nova, mas `app_settings` não pôde ser lido
 *                       (code `payment_settings_unavailable`, HTTP 503);
 *  4. session         — sessão expirada (401);
 *  5. network         — falha transitória de rede/função (retryable).
 *
 * Nunca uma falha interna é convertida em `{ pix:false, card:false,
 * crypto:false, boleto:false }` — era o que fazia a tela dizer que "nenhuma
 * forma está configurada" quando o problema era outro.
 *
 * Quando a edge é antiga, o checkout calcula a disponibilidade direto dos
 * toggles por função (zennithpay.pixEnabled, vexopay.cryptoEnabled,
 * stripe.cardEnabled, stripe.boletoEnabled, evopay.pixEnabled como
 * último-resort legado) e da existência das credenciais salvas em
 * app_settings.
 */

import { supabase } from "@/integrations/supabase/client";
import type { EdgeCallResult } from "@/lib/edgeErrors";

export type PaymentMethodId = "pix" | "crypto" | "card" | "boleto";

export type PaymentMethodsState =
  | { status: "loading" }
  | { status: "ok"; methods: Record<PaymentMethodId, boolean> }
  | { status: "outdated" }
  | { status: "settingsFailed" }
  | { status: "session" }
  | { status: "network" };

export const NO_METHODS: Record<PaymentMethodId, boolean> = {
  pix: false,
  crypto: false,
  card: false,
  boleto: false,
};

/** PIX + Crypto são os meios oficiais. Se a edge antiga não responder `v: 2`
 * e não conseguirmos ler app_settings, o checkout oferece esses dois em vez
 * de travar a compra. */
export const FALLBACK_CHECKOUT_METHODS: Record<PaymentMethodId, boolean> = {
  pix: true,
  crypto: true,
  card: false,
  boleto: false,
};

/** Métodos que o checkout deve deixar clicáveis. */
export function checkoutMethods(state: PaymentMethodsState): Record<PaymentMethodId, boolean> | null {
  if (state.status === "ok") return state.methods;
  if (state.status === "outdated" || state.status === "settingsFailed" || state.status === "network") {
    return FALLBACK_CHECKOUT_METHODS;
  }
  return null;
}

function isMethodsShape(value: unknown): value is Record<PaymentMethodId, boolean> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (["pix", "crypto", "card", "boleto"] as const).every((k) => typeof v[k] === "boolean");
}

/** Calcula a disponibilidade de cada método DIRETO de app_settings, honrando
 *  os toggles por função de cada provider. Usado como fallback quando a edge
 *  publicada é antiga e não devolve `v: 2`. */
export async function computeMethodsFromSettings(): Promise<Record<PaymentMethodId, boolean> | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("app_settings")
      .select("key, value")
      .in("key", ["zennithpay", "vexopay", "stripe", "evopay", "checkout_gateways"]);
    if (error || !data) return null;
    const byKey: Record<string, any> = {};
    for (const r of data) byKey[r.key] = r.value || {};

    const zennith = byKey.zennithpay || {};
    const vexo = byKey.vexopay || {};
    const stripe = byKey.stripe || {};
    const evo = byKey.evopay || {};
    const cg = byKey.checkout_gateways || {};

    // Helper: flag booleana com fallback para o valor legado em checkout_gateways
    const flag = (val: unknown, legacy?: unknown, def = false): boolean => {
      if (typeof val === "boolean") return val;
      if (typeof legacy === "boolean") return legacy;
      return def;
    };
    const has = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

    // PIX: ZennithPay oficial; evopay.pixEnabled é legado mas não contamos
    // como ativação a menos que a chave exista (para não reativar o legado
    // por acidente). EvoPay é DESLIGADO por padrão.
    const pixOn =
      flag(zennith.pixEnabled, cg.pix, true) &&
      (has(zennith.apiKey) || false);
    // Crypto: VexoPay.
    const cryptoOn =
      flag(vexo.cryptoEnabled, cg.crypto, true) &&
      has(vexo.clientId) && has(vexo.clientSecret);
    // Cartão: Stripe.
    const cardOn =
      flag(stripe.cardEnabled, cg.card, false) &&
      has(stripe.secretKey);
    // Boleto: Stripe também.
    const boletoOn =
      flag(stripe.boletoEnabled, cg.boleto, false) &&
      has(stripe.secretKey);

    return { pix: pixOn, crypto: cryptoOn, card: cardOn, boleto: boletoOn };
  } catch {
    return null;
  }
}

/** Mensagem segura (sem detalhes de secrets/SQL/gateway) por situação. */
export function paymentMethodsNotice(state: PaymentMethodsState): { message: string; retryable: boolean } | null {
  switch (state.status) {
    case "ok": {
      const anyEnabled = Object.values(state.methods).some(Boolean);
      if (anyEnabled) return null;
      return {
        message:
          "Nenhuma forma de pagamento está ativa no momento. Avise o suporte para o vendedor receber.",
        retryable: true,
      };
    }
    case "outdated":
      // Função antiga: usamos fallback; não bloqueamos a compra.
      return null;
    case "settingsFailed":
      return {
        message: "Não foi possível verificar as formas de pagamento agora. Tente novamente em instantes.",
        retryable: true,
      };
    case "session":
      return { message: "Sua sessão expirou. Entre novamente para concluir a compra.", retryable: false };
    case "network":
      return { message: "Falha de conexão ao consultar as formas de pagamento. Verifique sua internet.", retryable: true };
    default:
      return null;
  }
}

/** Classifica o resultado de `unwrapEdgeCall` no formato acima. */
export function classifyPaymentMethods(
  result: EdgeCallResult<{ methods?: unknown; v?: number }>,
): PaymentMethodsState {
  if (result.errorMessage === null && result.data) {
    if (isMethodsShape(result.data.methods)) {
      return { status: "ok", methods: result.data.methods };
    }
    // 200 sem `methods`: formato desconhecido — tratar como função antiga.
    return { status: "outdated" };
  }

  const status = result.status ?? 0;
  if (status === 401) return { status: "session" };
  // Função antiga publicada: a ação payment_methods não existia e a chamada caía
  // no gate de admin (403 "Apenas administradores.") ou em "Provedor inválido."
  if (status === 403 || status === 400 || status === 404) return { status: "outdated" };
  if (status === 503 || result.code === "payment_settings_unavailable") return { status: "settingsFailed" };
  return { status: "network" };
}
