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

/** Calcula a disponibilidade de cada método DIRETO de app_settings.
 *  Para o COMPRADOR (não-admin), só o objeto `checkout_gateways` é legível
 *  via RLS — credenciais de provedor só admins leem. Então:
 *    1. Se `checkout_gateways` tem booleanos explícitos, usamos (honra o que
 *       o admin ligou/desligou no painel).
 *    2. Se não tem, fallback seguro: PIX e Crypto ligados (oficiais),
 *       Cartão/Boleto desligados.
 *  A verificação de "existe credencial?" roda no servidor (edge) quando
 *  ela estiver publicada; antes disso, honramos a vontade do admin. */
export async function computeMethodsFromSettings(): Promise<Record<PaymentMethodId, boolean> | null> {
  try {
    const { data, error } = await (supabase as any)
      .from("app_settings")
      .select("key, value")
      .in("key", ["zennithpay", "vexopay", "stripe", "evopay", "checkout_gateways"]);
    if (error || !data) {
      // Sem leitura do banco (ex.: RLS), cai no FALLBACK global do caller.
      return null;
    }
    const byKey: Record<string, any> = {};
    for (const r of data) byKey[r.key] = r.value || {};

    const cg = byKey.checkout_gateways || {};
    // Se o admin já gravou checkout_gateways com booleanos explícitos,
    // confiamos 100% no que ele marcou.
    const hasExplicit =
      typeof cg.pix === "boolean" ||
      typeof cg.crypto === "boolean" ||
      typeof cg.card === "boolean" ||
      typeof cg.boleto === "boolean";

    if (hasExplicit) {
      return {
        pix: cg.pix !== false,
        crypto: cg.crypto !== false,
        card: cg.card === true,
        boleto: cg.boleto === true,
      };
    }

    // Sem checkout_gateways salvo: tenta derivar do que cada provider
    // permite a partir das chaves que o comprador consegue ver (não-secretas).
    // Pix/crypto ligados por padrão, cartão/boleto desligados.
    const zennith = byKey.zennithpay || {};
    const vexo = byKey.vexopay || {};
    const stripe = byKey.stripe || {};
    const zPix = typeof zennith.pixEnabled === "boolean" ? zennith.pixEnabled : (zennith.enabled !== false);
    const vCrypto = typeof vexo.cryptoEnabled === "boolean" ? vexo.cryptoEnabled : (vexo.enabled !== false);
    const sCard = typeof stripe.cardEnabled === "boolean" ? stripe.cardEnabled : stripe.enabled === true;
    const sBoleto = typeof stripe.boletoEnabled === "boolean" ? stripe.boletoEnabled : false;
    return {
      pix: zPix,
      crypto: vCrypto,
      card: sCard,
      boleto: sBoleto,
    };
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
