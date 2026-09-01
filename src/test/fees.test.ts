import { describe, expect, it } from "vitest";
import {
  BUYER_FEE,
  checkoutTotals,
  sellerCredit,
  WITHDRAW_FEE,
  WITHDRAW_MIN,
  withdrawTotals,
} from "@/lib/fees";

describe("checkoutTotals", () => {
  it("anúncio de R$ 5,00 vira R$ 5,90 para o cliente", () => {
    expect(checkoutTotals(5)).toEqual({ productAmount: 5, buyerFee: 0.9, total: 5.9 });
  });

  it("anúncio de R$ 2,00 vira R$ 2,90", () => {
    expect(checkoutTotals(2)).toEqual({ productAmount: 2, buyerFee: 0.9, total: 2.9 });
  });

  it("taxa é sempre 90 centavos, nunca percentual", () => {
    expect(checkoutTotals(100).buyerFee).toBe(BUYER_FEE);
    expect(checkoutTotals(100).total).toBe(100.9);
  });

  it("arredonda centavos sem inventar valor", () => {
    expect(checkoutTotals(5.555).productAmount).toBe(5.56);
    expect(checkoutTotals(5.555).total).toBe(6.46);
  });
});

describe("withdrawTotals", () => {
  it("mínimo é R$ 10,00 e a taxa é R$ 3,50", () => {
    expect(WITHDRAW_MIN).toBe(10);
    expect(WITHDRAW_FEE).toBe(3.5);
  });

  it("bloqueia saldo abaixo do mínimo", () => {
    const r = withdrawTotals(9.99);
    expect(r.canWithdraw).toBe(false);
    expect(r.reason).toMatch(/R\$ 10,00/);
  });

  it("saque de R$ 10,00 deixa R$ 6,50 líquidos", () => {
    const r = withdrawTotals(10);
    expect(r.canWithdraw).toBe(true);
    expect(r.fee).toBe(3.5);
    expect(r.net).toBe(6.5);
  });

  it("saque de R$ 20,00 deixa R$ 16,50", () => {
    expect(withdrawTotals(20).net).toBe(16.5);
  });
});

describe("sellerCredit", () => {
  it("vendedor recebe o preço anunciado, não o total do checkout", () => {
    expect(sellerCredit({ amount: 5.9, productAmount: 5, buyerFee: 0.9 })).toBe(5);
  });

  it("sem product_amount, desconta a taxa do total", () => {
    expect(sellerCredit({ amount: 5.9 })).toBe(5);
  });
});
