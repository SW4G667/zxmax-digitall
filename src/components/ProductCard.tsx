import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, BadgeCheck, Zap } from "lucide-react";
import { Product } from "@/store/StoreContext";
import useFavorites from "@/hooks/useFavorites";
import { formatBRL, formatRobuxPackage, formatStockLabel, productStock, ROBUX_CATEGORY } from "@/lib/catalog";

interface Props {
  product: Product;
  onClick?: () => void;
  verified?: boolean;
}

export default function ProductCard({ product, onClick, verified }: Props) {
  const navigate = useNavigate();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(product.id);

  const handleClick = () => {
    if (onClick) onClick();
    else navigate(`/produto/${product.id}`);
  };

  const price = product.category === ROBUX_CATEGORY
    ? formatRobuxPackage(product)
    : formatBRL(product.price);

  return (
    <div
      onClick={handleClick}
      className="gg-card group cursor-pointer hover:shadow-md transition flex flex-col h-full"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-2 left-2 flex gap-1.5">
          {product.deliveryType === "auto" && (
            <span className="inline-flex items-center gap-0.5 bg-white/95 text-[#2B7FFF] text-[10px] font-bold px-1.5 py-0.5 rounded">
              <Zap className="w-3 h-3" /> Auto
            </span>
          )}
          {product.sales > 50 && <span className="badge-hot">HOT</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggle(product.id); }}
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-md transition ${
            fav ? "bg-[#2B7FFF] text-white" : "bg-white/90 text-foreground/70 hover:text-[#2B7FFF]"
          }`}
          aria-label="Favoritar"
        >
          <Heart className={`w-4 h-4 ${fav ? "fill-current" : ""}`} />
        </button>
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-semibold text-foreground text-[13px] leading-snug line-clamp-2 min-h-[36px] uppercase tracking-tight">
          {product.name}
        </h3>
        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
          por <span className="text-[#2B7FFF] font-semibold">{product.seller}</span>
          {verified && <BadgeCheck className="w-3 h-3 text-[#2B7FFF]" />}
        </p>
        <div className="mt-auto pt-3 flex items-center justify-between gap-2">
          <span className="gg-price-pill">{price} +</span>
          <span className="text-[10px] text-muted-foreground">Estoque: {formatStockLabel(productStock(product))}</span>
        </div>
      </div>
    </div>
  );
}
