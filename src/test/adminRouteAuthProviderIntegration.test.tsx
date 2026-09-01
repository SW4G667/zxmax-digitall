import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

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

vi.mock("@/store/StoreContext", () => ({ useStore: () => ({ refreshPurchases: vi.fn() }) }));
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/AdminView", () => ({ default: () => <div>Painel administrativo integrado</div> }));
vi.mock("@/components/AdminLoginGate", () => ({ default: () => <div>Confirmação MFA</div> }));
vi.mock("@/components/AuthScreen", () => ({ default: () => <div>Login</div> }));
vi.mock("@/components/BannedScreen", () => ({ default: () => <div>Bloqueado</div> }));
vi.mock("@/components/StoreView", () => ({ default: () => <div>Loja</div> }));
vi.mock("@/components/InventoryView", () => ({ default: () => <div>Inventário</div> }));
vi.mock("@/components/MyPurchasesView", () => ({ default: () => <div>Compras</div> }));
vi.mock("@/components/SupportView", () => ({ default: () => <div>Suporte</div> }));
vi.mock("@/components/WithdrawView", () => ({ default: () => <div>Saque</div> }));
vi.mock("@/components/LoadingScreen", () => ({ default: ({ message }: { message: string }) => <div>{message}</div> }));
vi.mock("@/lib/securityEvents", () => ({ recordSecurityEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));

// eslint-disable-next-line import/first
import { AuthProvider } from "@/hooks/useAuth";
// eslint-disable-next-line import/first
import Index from "@/pages/Index";

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("rota administrativa — sessão e papel confirmados", () => {
  it("consulta has_role e só então renderiza o painel para uma sessão administrativa com gate concluído", async () => {
    const user = { id: "admin-integrado", email: "admin@example.test", user_metadata: {} };
    localStorage.setItem("zxmax_admin_gate_ok_admin-integrado", "1");
    auth.getSession.mockResolvedValue({ data: { session: { user } } });
    auth.refreshSession.mockResolvedValue({ data: { session: null } });
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    auth.mfa.listFactors.mockResolvedValue({ data: { totp: [] } });
    rpc.mockResolvedValue({ data: true, error: null });

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <AuthProvider><Index view="admin" /></AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("Painel administrativo integrado")).toBeInTheDocument());
    expect(rpc).toHaveBeenCalledWith("has_role", { _user_id: "admin-integrado", _role: "admin" });
    expect(screen.queryByText("Acesso restrito a administradores.")).not.toBeInTheDocument();
  });
});
