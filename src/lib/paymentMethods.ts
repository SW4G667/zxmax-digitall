import type { EdgeCallResult } from "@/lib/edgeErrors";

export type PaymentMethodId = "evopay_pix" | "zennith_pix" | "vexopay_pix" | "crypto" | "card" | "boleto";
export type PaymentFees = Partial<Record<PaymentMethodId, number>>;

export type PaymentMethodsState =
  | { status: "loading" }
  | { status: "ok"; methods: Record<PaymentMethodId, boolean>; fees: PaymentFees }
  | { status: "session" }
  | { status: "unavailable" }
  | { status: "network" };

export const NO_METHODS: Record<PaymentMethodId, boolean> = { evopay_pix: false, zennith_pix: false, vexopay_pix: false, crypto: false, card: false, boleto: false };

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
  // Suporta tanto legado (sem evopay) quanto novo
  const required = ["crypto", "card", "boleto"] as const;
  const pixKeys = ["evopay_pix", "zennith_pix", "vexopay_pix"] as const;
  const hasRequired = required.every((key) => typeof methods[key] === "boolean");
  const hasAtLeastOnePix = pixKeys.some((k) => typeof methods[k] === "boolean");
  return hasRequired && hasAtLeastOnePix;
}

function normalizeMethods(raw: Record<string, unknown>): Record<PaymentMethodId, boolean> {
  const evopay = Boolean(raw.evopay_pix);
  const zennith = Boolean(raw.zennith_pix);
  const vexo = Boolean(raw.vexopay_pix);
  // Precedência: Evopay > Zennith > VexoPay
  let selected: PaymentMethodId | null = null;
  if (evopay) selected = "evopay_pix";
  else if (zennith) selected = "zennith_pix";
  else if (vexo) selected = "vexopay_pix";

  return {
    evopay_pix: selected === "evopay_pix",
    zennith_pix: selected === "zennith_pix",
    vexopay_pix: selected === "vexopay_pix",
    crypto: Boolean(raw.crypto),
    card: Boolean(raw.card),
    boleto: Boolean(raw.boleto),
  };
}

export function classifyPaymentMethods(result: EdgeCallResult<{ methods?: unknown; fees?: unknown; v?: number }>): PaymentMethodsState {
  if (result.errorMessage === null && result.data && result.data.methods && typeof result.data.methods === "object") {
    const rawFees = result.data.fees && typeof result.data.fees === "object" ? result.data.fees as Record<string, unknown> : {};
    const raw = result.data.methods as Record<string, unknown>;
    if (!validMethods(raw)) {
      // Se for versão antiga sem evopay_pix, ainda tenta normalizar
      const hasOld = typeof raw.zennith_pix === "boolean" && typeof raw.vexopay_pix === "boolean";
      if (!hasOld) {
        // invalid
      }
    }
    const methods = normalizeMethods(raw);
    return {
      status: "ok",
      methods,
      fees: {
        evopay_pix: safeFee(rawFees.evopay_pix),
        zennith_pix: safeFee(rawFees.zennith_pix),
        vexopay_pix: safeFee(rawFees.vexopay_pix),
      },
    };
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
