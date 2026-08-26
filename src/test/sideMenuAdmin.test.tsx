import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "@/components/AppShell";
import SideMenu from "@/components/SideMenu";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    isAdmin: true,
    user: { id: "admin-1", email: "admin@example.test" },
    profile: { is_verified_seller: true },
    mfaEnabled: true,
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/store/StoreContext", () => ({
  useStore: () => ({ state: { products: [], purchases: [] } }),
}));

vi.mock("@/hooks/useFavorites", () => ({
  default: () => ({ count: 0 }),
}));

vi.mock("@/components/Header", () => ({
  default: ({ onMenuClick }: { onMenuClick: () => void }) => <button onClick={onMenuClick}>Abrir navegação</button>,
}));
vi.mock("@/components/BottomNav", () => ({ default: () => null }));
vi.mock("@/components/ProfileModal", () => ({ default: () => null }));
vi.mock("@/components/AuthScreen", () => ({ default: () => null }));
vi.mock("@/components/SiteFooter", () => ({ default: () => null }));

describe("SideMenu administrativo", () => {
  it("constrói as entradas administrativas mesmo quando o menu está fechado", () => {
    expect(() => render(
      <MemoryRouter>
        <SideMenu open={false} onClose={vi.fn()} onNavigate={vi.fn()} onOpenProfile={vi.fn()} />
      </MemoryRouter>,
    )).not.toThrow();
  });

  it("permite abrir o menu administrativo dentro da casca de rota", () => {
    render(
      <MemoryRouter>
        <AppShell><p>Conteúdo da rota</p></AppShell>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir navegação" }));
    expect(screen.getByText("Tags de usuários")).toBeInTheDocument();
    expect(screen.getByText("Cargos e permissões")).toBeInTheDocument();
  });
});
