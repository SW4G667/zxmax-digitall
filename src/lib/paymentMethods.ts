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
 */

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

function isMethodsShape(value: unknown): value is Record<PaymentMethodId, boolean> {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (["pix", "crypto", "card", "boleto"] as const).every((k) => typeof v[k] === "boolean");
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
      return {
        message:
          "Estamos atualizando os meios de pagamento. Tente novamente em alguns minutos.",
        retryable: true,
      };
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
