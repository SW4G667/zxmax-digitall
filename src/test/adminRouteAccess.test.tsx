import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const authState = vi.hoisted(() => ({
  user: { id: "admin-confirmado" } as { id: string } | null,
  loading: false,
  banned: null,
  isAdmin: true,
  adminRoleResolved: true,
  adminGateUnlocked: true,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/store/StoreContext", () => ({ useStore: () => ({ refreshPurchases: vi.fn() }) }));
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/AdminView", () => ({ default: () => <div>Painel administrativo carregado</div> }));
vi.mock("@/components/AdminLoginGate", () => ({ default: () => <div>Confirmação MFA</div> }));
vi.mock("@/components/AuthScreen", () => ({ default: () => <div>Login</div> }));
vi.mock("@/components/BannedScreen", () => ({ default: () => <div>Bloqueado</div> }));
vi.mock("@/components/StoreView", () => ({ default: () => <div>Loja</div> }));
vi.mock("@/components/InventoryView", () => ({ default: () => <div>Inventário</div> }));
vi.mock("@/components/MyPurchasesView", () => ({ default: () => <div>Compras</div> }));
vi.mock("@/components/SupportView", () => ({ default: () => <div>Suporte</div> }));
vi.mock("@/components/WithdrawView", () => ({ default: () => <div>Saque</div> }));
vi.mock("@/components/LoadingScreen", () => ({ default: ({ message }: { message: string }) => <div>{message}</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/securityEvents", () => ({ recordSecurityEvent: vi.fn() }));
vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));

// eslint-disable-next-line import/first
import Index from "@/pages/Index";

describe("rota administrativa — papel confirmado", () => {
  it("renderiza o painel quando a sessão possui admin confirmado e o gate local foi concluído", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Index view="admin" />
      </MemoryRouter>,
    );

    expect(screen.getByText("Painel administrativo carregado")).toBeInTheDocument();
    expect(screen.queryByText("Acesso restrito a administradores.")).not.toBeInTheDocument();
    expect(screen.queryByText("Verificando permissões...")).not.toBeInTheDocument();
  });
});
