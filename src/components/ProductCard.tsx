import React from "react";
import { useNavigate } from "react-router-dom";
import { Heart, BadgeCheck } from "lucide-react";
import { Product, useStore } from "@/store/StoreContext";
import useFavorites from "@/hooks/useFavorites";
import { formatBRL, formatRobuxPackage, formatStockLabel, lowestProductPrice, productHasAutoDelivery, productHasMixedDelivery, productStock, ROBUX_CATEGORY } from "@/lib/catalog";

interface Props {
  product: Product;
  onClick?: () => void;
  verified?: boolean;
}

export default function ProductCard({ product, onClick, verified }: Props) {
  const navigate = useNavigate();
  const { state } = useStore();
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(product.id);
  const seller = state.userDirectory?.[product.sellerId];
  const sellerName = seller?.name || product.seller || "Vendedor";
  const sellerAvatar = seller?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(sellerName)}`;
  const sellerVerified = verified ?? seller?.documentVerified ?? seller?.isVerified ?? false;

  const handleClick = () => {
    if (onClick) onClick();
    else navigate(`/produto/${product.id}`);
  };

  const price = product.category === ROBUX_CATEGORY
    ? formatRobuxPackage(product)
    : formatBRL(lowestProductPrice(product));
  const hasAutoDelivery = productHasAutoDelivery(product);
  const mixedDelivery = productHasMixedDelivery(product);
  const variationCount = product.category === ROBUX_CATEGORY ? 0 : (product.variations?.length || 0);

  return (
    <div
      onClick={handleClick}
      className="bg-[#15151a] border border-[#25252e] rounded-2xl overflow-hidden group cursor-pointer hover:border-[#2a2a36] transition flex flex-col h-full"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#0a0a0f]">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute top-2 left-2 flex gap-1.5">
          {hasAutoDelivery && <span className="badge-auto">{mixedDelivery ? "Auto + manual" : "Auto"}</span>}
          {product.sales > 50 && <span className="badge-hot">HOT</span>}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggle(product.id); }}
          className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-md transition ${
            fav ? "bg-[#0084ff] text-white" : "bg-black/60 text-white/80 hover:text-white"
          }`}
          aria-label="Favoritar"
        >
          <Heart className={`w-4 h-4 ${fav ? "fill-current" : ""}`} />
        </button>
        <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-bold text-white/80">
          {product.category}
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1">
        <h3 className="font-bold text-white text-[13px] leading-tight line-clamp-2 min-h-[36px]">
          {product.name}
        </h3>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <img src={sellerAvatar} alt="" className="h-6 w-6 shrink-0 rounded-full border border-white/[0.08] bg-[#0d0d11] object-cover" loading="lazy" />
          <p className="min-w-0 truncate text-[11px] text-white/40">
            por <span className="font-semibold text-[#66b7ff]">{sellerName}</span>
          </p>
          {sellerVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#52afff]" aria-label="Vendedor com documento verificado" />}
        </div>
        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-[10px] text-white/30 uppercase font-bold tracking-wider">A partir de</p>
            <p className="text-[15px] font-black text-[#ffbd2e]">{price}</p>
            <p className="text-[10px] text-white/35 mt-0.5">Estoque: {formatStockLabel(productStock(product))}{variationCount > 0 ? ` · ${variationCount} opções` : ""}</p>
          </div>
          <span className="bg-[#ffbd2e] text-black px-3 py-1.5 text-[11px] rounded-lg font-black">Ver</span>
        </div>
      </div>
    </div>
  );
}
