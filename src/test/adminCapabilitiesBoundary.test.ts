import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("permissões administrativas por capacidade", () => {
  it("mantém uma allow-list auditável, com RLS e sem delegar poderes críticos", async () => {
    const migration = await readFile(join(process.cwd(), "supabase/migrations/20260827023000_add_audited_admin_capabilities.sql"), "utf8");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.user_capabilities");
    expect(migration).toContain("ALTER TABLE public.user_capabilities ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.user_capabilities FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("'moderate_catalog'");
    expect(migration).toContain("'review_identity'");
    expect(migration).toContain("'manage_user_safety'");
    expect(migration).toContain("'manage_tags'");
    expect(migration).toContain("'view_sanitized_webhooks'");
    expect(migration).not.toContain("manage_payments");
    expect(migration).not.toContain("manage_secrets");
    expect(migration).not.toContain("manage_maintenance");
    expect(migration).toContain("'capabilities.replaced'");
  });

  it("exige AAL2 e capacidade no servidor para as ações delegáveis", async () => {
    const guards = await readFile(join(process.cwd(), "supabase/migrations/20260827024500_enforce_delegated_capabilities.sql"), "utf8");
    const edge = await readFile(join(process.cwd(), "supabase/functions/admin-verify/index.ts"), "utf8");

    expect(guards).toContain("auth.jwt() ->> 'aal'");
    expect(guards).toContain("PERFORM public.require_admin_capability('manage_tags')");
    expect(guards).toContain("PERFORM public.require_admin_capability('moderate_catalog')");
    expect(guards).toContain("CREATE OR REPLACE FUNCTION public.require_primary_admin()");
    expect(edge).toContain('authorizationClient.rpc("has_capability"');
    expect(edge).toContain('get_webhook_logs: "view_sanitized_webhooks"');
  });

  it("configura papel e capacidades pelo ID público, sem transportar e-mail no painel", async () => {
    const panel = await readFile(join(process.cwd(), "src/components/AdminRolePermissionsPanel.tsx"), "utf8");
    const view = await readFile(join(process.cwd(), "src/components/AdminView.tsx"), "utf8");
    const migration = await readFile(join(process.cwd(), "supabase/migrations/20260827030000_assign_roles_by_public_id.sql"), "utf8");

    expect(panel).toContain('rpc("assign_user_role_by_public_id"');
    expect(panel).toContain('rpc("update_user_capabilities"');
    expect(panel).not.toContain("role-email");
    expect(panel).not.toContain("E-mail do usuário");
    expect(view).toContain("<AdminRolePermissionsPanel />");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.assign_user_role_by_public_id");
    expect(migration).toContain("PERFORM public.require_primary_admin()");
  });

  it("exige sessão administrativa AAL2 também para enumerar operadores", async () => {
    const directoryGuard = await readFile(join(process.cwd(), "supabase/migrations/20260827031500_require_aal2_for_capability_directory.sql"), "utf8");
    expect(directoryGuard).toContain("PERFORM public.require_primary_admin()");
  });

  it("orienta o operador quando clicar em uma ação sem capacidade, sem tentar executá-la", async () => {
    const operatorConsole = await readFile(join(process.cwd(), "src/components/OperatorConsole.tsx"), "utf8");

    expect(operatorConsole).toContain("Você não tem a permissão necessária para esta ação.");
    expect(operatorConsole).toContain("if (!canUse)");
    expect(operatorConsole).toContain("aria-disabled={!canUse || !card.tab}");
  });
});
