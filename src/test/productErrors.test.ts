import { describe, expect, it } from "vitest";
import { classifyProductError, GENERIC_PRODUCT_ERROR, productErrorMessage } from "@/lib/productErrors";

/**
 * Fase 1.2 — o usuário nunca pode receber só "Tente novamente", e nunca pode
 * receber SQL, nome de coluna, token ou stack trace.
 */
describe("classifyProductError", () => {
  const cases: [string, Parameters<typeof classifyProductError>[0], string][] = [
    ["sessão expirada", { status: 401, message: "JWT expired" }, "session"],
    ["permissão insuficiente (RLS)", { code: "42501", message: 'new row violates row-level security policy for table "products"' }, "forbidden"],
    ["vendedor não verificado", { code: "42501", message: "permission denied: conta sem verificacao de vendedor" }, "notVerified"],
    ["tentativa de auto-aprovação", { code: "42501", message: "Apenas administradores podem aprovar anúncios" }, "forbidden"],
    ["preço abaixo do mínimo (trigger)", { code: "23514", message: "O preço mínimo de um anúncio é R$ 2,00" }, "price"],
    ["preço inválido (cast)", { code: "22P02", message: 'invalid input syntax for type numeric: "abc"' }, "price"],
    ["overflow numérico", { code: "22003", message: "numeric field overflow" }, "price"],
    ["campo obrigatório ausente", { code: "23502", message: 'null value in column "name" violates not-null constraint' }, "required"],
    ["duplicado", { code: "23505", message: "duplicate key value" }, "duplicate"],
    ["coluna inexistente (migration não aplicada)", { code: "42703", message: 'column products.stock does not exist' }, "schema"],
    ["cache de schema do PostgREST", { code: "PGRST204", message: "Could not find the 'delivery_time' column" }, "schema"],
    ["falha de rede", { message: "TypeError: Failed to fetch" }, "network"],
    ["banco indisponível", { status: 503, message: "service unavailable" }, "unavailable"],
    ["rate limit", { status: 429, message: "Too Many Requests" }, "rateLimit"],
    ["erro desconhecido", { message: "boom" }, "unknown"],
  ];

  it.each(cases)("classifica %s", (_label, error, expected) => {
    expect(classifyProductError(error)).toBe(expected);
  });

  it("trata ausência de erro", () => {
    expect(classifyProductError(null)).toBe("unknown");
    expect(classifyProductError(undefined)).toBe("unknown");
  });
});

describe("productErrorMessage", () => {
  it("dá uma instrução específica para cada falha conhecida", () => {
    expect(productErrorMessage({ status: 401, message: "JWT expired" })).toMatch(/sessão expirou/i);
    expect(productErrorMessage({ code: "23514", message: "preço mínimo" })).toMatch(/R\$ 2,00/);
    expect(productErrorMessage({ code: "23502", message: "not-null" })).toMatch(/obrigatórios/i);
    expect(productErrorMessage({ message: "Failed to fetch" })).toMatch(/conexão/i);
    expect(productErrorMessage({ code: "42501", message: "row-level security" })).toMatch(/permissão/i);
  });

  it("cai numa mensagem genérica somente para o desconhecido", () => {
    expect(productErrorMessage({ message: "boom" })).toBe(GENERIC_PRODUCT_ERROR);
  });

  it("nunca vaza detalhe técnico, SQL, coluna ou token", () => {
    const leaky = {
      code: "42501",
      message: 'new row violates row-level security policy for table "products"',
      details: "INSERT INTO public.products (seller_id) VALUES ('...')",
      hint: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret",
    };
    const shown = productErrorMessage(leaky);
    for (const forbidden of ["row-level", "INSERT", "products", "Bearer", "eyJ", "seller_id", "42501"]) {
      expect(shown).not.toContain(forbidden);
    }
  });
});
