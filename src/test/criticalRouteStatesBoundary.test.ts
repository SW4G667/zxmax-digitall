import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("estados críticos de rota", () => {
  it("mantém produto lento, ausente e falho em estados recuperáveis", async () => {
    const product = await readFile(join(process.cwd(), "src/pages/Produto.tsx"), "utf8");

    expect(product).toContain('catalogStatus === "loading"');
    expect(product).toContain("Carregando produto…");
    expect(product).toContain('catalogStatus === "error" ? "Não conseguimos carregar este produto agora." : "Produto não encontrado"');
    expect(product).toContain("Tentar novamente");
    expect(product).toContain("void refreshProducts()");
  });

  it("mantém sessão, bloqueio administrativo e manutenção no caminho protegido", async () => {
    const index = await readFile(join(process.cwd(), "src/pages/Index.tsx"), "utf8");
    const app = await readFile(join(process.cwd(), "src/App.tsx"), "utf8");

    expect(index).toContain('if (loading)');
    expect(index).toContain('LoadingScreen message="Carregando..."');
    expect(index).toContain('if (user && banned) return <BannedScreen />');
    expect(index).toContain('requiresAuth && !user');
    expect(index).toContain('view === "admin" && user && adminRoleResolved && !isOperator');
    expect(index).toContain('recordSecurityEvent(supabase, "admin.access", "blocked")');
    expect(app).toContain("<MaintenanceGate>");
  });
});
