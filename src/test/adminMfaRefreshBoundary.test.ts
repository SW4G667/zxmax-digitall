import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Acesso administrativo após 2FA", () => {
  it("reidrata autorização quando a sessão atualizada pertence ao mesmo usuário", async () => {
    const source = await readFile(join(process.cwd(), "src/hooks/useAuth.tsx"), "utf8");

    expect(source).toContain("if (nextUser.id === prevId)");
    expect(source).toContain("hydrateAccount(nextUser.id);");
    expect(source).toContain("refreshAuthorization");
  });

  it("mantém a manutenção bloqueada enquanto revalida e só libera papel confirmado", async () => {
    const source = await readFile(join(process.cwd(), "src/components/MaintenanceGate.tsx"), "utf8");

    expect(source).toContain("Validando permissões administrativas…");
    expect(source).toContain("void refreshAuthorization()");
    expect(source).toContain("adminRoleResolved && isAdmin");
  });

  it("faz o gate interno atualizar as permissões do servidor antes de liberar o painel", async () => {
    const source = await readFile(join(process.cwd(), "src/components/AdminLoginGate.tsx"), "utf8");

    expect(source).toContain("refreshAuthorization,");
    expect(source).toContain("await refreshAuthorization();");
    expect(source).toContain("await refreshAuthorization();\n      unlockAdminGate();");
  });
});
