import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

describe("SideMenu administrativo", () => {
  it("constrói as entradas administrativas mesmo quando o menu está fechado", () => {
    expect(() => render(
      <MemoryRouter>
        <SideMenu open={false} onClose={vi.fn()} onNavigate={vi.fn()} onOpenProfile={vi.fn()} />
      </MemoryRouter>,
    )).not.toThrow();
  });
});
