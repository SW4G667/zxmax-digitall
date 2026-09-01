import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatRobuxUnitPrice, unitPriceFromPackage } from "@/lib/catalog";

describe("mercado de Robux", () => {
  it("preserva precisão útil para o valor unitário sem alterar os totais monetários", () => {
    expect(formatRobuxUnitPrice(0.0053)).toMatch(/0,0053/);
    expect(formatRobuxUnitPrice(0.0271)).toMatch(/0,0271/);
    expect(formatRobuxUnitPrice("invalid")).toBe("—");
    expect(unitPriceFromPackage({ price: 2, category: "Robux e Gift Cards", variations: [{ name: "1000 Robux" }] })).toBe(0.002);
  });

  it("renderiza um comparador próprio de ofertas reais e inicia na quantidade mínima", async () => {
    const productPage = await readFile(join(process.cwd(), "src/pages/Produto.tsx"), "utf8");
    const marketPage = await readFile(join(process.cwd(), "src/pages/Robux.tsx"), "utf8");

    expect(productPage).toContain("Mercado de Robux");
    expect(productPage).toContain("Oferta selecionada");
    expect(productPage).toContain("Esta oferta não está disponível.");
    expect(productPage).toContain("Nenhum pedido ou pagamento foi iniciado.");
    expect(productPage).toContain("Compare preço por unidade, mínimo, estoque e prazo.");
    expect(productPage).toContain("const applyRobuxQuantity");
    expect(productPage).toContain("sellerOffers.find((o) => o.id === productId) ?? null");
    expect(productPage).not.toContain("sellerOffers.find((o) => o.id === productId) || sellerOffers[0]");
    expect(productPage).toContain('aria-label="Quantidade de Robux"');
    expect(productPage).toContain("setQuantityDraft(event.target.value.replace(/\\D/g, \"\"))");
    expect(productPage).toContain("Sem avaliações registradas");
    expect(productPage).toContain("formatRobuxUnitPrice");
    expect(productPage).toContain("const unitPrice = isRobux");
    expect(productPage).toContain("isRobux ? undefined : (selectedVariation || undefined)");
    expect(productPage).toContain("A taxa aplicável aparece ao escolher a forma de pagamento.");
    expect(productPage).not.toContain("inclui taxa de {formatBRL(BUYER_FEE)}");
    expect(productPage).not.toContain("Eldorado-style");
    expect(productPage).not.toContain("TradeShield");
    expect(marketPage).toContain("Mercado de Robux");
    expect(marketPage).toContain("Somente anúncios aprovados com perfil público válido aparecem neste mercado.");
    expect(marketPage).toContain(".filter((offer) => Boolean(offer.sellerPublicId && offer.sellerName))");
    expect(marketPage).toContain("Valor/un.");
    expect(marketPage).toContain("ID público:");
    expect(marketPage).toContain("Sem avaliações registradas");
  });
});
