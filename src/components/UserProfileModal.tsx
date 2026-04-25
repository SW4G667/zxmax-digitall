import React from "react";
import { useStore } from "@/store/StoreContext";
import { StarEmoji } from "@/components/CustomEmojis";
import { X, Shield, CheckCircle } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  userEmail: string;
}

export default function UserProfileModal({ open, onClose, userEmail }: Props) {
  const { state } = useStore();
  
  // Find seller info from products or purchases
  const sellerProduct = state.products.find((p) => p.sellerEmail === userEmail);
  const sellerName = sellerProduct?.seller || userEmail.split("@")[0];
  const sellerUuid = sellerProduct?.sellerId || state.purchases.find((p) => p.sellerEmail === userEmail)?.sellerId || "";
  const sellerId = sellerProduct?.sellerPublicId || state.purchases.find((p) => p.sellerEmail === userEmail)?.sellerPublicId || state.userDirectory?.[sellerUuid]?.publicId || "ID indisponível";
  
  const sellerProducts = state.products.filter((p) => p.sellerEmail === userEmail && p.approved);
  const sellerPurchases = state.purchases.filter((p) => p.sellerEmail === userEmail);
  const sellerReviews = sellerPurchases.filter((p) => p.reviewed);
  
  const avgRating = sellerReviews.length > 0
    ? (sellerReviews.reduce((a, r) => a + (r.reviewStars || 0), 0) / sellerReviews.length).toFixed(1)
    : "Novo";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-6 bg-card animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-bold text-foreground">Perfil do Vendedor</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-4">
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(sellerName)}`} 
              className="w-24 h-24 rounded-3xl bg-primary/10 border-4 border-card shadow-xl" 
              alt={sellerName} 
            />
            <div className="absolute -bottom-2 -right-2 bg-success text-white p-1.5 rounded-xl shadow-lg">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <h4 className="text-2xl font-black text-foreground">{sellerName}</h4>
          <div className="flex items-center gap-1.5 mt-1 bg-muted px-3 py-1 rounded-full">
            <Shield className="w-3 h-3 text-primary" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vendedor Verificado</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-muted rounded-2xl p-3 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Vendas</p>
            <p className="text-lg font-black text-foreground">{sellerPurchases.length}</p>
          </div>
          <div className="bg-muted rounded-2xl p-3 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Avaliação</p>
            <div className="flex items-center justify-center gap-1">
              <StarEmoji className="w-3 h-3" />
              <p className="text-lg font-black text-foreground">{avgRating}</p>
            </div>
          </div>
          <div className="bg-muted rounded-2xl p-3 text-center">
            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Produtos</p>
            <p className="text-lg font-black text-foreground">{sellerProducts.length}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
            <p className="text-[10px] font-bold text-primary uppercase mb-1 tracking-widest">ID do Vendedor (para denúncias)</p>
            <p className="text-xs text-foreground font-mono break-all select-all">{sellerId}</p>
            <p className="text-[9px] text-muted-foreground mt-2 italic">Use este ID para abrir disputas ou denúncias.</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase px-1">Produtos ({sellerProducts.length})</p>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
              {sellerProducts.length > 0 ? sellerProducts.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-xl border border-border/20">
                  <img src={p.image} className="w-10 h-10 rounded-lg object-cover" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{p.name}</p>
                    <p className="text-[10px] text-primary font-black">R$ {p.price.toFixed(2)}</p>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground italic px-2">Nenhum produto publicado.</p>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full btn-gradient mt-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-primary/20"
        >
          Fechar Perfil
        </button>
      </div>
    </div>
  );
}
