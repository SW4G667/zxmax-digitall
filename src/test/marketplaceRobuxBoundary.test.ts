import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("fronteira do mercado de Robux", () => {
  it("mantém Robux fora da grade comum e preserva um único atalho dedicado na Home", async () => {
    const home = await readFile(join(process.cwd(), "src/pages/MarketplaceHome.tsx"), "utf8");
    const header = await readFile(join(process.cwd(), "src/components/Header.tsx"), "utf8");
    const store = await readFile(join(process.cwd(), "src/components/StoreView.tsx"), "utf8");
    const categories = await readFile(join(process.cwd(), "src/pages/Categorias.tsx"), "utf8");

    expect(home).toContain("publicProducts.filter((product) => !isRobuxCategory(product.category))");
    expect(home).toContain('robuxShortcutProduct ? `/produto/${robuxShortcutProduct.id}` : "/robux"');
    expect(home).toContain('aria-label="Abrir produto de Robux"');
    expect(header).not.toContain('navigate("/robux")');
    expect(home).toContain('["Bots Discord", "Contas", "Scripts"]');
    expect(store).toContain("approved.filter((p) => !isRobuxCategory(p.category))");
    expect(categories).toContain('isRobuxCategory(category) ? "/robux"');
    expect(categories).toContain("Mercado próprio");
  });

  it("faz /robux abrir diretamente a melhor oferta e mantém comparação dentro do produto", async () => {
    const route = await readFile(join(process.cwd(), "src/pages/Robux.tsx"), "utf8");
    const product = await readFile(join(process.cwd(), "src/pages/Produto.tsx"), "utf8");

    expect(route).toContain('navigate(`/produto/${bestOffer.id}`, { replace: true })');
    expect(route).toContain("unitPriceFromPackage(a) - unitPriceFromPackage(b)");
    expect(product).toContain("Outros vendedores ({Math.max(0, sellerOffers.length - 1)})");
    expect(product).toContain('{ id: "recomendado", label: "Recomendado" }');
    expect(product).toContain('{ id: "barato", label: "Mais baratos primeiro" }');
    expect(product).toContain('{ id: "min", label: "Menor qtd. mín." }');
    expect(product).toContain("sellerOffers.filter((offer) => offer.id !== productId).map");
  });

  it("não aplica regras de Robux a anúncios de outras categorias", async () => {
    const inventory = await readFile(join(process.cwd(), "src/components/InventoryView.tsx"), "utf8");

    expect(inventory).toContain("const isRobuxListing = isRobuxCategory(form.category)");
    expect(inventory).toContain('name: isRobuxListing ? "Robux" : form.name.trim()');
    expect(inventory).toContain('description: isRobuxListing ? "" : form.description');
    expect(inventory).toContain('const effectiveDeliveryType: "auto" | "manual" = isRobuxListing');
    expect(inventory).toContain("const effectiveStock = isRobuxListing");
    expect(inventory).toContain("const inventoryPayload = isRobuxListing");
    expect(inventory).not.toContain('name: isRobuxCategory ? "Robux"');
    expect(inventory).not.toContain("const effectiveStock = isRobuxCategory");
  });
});
