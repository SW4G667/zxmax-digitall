import React, { useState } from "react";
import { useStore, Purchase } from "@/store/StoreContext";
import { BagCheckEmoji, StarEmoji, ChatEmoji, ShieldEmoji } from "@/components/CustomEmojis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Send, Copy, ExternalLink, Lock, Image as ImageIcon } from "lucide-react";

const statusMap: Record<Purchase["status"], { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  paid: { label: "Pago", cls: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  delivered: { label: "Entregue", cls: "bg-primary/20 text-primary border-primary/30" },
  dispute: { label: "Disputa", cls: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function MyPurchasesView() {
  const { state, openDispute, confirmDelivery, reviewPurchase, sendPurchaseMessage } = useStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [showSupportConfirm, setShowSupportConfirm] = useState(false);
  const [showDisputeConfirm, setShowDisputeConfirm] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  if (!state.currentUser) return null;

  const myPurchases = state.purchases.filter((p) => p.buyerEmail === state.currentUser!.email);
  const selected = myPurchases.find((p) => p.id === selectedId);
  const selectedProduct = selected ? state.products.find((pr) => pr.id === selected.productId) : null;

  const handleSend = () => {
    if (!msg.trim() || !selected) return;
    // Chat restriction: buyer can only message after payment
    if (selected.status === "pending") {
      toast.error("Finalize o pagamento para conversar.");
      return;
    }
    sendPurchaseMessage(selected.id, state.currentUser!.email, msg.trim());
    setMsg("");
  };

  const handleCallSupport = () => {
    if (!selected) return;
    sendPurchaseMessage(selected.id, state.currentUser!.email, "⚠️ Aguardando suporte — ajuda solicitada pelo comprador.");
    toast.success("Suporte chamado! Aguarde um administrador.");
    setShowSupportConfirm(false);
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
    setShowDisputeConfirm(false);
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
    const isChatLocked = selected.status === "pending";

    // Detect delivery content in messages
    const deliveryMsg = chat.find((m) => m.text.startsWith("📦 Entrega:") || m.text.includes("ENTREGA_AUTO:"));

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

        {/* Delivery preview badge */}
        {selected.status === "delivered" && selectedProduct.deliveryType === "auto" && selectedProduct.deliveryContent && (
          <div className="glass-card p-4 mb-4 border-2 border-success/30 bg-success/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-success uppercase bg-success/10 px-2 py-0.5 rounded-full">📦 Produto Entregue</span>
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-xl p-3">
              <p className="flex-1 text-sm text-foreground font-mono break-all">{selectedProduct.deliveryContent}</p>
              <button onClick={() => { navigator.clipboard.writeText(selectedProduct.deliveryContent || ""); toast.success("Copiado!"); }} className="shrink-0 p-1.5 hover:bg-card rounded-lg">
                <Copy className="w-4 h-4 text-muted-foreground" />
              </button>
              {selectedProduct.deliveryContent.startsWith("http") && (
                <a href={selectedProduct.deliveryContent} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 hover:bg-card rounded-lg">
                  <ExternalLink className="w-4 h-4 text-primary" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Feedback section at top for delivered+not reviewed */}
        {selected.status === "delivered" && !selected.reviewed && !showReview && (
          <div className="glass-card p-5 mb-4 border-2 border-primary/20 bg-primary/5">
            <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
              <StarEmoji className="w-5 h-5" /> Deixe sua avaliação!
            </h4>
            <p className="text-xs text-muted-foreground mb-3">Seu feedback ajuda outros compradores e o vendedor.</p>
            <Button onClick={() => setShowReview(true)} className="btn-gradient w-full">
              <StarEmoji className="w-4 h-4" /> Avaliar Produto
            </Button>
          </div>
        )}

        {/* Review form */}
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

        {/* Already reviewed */}
        {selected.reviewed && (
          <div className="glass-card p-4 mb-4 bg-success/5 border border-success/20">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-success">Sua avaliação</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <StarEmoji key={s} className="w-3.5 h-3.5" filled={s <= (selected.reviewStars || 0)} />
                ))}
              </div>
            </div>
            <p className="text-sm text-foreground">{selected.reviewComment}</p>
          </div>
        )}

        {/* Chat messages */}
        <div className="glass-card p-4 mb-4 min-h-[250px] max-h-[400px] overflow-y-auto flex flex-col gap-2">
          {isChatLocked && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Lock className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground font-medium">Finalize o pagamento para conversar.</p>
            </div>
          )}
          {!isChatLocked && chat.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem ainda. Inicie a conversa!</p>
          )}
          {!isChatLocked && chat.map((m, i) => {
            const isMe = m.from === state.currentUser!.email;
            const isImage = m.text.startsWith("data:image/");
            const isFile = !isImage && m.text.startsWith("data:");
            const fileName = isFile ? (m.text.match(/data:([^;]+)/)?.[1] || "arquivo") : "";
            return (
              <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"}`}>
                  {isImage ? (
                    <img src={m.text} alt="Imagem" className="max-w-full max-h-48 rounded-lg cursor-pointer" onClick={() => window.open(m.text, "_blank")} />
                  ) : isFile ? (
                    <a href={m.text} download={`arquivo.${fileName.split("/")[1] || "bin"}`} className="flex items-center gap-2 underline">
                      📎 Baixar arquivo ({fileName.split("/")[1] || "arquivo"})
                    </a>
                  ) : (
                    <p>{m.text}</p>
                  )}
                  <p className={`text-[10px] mt-1 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(m.date).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message input */}
        {!isChatLocked ? (
          <div className="glass-card p-3 mb-4">
            {/* Image preview */}
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                {imagePreview.startsWith("data:image/") ? (
                  <img src={imagePreview} alt="Preview" className="max-h-24 rounded-lg" />
                ) : (
                  <div className="bg-muted rounded-lg px-3 py-2 text-xs text-foreground">📎 Arquivo selecionado</div>
                )}
                <button onClick={() => setImagePreview(null)} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">×</button>
              </div>
            )}
            <div className="flex gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf,.doc,.docx,.txt,.zip,.rar,.xlsx,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) {
                    toast.error("Arquivo muito grande! Máximo 5MB.");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => setImagePreview(reader.result as string);
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-xl hover:bg-muted transition shrink-0" title="Enviar imagem">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </button>
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Digite sua mensagem..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <Button size="icon" onClick={() => {
                if (imagePreview && selected) {
                  sendPurchaseMessage(selected.id, state.currentUser!.email, imagePreview);
                  setImagePreview(null);
                  toast.success("Imagem enviada!");
                } else {
                  handleSend();
                }
              }} className="btn-gradient shrink-0 w-9 h-9">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="glass-card p-3 mb-4 text-center">
            <p className="text-xs text-muted-foreground font-medium">💳 Finalize o pagamento para desbloquear o chat.</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 flex-wrap">
          {selected.status === "paid" && !selected.reviewed && (
            <Button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1">
              ✓ Confirmar Entrega
            </Button>
          )}
          {selected.status === "paid" && (
            <Button variant="destructive" onClick={() => setShowDisputeConfirm(true)} className="flex-1">
              <ShieldEmoji className="w-4 h-4" /> Abrir Disputa
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowSupportConfirm(true)} className="flex-1">
            <ChatEmoji className="w-4 h-4" /> Chamar Suporte
          </Button>
        </div>

        {/* Support confirmation dialog */}
        {showSupportConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowSupportConfirm(false)}>
            <div className="glass-card w-full max-w-sm p-6 bg-card animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-foreground mb-2">Chamar Suporte?</h3>
              <p className="text-sm text-muted-foreground mb-4">Tem certeza que quer chamar o suporte? Isso abrirá um chat de ajuda.</p>
              <div className="flex gap-2">
                <button onClick={handleCallSupport} className="flex-1 btn-gradient py-2.5 rounded-xl text-sm font-bold">Sim, chamar</button>
                <button onClick={() => setShowSupportConfirm(false)} className="flex-1 border border-border py-2.5 rounded-xl text-sm font-bold text-muted-foreground">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Dispute confirmation dialog */}
        {showDisputeConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowDisputeConfirm(false)}>
            <div className="glass-card w-full max-w-sm p-6 bg-card animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-foreground mb-2">Abrir Disputa?</h3>
              <p className="text-sm text-muted-foreground mb-4">Ao abrir disputa, um admin irá analisar o caso e poderá reverter o pagamento se necessário.</p>
              <div className="flex gap-2">
                <button onClick={handleDispute} className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-xl text-sm font-bold">Sim, abrir disputa</button>
                <button onClick={() => setShowDisputeConfirm(false)} className="flex-1 border border-border py-2.5 rounded-xl text-sm font-bold text-muted-foreground">Cancelar</button>
              </div>
            </div>
          </div>
        )}
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
                  {purchase.reviewed && <span className="text-[10px] text-success font-bold flex items-center gap-0.5"><StarEmoji className="w-3 h-3" /> Avaliado</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
