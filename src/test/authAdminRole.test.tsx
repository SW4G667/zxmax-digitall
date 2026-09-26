import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  mfa: { listFactors: vi.fn() },
}));

vi.mock("@/integrations/supabase/client", () => {
  const query = {
    eq: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.eq.mockImplementation(() => query);
  query.limit.mockImplementation(() => query);
  query.maybeSingle.mockResolvedValue({ data: null, error: null });

  return {
    supabase: {
      auth,
      rpc,
      from: vi.fn(() => ({ select: vi.fn(() => query) })),
    },
  };
});

// eslint-disable-next-line import/first
import { AuthProvider, useAuth } from "@/hooks/useAuth";

function AuthProbe() {
  const { user, isAdmin, adminRoleResolved } = useAuth();
  return <p>{`${user?.id ?? "none"}|${isAdmin}|${adminRoleResolved}`}</p>;
}

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("AuthProvider — confirmação de papel administrativo", () => {
  it("libera o estado administrativo apenas após uma resposta positiva da RPC has_role", async () => {
    const user = { id: "admin-confirmado", email: "admin@example.test", user_metadata: {} };
    auth.getSession.mockResolvedValue({ data: { session: { user } } });
    auth.refreshSession.mockResolvedValue({ data: { session: null } });
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    auth.mfa.listFactors.mockResolvedValue({ data: { totp: [] } });
    rpc.mockResolvedValue({ data: true, error: null });

    render(<AuthProvider><AuthProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByText("admin-confirmado|true|true")).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith("has_role", { _user_id: "admin-confirmado", _role: "admin" });
  });
});
