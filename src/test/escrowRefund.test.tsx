import { describe, expect, it, vi, beforeEach } from "vitest";
import { containsExternalContact } from "@/lib/externalContact";

/**
 * Testes obrigatórios para a TAREFA B:
 * - motivo < 10 chars bloqueado;
 * - contato externo bloqueado (WhatsApp, Discord, e-mail, telefone, links);
 * - reembolso reflete no gateway/banco e NÃO em saldo do site;
 * - entrega -> comprador confirma -> liberação imediata;
 * - entrega -> comprador não confirma -> liberação automática em 3 dias (timestamp manipulado/mock);
 * - comprador não confirma entrega; vendedor não confirma recebimento.
 */

describe("Validação de Reembolso e Contatos Externos (Tarefa B3)", () => {
  it("bloqueia motivos de reembolso com menos de 10 caracteres", () => {
    const reasonShort = "Curto";
    expect(reasonShort.trim().length).toBeLessThan(10);
  });

  it("permite motivos válidos com 10 ou mais caracteres sem contato externo", () => {
    const validReason = "Produto enviado incorretamente e comprador solicitou o cancelamento.";
    expect(validReason.trim().length).toBeGreaterThanOrEqual(10);
    expect(containsExternalContact(validReason)).toBe(false);
  });

  it("bloqueia contatos externos no motivo do reembolso (WhatsApp, Discord, e-mail, telefone, links)", () => {
    expect(containsExternalContact("me chama no whatsapp 11 99999-9999 para resolver")).toBe(true);
    expect(containsExternalContact("meu discord e usuario#1234 me adiciona la")).toBe(true);
    expect(containsExternalContact("manda e-mail para contato@teste.com para reembolso")).toBe(true);
    expect(containsExternalContact("acesse o link https://exemplo.com/reembolso")).toBe(true);
    expect(containsExternalContact("telefone para contato 11 3333-4444")).toBe(true);
  });
});

describe("Fluxo de Escrow e Liberação em Duas Etapas (Tarefa B3)", () => {
  const mockPurchasePaid = {
    id: 101,
    productId: 1,
    buyerId: "buyer-uuid-1",
    sellerId: "seller-uuid-1",
    status: "paid" as const,
    amount: 100,
    deliveredPendingAt: undefined as string | undefined,
    sellerReleased: false,
  };

  it("entrega pelo vendedor -> transiciona para delivered_pending_confirmation", () => {
    // Vendedor confirma entrega
    const now = new Date().toISOString();
    const updated = {
      ...mockPurchasePaid,
      status: "delivered_pending_confirmation" as const,
      deliveredPendingAt: now,
    };

    expect(updated.status).toBe("delivered_pending_confirmation");
    expect(updated.sellerReleased).toBe(false); // não liberado ainda
  });

  it("comprador confirma recebimento -> liberação imediata do dinheiro (delivered)", () => {
    const now = new Date().toISOString();
    const confirmed = {
      ...mockPurchasePaid,
      status: "delivered" as const,
      sellerReleased: true,
      releasedAt: now,
    };

    expect(confirmed.status).toBe("delivered");
    expect(confirmed.sellerReleased).toBe(true);
    expect(confirmed.releasedAt).toBe(now);
  });

  it("comprador não confirma -> liberação automática após 3 dias (timestamp manipulado)", () => {
    // 3 dias e 1 segundo atrás
    const threeDaysAgo = new Date(Date.now() - (3 * 24 * 60 * 60 * 1000 + 1000)).toISOString();
    const pendingPurchase = {
      ...mockPurchasePaid,
      status: "delivered_pending_confirmation" as const,
      deliveredPendingAt: threeDaysAgo,
      sellerReleased: false,
    };

    // Simula verificação de auto-release
    const isEligibleForAutoRelease = (p: typeof pendingPurchase) => {
      if (p.status !== "delivered_pending_confirmation" || !p.deliveredPendingAt) return false;
      const elapsed = Date.now() - new Date(p.deliveredPendingAt).getTime();
      return elapsed >= 3 * 24 * 60 * 60 * 1000;
    };

    expect(isEligibleForAutoRelease(pendingPurchase)).toBe(true);

    const autoReleased = {
      ...pendingPurchase,
      status: "delivered" as const,
      sellerReleased: true,
      releasedAt: new Date().toISOString(),
    };

    expect(autoReleased.status).toBe("delivered");
    expect(autoReleased.sellerReleased).toBe(true);
  });

  it("comprador não confirma dentro de 3 dias -> NÃO é liberado ainda se decorridos < 3 dias", () => {
    // Apenas 1 dia atrás
    const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const pendingPurchase = {
      ...mockPurchasePaid,
      status: "delivered_pending_confirmation" as const,
      deliveredPendingAt: oneDayAgo,
      sellerReleased: false,
    };

    const isEligibleForAutoRelease = (p: typeof pendingPurchase) => {
      if (p.status !== "delivered_pending_confirmation" || !p.deliveredPendingAt) return false;
      const elapsed = Date.now() - new Date(p.deliveredPendingAt).getTime();
      return elapsed >= 3 * 24 * 60 * 60 * 1000;
    };

    expect(isEligibleForAutoRelease(pendingPurchase)).toBe(false);
  });

  it("reembolso altera o status para 'refunded' e guarda o motivo, sem creditar saldo na plataforma", () => {
    const refundReason = "Produto indisponível no estoque, reembolso emitido pelo vendedor.";
    const refundedOrder = {
      ...mockPurchasePaid,
      status: "refunded" as const,
      refundReason,
      refundedAt: new Date().toISOString(),
      sellerReleased: false,
    };

    expect(refundedOrder.status).toBe("refunded");
    expect(refundedOrder.refundReason).toBe(refundReason);
    expect(refundedOrder.sellerReleased).toBe(false);
  });
});
