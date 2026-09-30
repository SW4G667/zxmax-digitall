import React, { useEffect, useMemo } from "react";
import { Coins, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";
import { isRobuxCategory, productStock, storefrontProducts, unitPriceFromPackage } from "@/lib/catalog";

export default function RobuxPage() {
  const { state, catalogStatus, refreshProducts } = useStore();
  const navigate = useNavigate();

  const bestOffer = useMemo(() => {
    const publicProducts = storefrontProducts(state.products, state.currentUser?.id);
    return [...publicProducts]
      .filter((product) =>
        isRobuxCategory(product.category) &&
        (product.sellerPublicId || state.userDirectory?.[product.sellerId]?.publicId) &&
        productStock(product) !== 0
      )
      .sort((a, b) =>
        unitPriceFromPackage(a) - unitPriceFromPackage(b) ||
        Number(a.minQuantity || 1) - Number(b.minQuantity || 1) ||
        Number(a.id) - Number(b.id)
      )[0] || null;
  }, [state.products, state.currentUser?.id, state.userDirectory]);

  useEffect(() => {
    if (!bestOffer) return;
    navigate(`/produto/${bestOffer.id}`, { replace: true });
  }, [bestOffer, navigate]);

  return (
    <AppShell>
      <main className="mx-auto max-w-xl py-14 text-center">
        {catalogStatus === "loading" ? (
          <>
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-[var(--zx-accent)]" />
            <p className="mt-3 text-sm font-bold text-white">Abrindo a melhor oferta de Robux…</p>
          </>
        ) : catalogStatus === "error" ? (
          <>
            <Coins className="mx-auto h-8 w-8 text-white/30" />
            <h1 className="mt-4 text-lg font-black text-white">Não foi possível carregar as ofertas.</h1>
            <button type="button" onClick={() => void refreshProducts()} className="mt-4 rounded-xl bg-[var(--zx-accent)] px-4 py-2.5 text-xs font-bold text-white">Tentar novamente</button>
          </>
        ) : !bestOffer ? (
          <>
            <Coins className="mx-auto h-8 w-8 text-white/30" />
            <h1 className="mt-4 text-lg font-black text-white">Nenhuma oferta de Robux disponível agora.</h1>
            <p className="mt-2 text-xs leading-5 text-white/40">Quando existir uma oferta aprovada e com estoque, este endereço abrirá o produto diretamente.</p>
          </>
        ) : (
          <p className="text-sm text-white/45">Abrindo produto de Robux…</p>
        )}
      </main>
    </AppShell>
  );
}
