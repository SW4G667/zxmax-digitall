import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Star } from "lucide-react";
import { Product } from "@/store/StoreContext";
import useFavorites from "@/hooks/useFavorites";

interface Props {
  product: Product;
  onClick?: () => void;
}

export default function ProductCard({ product, onClick }: Props) {
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavorites();

  const fav = isFavorite(product.id);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(`/produto/${product.id}`);
    }
  };

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggle(product.id);
  };

  return (
    <div
      onClick={handleClick}
      className="glass-card overflow-hidden group cursor-pointer hover-lift flex flex-col h-full"
    >
      {/* Image 4:3 */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {/* Top badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {product.deliveryType === "auto" && <span className="badge-auto">Auto</span>}
          {product.sales > 50 && <span className="badge-hot">HOT</span>}
        </div>
        {/* Favorite */}
        <button
          onClick={handleFav}
          className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-md transition ${
            fav ? "bg-primary text-white" : "bg-card/80 text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Favoritar"
        >
          <Heart className={`w-4 h-4 ${fav ? "fill-current" : ""}`} />
        </button>
        {/* Category */}
        <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-bold text-foreground border border-border/50">
          {product.category}
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-bold text-foreground text-[13px] leading-tight line-clamp-2 min-h-[36px]">
          {product.name}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          por <span className="text-primary font-semibold">{product.seller}</span>
        </p>

        <div className="mt-auto pt-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Preço</p>
            <p className="text-[15px] font-black text-foreground">R$ {Number(product.price).toFixed(2)}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-[11px] font-bold text-foreground">{product.rating ? Number(product.rating).toFixed(1) : "Novo"}</span>
              <span className="text-[10px] text-muted-foreground">• {product.sales} vendas</span>
            </div>
          </div>
          <span className="btn-gradient px-3 py-1.5 text-[11px] rounded-lg">Ver</span>
        </div>
      </div>
    </div>
  );
}
