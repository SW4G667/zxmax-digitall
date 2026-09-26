import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Header from "@/components/Header";

const authState = vi.hoisted(() => ({ user: null as { email: string } | null }));

vi.mock("@/store/StoreContext", () => ({
  useStore: () => ({
    state: { config: {}, currentUser: null },
    isDark: true,
    toggleDark: vi.fn(),
  }),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ profile: null, user: authState.user, isAdmin: false }),
}));
vi.mock("@/hooks/useFavorites", () => ({ default: () => ({ count: 0 }) }));
vi.mock("@/components/NotificationBell", () => ({ default: () => null }));
vi.mock("@/components/DiscordIcon", () => ({ default: () => <span aria-hidden /> }));

describe("ação móvel de anúncio no cabeçalho", () => {
  beforeEach(() => { authState.user = null; });

  it("pede autenticação ao visitante sem criar anúncio ou checkout", () => {
    const onAuthClick = vi.fn();
    render(
      <MemoryRouter>
        <Header onAuthClick={onAuthClick} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Entrar para anunciar" }));
    expect(onAuthClick).toHaveBeenCalledTimes(1);
  });
});
