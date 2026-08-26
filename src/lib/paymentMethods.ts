import type { EdgeCallResult } from "@/lib/edgeErrors";

export type PaymentMethodId = "zennith_pix" | "vexopay_pix" | "crypto" | "card" | "boleto";
export type PaymentFees = Partial<Record<PaymentMethodId, number>>;

export type PaymentMethodsState =
  | { status: "loading" }
  | { status: "ok"; methods: Record<PaymentMethodId, boolean>; fees: PaymentFees }
  | { status: "session" }
  | { status: "unavailable" }
  | { status: "network" };

export const NO_METHODS: Record<PaymentMethodId, boolean> = { zennith_pix: false, vexopay_pix: false, crypto: false, card: false, boleto: false };

export function checkoutMethods(state: PaymentMethodsState): Record<PaymentMethodId, boolean> | null {
  return state.status === "ok" ? state.methods : null;
}

const safeFee = (value: unknown) => {
  const fee = Number(value);
  return Number.isFinite(fee) && fee >= 0 && fee <= 1000 ? Math.round(fee * 100) / 100 : 0;
};

function validMethods(value: unknown): value is Record<PaymentMethodId, boolean> {
  if (!value || typeof value !== "object") return false;
  const methods = value as Record<string, unknown>;
  return (["zennith_pix", "vexopay_pix", "crypto", "card", "boleto"] as const).every((key) => typeof methods[key] === "boolean");
}

export function classifyPaymentMethods(result: EdgeCallResult<{ methods?: unknown; fees?: unknown; v?: number }>): PaymentMethodsState {
  if (result.errorMessage === null && result.data && validMethods(result.data.methods)) {
    const rawFees = result.data.fees && typeof result.data.fees === "object" ? result.data.fees as Record<string, unknown> : {};
    return { status: "ok", methods: result.data.methods, fees: { zennith_pix: safeFee(rawFees.zennith_pix), vexopay_pix: safeFee(rawFees.vexopay_pix) } };
  }
  if (result.status === 401) return { status: "session" };
  if (result.status === 503) return { status: "network" };
  if (result.status === null) return { status: "network" };
  return { status: "unavailable" };
}

export function paymentMethodsNotice(state: PaymentMethodsState): { message: string; retryable: boolean } | null {
  if (state.status === "loading" || state.status === "ok") return null;
  if (state.status === "session") return { message: "Sua sessão expirou. Entre novamente para concluir o pagamento.", retryable: false };
  if (state.status === "network") return { message: "Não foi possível verificar os métodos de pagamento agora. Tente novamente.", retryable: true };
  return { message: "Nenhum método de pagamento está ativo no momento.", retryable: true };
}
