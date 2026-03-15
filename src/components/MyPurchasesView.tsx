import React, { useState } from "react";
import { useStore, Purchase, Product } from "@/store/StoreContext";
import { BagCheckEmoji, StarEmoji, ChatEmoji, ShieldEmoji } from "@/components/CustomEmojis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

/** Status label + color mapping */
const statusMap: Record<Purchase["status"], { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  paid: { label: "Pago", cls: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  delivered: { label: "Entregue", cls: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  dispute: { label: "Disputa", cls: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function MyPurchasesView() {
  const { state, openDispute, confirmDelivery, reviewPurchase, sendPurchaseMessage } = useStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [showReview, setShowReview] = useState(false);

  if (!state.currentUser) return null;

  const myPurchases = state.purchases.filter((p) => p.buyerEmail === state.currentUser!.email);
  const selected = myPurchases.find((p) => p.id === selectedId);
  const selectedProduct = selected ? state.products.find((pr) => pr.id === selected.productId) : null;

  const handleSend = () => {
    if (!msg.trim() || !selected) return;
    sendPurchaseMessage(selected.id, state.currentUser!.email, msg.trim());
    setMsg("");
  };

  const handleCallSupport = () => {
    if (!selected) return;
    sendPurchaseMessage(selected.id, state.currentUser!.email, "⚠️ Aguardando suporte — ajuda solicitada pelo comprador.");
    toast.success("Suporte chamado! Aguarde um administrador.");
  };

  const handleConfirm = () => {
    if (!selected) return;
    confirmDelivery(selected.id);
    toast.success("Entrega confirmada!");
    setShowReview(true);
  };

  const handleDispute = () => {
    if (!selected) return;
    openDispute(selected.id);
    toast.info("Disputa aberta! O admin irá analisar.");
  };

  const handleReview = () => {
    if (!reviewText.trim()) { toast.error("Escreva um comentário."); return; }
    if (!selected) return;
    reviewPurchase(selected.id, reviewStars, reviewText.trim());
    toast.success("Avaliação enviada!");
    setShowReview(false);
    setReviewStars(5);
    setReviewText("");
  };

  /* ── Chat view ── */
  if (selected && selectedProduct) {
    const chat = selected.messages || [];
    return (
      <div className="animate-fade-in-up max-w-2xl mx-auto">
        <button onClick={() => { setSelectedId(null); setShowReview(false); }} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        {/* Product info header */}
        <div className="glass-card p-5 mb-4 flex gap-4 items-center">
          <img src={selectedProduct.image} className="w-16 h-16 rounded-2xl object-cover" alt={selectedProduct.name} />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground truncate">{selectedProduct.name}</h3>
            <p className="text-xs text-muted-foreground">Vendedor: <span className="text-primary font-semibold">{selectedProduct.seller}</span></p>
            <p className="text-sm font-black text-foreground mt-0.5">R$ {selected.amount.toFixed(2)}</p>
          </div>
          <Badge className={statusMap[selected.status].cls}>{statusMap[selected.status].label}</Badge>
        </div>

        {/* Review form after delivery confirmed */}
        {showReview && (
          <div className="glass-card p-5 mb-4 animate-fade-in-up">
            <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <StarEmoji className="w-5 h-5" /> Avaliar Produto
            </h4>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setReviewStars(s)}>
                  <StarEmoji className="w-7 h-7" filled={s <= reviewStars} />
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Escreva seu comentário (obrigatório)..."
              className="w-full bg-secondary/50 border border-border/40 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none h-20 mb-3"
            />
            <Button onClick={handleReview} className="btn-gradient w-full">Enviar Avaliação</Button>
          </div>
        )}

        {/* Chat messages */}
        <div className="glass-card p-4 mb-4 min-h-[250px] max-h-[400px] overflow-y-auto flex flex-col gap-2">
          {chat.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem ainda. Inicie a conversa!</p>
          )}
          {chat.map((m, i) => {
            const isMe = m.from === state.currentUser!.email;
            return (
              <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"}`}>
                  <p>{m.text}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(m.date).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message input */}
        <div className="glass-card p-3 flex gap-2 items-center mb-4">
          <input
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Button size="icon" onClick={handleSend} className="btn-gradient shrink-0 w-9 h-9">
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          {(selected.status === "paid" || selected.status === "delivered") && !selected.reviewed && selected.status === "paid" && (
            <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1">
              ✓ Confirmar Entrega
            </Button>
          )}
          {selected.status === "delivered" && !selected.reviewed && !showReview && (
            <Button onClick={() => setShowReview(true)} className="btn-gradient flex-1">
              <StarEmoji className="w-4 h-4" /> Avaliar
            </Button>
          )}
          {(selected.status === "paid") && (
            <Button variant="destructive" onClick={handleDispute} className="flex-1">
              <ShieldEmoji className="w-4 h-4" /> Abrir Disputa
            </Button>
          )}
          <Button variant="outline" onClick={handleCallSupport} className="flex-1">
            <ChatEmoji className="w-4 h-4" /> Chamar Suporte
          </Button>
        </div>
      </div>
    );
  }

  /* ── Purchase list ── */
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-foreground">Minhas Compras</h1>
        <BagCheckEmoji className="w-8 h-8" />
      </div>

      {myPurchases.length === 0 ? (
        <div className="text-center py-20">
          <BagCheckEmoji className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-muted-foreground font-medium">Você ainda não comprou nada.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {myPurchases.map((purchase, i) => {
            const product = state.products.find((pr) => pr.id === purchase.productId);
            if (!product) return null;
            return (
              <button
                key={purchase.id}
                onClick={() => setSelectedId(purchase.id)}
                className="glass-card p-4 flex gap-4 items-center text-left w-full animate-fade-in-up hover:ring-2 hover:ring-primary/30"
                style={{ animationDelay: `${i * 0.06}s` }}
              >
                <img src={product.image} className="w-14 h-14 rounded-xl object-cover shrink-0" alt={product.name} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground text-sm truncate">{product.name}</h3>
                  <p className="text-xs text-muted-foreground">por {product.seller}</p>
                  <p className="text-sm font-black text-foreground">R$ {purchase.amount.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className={statusMap[purchase.status].cls}>{statusMap[purchase.status].label}</Badge>
                  {purchase.reviewed && <span className="text-[10px] text-emerald-500 font-bold">Avaliado ✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
