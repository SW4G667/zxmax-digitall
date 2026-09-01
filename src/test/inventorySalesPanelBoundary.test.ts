import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = () => readFile(resolve(process.cwd(), "src/components/InventoryView.tsx"), "utf8");

describe("painel de vendas nos anúncios", () => {
  it("lista vendas reais com identidade pública e atalho ao chat, sem contato da contraparte", async () => {
    const inventory = await source();
    expect(inventory).toContain("const recentSales = [...mySales]");
    expect(inventory).toContain("Vendas recentes");
    expect(inventory).toContain("Comprador: {buyer?.name || \"Usuário\"} · ID público");
    expect(inventory).toContain("onClick={() => onOpenChat?.(sale.id)}");
    expect(inventory).toContain("Abrir chat");
    expect(inventory).not.toContain("buyerEmail");
  });
});
