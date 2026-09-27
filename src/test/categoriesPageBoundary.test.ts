import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = async (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("página de categorias", () => {
  it("usa categorias e anúncios reais do estado, sem catálogo fabricado", async () => {
    const page = await source("src/pages/Categorias.tsx");
    expect(page).toContain("state.config.categories");
    expect(page).toContain("storefrontProducts(state.products, state.currentUser?.id)");
    expect(page).toContain("approved.filter((product) => product.category === category)");
    expect(page).toContain('"/loja?cat=" + encodeURIComponent(category)');
    expect(page).toContain('category === ROBUX_CATEGORY ? "/robux"');
  });

  it("mantém descoberta no menu sem duplicar todos os filtros do catálogo", async () => {
    const app = await source("src/App.tsx");
    const menu = await source("src/components/SideMenu.tsx");
    const store = await source("src/components/StoreView.tsx");
    expect(app).toContain('<Route path="/categorias" element={<Categorias />} />');
    expect(menu).toContain('to: "/categorias"');
    expect(menu).toContain('to: "/loja"');
    expect(menu).toContain('to: "/robux"');
    expect(menu).not.toContain('label: "Novidades"');
    expect(menu).not.toContain('label: "Mais vendidos"');
    expect(menu).not.toContain('label: "Entrega automática"');
    expect(store).toContain('const sortParam = params.get("sort") as SortKey | null;');
    expect(store).toContain('const deliveryParam = params.get("delivery");');
    expect(store).toContain('const verifiedParam = params.get("verified");');
  });
});
