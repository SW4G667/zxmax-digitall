import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("fronteira do mercado de Robux", () => {
  it("mantém Robux em uma experiência dedicada sem misturar na grade comum", async () => {
    const home = await readFile(join(process.cwd(), "src/pages/MarketplaceHome.tsx"), "utf8");
    const store = await readFile(join(process.cwd(), "src/components/StoreView.tsx"), "utf8");
    const categories = await readFile(join(process.cwd(), "src/pages/Categorias.tsx"), "utf8");

    expect(home).toContain("const robux = useMemo");
    expect(home).toContain('navigate("/robux")');
    expect(home).toContain('["Bots Discord", "Contas", "Scripts"]');
    expect(store).toContain("approved.filter((p) => p.category !== ROBUX_CATEGORY)");
    expect(categories).toContain('category === ROBUX_CATEGORY ? "/robux"');
    expect(categories).toContain("Mercado próprio");
  });
});
