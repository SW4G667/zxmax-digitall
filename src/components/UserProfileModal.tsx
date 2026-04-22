import React, { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { StarEmoji, MoneyEmoji } from "@/components/CustomEmojis";
import { X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  userEmail: string;
}

export default function UserProfileModal({ open, onClose, userEmail }: Props) {
  const { state } = useStore();

  if (!open) return null;

  // Find user purchases to get stats
  const userPurchases = state.purchases.filter((p) => p.sellerEmail === userEmail);
  const userReviews = userPurchases.filter((p) => p.reviewed);
  const avgRating = userReviews.length > 0
    ? (userReviews.reduce((a, r) => a + (r.reviewStars || 0), 0) / userReviews.length).toFixed(1)
    : null;

  // Find user products
  const userProducts = state.products.filter((p) => p.sellerEmail === userEmail && p.approved);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-lg p-7 bg-card animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-foreground">Perfil do Vendedor</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        <div className="flex items-center gap-5 mb-6 p-5 bg-muted rounded-2xl">
          <img 
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userEmail)}`} 
            className="w-20 h-20 rounded-2xl object-cover shadow-lg" 
            alt="Avatar" 
          />
          <div className="flex-1">
            <p className="text-lg font-bold text-foreground">{userEmail.split("@")[0]}</p>
            <p className="text-muted-foreground text-xs mt-0.5 font-mono break-all">{userEmail}</p>
            <p className="text-success text-sm mt-0.5 font-semibold">✓ Vendedor Ativo</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 bg-primary/5 rounded-2xl">
            <p className="text-[10px] font-bold text-primary uppercase">Vendas</p>
            <p className="text-2xl font-black text-primary">{userPurchases.length}</p>
          </div>
          <div className="p-4 bg-success/5 rounded-2xl">
            <p className="text-[10px] font-bold text-success uppercase">Avaliação</p>
            <div className="flex items-center gap-1">
              <StarEmoji className="w-4 h-4" />
              <p className="text-2xl font-black text-success">{avgRating || "—"}</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Produtos ({userProducts.length})</h4>
          {userProducts.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {userProducts.map((p) => (
                <div key={p.id} className="p-3 bg-muted rounded-xl">
                  <p className="text-sm font-bold text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">R$ {p.price.toFixed(2)} · {p.sales} vendas</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Nenhum produto publicado</p>
          )}
        </div>

        <button onClick={onClose} className="w-full p-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:opacity-90 transition">
          Fechar
        </button>
      </div>
    </div>
  );
}
