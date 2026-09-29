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
    expect(home).toContain('onClick={() => navigate("/robux")}');
    expect(home).toContain('aria-label="Abrir mercado de Robux"');
    expect(header).not.toContain('navigate("/robux")');
    expect(home).toContain('["Bots Discord", "Contas", "Scripts"]');
    expect(store).toContain("approved.filter((p) => !isRobuxCategory(p.category))");
    expect(categories).toContain('isRobuxCategory(category) ? "/robux"');
    expect(categories).toContain("Mercado próprio");
  });

  it("mantém a ordenação de ofertas explícita e selecionável", async () => {
    const page = await readFile(join(process.cwd(), "src/pages/Robux.tsx"), "utf8");

    expect(page).toContain('type SortKey = "barato" | "min" | "recomendado"');
    expect(page).toContain('{ id: "barato", label: "Mais barato" }');
    expect(page).toContain('{ id: "min", label: "Menor mínimo" }');
    expect(page).toContain('role="group" aria-label="Ordenar ofertas"');
    expect(page).toContain("onClick={() => setSort(option.id)}");
    expect(page).toContain('if (sort === "min")');
    expect(page).toContain('if (sort === "recomendado")');
    expect(page).toContain("left.pricePerUnit - right.pricePerUnit");
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
