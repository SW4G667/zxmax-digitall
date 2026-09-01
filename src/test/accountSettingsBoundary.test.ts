import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("configurações de conta", () => {
  it("oferece troca de senha e encerramento de sessões sem persistir a senha no perfil", async () => {
    const page = await source("src/pages/Configuracoes.tsx");
    const routes = await source("src/App.tsx");

    expect(page).toContain("supabase.auth.updateUser({ password: newPassword })");
    expect(page).toContain('await signOut("others")');
    expect(page).toContain('autoComplete="new-password"');
    expect(page).toContain("newPassword.length < 12");
    expect(page).not.toContain(".from(\"profiles\").update({ password");
    expect(routes).toContain('path="/configuracoes"');
  });

  it("explica limites de códigos por e-mail e aponta apenas áreas reais autorizadas", async () => {
    const page = await source("src/pages/Configuracoes.tsx");
    const menu = await source("src/components/SideMenu.tsx");
    const profile = await source("src/pages/Perfil.tsx");

    expect(page).toContain("não substituem um segundo fator independente");
    expect(page).toContain('to="/perfil"');
    expect(page).toContain('to="/minhas-compras"');
    expect(page).toContain('to="/sacar"');
    expect(menu).toContain('to: "/configuracoes"');
    expect(profile).toContain("Anúncios no ar");
    expect(profile).toContain("Vendas recebidas");
    expect(profile).toContain("Avaliações");
    expect(profile).toContain("state.products.filter((product) => product.sellerId === user.id)");
  });
});
