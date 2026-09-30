import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("segurança do ZXMAX App", () => {
  it("não confunde vendedor verificado com documentos aprovados", async () => {
    const store = await readFile(join(process.cwd(), "src/store/StoreContext.tsx"), "utf8");
    expect(store).toContain('documentVerified: (profile as any)?.verification_status === "approved"');
    expect(store).not.toContain('verification_status === "approved" || profile?.is_verified_seller');
  });

  it("bloqueia conta banida no app e reconsulta o ban durante a sessão", async () => {
    const app = await readFile(join(process.cwd(), "src/pages/AppDashboard.tsx"), "utf8");
    const auth = await readFile(join(process.cwd(), "src/hooks/useAuth.tsx"), "utf8");
    expect(app).toContain("if (user && banned) return <BannedScreen />");
    expect(auth).toContain("window.setInterval(recheckBan, 15_000)");
    expect(auth).toContain('document.addEventListener("visibilitychange", onVisibility)');
  });

  it("usa autorização financeira do servidor para cobranças", async () => {
    const app = await readFile(join(process.cwd(), "src/pages/AppDashboard.tsx"), "utf8");
    const edge = await readFile(join(process.cwd(), "supabase/functions/merchant-charge/index.ts"), "utf8");
    expect(app).toContain('rpc("can_use_merchant_gateway")');
    expect(edge).toContain('admin.rpc("can_use_merchant_gateway"');
    expect(edge).toContain('admin.rpc("is_banned"');
  });
});
