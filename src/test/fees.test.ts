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
  it("anúncio de R$ 5,00 usa a taxa fallback quando a configuração remota não chegou", () => {
    expect(checkoutTotals(5)).toEqual({ productAmount: 5, buyerFee: 0.9, total: 5.9 });
  });

  it("aceita taxa do comprador configurada pelo painel", () => {
    expect(checkoutTotals(5, 1.25)).toEqual({ productAmount: 5, buyerFee: 1.25, total: 6.25 });
  });

  it("fallback continua fixo em centavos, nunca percentual", () => {
    expect(checkoutTotals(100).buyerFee).toBe(BUYER_FEE);
    expect(checkoutTotals(100).total).toBe(100.9);
  });

  it("arredonda centavos sem inventar valor", () => {
    expect(checkoutTotals(5.555).productAmount).toBe(5.56);
    expect(checkoutTotals(5.555).total).toBe(6.46);
  });
});

describe("withdrawTotals", () => {
  it("fallback acompanha a configuração inicial da plataforma", () => {
    expect(WITHDRAW_MIN).toBe(5);
    expect(WITHDRAW_FEE).toBe(3.5);
  });

  it("bloqueia saldo abaixo do mínimo fallback", () => {
    const r = withdrawTotals(4.99);
    expect(r.canWithdraw).toBe(false);
    expect(r.reason).toMatch(/R\$ 5,00/);
  });

  it("usa mínimo e taxa configurados pelo painel", () => {
    const r = withdrawTotals(20, { min: 10, fee: 2.75 });
    expect(r.min).toBe(10);
    expect(r.fee).toBe(2.75);
    expect(r.net).toBe(17.25);
    expect(r.canWithdraw).toBe(true);
  });

  it("saque fallback de R$ 10,00 deixa R$ 6,50 líquidos", () => {
    const r = withdrawTotals(10);
    expect(r.canWithdraw).toBe(true);
    expect(r.fee).toBe(3.5);
    expect(r.net).toBe(6.5);
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
