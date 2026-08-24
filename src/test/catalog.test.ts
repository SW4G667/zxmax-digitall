import { describe, expect, it } from "vitest";
import {
  formatBRL,
  isValidProductPrice,
  MIN_PRODUCT_PRICE,
  mergeCatalog,
  normalizeProductPrice,
  parsePriceInput,
  robuxPackageUnits,
  ROBUX_CATEGORY,
  sanitizePrice,
  storefrontProducts,
  unitPriceFromPackage,
} from "@/lib/catalog";

// ---------------------------------------------------------------------------
// Fase 2 — parsing e integridade de preço
// ---------------------------------------------------------------------------
describe("parsePriceInput", () => {
  it("aceita 2,00 (pt-BR) e 2.00 (ponto)", () => {
    expect(parsePriceInput("2,00")).toBe(2);
    expect(parsePriceInput("2.00")).toBe(2);
  });

  it("aceita R$ 2,00 com símbolo e espaços", () => {
    expect(parsePriceInput("R$ 2,00")).toBe(2);
    expect(parsePriceInput("  R$2,00 ")).toBe(2);
  });

  it("respeita o separador de milhar brasileiro", () => {
    expect(parsePriceInput("1.234,56")).toBe(1234.56);
  });

  it("rejeita NaN, infinito, negativo e strings maliciosas", () => {
    expect(parsePriceInput(Number.NaN)).toBe(0);
    expect(parsePriceInput(Number.POSITIVE_INFINITY)).toBe(0);
    expect(parsePriceInput(-10)).toBe(0);
    expect(parsePriceInput("-5,00")).toBe(0);
    expect(parsePriceInput("<script>alert(1)</script>")).toBe(0);
    expect(parsePriceInput("1e309")).toBe(0);
  });

  it("arredonda para centavos, sem precisão indevida", () => {
    expect(parsePriceInput("2,005")).toBe(2.01);
    expect(sanitizePrice(0.1 + 0.2)).toBe(0.3);
  });
});

describe("isValidProductPrice", () => {
  it("bloqueia qualquer valor abaixo de R$ 2,00", () => {
    expect(isValidProductPrice(parsePriceInput("1,99"))).toBe(false);
    expect(isValidProductPrice(parsePriceInput("0,002"))).toBe(false);
    expect(isValidProductPrice(parsePriceInput("2,00"))).toBe(true);
    expect(isValidProductPrice(MIN_PRODUCT_PRICE)).toBe(true);
  });

  it("bloqueia valores absurdos", () => {
    expect(isValidProductPrice(10_000_000)).toBe(false);
  });
});

describe("formatBRL", () => {
  it("nunca imprime R$ 2,00000", () => {
    expect(formatBRL(2)).toBe("R$ 2,00");
    expect(formatBRL(1234.5)).toBe("R$ 1234,50");
    expect(formatBRL(Number.NaN)).toBe("R$ 0,00");
  });
});

// ---------------------------------------------------------------------------
// Fase 2 — pacote de Robux nunca vira preço por unidade
// ---------------------------------------------------------------------------
describe("preço de pacote Robux", () => {
  const pacote = { price: 2, category: ROBUX_CATEGORY, variations: [{ name: "1000 Robux", price: 2 }] };

  it("lê a quantidade do pacote a partir da variação", () => {
    expect(robuxPackageUnits(pacote)).toBe(1000);
    expect(robuxPackageUnits({ category: "Contas", variations: [{ name: "1000", price: 2 }] })).toBe(1);
    expect(robuxPackageUnits({ category: ROBUX_CATEGORY, variations: [] })).toBe(1);
  });

  it("deriva o preço por unidade sem alterar o preço anunciado", () => {
    expect(unitPriceFromPackage(pacote)).toBeCloseTo(0.002, 6);
    expect(pacote.price).toBe(2); // o valor gravado continua sendo o do pacote
  });

  it("normaliza listagem legada gravada por unidade usando a própria variação", () => {
    expect(normalizeProductPrice({ price: 0.002, category: ROBUX_CATEGORY, variations: [{ price: 2 }] })).toBe(2);
  });

  it("não inventa preço quando não existe variação válida", () => {
    expect(normalizeProductPrice({ price: 0.002, category: ROBUX_CATEGORY, variations: [] })).toBe(0.002);
    expect(normalizeProductPrice({ price: 0.002, category: ROBUX_CATEGORY, variations: [{ price: 0.5 }] })).toBe(0.002);
    expect(normalizeProductPrice({ price: 0.002, category: "Contas", variations: [{ price: 9 }] })).toBe(0.002);
  });

  it("mantém preços normais intactos", () => {
    expect(normalizeProductPrice({ price: 19.9, category: "Contas" })).toBe(19.9);
  });
});

// ---------------------------------------------------------------------------
// Fase 1 — produtos não podem sumir nem "ressuscitar"
// ---------------------------------------------------------------------------
describe("mergeCatalog", () => {
  const previous = [{ id: 7, approved: true, sellerId: "seller" }];

  it("não apaga a loja quando a requisição falha e volta vazia", () => {
    expect(mergeCatalog([], previous, { failed: true })).toEqual(previous);
  });

  it("mescla o que conseguiu carregar numa falha parcial", () => {
    const parcial = [{ id: 9, approved: true, sellerId: "outro" }];
    expect(mergeCatalog(parcial, previous, { failed: true }).map((p) => p.id).sort()).toEqual([7, 9]);
  });

  it("uma leitura bem-sucedida é autoritativa: produto excluído não volta", () => {
    expect(mergeCatalog([], previous, { failed: false })).toEqual([]);
  });

  it("não preserva linhas otimistas do cliente (sem produtos-fantasma)", () => {
    const otimista = [{ id: 1_700_000_000_001, approved: false, sellerId: "eu" }];
    const servidor = [{ id: 9, approved: true, sellerId: "eu" }];
    expect(mergeCatalog(servidor, otimista)).toEqual(servidor);
  });
});

// ---------------------------------------------------------------------------
// Fase 1 — matriz de visibilidade
// ---------------------------------------------------------------------------
describe("matriz de visibilidade da loja", () => {
  const aprovado = { id: 1, approved: true, sellerId: "outro" };
  const pendenteProprio = { id: 2, approved: false, sellerId: "eu" };
  const pendenteDeOutro = { id: 3, approved: false, sellerId: "outro" };
  const catalogo = [aprovado, pendenteProprio, pendenteDeOutro];

  it("visitante não logado: vê apenas aprovados", () => {
    expect(storefrontProducts(catalogo, null).map((p) => p.id)).toEqual([1]);
    expect(storefrontProducts(catalogo, undefined).map((p) => p.id)).toEqual([1]);
  });

  it("usuário comum: vê aprovados e o próprio pendente, nunca o pendente alheio", () => {
    const visiveis = storefrontProducts(catalogo, "eu").map((p) => p.id);
    expect(visiveis).toEqual([1, 2]);
    expect(visiveis).not.toContain(3);
  });

  it("administrador: vê tudo", () => {
    expect(storefrontProducts(catalogo, "admin", true).map((p) => p.id)).toEqual([1, 2, 3]);
  });
});
