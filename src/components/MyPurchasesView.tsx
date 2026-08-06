import React, { useState, useEffect } from "react";
import { useStore, Purchase } from "@/store/StoreContext";
import { ShoppingBagEmoji, StarEmoji } from "@/components/CustomEmojis";
import { Search, ShieldAlert, Copy, ArrowLeft, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OrderChat from "@/components/OrderChat";
import PixPaymentModal, { PixCharge } from "@/components/PixPaymentModal";
import { supabase } from "@/integrations/supabase/client";

const statusMap: Record<Purchase["status"], { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  paid: { label: "Pago", cls: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  delivered: { label: "Entregue", cls: "bg-primary/20 text-primary border-primary/30" },
  dispute: { label: "Disputa", cls: "bg-destructive/20 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
};

export default function MyPurchasesView({ initialSelectedId }: { initialSelectedId?: number | null }) {
  const { state, confirmDelivery, openDispute, reviewPurchase, savePixCharge, markPurchasePaid } = useStore();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId || null);

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [loadingPix, setLoadingPix] = useState<number | null>(null);

  const visiblePurchases = state.currentUser?.isAdmin
    ? state.purchases
    : state.purchases.filter((p) => p.buyerEmail === state.currentUser?.email);
  const filtered = visiblePurchases.filter((p) => {
    const product = state.products.find((pr) => pr.id === p.productId);
    return product?.name.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const selected = selectedId ? state.purchases.find((p) => p.id === selectedId) : null;
  const selectedProduct = selected ? state.products.find((p) => p.id === selected.productId) : null;

  const handlePayPix = async (purchase: Purchase, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!state.currentUser) return;
    const product = state.products.find((p) => p.id === purchase.productId);
    const expired = purchase.pixExpiresAt ? new Date(purchase.pixExpiresAt).getTime() < Date.now() : true;
    setResumeId(purchase.id);
    // Reuse existing valid QR
    if (purchase.pixQrCode && purchase.evopayChargeId && !expired) {
      setPixCharge({ evopayId: purchase.evopayChargeId, qrCodeText: purchase.pixQrCode, amount: purchase.amount });
      return;
    }
    // Generate a new Pix
    setLoadingPix(purchase.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-evopay-pix", {
        body: {
          purchaseId: purchase.id,
          productName: purchase.variationName ? `${product?.name} - ${purchase.variationName}` : product?.name,
          amount: purchase.amount,
          buyerEmail: state.currentUser.email,
          buyerName: state.currentUser.name,
        },
      });
      if (error) throw error;
      if (data?.qrCodeText) {
        savePixCharge(purchase.id, { evopayId: data.id, qrCodeText: data.qrCodeText, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() });
        setPixCharge({ evopayId: data.id, qrCodeText: data.qrCodeText, amount: data.amount ?? purchase.amount });
      } else {
        toast.error("Erro ao gerar PIX. Tente novamente.");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar PIX: " + (err.message || "tente novamente"));
    } finally {
      setLoadingPix(null);
    }
  };

  const handlePixPaid = () => {
    if (resumeId != null) markPurchasePaid(resumeId);
    toast.success("Pagamento confirmado!");
  };

  const handleDispute = async () => {
    if (!disputeReason.trim() || !selectedId) {
      toast.error("Por favor, descreva o motivo da disputa.");
      return;
    }
    const ok = await openDispute(selectedId, disputeReason.trim());
    if (!ok) return toast.error("Não foi possível abrir a disputa neste estado do pedido.");
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

  const handleConfirm = async () => {
    if (!selectedId) return;
    const ok = await confirmDelivery(selectedId);
    if (!ok) return toast.error("Não foi possível confirmar a entrega.");
    toast.success("Entrega confirmada!");
    setShowReview(true);
  };

  if (selected && selectedProduct) {
    const isChatLocked = selected.status === "pending" || selected.status === "cancelled";

    return (
      <div className="animate-fade-in-up max-w-2xl mx-auto">
        <button onClick={() => { setSelectedId(null); setShowReview(false); }} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="glass-card p-5 mb-4 flex gap-4 items-center">
          <img src={selectedProduct.image} className="w-16 h-16 rounded-2xl object-cover" alt={selectedProduct.name} />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground truncate">{selectedProduct.name}</h3>
            <p className="text-xs text-muted-foreground">
              {state.currentUser?.isAdmin
                ? `Comprador: ${selected.buyerEmail} · Vendedor: ${selected.sellerEmail}`
                : <>Vendedor: <span className="text-primary font-semibold">{selectedProduct.seller}</span></>}
            </p>
            <p className="text-sm font-black text-foreground mt-0.5">R$ {selected.amount.toFixed(2)}</p>
          </div>
          <Badge className={statusMap[selected.status].cls}>{statusMap[selected.status].label}</Badge>
        </div>

        {/* Pending: pay with Pix */}
        {selected.status === "pending" && (
          <div className="glass-card p-4 mb-4 border-2 border-yellow-500/30 bg-yellow-500/5">
            <p className="text-sm text-foreground mb-3">Seu pedido está aguardando pagamento.</p>
            <Button onClick={(e) => handlePayPix(selected, e)} disabled={loadingPix === selected.id} className="w-full btn-gradient font-bold">
              <QrCode className="w-4 h-4 mr-2" />
              {loadingPix === selected.id ? "Gerando..." : (selected.pixQrCode && selected.pixExpiresAt && new Date(selected.pixExpiresAt).getTime() > Date.now() ? "Pagar com Pix" : "Gerar novo Pix")}
            </Button>
          </div>
        )}

        {/* Delivery Info */}
        {(selected.status === "delivered" || selected.status === "paid") && (
          <div className="glass-card p-4 mb-4 border-2 border-success/30 bg-success/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-success uppercase bg-success/10 px-2 py-0.5 rounded-full">📦 Informações de Entrega</span>
            </div>
            {selectedProduct.deliveryType === "auto" && selectedProduct.deliveryContent ? (
              <div className="flex items-center gap-2 bg-muted rounded-xl p-3">
                <p className="flex-1 text-sm text-foreground font-mono break-all">{selectedProduct.deliveryContent}</p>
                <button onClick={() => { navigator.clipboard.writeText(selectedProduct.deliveryContent || ""); toast.success("Copiado!"); }} className="shrink-0 p-1.5 hover:bg-card rounded-lg">
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <p className="text-sm text-foreground">Aguardando o vendedor entregar. Combine pelo chat abaixo.</p>
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
          {!state.currentUser?.isAdmin && !isChatLocked && (
            <button onClick={() => setShowDisputeForm(true)} className="text-[10px] font-bold text-destructive uppercase hover:underline">
              Abrir Disputa
            </button>
          )}
        </div>
        <OrderChat orderId={selected.id} locked={isChatLocked} />

        <PixPaymentModal charge={pixCharge} onClose={() => setPixCharge(null)} onPaid={handlePixPaid} />


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
