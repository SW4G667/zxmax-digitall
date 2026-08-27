import React, { useState, useEffect, useCallback, useRef } from "react";
import { useStore, Purchase } from "@/store/StoreContext";
import { ShoppingBagEmoji, StarEmoji } from "@/components/CustomEmojis";
import { Search, ShieldAlert, Copy, ArrowLeft, QrCode, MessageSquare, Eye, PackageCheck, CircleDot, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OrderChat from "@/components/OrderChat";
import PixPaymentModal, { PixCharge } from "@/components/PixPaymentModal";
import { supabase } from "@/integrations/supabase/client";
import { unwrapEdgeCall } from "@/lib/edgeErrors";
import { useAuth } from "@/hooks/useAuth";

const statusMap: Record<Purchase["status"], { label: string; cls: string }> = {
  pending: { label: "Aguardando pagamento", cls: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  paid: { label: "Pago", cls: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  delivered_pending_confirmation: { label: "Entregue (Aguardando comprador)", cls: "bg-primary/20 text-primary border-primary/30" },
  delivered: { label: "Concluído", cls: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  dispute: { label: "Em disputa", cls: "bg-destructive/20 text-destructive border-destructive/30" },
  cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
  refunded: { label: "Reembolsado", cls: "bg-amber-500/20 text-amber-500 border-amber-500/30" },
};

function StageStepper({ status }: { status: Purchase["status"] }) {
  if (status === "cancelled" || status === "dispute" || status === "refunded") return null;

  const donePaid = status !== "pending";
  const doneDelivered = status === "delivered_pending_confirmation" || status === "delivered";
  const doneConcluded = status === "delivered";

  return (
    <div className="flex items-center gap-1 mt-2">
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <div className={`flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-black shrink-0 ${donePaid ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
          {donePaid ? <CheckCircle2 className="w-3 h-3" /> : "1"}
        </div>
        <span className={`text-[10px] font-bold truncate ${donePaid ? "text-foreground" : "text-muted-foreground"}`}>Pago</span>
        <div className={`h-[2px] flex-1 rounded-full ${doneDelivered ? "bg-primary" : "bg-border"}`} />
      </div>
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <div className={`flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-black shrink-0 ${doneDelivered ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
          {doneDelivered ? <CheckCircle2 className="w-3 h-3" /> : "2"}
        </div>
        <span className={`text-[10px] font-bold truncate ${doneDelivered ? "text-foreground" : "text-muted-foreground"}`}>Entregue</span>
        <div className={`h-[2px] flex-1 rounded-full ${doneConcluded ? "bg-primary" : "bg-border"}`} />
      </div>
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <div className={`flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-black shrink-0 ${doneConcluded ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
          {doneConcluded ? <CheckCircle2 className="w-3 h-3" /> : "3"}
        </div>
        <span className={`text-[10px] font-bold truncate ${doneConcluded ? "text-foreground" : "text-muted-foreground"}`}>Concluído</span>
      </div>
    </div>
  );
}

export default function MyPurchasesView({ initialSelectedId }: { initialSelectedId?: number | null }) {
  const { state, confirmDelivery, openDispute, reviewPurchase, savePixCharge, refreshPurchases } = useStore();
  const { sessionReady } = useAuth();
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
  const [syncState, setSyncState] = useState<"loading" | "ready" | "error">("loading");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [orderScope, setOrderScope] = useState<"all" | "purchases" | "sales">("all");
  const refreshPurchasesRef = useRef(refreshPurchases);
  refreshPurchasesRef.current = refreshPurchases;

  const refreshOrderList = useCallback(async (notify = false) => {
    if (!sessionReady) {
      setSyncState("loading");
      return;
    }
    setSyncState("loading");
    setSyncMessage(null);
    const result = await refreshPurchasesRef.current();
    if (!result.ok) {
      setSyncState("error");
      setSyncMessage(result.message || "Não foi possível atualizar seus pedidos agora.");
      if (notify) toast.error("Não foi possível atualizar seus pedidos.");
      return;
    }
    setSyncState("ready");
    if (notify) toast.success("Pedidos atualizados.");
  }, [sessionReady]);

  // Segunda camada de defesa: a tela também atualiza ao ser aberta. Isso cobre
  // navegação direta para /minhas-compras após o SDK terminar de restaurar o JWT.
  useEffect(() => {
    void refreshOrderList();
  }, [refreshOrderList]);

  const visiblePurchases = state.currentUser?.isAdmin
    ? state.purchases
    : state.purchases.filter(
        (p) => p.buyerId === state.currentUser?.id || p.sellerId === state.currentUser?.id
      );
  const myPurchases = visiblePurchases.filter((p) => p.buyerId === state.currentUser?.id);
  const mySales = visiblePurchases.filter((p) => p.sellerId === state.currentUser?.id);
  const scopedPurchases = orderScope === "purchases"
    ? myPurchases
    : orderScope === "sales"
      ? mySales
      : visiblePurchases;
  const availableScopes = [
    { id: "all" as const, label: state.currentUser?.isAdmin ? "Todos" : "Todos", count: visiblePurchases.length },
    ...(myPurchases.length ? [{ id: "purchases" as const, label: "Compras", count: myPurchases.length }] : []),
    ...(mySales.length ? [{ id: "sales" as const, label: "Vendas", count: mySales.length }] : []),
  ];
  const q = search.trim().toLowerCase();
  const filtered = scopedPurchases.filter((p) => {
    if (!q) return true;
    // Procura no nome do produto, ID e variação. O e-mail só integra a busca
    // administrativa; participantes não precisam dele para localizar pedidos.
    const product = state.products.find((pr) => pr.id === p.productId);
    const hay = [
      product?.name || "",
      String(p.id),
      p.variationName || "",
      String(p.buyerPublicId || ""),
      String(p.sellerPublicId || ""),
    ].join(" ").toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const purchaseSummary = scopedPurchases.reduce(
    (summary, purchase) => {
      summary.total += 1;
      if (purchase.status === "pending") summary.pending += 1;
      if (["paid", "delivered_pending_confirmation"].includes(purchase.status)) summary.inProgress += 1;
      if (purchase.status === "delivered") summary.done += 1;
      return summary;
    },
    { total: 0, pending: 0, inProgress: 0, done: 0 },
  );

  const selected = selectedId ? state.purchases.find((p) => p.id === selectedId) : null;
  const selectedProduct = selected ? state.products.find((p) => p.id === selected.productId) : null;
  const selectedAsSeller = !!selected && selected.sellerId === state.currentUser?.id;
  const selectedBuyer = selected ? state.userDirectory?.[selected.buyerId] : undefined;
  const selectedCounterparty = selected
    ? (selectedAsSeller
      ? `Comprador: ${selectedBuyer?.name || "Usuário"} · #${selected.buyerPublicId || "—"}`
      : `Vendedor: ${selectedProduct?.seller || "—"}`)
    : "";

  const handlePayPix = async (purchase: Purchase, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!state.currentUser) return;
    const provider = purchase.paymentProvider || "zennith_pix";
    if (provider !== "zennith_pix" && provider !== "vexopay_pix") {
      toast.error("Este pedido não pode ser retomado como PIX. Volte ao método de pagamento original.");
      return;
    }
    const product = state.products.find((p) => p.id === purchase.productId);
    const expired = purchase.pixExpiresAt ? new Date(purchase.pixExpiresAt).getTime() < Date.now() : true;
    setResumeId(purchase.id);
    // Reuse existing valid QR
    if (purchase.pixQrCode && purchase.evopayChargeId && !expired) {
      setPixCharge({ evopayId: purchase.evopayChargeId, qrCodeText: purchase.pixQrCode, amount: purchase.amount, purchaseId: purchase.id });
      return;
    }
    // Generate a new Pix
    setLoadingPix(purchase.id);
    try {
      const res = await unwrapEdgeCall<{ id: string; qrCodeText: string; qrCodeUrl?: string; expiresAt?: string; amount?: number }>(
        await supabase.functions.invoke(
          provider === "vexopay_pix" ? "create-evopay-pix" : "create-zennith-pix",
          {
            body: provider === "vexopay_pix"
              ? { purchaseId: purchase.id }
              : {
                purchaseId: purchase.id,
                productName: purchase.variationName ? `${product?.name} - ${purchase.variationName}` : product?.name,
              },
          },
        ),
        "Erro ao gerar PIX.",
      );
      if (res.errorMessage) {
        if (res.status === 404 || /not found/i.test(res.errorMessage)) {
          throw new Error("PIX temporariamente indisponível. Avise o suporte.");
        }
        throw new Error(res.errorMessage);
      }
      const data = res.data;
      if (data?.qrCodeText) {
        savePixCharge(purchase.id, { evopayId: data.id, qrCodeText: data.qrCodeText, expiresAt: data.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString() });
        setPixCharge({ evopayId: data.id, qrCodeText: data.qrCodeText, amount: data.amount ?? purchase.amount, qrCodeUrl: data.qrCodeUrl, purchaseId: purchase.id });
      } else {
        toast.error("Erro ao gerar PIX. Tente novamente.");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar PIX: " + (err.message || "tente novamente"));
    } finally {
      setLoadingPix(null);
    }
  };

  const handlePixPaid = async () => {
    void refreshPurchases();
    toast.success("Pagamento confirmado. Atualizando o pedido...");
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

  const handleReview = async () => {
    if (!selectedId || !comment.trim()) {
      toast.error("Por favor, escreva um comentário.");
      return;
    }
    const ok = await reviewPurchase(selectedId, rating, comment);
    if (ok) {
      toast.success("Avaliação enviada!");
      setShowReview(false);
    }
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
                ? `Comprador #${selected.buyerPublicId || "—"} · Vendedor #${selected.sellerPublicId || "—"}`
                : selectedAsSeller
                  ? selectedCounterparty
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
      <div className="mb-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-4xl font-black text-foreground">Meus pedidos</h1>
              <ShoppingBagEmoji className="w-8 h-8" />
            </div>
            <p className="text-muted-foreground">Acompanhe suas compras e vendas, com status, entrega e chat protegido por pedido.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshOrderList(true)} disabled={syncState === "loading"} className="shrink-0 gap-2">
            {syncState === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5" aria-label="Resumo dos pedidos">
        {[
          ["Total", purchaseSummary.total, "text-foreground"],
          ["Aguardando pagamento", purchaseSummary.pending, "text-yellow-600 dark:text-yellow-400"],
          ["Em andamento", purchaseSummary.inProgress, "text-primary"],
          ["Concluídos", purchaseSummary.done, "text-emerald-600 dark:text-emerald-400"],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-2xl border border-border/50 bg-card/70 px-4 py-3">
            <p className="text-[10px] uppercase tracking-wide font-bold text-muted-foreground truncate">{label}</p>
            <p className={`mt-1 text-2xl leading-none font-black ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {syncState === "error" && (
        <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="font-bold text-sm text-foreground">Não foi possível sincronizar os pedidos agora.</p>
            <p className="mt-1 text-xs text-muted-foreground">{syncMessage} A lista anterior foi preservada. Tente atualizar novamente.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refreshOrderList(true)} className="shrink-0">Tentar de novo</Button>
        </div>
      )}

      {availableScopes.length > 1 && (
        <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Tipo de pedido">
          {availableScopes.map((scope) => {
            const active = orderScope === scope.id;
            return (
              <button
                key={scope.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setOrderScope(scope.id)}
                className={`shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30"}`}
              >
                {scope.label} <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-primary/20" : "bg-muted"}`}>{scope.count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-card rounded-2xl px-4 py-3 mb-8 border border-border/40 flex items-center gap-3">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome do produto..." className="bg-transparent border-none focus:ring-0 outline-none text-sm w-full text-foreground" />
      </div>

      <div className="grid gap-4">
        {syncState === "loading" && scopedPurchases.length === 0 && (
          <div className="glass-card p-8 flex items-center gap-3 text-muted-foreground" role="status">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm font-medium">Sincronizando seus pedidos com segurança...</span>
          </div>
        )}
        {filtered.map((p) => {
          const prod = state.products.find((pr) => pr.id === p.productId);
          const buyer = state.userDirectory?.[p.buyerId];
          return (
            <div key={p.id} className="glass-card p-4 sm:p-5 hover:border-primary/40 transition">
              <div className="flex items-start gap-4">
                <img src={prod?.image} className="w-16 h-16 rounded-lg object-cover shrink-0" alt="" />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-foreground truncate">{prod?.name}</h4>
                      {p.variationName && <p className="text-[10px] text-primary font-bold">Opção: {p.variationName}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">Pedido #{p.id} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}</p>
                      {p.sellerId === state.currentUser?.id && <p className="text-[11px] text-primary mt-1">Comprador: {buyer?.name || "Usuário"} · #{p.buyerPublicId || "—"}</p>}
                    </div>
                    <Badge className={`${statusMap[p.status].cls} shrink-0`}>{statusMap[p.status].label}</Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
                    <p className="text-sm font-black text-foreground">R$ {p.amount.toFixed(2)}</p>
                    <div className="flex items-center gap-2">
                      {p.status === "pending" ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePayPix(p, e); }}
                          disabled={loadingPix === p.id}
                          className="btn-gradient px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
                        >
                          <QrCode className="w-3.5 h-3.5" /> {loadingPix === p.id ? "Gerando..." : "Pagar Pix"}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition flex items-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Chat
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedId(p.id)}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detalhes
                      </button>
                    </div>
                  </div>
                  {p.status !== "cancelled" && p.status !== "dispute" && (
                    <div className="mt-3 max-w-md">
                      <StageStepper status={p.status} />
                    </div>
                  )}
                  {p.status === "dispute" && (
                    <p className="mt-2 text-[11px] font-bold text-destructive flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5" /> Disputa em análise pela equipe.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {syncState !== "loading" && filtered.length === 0 && (
          <div className="text-center py-20 bg-card rounded-3xl border-2 border-dashed border-border">
            <p className="text-3xl mb-3">🛍️</p>
            <p className="text-muted-foreground font-medium">{search ? "Nenhum pedido corresponde à sua busca." : orderScope === "sales" ? "Você ainda não tem vendas neste perfil." : orderScope === "purchases" ? "Você ainda não tem compras neste perfil." : "Você ainda não tem pedidos vinculados a esta conta."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
