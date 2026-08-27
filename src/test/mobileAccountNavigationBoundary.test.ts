import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("hierarquia móvel de conta", () => {
  it("mantém no menu um resumo com dados públicos e contagem real de pedidos", async () => {
    const menu = await source("src/components/SideMenu.tsx");
    expect(menu).toContain('ID #{profile?.public_id || state.currentUser?.publicId || "—"}');
    expect(menu).toContain("pedido{openOrders === 1 ? \"\" : \"s\"} em aberto");
    expect(menu).not.toContain("profile?.email");
  });

  it("apresenta no login apenas orientações próprias de segurança e uso interno", async () => {
    const auth = await source("src/components/AuthScreen.tsx");
    expect(auth).toContain("Acesso seguro");
    expect(auth).toContain("Tudo no site");
    expect(auth).toContain("Compras e conversas ficam dentro da ZXMAX.");
  });
});
