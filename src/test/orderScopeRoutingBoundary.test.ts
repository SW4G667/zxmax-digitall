import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("atalho de pedidos do vendedor", () => {
  it("preserva o guard de rota e abre o recorte de vendas pela URL", async () => {
    const menu = await source("src/components/SideMenu.tsx");
    const index = await source("src/pages/Index.tsx");
    const purchases = await source("src/components/MyPurchasesView.tsx");

    expect(menu).toContain('to: "/minhas-compras?scope=sales"');
    expect(index).toContain('get("scope")');
    expect(index).toContain('initialScope={initialPurchaseScope}');
    expect(index).toContain('view === "purchases" && user && <MyPurchasesView');
    expect(purchases).toContain('initialScope?: "all" | "purchases" | "sales"');
  });
});
