import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn(), useLocation: () => ({ search: "" }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/components/AuthScreen", () => ({ default: () => null }));
vi.mock("@/components/UserProfileModal", () => ({ default: () => null }));
vi.mock("@/store/StoreContext", () => ({
  useStore: () => ({
    catalogStatus: "ready",
    refreshProducts: vi.fn(),
    state: {
      currentUser: null,
      config: { categories: ["Bots Discord"], discordLink: "", commission: 0, instantFee: 0, globalNotice: "", rules: "" },
      userDirectory: { seller: { isVerified: true } },
      products: [{ id: 92, name: "Bot de moderação", category: "Bots Discord", seller: "Vendedor", sellerId: "seller", description: "Automação", price: 12, sales: 4, rating: 5, approved: true, image: "https://example.com/product.png", deliveryType: "auto", stock: 3 }],
    },
  }),
}));

// eslint-disable-next-line import/first
import StoreView from "@/components/StoreView";

describe("StoreView — hierarquia de catálogo", () => {
  it("mantém filtros acessíveis e destaca preço de cartão publicado em azul", () => {
    render(<StoreView />);
    expect(screen.getAllByRole("button", { name: /Filtros|Ajustar/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bots Discord").length).toBeGreaterThan(1);
    const price = screen.getAllByText(/R\$\s*12,00/)[0];
    expect(price).toHaveClass("text-[#45a7ff]");
    expect(screen.getByText("AUTO")).toBeInTheDocument();
  });
});
