import React, { useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import useFavorites from "@/hooks/useFavorites";
import ProductCard from "@/components/ProductCard";
import AppShell from "@/components/AppShell";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

export default function FavoritosPage() {
  const { state } = useStore();
  const { favorites, count } = useFavorites();

  const favProducts = useMemo(() => {
    return state.products.filter((p) => favorites.includes(p.id) && p.approved);
  }, [state.products, favorites]);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Heart className="w-6 h-6 fill-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Favoritos</h1>
            <p className="text-sm text-muted-foreground">{count} {count === 1 ? "produto salvo" : "produtos salvos"}</p>
          </div>
        </div>

        {favProducts.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border-2 border-dashed border-border">
            <p className="text-3xl mb-3">💙</p>
            <p className="text-foreground font-bold">Nenhum favorito ainda</p>
            <p className="text-sm text-muted-foreground mt-1">Salve produtos clicando no coração para vê-los aqui.</p>
            <Link to="/loja" className="btn-gradient inline-block px-6 py-3 rounded-xl font-bold text-sm mt-5">Explorar loja</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {favProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
