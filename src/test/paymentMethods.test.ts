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
const ok = (methods: Record<string, boolean>): EdgeCallResult<{ methods?: unknown }> => ({
  data: { methods },
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
  it("HTTP 200 com methods válidos devolve os métodos reais", () => {
    const state = classifyPaymentMethods(ok({ pix: true, crypto: false, card: true, boleto: false }));
    expect(state).toEqual({
      status: "ok",
      methods: { pix: true, crypto: false, card: true, boleto: false },
    });
  });

  it("403 (função antiga: gate de admin) vira 'outdated' e o checkout oferece PIX+Crypto", () => {
    const state = classifyPaymentMethods(failed(403));
    expect(state.status).toBe("outdated");
    expect(paymentMethodsNotice(state)).toBeNull();
    expect(checkoutMethods(state)).toEqual({ pix: true, crypto: true, card: false, boleto: false });
  });

  it("200 sem methods (formato antigo) vira 'outdated'", () => {
    const state = classifyPaymentMethods({
      data: { integrations: {} } as unknown as { methods?: unknown },
      errorMessage: null,
      code: null,
      status: 200,
    });
    expect(state.status).toBe("outdated");
  });

  it("503/`payment_settings_unavailable` avisa, mas o checkout ainda oferece PIX+Crypto", () => {
    const state = classifyPaymentMethods(failed(503, "payment_settings_unavailable"));
    expect(state.status).toBe("settingsFailed");
    expect(paymentMethodsNotice(state)?.retryable).toBe(true);
    expect(checkoutMethods(state)?.pix).toBe(true);
    expect(checkoutMethods(state)?.crypto).toBe(true);
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
    const state = classifyPaymentMethods(ok({ pix: false, crypto: false, card: false, boleto: false }));
    expect(state.status).toBe("ok");
    expect(paymentMethodsNotice(state)?.message).toMatch(/Nenhuma forma de pagamento está ativa/i);
  });

  it("payload inválido não quebra: methods não-booleano é tratado", () => {
    const state = classifyPaymentMethods({
      data: { methods: { pix: "sim" } },
      errorMessage: null,
      code: null,
      status: 200,
    });
    expect(state.status).toBe("outdated");
  });
});
