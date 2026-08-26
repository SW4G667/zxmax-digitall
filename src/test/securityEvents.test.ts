import { describe, expect, it, vi } from "vitest";
import { recordSecurityEvent } from "@/lib/securityEvents";

describe("security event logging", () => {
  it("envia apenas tipo e resultado ao endpoint de auditoria", () => {
    const invoke = vi.fn();
    recordSecurityEvent({ functions: { invoke } }, "auth.login", "failure");
    expect(invoke).toHaveBeenCalledWith("security-event", {
      body: { eventType: "auth.login", outcome: "failure" },
    });
    expect(JSON.stringify(invoke.mock.calls[0])).not.toMatch(/senha|password|token|@/i);
  });

  it("registra bloqueio administrativo sem anexar a identidade do usuário", () => {
    const invoke = vi.fn();
    recordSecurityEvent({ functions: { invoke } }, "admin.access", "blocked");
    expect(invoke).toHaveBeenCalledWith("security-event", {
      body: { eventType: "admin.access", outcome: "blocked" },
    });
    expect(JSON.stringify(invoke.mock.calls[0])).not.toMatch(/email|senha|password|token|user_id/i);
  });
});
