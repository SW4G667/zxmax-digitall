import React, { useState, useEffect, useRef } from "react";
import { useStore, Purchase } from "@/store/StoreContext";
import { ShoppingBagEmoji, StarEmoji, ChatEmoji } from "@/components/CustomEmojis";
import { Search, X, MessageSquare, Star, Send, ShieldAlert, CheckCircle2, Clock, ExternalLink, Copy, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusMap: Record<Purchase["status"], { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  paid: { label: "Pago", cls: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  delivered: { label: "Entregue", cls: "bg-primary/20 text-primary border-primary/30" },
  dispute: { label: "Disputa", cls: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function MyPurchasesView({ initialSelectedId }: { initialSelectedId?: number | null }) {
  const { state, sendPurchaseMessage, confirmDelivery, openDispute, reviewPurchase } = useStore();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId || null);

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);
  const [msg, setMsg] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [showReview, setShowReview] = useState(false);

  const myPurchases = state.purchases.filter((p) => p.buyerEmail === state.currentUser?.email);
  const filtered = myPurchases.filter((p) => {
    const product = state.products.find((pr) => pr.id === p.productId);
    return product?.name.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const selected = selectedId ? state.purchases.find((p) => p.id === selectedId) : null;
  const selectedProduct = selected ? state.products.find((p) => p.id === selected.productId) : null;

  const handleSend = () => {
    if (!msg.trim() || !selectedId || !state.currentUser) return;
    if (selected?.status === "pending") {
      toast.error("Finalize o pagamento para conversar.");
      return;
    }
    sendPurchaseMessage(selectedId, state.currentUser.email, msg.trim());
    setMsg("");
  };

  const handleDispute = () => {
    if (!disputeReason.trim() || !selectedId) {
      toast.error("Por favor, descreva o motivo da disputa.");
      return;
    }
    openDispute(selectedId, disputeReason);
    toast.success("Disputa aberta! Um administrador irá analisar o caso.");
    setShowDisputeForm(false);
    setDisputeReason("");
  };

  const handleReview = () => {
    if (!selectedId || !comment.trim()) {
      toast.error("Por favor, escreva um comentário.");
      return;
    }
    reviewPurchase(selectedId, rating, comment);
    toast.success("Avaliação enviada!");
    setShowReview(false);
  };

  const handleConfirm = () => {
    if (!selectedId) return;
    confirmDelivery(selectedId);
    toast.success("Entrega confirmada!");
    setShowReview(true);
  };

  // Auto-scroll chat
  useEffect(() => {
    if (selectedId) {
      const chat = document.getElementById("purchase-chat");
      if (chat) chat.scrollTop = chat.scrollHeight;
    }
  }, [selectedId, selected?.messages]);

  if (selected && selectedProduct) {
    const chat = selected.messages || [];
    const isChatLocked = selected.status === "pending";
    const deliveryMsg = chat.find((m) => m.text.startsWith("📦 ENTREGA_AUTO:"));

    return (
      <div className="animate-fade-in-up max-w-2xl mx-auto">
        <button onClick={() => { setSelectedId(null); setShowReview(false); }} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="glass-card p-5 mb-4 flex gap-4 items-center">
          <img src={selectedProduct.image} className="w-16 h-16 rounded-2xl object-cover" alt={selectedProduct.name} />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground truncate">{selectedProduct.name}</h3>
            <p className="text-xs text-muted-foreground">Vendedor: <span className="text-primary font-semibold">{selectedProduct.seller}</span></p>
            <p className="text-sm font-black text-foreground mt-0.5">R$ {selected.amount.toFixed(2)}</p>
          </div>
          <Badge className={statusMap[selected.status].cls}>{statusMap[selected.status].label}</Badge>
        </div>

        {/* Delivery Info */}
        {(selected.status === "delivered" || selected.status === "paid") && (
          <div className="glass-card p-4 mb-4 border-2 border-success/30 bg-success/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-success uppercase bg-success/10 px-2 py-0.5 rounded-full">📦 Informações de Entrega</span>
            </div>
            {selectedProduct.deliveryType === "auto" ? (
              <div className="flex items-center gap-2 bg-muted rounded-xl p-3">
                <p className="flex-1 text-sm text-foreground font-mono break-all">
                  {deliveryMsg?.text.replace("📦 ENTREGA_AUTO: ", "") || selectedProduct.deliveryContent}
                </p>
                <button onClick={() => { navigator.clipboard.writeText(deliveryMsg?.text.replace("📦 ENTREGA_AUTO: ", "") || selectedProduct.deliveryContent || ""); toast.success("Copiado!"); }} className="shrink-0 p-1.5 hover:bg-card rounded-lg">
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-foreground">O vendedor entregará seu produto via chat abaixo.</p>
            )}
            {selected.status === "paid" && (
              <Button onClick={handleConfirm} className="w-full mt-3 bg-success hover:bg-success/90 text-white font-bold">
                Confirmar Recebimento
              </Button>
            )}
          </div>
        )}

        {/* Review Form */}
        {showReview && (
          <div className="glass-card p-5 mb-4 animate-fade-in-up">
            <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <StarEmoji className="w-5 h-5" /> Avaliar Produto
            </h4>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)}>
                  <StarEmoji className="w-7 h-7" filled={s <= rating} />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escreva seu comentário (obrigatório)..."
              className="w-full bg-secondary/50 border border-border/40 rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none h-20 mb-3"
            />
            <Button onClick={handleReview} className="btn-gradient w-full">Enviar Avaliação</Button>
          </div>
        )}

        {/* Chat */}
        <div className="flex items-center justify-between mb-2 px-1">
          <h4 className="text-xs font-bold text-muted-foreground uppercase">Chat</h4>
          <button onClick={() => setShowDisputeForm(true)} className="text-[10px] font-bold text-destructive uppercase hover:underline">
            Abrir Disputa
          </button>
        </div>
        <div id="purchase-chat" className="glass-card p-4 mb-4 min-h-[300px] max-h-[400px] overflow-y-auto flex flex-col gap-2">
          {isChatLocked ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Clock className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Finalize o pagamento para conversar.</p>
            </div>
          ) : chat.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem ainda.</p>
          ) : (
            chat.map((m, i) => {
              const isMe = m.from === state.currentUser?.email;
              const isSystem = m.from === "System";
              if (isSystem) return (
                <div key={i} className="flex justify-center my-1">
                  <span className="bg-muted text-muted-foreground text-[9px] px-2 py-0.5 rounded-full font-bold uppercase">
                    {m.text}
                  </span>
                </div>
              );
              return (
                <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"}`}>
                    <p>{m.text}</p>
                    <p className={`text-[9px] mt-1 opacity-60 ${isMe ? "text-right" : "text-left"}`}>
                      {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {!isChatLocked && (
          <div className="flex gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} placeholder="Digite sua mensagem..." className="flex-1 p-3 rounded-xl bg-card border border-border/40 focus:ring-2 ring-primary outline-none text-sm text-foreground" />
            <button onClick={handleSend} className="btn-gradient p-3 rounded-xl"><Send className="w-4 h-4" /></button>
          </div>
        )}

        {/* Dispute Modal */}
        {showDisputeForm && (
          <div className="fixed inset-0 z-[70] bg-foreground/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowDisputeForm(false)}>
            <div className="glass-card w-full max-w-md p-6 bg-card animate-fade-in-up" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4 text-destructive">
                <ShieldAlert className="w-6 h-6" />
                <h3 className="text-xl font-bold">Abrir Disputa</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Descreva detalhadamente o problema. Um administrador entrará no chat para mediar a situação.
              </p>
              <textarea 
                value={disputeReason} 
                onChange={(e) => setDisputeReason(e.target.value)} 
                placeholder="Ex: O produto não funciona, o vendedor não responde..." 
                className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-destructive outline-none text-sm text-foreground mb-4 resize-none" 
                rows={4} 
              />
              <div className="flex gap-3">
                <button onClick={() => setShowDisputeForm(false)} className="flex-1 py-3 rounded-xl font-bold text-sm bg-muted text-foreground">Cancelar</button>
                <button onClick={handleDispute} className="flex-1 py-3 rounded-xl font-bold text-sm bg-destructive text-white hover:opacity-90">Confirmar Disputa</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground">Minhas Compras</h1>
          <ShoppingBagEmoji className="w-8 h-8" />
        </div>
        <p className="text-muted-foreground">Acompanhe seus pedidos e acesse seus produtos.</p>
      </div>

      <div className="bg-card rounded-2xl px-4 py-3 mb-8 border border-border/40 flex items-center gap-3">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome do produto..." className="bg-transparent border-none focus:ring-0 outline-none text-sm w-full text-foreground" />
      </div>

      <div className="grid gap-4">
        {filtered.map((p) => {
          const prod = state.products.find((pr) => pr.id === p.productId);
          return (
            <div key={p.id} onClick={() => setSelectedId(p.id)} className="glass-card p-5 flex items-center gap-5 cursor-pointer hover:border-primary/50 transition group">
              <img src={prod?.image} className="w-16 h-16 rounded-2xl object-cover" alt="" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-foreground truncate group-hover:text-primary transition">{prod?.name}</h4>
                  <Badge className={statusMap[p.status].cls}>{statusMap[p.status].label}</Badge>
                </div>
                {p.variationName && <p className="text-[10px] text-primary font-bold">Opção: {p.variationName}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">Comprado em {new Date(p.createdAt).toLocaleDateString()}</p>
                <p className="text-sm font-black text-foreground mt-1">R$ {p.amount.toFixed(2)}</p>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-20 bg-card rounded-3xl border-2 border-dashed border-border">
            <p className="text-3xl mb-3">🛍️</p>
            <p className="text-muted-foreground font-medium">Você ainda não fez nenhuma compra.</p>
          </div>
        )}
      </div>
    </div>
  );
}
