import { afterEach, describe, expect, it } from "vitest";
import { peekStoredSession, readAdminGate, wipePersistedAuth } from "@/lib/authSession";

afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe("persisted auth cleanup", () => {
  it("wipes Supabase auth and all ZXMAX admin/MFA caches", () => {
    localStorage.setItem("sb-project-auth-token", JSON.stringify({ user: { id: "u" }, access_token: "token" }));
    localStorage.setItem("zxmax_admin_role_u", "1");
    localStorage.setItem("zxmax_admin_gate_ok_u", "1");
    localStorage.setItem("zxmax_mfa_enroll", "pending");
    sessionStorage.setItem("zxmax_admin_mfa_verified", "1");
    wipePersistedAuth();
    expect(peekStoredSession()).toBeNull();
    expect(localStorage.getItem("zxmax_admin_role_u")).toBeNull();
    expect(readAdminGate("u")).toBe(false);
    expect(sessionStorage.getItem("zxmax_admin_mfa_verified")).toBeNull();
  });
});
