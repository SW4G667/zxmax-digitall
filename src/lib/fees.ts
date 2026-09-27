/** Taxas padrão usadas apenas como fallback quando a configuração remota está indisponível. */
export const BUYER_FEE = 0.90;
export const WITHDRAW_MIN = 5.00;
export const WITHDRAW_FEE = 3.50;

export type WithdrawFeeConfig = {
  min?: number;
  fee?: number;
};

export function roundMoney(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function checkoutTotals(subtotal: unknown, configuredBuyerFee: unknown = BUYER_FEE): {
  productAmount: number;
  buyerFee: number;
  total: number;
} {
  const productAmount = roundMoney(subtotal);
  const buyerFee = Math.max(0, roundMoney(configuredBuyerFee));
  return {
    productAmount,
    buyerFee,
    total: roundMoney(productAmount + buyerFee),
  };
}

export function withdrawTotals(balance: unknown, config: WithdrawFeeConfig = {}): {
  balance: number;
  fee: number;
  net: number;
  min: number;
  canWithdraw: boolean;
  reason: string | null;
} {
  const available = Math.max(0, roundMoney(balance));
  const min = Math.max(0, roundMoney(config.min ?? WITHDRAW_MIN));
  const fee = Math.max(0, roundMoney(config.fee ?? WITHDRAW_FEE));
  const net = roundMoney(available - fee);

  if (available < min) {
    return {
      balance: available,
      fee,
      net: Math.max(0, net),
      min,
      canWithdraw: false,
      reason: `O saque mínimo é R$ ${min.toFixed(2).replace(".", ",")}.`,
    };
  }
  if (net <= 0) {
    return {
      balance: available,
      fee,
      net: 0,
      min,
      canWithdraw: false,
      reason: `A taxa de saque é R$ ${fee.toFixed(2).replace(".", ",")}.`,
    };
  }
  return { balance: available, fee, net, min, canWithdraw: true, reason: null };
}

/** Seller credit for a paid order — never invents a value. */
export function sellerCredit(purchase: { amount?: unknown; productAmount?: unknown; buyerFee?: unknown }): number {
  const productAmount = roundMoney(purchase.productAmount);
  if (productAmount > 0) return productAmount;
  const total = roundMoney(purchase.amount);
  const fee = roundMoney(purchase.buyerFee) || BUYER_FEE;
  return Math.max(0, roundMoney(total - fee));
}
