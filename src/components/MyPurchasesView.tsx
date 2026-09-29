import React, { useState, useEffect, useCallback, useRef } from "react";
import { useStore, Purchase } from "@/store/StoreContext";
import { ShoppingBagEmoji, StarEmoji } from "@/components/CustomEmojis";
import { Search, ShieldAlert, Copy, ArrowLeft, QrCode, MessageSquare, Eye, PackageCheck, CircleDot, CheckCircle2, Loader2, RefreshCw, CreditCard, WalletCards, Bitcoin, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OrderChat from "@/components/OrderChat";
import PixPaymentModal, { PixCharge } from "@/components/PixPaymentModal";
import CryptoPaymentModal, { CryptoCharge } from "@/components/CryptoPaymentModal";
import { supabase } from "@/integrations/supabase/client";
import { unwrapEdgeCall } from "@/lib/edgeErrors";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL } from "@/lib/catalog";

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

export default function MyPurchasesView({ initialSelectedId, initialScope = "all" }: { initialSelectedId?: number | null; initialScope?: "all" | "purchases" | "sales" }) {
  const { state, confirmDelivery, openDispute, reviewPurchase, savePixCharge, refreshPurchases, sellerRefundOrder } = useStore();
  const { sessionReady } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId || null);

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);
  useEffect(() => {
    setOrderScope(initialScope);
  }, [initialScope]);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);
  const [cryptoCharge, setCryptoCharge] = useState<CryptoCharge | null>(null);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [loadingPix, setLoadingPix] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending" | "cancelled" | "dispute">("all");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [syncState, setSyncState] = useState<"loading" | "ready" | "error">("loading");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [orderScope, setOrderScope] = useState<"all" | "purchases" | "sales">(initialScope);
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
  const statusFiltered = scopedPurchases.filter((purchase) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "approved") return ["paid", "delivered_pending_confirmation", "delivered"].includes(purchase.status);
    if (statusFilter === "pending") return purchase.status === "pending";
    if (statusFilter === "cancelled") return ["cancelled", "refunded"].includes(purchase.status);
    return purchase.status === "dispute";
  });
  const q = search.trim().toLowerCase();
  const filtered = statusFiltered.filter((p) => {
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
      summary.amount += Number.isFinite(purchase.amount) ? purchase.amount : 0;
      return summary;
    },
    { total: 0, pending: 0, inProgress: 0, done: 0, amount: 0 },
  );

  const selected = selectedId ? state.purchases.find((p) => p.id === selectedId) : null;
  const selectedProduct = selected ? state.products.find((p) => p.id === selected.productId) : null;
  const selectedAsSeller = !!selected && selected.sellerId === state.currentUser?.id;
  const automaticDeliveryMessage = selected?.messages
    ?.slice()
    .reverse()
    .find((message) => typeof message?.text === "string" && message.text.startsWith("📦 ENTREGA AUTOMÁTICA"));
  const automaticDeliveryContent = automaticDeliveryMessage?.text
    ?.replace(/^📦 ENTREGA AUTOMÁTICA\s*/u, "")
    .trim() || "";
  const automaticDeliveryWarning = selected?.messages
    ?.slice()
    .reverse()
    .find((message) => typeof message?.text === "string" && message.text.startsWith("⚠️ Pagamento confirmado"));
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
    if (provider !== "magnuspay_pix" && provider !== "zennith_pix" && provider !== "vexopay_pix") {
      toast.error("Este pedido não pode ser retomado como PIX. Volte ao método de pagamento original.");
      return;
    }
    const product = state.products.find((p) => p.id === purchase.productId);
    const expired = purchase.pixExpiresAt ? new Date(purchase.pixExpiresAt).getTime() < Date.now() : true;
    setResumeId(purchase.id);
    // Reuse existing valid QR
    if (purchase.pixQrCode && purchase.evopayChargeId && !expired) {
      setPixCharge({ evopayId: purchase.evopayChargeId, provider, qrCodeText: purchase.pixQrCode, amount: purchase.amount, purchaseId: purchase.id });
      return;
    }
    // Generate a new Pix
    setLoadingPix(purchase.id);
    try {
      const res = await unwrapEdgeCall<{ id: string; qrCodeText: string; qrCodeUrl?: string; expiresAt?: string; amount?: number }>(
        await supabase.functions.invoke(
          provider === "magnuspay_pix"
            ? "create-magnuspay-pix"
            : provider === "vexopay_pix"
              ? "create-evopay-pix"
              : "create-zennith-pix",
          {
            body: provider === "zennith_pix"
              ? {
                purchaseId: purchase.id,
                productName: purchase.variationName ? `${product?.name} - ${purchase.variationName}` : product?.name,
              }
              : { purchaseId: purchase.id },
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
        setPixCharge({ evopayId: data.id, provider, qrCodeText: data.qrCodeText, amount: data.amount ?? purchase.amount, qrCodeUrl: data.qrCodeUrl, purchaseId: purchase.id });
      } else {
        toast.error("Erro ao gerar PIX. Tente novamente.");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar PIX: " + (err.message || "tente novamente"));
    } finally {
      setLoadingPix(null);
    }
  };

  const paymentLabel = (purchase: Purchase) => {
    const provider = purchase.paymentProvider || "";
    if (provider === "card") return "Pagar com cartão";
    if (provider === "boleto") return "Gerar boleto";
    if (provider === "crypto") return "Pagar com cripto";
    if (provider === "wallet") return "Pagar com saldo";
    return purchase.pixQrCode && purchase.pixExpiresAt && new Date(purchase.pixExpiresAt).getTime() > Date.now()
      ? "Abrir PIX"
      : "Gerar PIX";
  };

  const handleResumePayment = async (purchase: Purchase, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const provider = purchase.paymentProvider || "";
    if (["magnuspay_pix", "zennith_pix", "vexopay_pix"].includes(provider)) {
      await handlePayPix(purchase, event);
      return;
    }

    const product = state.products.find((item) => item.id === purchase.productId);
    setLoadingPix(purchase.id);
    try {
      if (provider === "card" || provider === "boleto") {
        const result = await unwrapEdgeCall<{ url?: string }>(
          await supabase.functions.invoke("create-stripe-checkout", {
            body: { purchaseId: purchase.id, productName: product?.name || "Pedido ZXMAX", paymentMethod: provider },
          }),
          "Não foi possível retomar o pagamento.",
        );
        if (result.errorMessage || !result.data?.url) throw new Error(result.errorMessage || "O checkout não retornou um link.");
        window.location.href = result.data.url;
        return;
      }

      if (provider === "wallet") {
        const { data, error } = await (supabase as any).rpc("pay_purchase_with_wallet", { _purchase_id: purchase.id });
        if (error || !data?.success) throw new Error(error?.message || "Não foi possível pagar com o saldo.");
        await refreshPurchases();
        toast.success("Pagamento com saldo confirmado.");
        return;
      }

      if (provider === "crypto") {
        const result = await unwrapEdgeCall<{ id?: string; address?: string; qrCode?: string; amount?: number; network?: string; expiresAt?: string }>(
          await supabase.functions.invoke("create-vexopay-crypto", {
            body: { purchaseId: purchase.id, network: "TRC20", description: product?.name || "Pedido ZXMAX" },
          }),
          "Não foi possível retomar a cobrança em cripto.",
        );
        if (result.errorMessage || !result.data?.address) throw new Error(result.errorMessage || "O provedor não retornou a carteira.");
        setCryptoCharge({
          id: String(result.data.id || ""),
          address: String(result.data.address),
          amount: purchase.amount,
          cryptoAmount: result.data.amount,
          qrCode: result.data.qrCode,
          network: String(result.data.network || "TRC20"),
          expiresAt: result.data.expiresAt,
          purchaseId: purchase.id,
        });
        return;
      }

      throw new Error("A forma de pagamento original deste pedido não pode ser retomada automaticamente.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível retomar o pagamento.");
    } finally {
      setLoadingPix(null);
    }
  };

  const handlePixPaid = async () => {
    void refreshPurchases();
    toast.success("Pagamento confirmado. Atualizando o pedido...");
  };

  const handleSellerRefund = async () => {
    if (!selected || !selectedAsSeller) return;
    const reason = refundReason.trim();
    if (reason.length < 10) return toast.error("Explique o motivo do reembolso com pelo menos 10 caracteres.");
    setRefundBusy(true);
    const result = await sellerRefundOrder(selected.id, reason);
    setRefundBusy(false);
    if (!result.success) return toast.error(result.error || "Não foi possível concluir o reembolso.");
    setRefundOpen(false);
    setRefundReason("");
    toast.success("Reembolso enviado para a carteira ZXMAX do comprador.");
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

        {/* Pending: always resume the ORIGINAL payment method. */}
        {selected.status === "pending" && !selectedAsSeller && (
          <div className="glass-card p-4 mb-4 border-2 border-yellow-500/30 bg-yellow-500/5">
            <p className="text-sm text-foreground mb-1">Seu pedido está aguardando pagamento.</p>
            <p className="text-xs text-muted-foreground mb-3">Método original: {selected.paymentProvider === "card" ? "Cartão" : selected.paymentProvider === "boleto" ? "Boleto" : selected.paymentProvider === "crypto" ? "Cripto" : selected.paymentProvider === "wallet" ? "Saldo ZXMAX" : "PIX"}.</p>
            <Button onClick={(event) => void handleResumePayment(selected, event)} disabled={loadingPix === selected.id} className="w-full btn-gradient font-bold">
              {selected.paymentProvider === "card" ? <CreditCard className="w-4 h-4 mr-2" /> : selected.paymentProvider === "wallet" ? <WalletCards className="w-4 h-4 mr-2" /> : selected.paymentProvider === "crypto" ? <Bitcoin className="w-4 h-4 mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
              {loadingPix === selected.id ? "Preparando..." : paymentLabel(selected)}
            </Button>
          </div>
        )}

        {/* Delivery Info */}
        {(selected.status === "delivered" || selected.status === "paid") && (
          <div className="glass-card p-4 mb-4 border-2 border-success/30 bg-success/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-success uppercase bg-success/10 px-2 py-0.5 rounded-full">📦 Informações de Entrega</span>
            </div>
            {automaticDeliveryContent ? (
              <div className="rounded-xl border border-success/20 bg-background/45 p-3">
                <div className="flex items-start gap-2">
                  <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-sm text-foreground">{automaticDeliveryContent}</pre>
                  <button onClick={() => { navigator.clipboard.writeText(automaticDeliveryContent); toast.success("Entrega copiada!"); }} className="shrink-0 rounded-lg p-2 hover:bg-card" aria-label="Copiar entrega automática">
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-4 text-muted-foreground">Este conteúdo pertence somente a este pedido pago. Se houver mais de uma unidade, cada item entregue aparece em uma linha.</p>
              </div>
            ) : automaticDeliveryWarning ? (
              <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
                <p className="text-sm text-foreground">{automaticDeliveryWarning.text.replace(/^⚠️\s*/u, "")}</p>
              </div>
            ) : (
              <p className="text-sm text-foreground">Aguardando a entrega do vendedor. Use o chat do pedido para acompanhar.</p>
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
        <div className="flex items-center justify-between gap-3 mb-2 px-1">
          <h4 className="text-xs font-bold text-muted-foreground uppercase">Chat do pedido</h4>
          <div className="flex items-center gap-3">
            {selectedAsSeller && !isChatLocked && !["refunded", "cancelled"].includes(selected.status) && (
              <button onClick={() => setRefundOpen(true)} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500 uppercase hover:underline">
                <RotateCcw className="h-3 w-3" /> Reembolsar
              </button>
            )}
            {!state.currentUser?.isAdmin && !selectedAsSeller && !isChatLocked && (
              <button onClick={() => setShowDisputeForm(true)} className="text-[10px] font-bold text-destructive uppercase hover:underline">
                Abrir Disputa
              </button>
            )}
          </div>
        </div>
        <OrderChat orderId={selected.id} locked={isChatLocked} />

        <PixPaymentModal charge={pixCharge} onClose={() => setPixCharge(null)} onPaid={handlePixPaid} />
        <CryptoPaymentModal charge={cryptoCharge} onClose={() => setCryptoCharge(null)} onPaid={handlePixPaid} />

        {refundOpen && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setRefundOpen(false)}>
            <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111116] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-400">Reembolso do vendedor</p>
                  <h3 className="mt-1 text-lg font-black text-white">Reembolsar pedido #{selected.id}</h3>
                </div>
                <button type="button" onClick={() => setRefundOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-white/45 hover:text-white" aria-label="Cancelar reembolso"><X className="h-4 w-4" /></button>
              </div>
              <p className="mt-3 text-xs leading-5 text-white/45">O valor volta para a carteira ZXMAX do comprador. Essa ação só é permitida enquanto o saldo da venda ainda estiver no período de segurança.</p>
              <label className="mt-4 block text-xs font-bold text-white/65">Motivo do reembolso
                <textarea value={refundReason} onChange={(event) => setRefundReason(event.target.value)} maxLength={600} rows={4} placeholder="Explique claramente o motivo..." className="mt-2 w-full resize-none rounded-xl border border-white/[0.09] bg-black/20 p-3 text-sm text-white outline-none focus:border-amber-400/45" />
              </label>
              <button type="button" onClick={() => void handleSellerRefund()} disabled={refundBusy || refundReason.trim().length < 10} className="mt-4 w-full rounded-xl bg-amber-400 py-3 text-sm font-black text-black disabled:opacity-40">
                {refundBusy ? "Processando reembolso..." : "Confirmar reembolso"}
              </button>
            </div>
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

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5" aria-label="Resumo dos pedidos">
        {[
          ["Total", purchaseSummary.total, "text-foreground"],
          ["Aguardando pagamento", purchaseSummary.pending, "text-yellow-600 dark:text-yellow-400"],
          ["Em andamento", purchaseSummary.inProgress, "text-primary"],
          ["Concluídos", purchaseSummary.done, "text-emerald-600 dark:text-emerald-400"],
          ["Valor no recorte", formatBRL(purchaseSummary.amount), "text-foreground"],
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

      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Status do pedido">
        {([
          ["all", "Todos", scopedPurchases.length],
          ["approved", "Aprovados", scopedPurchases.filter((p) => ["paid", "delivered_pending_confirmation", "delivered"].includes(p.status)).length],
          ["pending", "Pendentes", scopedPurchases.filter((p) => p.status === "pending").length],
          ["cancelled", "Cancelados", scopedPurchases.filter((p) => ["cancelled", "refunded"].includes(p.status)).length],
          ["dispute", "Disputas", scopedPurchases.filter((p) => p.status === "dispute").length],
        ] as const).map(([id, label, count]) => (
          <button key={id} type="button" role="tab" aria-selected={statusFilter === id} onClick={() => setStatusFilter(id)}
            className={`shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${statusFilter === id ? "border-[#168cff]/45 bg-[#168cff]/12 text-[#6dbdff]" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}>
            {label} <span className="ml-1 text-[10px] opacity-70">{count}</span>
          </button>
        ))}
      </div>

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
                      {p.status === "pending" && p.buyerId === state.currentUser?.id ? (
                        <button
                          onClick={(event) => void handleResumePayment(p, event)}
                          disabled={loadingPix === p.id}
                          className="btn-gradient px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5"
                        >
                          {p.paymentProvider === "card" ? <CreditCard className="w-3.5 h-3.5" /> : p.paymentProvider === "wallet" ? <WalletCards className="w-3.5 h-3.5" /> : p.paymentProvider === "crypto" ? <Bitcoin className="w-3.5 h-3.5" /> : <QrCode className="w-3.5 h-3.5" />}
                          {loadingPix === p.id ? "Preparando..." : paymentLabel(p)}
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

      {/* The pending-payment CTA can be used from the compact list without
          selecting an order first. Keep this modal mounted in that branch too;
          otherwise a successful PIX response only updated invisible state. */}
      <PixPaymentModal charge={pixCharge} onClose={() => setPixCharge(null)} onPaid={handlePixPaid} />
      <CryptoPaymentModal charge={cryptoCharge} onClose={() => setCryptoCharge(null)} onPaid={handlePixPaid} />
    </div>
  );
}
