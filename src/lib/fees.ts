/**
 * Taxas oficiais da ZXMAX.
 *
 * Comprador paga o preço anunciado + R$ 0,90.
 * Ex.: anúncio de R$ 5,00 → checkout de R$ 5,90. O vendedor recebe R$ 5,00.
 *
 * Saque: mínimo R$ 10,00 e taxa fixa de R$ 3,50.
 * Ex.: saldo R$ 20,00 → líquido R$ 16,50.
 */

export const BUYER_FEE = 0.9;
export const WITHDRAW_MIN = 10;
export const WITHDRAW_FEE = 3.5;

export function roundMoney(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function checkoutTotals(subtotal: unknown): {
  productAmount: number;
  buyerFee: number;
  total: number;
} {
  const productAmount = roundMoney(subtotal);
  const buyerFee = BUYER_FEE;
  return {
    productAmount,
    buyerFee,
    total: roundMoney(productAmount + buyerFee),
  };
}

export function withdrawTotals(balance: unknown): {
  balance: number;
  fee: number;
  net: number;
  min: number;
  canWithdraw: boolean;
  reason: string | null;
} {
  const available = roundMoney(balance);
  const fee = WITHDRAW_FEE;
  const net = roundMoney(available - fee);
  if (available < WITHDRAW_MIN) {
    return {
      balance: available,
      fee,
      net: Math.max(0, net),
      min: WITHDRAW_MIN,
      canWithdraw: false,
      reason: `O saque mínimo é R$ ${WITHDRAW_MIN.toFixed(2).replace(".", ",")}.`,
    };
  }
  if (net <= 0) {
    return {
      balance: available,
      fee,
      net: 0,
      min: WITHDRAW_MIN,
      canWithdraw: false,
      reason: `A taxa de saque é R$ ${WITHDRAW_FEE.toFixed(2).replace(".", ",")}.`,
    };
  }
  return {
    balance: available,
    fee,
    net,
    min: WITHDRAW_MIN,
    canWithdraw: true,
    reason: null,
  };
}

/** Seller credit for a paid order — never invents a value. */
export function sellerCredit(purchase: { amount?: unknown; productAmount?: unknown; buyerFee?: unknown }): number {
  const productAmount = roundMoney(purchase.productAmount);
  if (productAmount > 0) return productAmount;
  const total = roundMoney(purchase.amount);
  const fee = roundMoney(purchase.buyerFee) || BUYER_FEE;
  return Math.max(0, roundMoney(total - fee));
}
