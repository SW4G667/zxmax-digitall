import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath: string) => readFile(resolve(process.cwd(), relativePath), "utf8");

describe("redesign próprio de menu e autenticação", () => {
  it("mantém o menu contextual acessível e não cria destinos administrativos para visitantes", async () => {
    const shell = await source("src/components/AppShell.tsx");
    const header = await source("src/components/Header.tsx");
    const menu = await source("src/components/SideMenu.tsx");

    expect(shell).toContain("menuOpen={menuOpen}");
    expect(header).toContain('aria-controls="zxmax-main-menu"');
    expect(header).toContain("aria-expanded={menuOpen}");
    expect(menu).toContain('id="zxmax-main-menu"');
    expect(menu).toContain('aria-modal="true"');
    expect(menu).toContain('event.key === "Escape"');
    expect(menu).toContain("if (!user) return [marketplace, help]");
    expect(menu).toContain("if (isAdmin || isSupport)");
  });

  it("mantém a autenticação funcional e não exibe detalhes brutos de falha do provedor", async () => {
    const auth = await source("src/components/AuthScreen.tsx");

    expect(auth).toContain('provider: "discord"');
    expect(auth).toContain("resetPasswordForEmail");
    expect(auth).toContain("signIn(email, password)");
    expect(auth).toContain("signUp(email, password, name.trim())");
    expect(auth).toContain("Não foi possível iniciar o login com Discord agora.");
    expect(auth).not.toContain('"Erro ao iniciar login com Discord: " +');
    expect(auth).toContain("zx-auth-panel");
    expect(auth).toContain("Nome público");
  });
});
