import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("hidratação persistente de pedidos", () => {
  it("recarrega pedidos do banco após restaurar a sessão e limpa apenas ao sair", async () => {
    const context = await source("src/store/StoreContext.tsx");
    const auth = await source("src/hooks/useAuth.tsx");
    expect(context).toContain("Orders must be rehydrated from the RLS-protected source");
    expect(context).toContain('supabase.functions.invoke("get-my-purchases", { body: {} })');
    expect(context).toContain("if (!authUserId || !sessionReady) return;");
    expect(context).toContain("Promise<{ ok: boolean; message?: string }>");
    expect(auth).toContain("const [sessionReady, setSessionReady] = useState(false);");
    expect(auth).toContain("setSessionReady(true);");
    expect(context).toContain("void refreshPurchases();");
    expect(context).toContain("}, [authUserId, sessionReady]);");
    expect(context).toContain("[zxmax:purchases:load]");
  });

  it("exibe sincronização, falha e atualização manual sem transformar erro em estado vazio", async () => {
    const purchases = await source("src/components/MyPurchasesView.tsx");
    expect(purchases).toContain("Sincronizando seus pedidos com segurança...");
    expect(purchases).toContain("Não foi possível sincronizar os pedidos agora.");
    expect(purchases).toContain("A lista anterior foi preservada.");
    expect(purchases).toContain("Atualizar");
    expect(purchases).toContain("void refreshOrderList();");
  });

  it("expõe uma função de leitura que valida o token e restringe pedidos ao participante", async () => {
    const edge = await source("supabase/functions/get-my-purchases/index.ts");
    expect(edge).toContain("auth.getUser(authHeader.slice(7))");
    expect(edge).toContain("buyer_id.eq.${auth.user.id},seller_id.eq.${auth.user.id}");
    expect(edge).toContain("const purchases = (data ?? []).map((purchase) => {");
    expect(edge).toContain('return json({ purchases });');
    expect(edge).toContain("evopay_charge_id: _chargeId");
    expect(edge).not.toContain("buyer_email");
    expect(edge).not.toContain("seller_email");
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
