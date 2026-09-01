import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("hierarquia móvel de conta", () => {
  it("mantém no menu um resumo com dados públicos e contagem real de pedidos", async () => {
    const menu = await source("src/components/SideMenu.tsx");
    expect(menu).toContain('ID #{profile?.public_id || state.currentUser?.publicId || "—"}');
    expect(menu).toContain("{openOrders} em aberto");
    expect(menu).toContain('id="zxmax-main-menu"');
    expect(menu).toContain("Preferência visual");
    expect(menu).toContain('label: "Transações"');
    expect(menu).toContain('to: "/minhas-compras?scope=sales"');
    expect(menu).not.toContain("profile?.email");
  });

  it("apresenta no login uma hierarquia própria e direta de acesso", async () => {
    const auth = await source("src/components/AuthScreen.tsx");
    expect(auth).toContain("Área da conta");
    expect(auth).toContain("Acompanhe pedidos, anúncios e conversas em um só lugar.");
    expect(auth).toContain("Continuar com Discord");
    expect(auth).toContain("zx-auth-panel");
    expect(auth).not.toContain("Erro ao iniciar login com Discord: ");
  });
});
