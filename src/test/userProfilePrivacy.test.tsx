import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const storeState = vi.hoisted(() => ({
  state: {
    products: [{
      id: 51,
      sellerId: "seller-public-id",
      seller: "contato-legado@exemplo.test",
      sellerEmail: "contato-legado@exemplo.test",
      sellerPublicId: "VND-9384",
      approved: true,
      image: "https://cdn.example.test/produto.png",
      name: "Produto público",
      price: 5,
    }],
    purchases: [{
      sellerId: "seller-public-id",
      sellerEmail: "contato-legado@exemplo.test",
      sellerPublicId: "VND-9384",
    }],
    userDirectory: {
      "seller-public-id": {
        name: "Vendedora pública",
        publicId: "VND-9384",
        avatar: "",
        isVerified: true,
      },
    },
  },
}));

vi.mock("@/store/StoreContext", () => ({ useStore: () => storeState }));
vi.mock("@/components/CustomEmojis", () => ({ StarEmoji: () => <span>Estrela</span> }));

// eslint-disable-next-line import/first
import UserProfileModal from "@/components/UserProfileModal";

describe("UserProfileModal — privacidade", () => {
  it("identifica o vendedor por userId e nunca renderiza os e-mails legados disponíveis no estado", () => {
    render(<UserProfileModal open onClose={vi.fn()} userId="seller-public-id" />);

    expect(screen.getByRole("heading", { name: "Perfil do Vendedor" })).toBeInTheDocument();
    expect(screen.getByText("Vendedora pública")).toBeInTheDocument();
    expect(screen.getByText("VND-9384")).toBeInTheDocument();
    expect(screen.queryByText("contato-legado@exemplo.test")).not.toBeInTheDocument();
    expect(screen.queryByText("contato-legado")).not.toBeInTheDocument();
  });

  it("não deixa as superfícies públicas consultarem e-mails legados de vendedor", async () => {
    const [storeView, productPage, profileModal, storeContext] = await Promise.all([
      readFile(join(process.cwd(), "src/components/StoreView.tsx"), "utf8"),
      readFile(join(process.cwd(), "src/pages/Produto.tsx"), "utf8"),
      readFile(join(process.cwd(), "src/components/UserProfileModal.tsx"), "utf8"),
      readFile(join(process.cwd(), "src/store/StoreContext.tsx"), "utf8"),
    ]);

    for (const source of [storeView, productPage, profileModal]) {
      expect(source).not.toContain("sellerEmail");
      expect(source).not.toContain("buyerEmail");
      expect(source).not.toContain("userEmail");
    }
    const catalogMapperStart = storeContext.indexOf("const products = unique.map");
    const catalogMapperEnd = storeContext.indexOf("setState((old)", catalogMapperStart);
    const catalogMapper = storeContext.slice(catalogMapperStart, catalogMapperEnd);
    expect(catalogMapper).not.toContain("sellerEmail:");
  });

  it("não fabrica ID público quando um anúncio legado não possui contraparte válida", async () => {
    const [productSource, purchaseSource] = await Promise.all([
      readFile(join(process.cwd(), "src/pages/Produto.tsx"), "utf8"),
      readFile(join(process.cwd(), "supabase/functions/create-purchase/index.ts"), "utf8"),
    ]);

    expect(productSource).toContain("Conta do vendedor em validação");
    expect(productSource).not.toContain('publicSellerId || "Indisponível"');
    expect(purchaseSource).toContain("never create a payable order without a valid counterparty");
    expect(purchaseSource).toContain("Este anúncio não está disponível para compra no momento.");
  });

  it("enriquece anúncios legados somente com o ID público de perfil e não com contato", async () => {
    const publicProducts = await readFile(join(process.cwd(), "supabase/functions/public-products/index.ts"), "utf8");
    expect(publicProducts).toContain('select("user_id, public_id")');
    expect(publicProducts).toContain("seller_public_id: product.seller_public_id || publicIds.get");
    expect(publicProducts).not.toContain('select("user_id, email");');
  });
});
