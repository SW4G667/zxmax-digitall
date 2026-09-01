import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = async (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("superfícies protegidas e minimizadas de contato", () => {
  it("monta os painéis administrativos somente após sessão, papel e gate administrativo", async () => {
    const index = await source("src/pages/Index.tsx");
    const admin = await source("src/components/AdminView.tsx");
    const extra = await source("src/components/AdminExtraPanels.tsx");

    expect(index).toContain("const isOperator = isAdmin || isSupport;");
    expect(index).toContain('view === "admin" && user && isOperator && (adminGateUnlocked ? <AdminView /> : <AdminLoginGate />)');
    expect(admin).toContain('useAuth()');
    expect(admin).toContain('action: "get_webhook_logs"');
    expect(extra).not.toContain("p.buyerEmail");
    expect(extra).not.toContain("p.sellerEmail");
    expect(extra).toContain("p.buyerPublicId");
    expect(extra).toContain("p.sellerPublicId");
  });

  it("mantém os dados de pedido em rota autenticada e não pesquisa contato de contraparte", async () => {
    const index = await source("src/pages/Index.tsx");
    const purchases = await source("src/components/MyPurchasesView.tsx");
    const inventory = await source("src/components/InventoryView.tsx");

    expect(index).toContain('view === "purchases" && user && <MyPurchasesView');
    expect(purchases).toContain("p.buyerId === state.currentUser?.id || p.sellerId === state.currentUser?.id");
    expect(purchases).toContain("String(p.buyerPublicId || \"\")");
    expect(purchases).toContain("String(p.sellerPublicId || \"\")");
    expect(purchases).not.toContain("state.currentUser?.isAdmin ? [p.buyerEmail || \"\", p.sellerEmail || \"\"] : []");
    expect(inventory).toContain("p.sellerId === state.currentUser?.id");
  });
});
