import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFile(join(process.cwd(), path), "utf8");

describe("transição segura de cargos", () => {
  it("substitui os privilégios anteriores e registra a transição", async () => {
    const sql = await source("supabase/migrations/20260827005500_harden_assign_user_role_transition.sql");
    expect(sql).toContain("DELETE FROM public.user_roles WHERE user_id = target_user_id;");
    expect(sql).toContain("'role.transitioned'");
    expect(sql).toContain("'previous_roles'");
    expect(sql).toContain("Você não pode remover seu próprio cargo administrativo pelo painel");
  });

  it("não apresenta cargos sem capacidade de servidor no painel", async () => {
    const panel = await source("src/components/AdminRolePermissionsPanel.tsx");
    expect(panel).toContain('value="admin"');
    expect(panel).toContain('value="support"');
    expect(panel).toContain('value="user"');
    expect(panel).not.toMatch(/value="(?:moderator|finance)"/);
    expect(panel).toContain('rpc("assign_user_role_by_public_id"');
  });
});
