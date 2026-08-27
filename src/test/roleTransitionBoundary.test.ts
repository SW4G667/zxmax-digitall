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
    const view = await source("src/components/AdminView.tsx");
    expect(view).toContain('value="admin"');
    expect(view).toContain('value="support"');
    expect(view).toContain('value="user"');
    expect(view).not.toMatch(/value="(?:moderator|finance)"/);
  });
});
