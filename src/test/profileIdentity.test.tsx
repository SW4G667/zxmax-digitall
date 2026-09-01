import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/store/StoreContext", () => ({
  useStore: () => ({
    state: {
      currentUser: {
        id: "admin-user",
        publicId: "",
        name: "Conta administrativa",
        avatar: "",
        balance: 0,
        earnings: 0,
        isAdmin: true,
        isVerified: false,
      },
    },
    requestWithdraw: vi.fn(),
    logout: vi.fn(),
    updatePixKey: vi.fn(),
    submitSellerDocument: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "admin-user" },
    profile: {
      public_id: 100004,
      display_name: "Conta administrativa",
      avatar_url: "",
      is_verified_seller: true,
      pix_key: "",
    },
    isAdmin: true,
    updateProfile: vi.fn(),
    refreshProfile: vi.fn(),
  }),
}));

vi.mock("@/components/CustomEmojis", () => ({
  StarEmoji: () => <span>Estrela</span>,
  MoneyEmoji: () => <span>Dinheiro</span>,
  DoorEmoji: () => <span>Sair</span>,
  CameraEmoji: () => <span>Câmera</span>,
  KeyEmoji: () => <span>Chave</span>,
}));

vi.mock("@/components/TwoFactorPanel", () => ({ default: () => <div>2FA</div> }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

// eslint-disable-next-line import/first
import ProfileModal from "@/components/ProfileModal";

describe("ProfileModal — identidade autenticada", () => {
  it("prefere o ID público e a verificação vindos do perfil ao estado ainda em sincronização", () => {
    render(<ProfileModal open onClose={vi.fn()} />);

    expect(screen.getByText("ID público: 100004")).toBeInTheDocument();
    expect(screen.getByText("Vendedor Verificado")).toBeInTheDocument();
    expect(screen.getByText("2FA")).toBeInTheDocument();
  });
});
