import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("fronteira do mercado de Robux", () => {
  it("mantém Robux fora da home e da grade comum", async () => {
    const home = await readFile(join(process.cwd(), "src/pages/MarketplaceHome.tsx"), "utf8");
    const store = await readFile(join(process.cwd(), "src/components/StoreView.tsx"), "utf8");
    const categories = await readFile(join(process.cwd(), "src/pages/Categorias.tsx"), "utf8");

    expect(home).toContain("const generalProducts");
    expect(home).toContain("product.category !== ROBUX_CATEGORY");
    expect(home).toContain("filter((category) => category !== ROBUX_CATEGORY)");
    expect(store).toContain("approved.filter((p) => p.category !== ROBUX_CATEGORY)");
    expect(categories).toContain('navigate("/robux")');
    expect(categories).toContain("página exclusiva");
  });
});
