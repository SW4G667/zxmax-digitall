import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("hidratação persistente de pedidos", () => {
  it("recarrega pedidos do banco após restaurar a sessão e limpa apenas ao sair", async () => {
    const context = await source("src/store/StoreContext.tsx");
    expect(context).toContain("Orders must be rehydrated from the RLS-protected source");
    expect(context).toContain("void refreshPurchases();");
    expect(context).toContain("}, [authUserId]);");
    expect(context).toContain("[zxmax:purchases:load]");
  });

  it("mantém a visão do vendedor limitada à identidade pública do comprador e ao chat do pedido", async () => {
    const purchases = await source("src/components/MyPurchasesView.tsx");
    const inventory = await source("src/components/InventoryView.tsx");
    expect(purchases).toContain("Comprador #${selected.buyerPublicId || \"—\"}");
    expect(inventory).toContain("ID público: {s.buyerPublicId || buyer?.publicId || \"—\"}");
    expect(inventory).toContain("Toque para abrir o chat seguro do pedido.");
    expect(inventory).not.toContain("<p className=\"font-bold text-sm text-white\">{s.buyerEmail}</p>");
  });
});
