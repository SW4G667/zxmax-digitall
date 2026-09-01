import { describe, expect, it } from "vitest";
import { checkoutMethods, classifyPaymentMethods, paymentMethodsNotice } from "@/lib/paymentMethods";
import type { EdgeCallResult } from "@/lib/edgeErrors";

/**
 * Sintoma de produção: Pix/Crypto/Cartão/Boleto todos "Indisponíveis" com a
 * mensagem "Nenhuma forma de pagamento está configurada no momento" MESMO com
 * credenciais cadastradas. Causa: qualquer falha (função antiga publicada, erro
 * de leitura, rede) era convertida em `{ all false }`. Aqui cada causa precisa
 * virar um estado distinto e honesto.
 */
const ok = (methods: Record<string, boolean>, fees: Record<string, number> = {}): EdgeCallResult<{ methods?: unknown; fees?: unknown }> => ({
  data: { methods, fees },
  errorMessage: null,
  code: null,
  status: 200,
});

const failed = (status: number, code: string | null = null): EdgeCallResult<{ methods?: unknown }> => ({
  data: null,
  errorMessage: "alguma falha",
  code,
  status,
});

describe("classifyPaymentMethods", () => {
  it("HTTP 200 com métodos válidos devolve as opções PIX nomeadas e suas taxas", () => {
    const state = classifyPaymentMethods(ok({ zennith_pix: true, vexopay_pix: false, crypto: false, card: false, boleto: false }, { zennith_pix: 0.9 }));
    expect(state.status).toBe("ok");
    if (state.status !== "ok") throw new Error("Estado inesperado");
    expect(state.methods).toEqual({ zennith_pix: true, vexopay_pix: false, crypto: false, card: false, boleto: false });
    expect(state.fees.zennith_pix).toBe(0.9);
  });

  it("403 não oferece métodos sem uma resposta validada da função", () => {
    const state = classifyPaymentMethods(failed(403));
    expect(state.status).toBe("unavailable");
    expect(paymentMethodsNotice(state)?.retryable).toBe(true);
    expect(checkoutMethods(state)).toBeNull();
  });

  it("200 sem methods não ativa gateway por compatibilidade", () => {
    const state = classifyPaymentMethods({
      data: { integrations: {} } as unknown as { methods?: unknown },
      errorMessage: null,
      code: null,
      status: 200,
    });
    expect(state.status).toBe("unavailable");
  });

  it("503/`payment_settings_unavailable` avisa sem oferecer gateway incerto", () => {
    const state = classifyPaymentMethods(failed(503, "payment_settings_unavailable"));
    expect(state.status).toBe("network");
    expect(paymentMethodsNotice(state)?.retryable).toBe(true);
    expect(checkoutMethods(state)).toBeNull();
  });

  it("401 vira sessão expirada", () => {
    expect(classifyPaymentMethods(failed(401)).status).toBe("session");
  });

  it("falha de rede vira estado de rede com retry", () => {
    const state = classifyPaymentMethods({ data: null, errorMessage: "Failed to fetch", code: null, status: null });
    expect(state.status).toBe("network");
    expect(paymentMethodsNotice(state)?.retryable).toBe(true);
  });

  it("métodos todos false (de verdade) continua distinguível de falha", () => {
    const state = classifyPaymentMethods(ok({ zennith_pix: false, vexopay_pix: false, crypto: false, card: false, boleto: false }));
    expect(state.status).toBe("ok");
    expect(paymentMethodsNotice(state)).toBeNull();
  });

  it("payload inválido não quebra: methods não-booleano é tratado", () => {
    const state = classifyPaymentMethods({
      data: { methods: { pix: "sim" } },
      errorMessage: null,
      code: null,
      status: 200,
    });
    expect(state.status).toBe("unavailable");
  });
});
