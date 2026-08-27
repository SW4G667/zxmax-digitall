import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useStore, ProductVariation, Product } from "@/store/StoreContext";
import { Shield, CheckCircle, Zap, Star, MessageSquare, Share2, Flag, Heart, Send, Eye, Minus, Plus, ThumbsUp, BadgeCheck, Clock, Package, CreditCard, Bitcoin, Expand, Search, X } from "lucide-react";
import { toast } from "sonner";
import PixPaymentModal, { PixCharge } from "@/components/PixPaymentModal";
import AuthScreen from "@/components/AuthScreen";
import UserProfileModal from "@/components/UserProfileModal";
import AppShell from "@/components/AppShell";
import useFavorites from "@/hooks/useFavorites";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, formatRobuxPackage, formatRobuxUnitPrice, formatStockLabel, productMinQuantity, productStock, ROBUX_CATEGORY, robuxPackageUnits, unitPriceFromPackage } from "@/lib/catalog";
import { BUYER_FEE, checkoutTotals } from "@/lib/fees";
import CryptoPaymentModal, { CryptoCharge } from "@/components/CryptoPaymentModal";
import { unwrapEdgeCall } from "@/lib/edgeErrors";
import { checkoutMethods, classifyPaymentMethods, paymentMethodsNotice, PaymentMethodsState } from "@/lib/paymentMethods";
import { friendlyQuestionError, isSchemaMissing } from "@/lib/questionErrors";
import { containsExternalContact } from "@/lib/externalContact";

// Linha de oferta de vendedor do mercado de Robux.
interface SellerOffer {
  id: number;
  product: Product;
  pricePerUnit: number;
  packageUnits: number;
  packagePrice: number;
  stock: number | null;
  minQty: number;
  delivery: string;
  sellerName: string;
  sellerId: string;
  rating: number;
  reviews: number;
  positivePct: number;
  verified: boolean;
}

type CheckoutMethod = "zennith_pix" | "vexopay_pix" | "crypto" | "card" | "boleto";

const METHOD_ORDER: CheckoutMethod[] = ["zennith_pix", "vexopay_pix", "crypto", "card", "boleto"];

function CheckoutModal({ product, quantity, unitPrice, subtotal, onClose, onConfirm, loading }: { product: Product; quantity: number; unitPrice: number; subtotal: number; onClose: () => void; onConfirm: (method: string, cpf: string, network?: string) => void; loading: boolean }) {
  // Sem método selecionado até sabermos o que está ativo: nunca deixamos PIX
  // "escolhido" visualmente quando ele não está disponível.
  const [method, setMethod] = useState<CheckoutMethod | null>(null);
  const [cpf, setCpf] = useState("");
  const [methodsState, setMethodsState] = useState<PaymentMethodsState>({ status: "loading" });
  const [methodsRetry, setMethodsRetry] = useState(0);
  const [network, setNetwork] = useState("TRC20");
  const fee = method && methodsState.status === "ok" ? Number(methodsState.fees[method] || 0) : 0;
  const total = Math.round((subtotal + fee) * 100) / 100;

  // Pergunta ao servidor quais meios estão REALMENTE configurados. Falhas de
  // consulta (função antiga publicada, settings ilegíveis, rede) NÃO viram
  // "tudo indisponível": cada causa tem estado e mensagem próprios.
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await unwrapEdgeCall<{ methods?: Record<string, boolean>; v?: number }>(
        await supabase.functions.invoke("integrations-config", { body: { action: "payment_methods" } }),
        "Não foi possível consultar as formas de pagamento.",
      );
      if (!active) return;
      const next = classifyPaymentMethods(result);
      if (!active) return;
      setMethodsState(next);
    })();
    return () => { active = false; };
  }, [methodsRetry]);

  const loadingMethods = methodsState.status === "loading";
  const available = checkoutMethods(methodsState);
  const isAvailable = (id: CheckoutMethod) => !!available?.[id];
  const anyMethod = !!available && Object.values(available).some(Boolean);
  const notice = paymentMethodsNotice(methodsState);

  // Só escolhe automaticamente quando existe algo realmente ativo.
  useEffect(() => {
    if (!available) return;
    if (method && available[method]) return;
    const first = METHOD_ORDER.find((m) => available[m]);
    setMethod(first ?? null);
  }, [available, method]);

  const handleConfirm = () => {
    if (!method || !isAvailable(method)) {
      toast.error("Nenhuma forma de pagamento disponível para este pedido agora.");
      return;
    }
    const cleanCpf = cpf.replace(/\D/g, "");
    if (method === "zennith_pix" || method === "vexopay_pix" || method === "crypto") {
      if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
        toast.error("Digite um CPF/CNPJ válido (11 ou 14 dígitos) para PIX/Crypto");
        return;
      }
    }
    onConfirm(method, cleanCpf, method === "crypto" ? network : undefined);
  };

  const methodButtons: Array<{ id: CheckoutMethod; label: string; icon: React.ReactNode; selectedClass: string }> = [
    { id: "zennith_pix", label: "PIX", icon: <CreditCard className="w-5 h-5" />, selectedClass: "bg-[#0084ff] border-[#0084ff] text-white" },
    { id: "vexopay_pix", label: "PIX", icon: <CreditCard className="w-5 h-5" />, selectedClass: "bg-[#0084ff] border-[#0084ff] text-white" },
    { id: "crypto", label: "Crypto", icon: <Bitcoin className="w-5 h-5" />, selectedClass: "bg-[#ffbd2e] border-[#ffbd2e] text-black" },
    { id: "card", label: "Cartão", icon: <CreditCard className="w-5 h-5" />, selectedClass: "bg-white border-white text-black" },
    { id: "boleto", label: "Boleto", icon: <Package className="w-5 h-5" />, selectedClass: "bg-white border-white text-black" },
  ];
  const visibleMethodButtons = methodButtons.filter(({ id }) => loadingMethods || isAvailable(id));

  return (
    <div role="dialog" aria-modal="true" aria-label="Checkout ZXMAX" className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#15151a] border border-[#25252e] rounded-2xl w-full max-w-md overflow-y-auto overscroll-contain max-h-[calc(100dvh-2rem)] animate-fade-in-up my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#1e1e28] sticky top-0 bg-[#15151a] z-10">
          <h3 className="font-black text-white text-lg">Checkout ZXMAX</h3>
          <p className="text-xs text-white/40 mt-1">{product.name} • {quantity.toLocaleString("pt-BR")} {product.category === ROBUX_CATEGORY ? "Robux" : "un."}</p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase text-white/30 mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {visibleMethodButtons.map(({ id, label, icon, selectedClass }) => {
                const selectable = !loadingMethods && isAvailable(id);
                const selected = selectable && method === id;
                return (
                  <button
                    key={id}
                    onClick={() => selectable && setMethod(id)}
                    disabled={!selectable}
                    aria-pressed={selected}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition relative ${selected ? selectedClass : "bg-[#1a1a20] border-[#25252e] text-white/60 hover:border-white/20"} ${selectable ? "" : "opacity-40 cursor-not-allowed"}`}
                  >
                    {icon}
                    <span className="text-xs font-bold">{label}</span>
                    {!loadingMethods && methodsState.status === "ok" && !isAvailable(id) && <span className="absolute top-1 right-1 text-[8px] bg-red-500 text-white px-1 rounded">Indisponível</span>}
                  </button>
                );
              })}
            </div>
            {loadingMethods ? (
              <p className="text-[10px] text-white/30 mt-2" aria-live="polite">Verificando formas de pagamento disponíveis…</p>
            ) : notice ? (
              <div className="mt-2 flex items-start justify-between gap-3">
                <p className="text-[11px] text-[#ffbd2e]" aria-live="polite" role="status">{notice.message}</p>
                {notice.retryable && (
                  <button onClick={() => setMethodsRetry((n) => n + 1)} className="shrink-0 text-[11px] font-bold text-[#5aaeff] hover:text-white">Tentar novamente</button>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-white/30 mt-2">Só aparecem habilitadas as formas realmente configuradas na plataforma.</p>
            )}
          </div>

          {anyMethod && (
            <div>
              <p className="text-xs font-bold uppercase text-white/30 mb-2">CPF para pagamento{method === "card" || method === "boleto" ? " (opcional)" : ""}</p>
              <input value={cpf} onChange={(e) => setCpf(e.target.value)} inputMode="numeric" placeholder="000.000.000-00" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white placeholder:text-white/20 text-sm focus:border-[#0084ff] outline-none" />
              <p className="text-[10px] text-white/30 mt-1">Obrigatório para PIX e Crypto</p>
            </div>
          )}

          <div className="bg-[#0a0a0f] border border-[#1e1e28] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs"><span className="text-white/40">Preço unitário</span><span className="text-white">{formatBRL(unitPrice * (product.category === ROBUX_CATEGORY ? robuxPackageUnits(product) : 1))} / {product.category === ROBUX_CATEGORY ? `${robuxPackageUnits(product).toLocaleString("pt-BR")} Robux` : "un."}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/40">Quantidade</span><span className="text-white">{quantity}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/40">Subtotal</span><span className="text-white">{formatBRL(subtotal)}</span></div>
            {method === "crypto" && (
              <div>
                <p className="text-xs font-bold uppercase text-white/30 mb-2">Rede</p>
                <div className="grid grid-cols-2 gap-2">
                  {["TRC20", "USDC_TRC20", "BTC", "TRX"].map((net) => (
                    <button key={net} type="button" onClick={() => setNetwork(net)} className={`p-2 rounded-xl border text-xs font-bold ${network === net ? "bg-[#ffbd2e] border-[#ffbd2e] text-black" : "bg-[#1a1a20] border-[#25252e] text-white/60"}`}>
                      {net === "TRC20" ? "USDT TRC20" : net.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between text-xs"><span className="text-white/40">Taxa do método</span><span className="text-[#ffbd2e]">+ {formatBRL(fee)}</span></div>
            <div className="h-px bg-[#1e1e28] my-2" />
            <div className="flex justify-between font-black"><span className="text-white">Total</span><span className="text-white text-lg">{formatBRL(total)}</span></div>
            <p className="text-[10px] text-white/30">A taxa é definida para o método selecionado. O vendedor recebe {formatBRL(subtotal)}.</p>
          </div>

          <button onClick={handleConfirm} disabled={loading || loadingMethods || !method || !isAvailable(method)} className="w-full bg-[#ffbd2e] hover:bg-[#e6a829] text-black py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition">
            {loading ? "Processando..."
              : !anyMethod && !loadingMethods ? "Nenhuma forma disponível"
              : method === "zennith_pix" || method === "vexopay_pix" ? "Pagar com PIX"
              : method === "crypto" ? "Pagar com Crypto"
              : method === "boleto" ? "Gerar boleto"
              : "Pagar com cartão"}
          </button>

          <div className="flex items-center justify-center gap-4 text-[11px] text-white/30">
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-[#00c950]" /> Garantia</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-[#ffbd2e]" /> Rápido</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-[#0084ff]" /> 24h</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProdutoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, buyProduct, refreshPurchases, savePixCharge, catalogStatus, refreshProducts, loadProductReviews, addProductQuestion, answerProductQuestion } = useStore();
  const { isFavorite, toggle } = useFavorites();
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "reviews" | "questions">("info");
  const [question, setQuestion] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);
  const [cryptoCharge, setCryptoCharge] = useState<CryptoCharge | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [sortBy, setSortBy] = useState<"recomendado" | "barato" | "min">("barato");
  const [variationOpen, setVariationOpen] = useState(false);
  const [variationSearch, setVariationSearch] = useState("");
  const [imageOpen, setImageOpen] = useState(false);
  const [remoteQuestions, setRemoteQuestions] = useState<Array<{ id: number; body: string; answer: string | null; created_at: string; answered_at: string | null }>>([]);
  const [questionsStatus, setQuestionsStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [questionsShown, setQuestionsShown] = useState(5);
  const [sendingQuestion, setSendingQuestion] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [sendingAnswer, setSendingAnswer] = useState<number | null>(null);
  const [realReviews, setRealReviews] = useState<Array<{ id: number; stars: number; comment: string; createdAt: string; buyerName: string }>>([]);
  const [reviewsStatus, setReviewsStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  const productId = Number(id);
  const product = state.products.find((p) => p.id === productId);
  const publicSellerId = product
    ? (product.sellerPublicId || state.userDirectory?.[product.sellerId]?.publicId || null)
    : null;
  const sellerIdentityReady = Boolean(publicSellerId);

  const isRobux = product?.category === ROBUX_CATEGORY;

  // For Robux, aggregate all sellers in same category as offers
  const sellerOffers: SellerOffer[] = useMemo(() => {
    if (!isRobux) return [];
    const robuxProducts = state.products.filter((p) => p.category === ROBUX_CATEGORY && p.approved && (p.sellerPublicId || state.userDirectory?.[p.sellerId]?.publicId));
    const offers: SellerOffer[] = robuxProducts.map((p) => {
      // Real review aggregates persisted on the product row (reviews migration);
      // before it exists these are undefined and the UI shows "Novo • 0 avaliações".
      const reviewCount = p.reviewCount ?? 0;
      const rating = reviewCount > 0 ? Number((p.reviewAvg ?? 0).toFixed(1)) : 0;
      const positivePct = reviewCount > 0 && p.reviewPositive ? Math.round((p.reviewPositive / reviewCount) * 100) : 0;
      return {
        id: p.id,
        product: p,
        pricePerUnit: unitPriceFromPackage(p),
        packageUnits: robuxPackageUnits(p),
        packagePrice: p.price,
        stock: productStock(p),
        minQty: productMinQuantity(p) ?? robuxPackageUnits(p),
        delivery: p.deliveryTime || "Combinado com o vendedor",
        sellerName: p.seller,
        sellerId: p.sellerId,
        rating,
        reviews: reviewCount,
        positivePct,
        verified: !!state.userDirectory?.[p.sellerId]?.isVerified,
      };
    });
    // Sort
    if (sortBy === "barato") offers.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
    else if (sortBy === "min") offers.sort((a, b) => a.minQty - b.minQty);
    else offers.sort((a, b) => b.reviews - a.reviews);
    return offers;
  }, [state.products, state.userDirectory, isRobux, sortBy, state.purchases]);

  const currentOffer = useMemo(() => {
    if (!isRobux) return null;
    return sellerOffers.find((o) => o.id === productId) || sellerOffers[0];
  }, [sellerOffers, productId, isRobux]);

  // A Robux offer is bought in units. Start at the real minimum whenever the
  // buyer changes offer, rather than presenting an invalid quantity of 1.
  useEffect(() => {
    if (!isRobux || !currentOffer) return;
    setQuantity((current) => {
      if (current < currentOffer.minQty) return currentOffer.minQty;
      if (currentOffer.stock != null && current > currentOffer.stock) return currentOffer.stock;
      return current;
    });
  }, [currentOffer?.id, currentOffer?.minQty, currentOffer?.stock, isRobux]);

  const productReviews = useMemo(() => realReviews, [realReviews]);

  // Aggregate comes from the persisted server stats (reviews migration). Honest
  // empty state: Product with 0 reviews shows "—" and "Sem avaliações ainda".
  const reviewCount = product?.reviewCount ?? 0;
  const avgRating = reviewCount > 0 ? (product?.reviewAvg ?? 0).toFixed(1) : null;

  useEffect(() => {
    let active = true;
    if (!productId) return;
    setReviewsStatus("loading");
    void (async () => {
      const reviews = await loadProductReviews(productId);
      if (!active) return;
      setRealReviews(reviews);
      setReviewsStatus(reviews.length > 0 ? "ready" : "ready");
    })();
    return () => { active = false; };
  }, [productId, loadProductReviews]);
  const legacyQuestions = product?.questions || [];
  const productQuestions = remoteQuestions.length > 0
    ? remoteQuestions.map((q) => ({ id: q.id, userName: "Comprador", text: q.body, date: q.created_at, answer: q.answer || undefined, answerDate: q.answered_at || undefined }))
    : legacyQuestions;

  useEffect(() => {
    if (product) {
      setSelectedVariation(null);
      if (isRobux) setQuantity(product.minQuantity ?? robuxPackageUnits(product));
    }
  }, [product?.id, isRobux]);

  const loadQuestions = React.useCallback(async () => {
    if (!productId) return;
    setQuestionsStatus("loading");
    const { data, error } = await (supabase as any)
      .from("product_questions")
      .select("id,body,answer,created_at,answered_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) {
      friendlyQuestionError(error, "load");
      setRemoteQuestions([]);
      // Tabela nova ainda não publicada: usa o JSON `products.questions` que já existe.
      setQuestionsStatus("ready");
      return;
    }
    setRemoteQuestions(data || []);
    setQuestionsStatus("ready");
  }, [productId]);

  useEffect(() => { void loadQuestions(); }, [loadQuestions]);

  if (!product) {
    if (catalogStatus === "loading") {
      return (
        <AppShell>
          <div className="max-w-7xl mx-auto grid lg:grid-cols-[1fr_360px] gap-6" aria-busy="true" aria-live="polite">
            <div className="space-y-4">
              <div className="h-72 rounded-2xl bg-white/5 animate-pulse" />
              <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
            </div>
            <div className="h-48 rounded-2xl bg-white/5 animate-pulse" />
            <span className="sr-only">Carregando produto…</span>
          </div>
        </AppShell>
      );
    }
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-white font-bold">
            {catalogStatus === "error" ? "Não conseguimos carregar este produto agora." : "Produto não encontrado"}
          </p>
          <p className="text-white/40 text-sm mt-1">
            {catalogStatus === "error"
              ? "Verifique sua conexão e tente novamente."
              : "Ele pode ter sido removido ou ainda estar em análise."}
          </p>
          <div className="flex gap-2 justify-center mt-4">
            {catalogStatus === "error" && (
              <button onClick={() => void refreshProducts()} className="bg-white/10 hover:bg-white/15 text-white px-6 py-3 rounded-xl font-bold text-sm">Tentar novamente</button>
            )}
            <button onClick={() => navigate("/loja")} className="bg-[#0084ff] text-white px-6 py-3 rounded-xl font-bold text-sm">Voltar para a loja</button>
          </div>
        </div>
      </AppShell>
    );
  }

  // For Robux the advertised price is the PACKAGE price. The per-unit value is
  // derived for display and for quantity maths, and is never written back.
  const packageUnits = robuxPackageUnits(product);
  const unitPrice = selectedVariation
    ? selectedVariation.price
    : (isRobux ? unitPriceFromPackage(product) : product.price);
  const displayQuantity = isRobux ? quantity : 1;
  const subtotal = Math.round(unitPrice * displayQuantity * 100) / 100;
  const { total } = checkoutTotals(subtotal);

  const handleBuyClick = () => {
    if (!state.currentUser) {
      setAuthOpen(true);
      return;
    }
    if (!sellerIdentityReady) {
      toast.error("Este anúncio está em validação e não está disponível para compra.");
      return;
    }
    const minQty = currentOffer?.minQty ?? packageUnits;
    if (isRobux && quantity < minQty) {
      toast.error(`Quantidade mínima: ${minQty.toLocaleString("pt-BR")}`);
      return;
    }
    if (isRobux && currentOffer?.stock != null && quantity > currentOffer.stock) {
      toast.error(`Estoque disponível: ${currentOffer.stock.toLocaleString("pt-BR")}`);
      return;
    }
    if (subtotal < 2) {
      toast.error("Valor mínimo R$ 2,00");
      return;
    }
    setCheckoutOpen(true);
  };

  const handleCheckoutConfirm = async (method: string, cpf: string, network?: string) => {
    setBuyLoading(true);
    let purchaseId: number | null = null;
    try {
      if (cpf && state.currentUser) {
        const { error: cpfError } = await supabase.from("profiles").update({ cpf } as any).eq("user_id", state.currentUser.id);
        if (cpfError) console.error("[zxmax:cpf]", cpfError);
      }

      purchaseId = await buyProduct(product.id, selectedVariation || undefined, displayQuantity, method);
      if (!purchaseId) return; // buyProduct já explicou o motivo

      if (method === "zennith_pix" || method === "vexopay_pix") {
        const res = await unwrapEdgeCall<{ id: string; qrCodeText: string; qrCodeUrl?: string; expiresAt?: string; amount?: number }>(
          await supabase.functions.invoke(method === "zennith_pix" ? "create-zennith-pix" : "create-evopay-pix", {
            body: { purchaseId, productName: selectedVariation ? `${product.name} - ${selectedVariation.name}` : product.name, buyerName: state.currentUser?.name, payerDocument: cpf || undefined },
          }),
          "Não foi possível gerar o PIX. Tente novamente.",
        );
        if (res.errorMessage || !res.data?.qrCodeText) {
          const msg = res.status === 404
            ? "O PIX está temporariamente indisponível. Avise o suporte."
            : res.errorMessage ?? "Não foi possível gerar o código PIX. Tente novamente.";
          toast.error(msg);
          return;
        }
        savePixCharge(purchaseId, { evopayId: res.data.id, qrCodeText: res.data.qrCodeText, expiresAt: res.data.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString() });
        setPixCharge({ evopayId: res.data.id, qrCodeText: res.data.qrCodeText, amount: Number(res.data.amount ?? total), qrCodeUrl: res.data.qrCodeUrl, purchaseId });
        setCheckoutOpen(false);
        return;
      }

      if (method === "crypto") {
        const res = await unwrapEdgeCall<{ id?: string; address?: string; qrCode?: string; amount?: number; network?: string; expiresAt?: string }>(
          await supabase.functions.invoke("create-vexopay-crypto", {
            body: { purchaseId, amount: total, network: network || "TRC20", description: product.name },
          }),
          "Não foi possível gerar a cobrança em cripto.",
        );
        if (res.errorMessage || !res.data?.address) {
          const msg = res.status === 404
            ? "Função de Crypto (VexoPay) ainda não publicada. Avise o suporte."
            : res.errorMessage ?? "O provedor de cripto não devolveu o endereço.";
          toast.error(msg);
          return;
        }
        setCryptoCharge({
          id: String(res.data.id || ""),
          address: String(res.data.address),
          amount: total,
          cryptoAmount: res.data.amount,
          qrCode: res.data.qrCode,
          network: String(res.data.network || network || "TRC20"),
          expiresAt: res.data.expiresAt,
          purchaseId,
        });
        setCheckoutOpen(false);
        return;
      }

      // Cartão e boleto (Stripe). O valor cobrado é revalidado no servidor a
      // partir do pedido — o que enviamos aqui é só o nome do produto.
      const res = await unwrapEdgeCall<{ url: string }>(
        await supabase.functions.invoke("create-stripe-checkout", {
          body: { purchaseId, productName: product.name, paymentMethod: method },
        }),
        "Não foi possível iniciar o pagamento com cartão.",
      );
      if (res.errorMessage || !res.data?.url) {
        // Agora a mensagem é a real da Stripe/servidor, e não mais
        // "Edge Function returned a non-2xx status code".
        toast.error(res.errorMessage ?? "A Stripe não devolveu o link de pagamento.");
        return;
      }
      toast.success("Redirecionando para o pagamento seguro...");
      window.location.href = res.data.url;
    } catch (err: any) {
      console.error("[zxmax:checkout]", err);
      toast.error("Erro inesperado ao processar a compra. Tente novamente.");
    } finally {
      setBuyLoading(false);
    }
  };

  const handlePixPaid = async () => {
    void refreshPurchases();
    toast.success("Pagamento confirmado!");
  };

  const handleSendQuestion = async () => {
    if (!state.currentUser) { setAuthOpen(true); return; }
    const clean = question.trim();
    if (clean.length < 3) { toast.error("Escreva uma pergunta com pelo menos 3 caracteres."); return; }
    if (containsExternalContact(clean)) {
      toast.error("Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, links ou telefone).");
      return;
    }
    setSendingQuestion(true);
    const { data: createdQuestion, error } = await (supabase as any).rpc("ask_product_question", { _product_id: product.id, _body: clean });
    setSendingQuestion(false);
    if (error) {
      toast.error(friendlyQuestionError(error, "ask"));
      return;
    }
    toast.success("Pergunta enviada ao vendedor.");
    if (createdQuestion?.id) {
      void supabase.functions.invoke("send-email", { body: { type: "new_question", questionId: createdQuestion.id } });
    }
    setQuestion("");
    await loadQuestions();
  };

  const handleAnswerQuestion = async (questionId: number) => {
    const clean = (answerDrafts[questionId] || "").trim();
    if (clean.length < 1) { toast.error("Escreva a resposta antes de enviar."); return; }
    setSendingAnswer(questionId);
    const { error } = await (supabase as any).rpc("answer_product_question", { _question_id: questionId, _answer: clean });
    if (error && isSchemaMissing(error)) {
      const next = (product.questions || []).map((item) =>
        item.id === questionId ? { ...item, answer: clean, answerDate: new Date().toISOString() } : item,
      );
      const upErr = await persistLegacyQuestions(next);
      setSendingAnswer(null);
      if (upErr) {
        toast.error(friendlyQuestionError(upErr, "answer"));
        return;
      }
      answerProductQuestion(product.id, questionId, clean);
      toast.success("Resposta publicada.");
      setAnswerDrafts((drafts) => ({ ...drafts, [questionId]: "" }));
      return;
    }
    setSendingAnswer(null);
    if (error) { toast.error(friendlyQuestionError(error, "answer")); return; }
    toast.success("Resposta publicada.");
    setAnswerDrafts((drafts) => ({ ...drafts, [questionId]: "" }));
    await loadQuestions();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const fav = isFavorite(product.id);

  // Mercado próprio de Robux: comparação de ofertas publicadas, sem métricas
  // inventadas e sem alterar o contrato de compra autorizado pelo servidor.
  if (isRobux && currentOffer) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <nav aria-label="Navegação estrutural" className="mb-5 flex items-center gap-2 overflow-hidden text-xs text-white/45"><Link to="/loja" className="hover:text-white">Início</Link><span>›</span><Link to="/robux" className="hover:text-white">Mercado de Robux</Link><span>›</span><span className="truncate font-semibold text-white">Oferta selecionada</span></nav>

          <section className="relative mb-6 overflow-hidden rounded-[1.6rem] border border-[#168cff]/20 bg-[#11151e] p-5 sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_5%,rgba(0,132,255,0.2),transparent_35%),radial-gradient(circle_at_5%_100%,rgba(0,209,166,0.08),transparent_28%)]" />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#72bbff]">Mercado de Robux</p><h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Compare ofertas antes de comprar.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/55">Preço por unidade, quantidade mínima, estoque e prazo vêm de cada anúncio publicado.</p></div><div className="grid grid-cols-2 gap-2 text-xs sm:min-w-[270px]"><div className="rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5"><p className="text-white/40">Ofertas</p><p className="mt-1 text-lg font-black text-white">{sellerOffers.length}</p></div><div className="rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2.5"><p className="text-white/40">Menor valor/un.</p><p className="mt-1 text-sm font-black text-[#75c5ff]">{formatRobuxUnitPrice(sellerOffers[0]?.pricePerUnit)}</p></div></div></div>
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              <section className="rounded-2xl border border-[#252b38] bg-[#12151d] p-5 sm:p-6" aria-labelledby="offer-title">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#70bcff]">Oferta selecionada</p><h2 id="offer-title" className="mt-2 text-xl font-black text-white">{currentOffer.packageUnits.toLocaleString("pt-BR")} Robux por pacote</h2><p className="mt-1 text-sm text-white/50">{formatRobuxUnitPrice(currentOffer.pricePerUnit)} por Robux · {formatRobuxPackage(currentOffer.product)}</p></div><button onClick={() => setSelectedSellerId(currentOffer.sellerId)} className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] p-2 text-left transition hover:border-[#168cff]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#51a9ff]"><img src={state.userDirectory?.[currentOffer.sellerId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentOffer.sellerName}`} className="h-9 w-9 rounded-full bg-[#1a1a20] object-cover" alt="" /><span className="min-w-0"><span className="flex max-w-36 items-center gap-1 truncate text-xs font-bold text-white">{currentOffer.sellerName}{currentOffer.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#53afff]" aria-label="Vendedor verificado" />}</span><span className="block text-[10px] text-white/45">Ver perfil público</span></span></button></div>

                <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#0d1017] p-4"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold text-white">Quantidade desejada</p><p className="mt-1 text-[11px] text-white/45">Ajuste em pacotes de {currentOffer.packageUnits.toLocaleString("pt-BR")} Robux.</p></div><p className="text-right text-xs text-white/45">Mínimo<br /><span className="font-bold text-white">{currentOffer.minQty.toLocaleString("pt-BR")}</span></p></div><div className="mt-4 grid grid-cols-[48px_1fr_48px] gap-3"><button type="button" aria-label="Diminuir quantidade" onClick={() => setQuantity(Math.max(currentOffer.minQty, quantity - currentOffer.packageUnits))} disabled={quantity <= currentOffer.minQty} className="grid h-12 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-35"><Minus className="h-4 w-4" /></button><output aria-live="polite" className="grid h-12 place-items-center rounded-xl border border-[#168cff]/20 bg-[#168cff]/[0.07] text-lg font-black text-white">{quantity.toLocaleString("pt-BR")} <span className="ml-1 text-xs font-semibold text-[#8acbff]">Robux</span></output><button type="button" aria-label="Aumentar quantidade" onClick={() => setQuantity(currentOffer.stock != null ? Math.min(currentOffer.stock, quantity + currentOffer.packageUnits) : quantity + currentOffer.packageUnits)} disabled={currentOffer.stock != null && quantity >= currentOffer.stock} className="grid h-12 place-items-center rounded-xl border border-[#168cff]/30 bg-[#168cff]/10 text-[#86c9ff] transition hover:bg-[#168cff]/20 disabled:cursor-not-allowed disabled:opacity-35"><Plus className="h-4 w-4" /></button></div><div className="mt-3 grid grid-cols-2 gap-3 text-[11px]"><span className="text-white/45">Estoque: <b className="text-white">{formatStockLabel(currentOffer.stock)}</b></span><span className="text-right text-white/45">Entrega: <b className="text-white">{currentOffer.delivery}</b></span></div></div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3"><p className="text-[10px] uppercase tracking-wide text-white/40">Valor/unidade</p><p className="mt-1 text-sm font-black text-white">{formatRobuxUnitPrice(currentOffer.pricePerUnit)}</p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3"><p className="text-[10px] uppercase tracking-wide text-white/40">Subtotal</p><p className="mt-1 text-sm font-black text-white">{formatBRL(subtotal)}</p></div><div className="col-span-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-3 sm:col-span-1"><p className="text-[10px] uppercase tracking-wide text-white/40">Taxa do pedido</p><p className="mt-1 text-sm font-black text-white">{formatBRL(BUYER_FEE)}</p></div></div>
                <p className="mt-5 flex gap-2 text-xs leading-5 text-white/45"><Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#63baff]" />A oferta e o valor final são revalidados no servidor antes de criar qualquer pedido.</p>
              </section>

              <section className="overflow-hidden rounded-2xl border border-[#252b38] bg-[#12151d]" aria-labelledby="offers-title"><div className="border-b border-white/[0.07] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#70bcff]">Comparar</p><h2 id="offers-title" className="mt-1 text-xl font-black text-white">Ofertas publicadas</h2></div><Link to="/robux" className="text-xs font-bold text-[#79c1ff] hover:text-white">Ver mercado completo</Link></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">{[{ id: "barato", label: "Menor valor/un." }, { id: "recomendado", label: "Mais avaliações" }, { id: "min", label: "Menor mínimo" }].map((option) => <button key={option.id} type="button" onClick={() => setSortBy(option.id as typeof sortBy)} aria-pressed={sortBy === option.id} className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition ${sortBy === option.id ? "border-[#168cff]/55 bg-[#168cff]/15 text-[#9dd4ff]" : "border-white/[0.09] bg-white/[0.035] text-white/55 hover:text-white"}`}>{sortBy === option.id && <CheckCircle className="mr-1 inline h-3 w-3" />}{option.label}</button>)}</div></div><div className="divide-y divide-white/[0.07]">{sellerOffers.map((offer) => { const selected = offer.id === productId; const offerPublicId = state.userDirectory?.[offer.sellerId]?.publicId; return <article key={offer.id} className={`p-4 sm:p-5 ${selected ? "bg-[#168cff]/[0.055]" : "hover:bg-white/[0.018]"}`}><div className="flex flex-wrap items-start justify-between gap-4"><button type="button" onClick={() => setSelectedSellerId(offer.sellerId)} className="flex min-w-0 items-center gap-3 text-left"><img src={state.userDirectory?.[offer.sellerId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${offer.sellerName}`} className="h-10 w-10 rounded-full bg-[#1a1a20] object-cover" alt="" /><span className="min-w-0"><span className="flex max-w-44 items-center gap-1 truncate text-sm font-bold text-white">{offer.sellerName}{offer.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#53afff]" aria-label="Vendedor verificado" />}</span><span className="mt-0.5 block text-[11px] text-white/45">{offerPublicId ? `ID ${offerPublicId}` : "Perfil em validação"}</span></span></button><div className="text-right"><p className="text-xs font-black text-white">{formatRobuxUnitPrice(offer.pricePerUnit)} <span className="font-medium text-white/45">/ Robux</span></p><p className="mt-1 text-[11px] text-white/45">{formatRobuxPackage(offer.product)}</p></div></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><p className="text-white/40">Estoque</p><p className="mt-1 font-bold text-white">{formatStockLabel(offer.stock)}</p></div><div><p className="text-white/40">Mínimo</p><p className="mt-1 font-bold text-white">{offer.minQty.toLocaleString("pt-BR")}</p></div><div><p className="text-white/40">Prazo</p><p className="mt-1 truncate font-bold text-white">{offer.delivery}</p></div></div><div className="mt-4 flex items-center justify-between gap-3"><p className="min-w-0 truncate text-[11px] text-white/45">{offer.reviews > 0 ? <><ThumbsUp className="mr-1 inline h-3 w-3 text-[#43d5b2]" />{offer.positivePct}% em {offer.reviews} avaliação(ões)</> : "Sem avaliações registradas"}</p>{selected ? <span className="rounded-lg border border-[#168cff]/30 bg-[#168cff]/10 px-2.5 py-1.5 text-[11px] font-bold text-[#8dcdff]">Selecionada</span> : <button type="button" onClick={() => navigate(`/produto/${offer.id}`)} className="rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-[11px] font-bold text-white transition hover:border-[#168cff]/55 hover:bg-[#168cff]/10">Selecionar</button>}</div></article>; })}</div></section>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-5"><section className="rounded-2xl border border-[#168cff]/25 bg-[#111a26] p-5 shadow-[0_20px_55px_rgba(0,91,183,0.12)]"><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#79c1ff]">Resumo da oferta</p><p className="mt-3 text-3xl font-black text-white">{formatBRL(total)}</p><p className="mt-1 text-xs leading-5 text-white/50">{quantity.toLocaleString("pt-BR")} Robux · {formatBRL(subtotal)} de produto; inclui taxa de {formatBRL(BUYER_FEE)}.</p><button onClick={handleBuyClick} disabled={!sellerIdentityReady || buyLoading} className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#168cff] px-4 text-sm font-black text-white shadow-[0_10px_28px_rgba(0,132,255,0.25)] transition hover:bg-[#0875e6] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50">{sellerIdentityReady ? (buyLoading ? "Preparando pedido…" : "Comprar agora") : "Oferta em validação"}</button><p className="mt-3 text-center text-[10px] leading-4 text-white/40">As formas de pagamento só são mostradas após a disponibilidade ser consultada.</p></section><section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><h2 className="text-sm font-black text-white">Como funciona</h2><ol className="mt-4 space-y-3 text-xs leading-5 text-white/55"><li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#168cff]/15 text-[10px] font-black text-[#89ccff]">1</span>Compare preço por unidade, mínimo, estoque e prazo.</li><li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#168cff]/15 text-[10px] font-black text-[#89ccff]">2</span>Escolha uma oferta com perfil público válido.</li><li className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#168cff]/15 text-[10px] font-black text-[#89ccff]">3</span>O pedido e os dados de pagamento são tratados no fluxo protegido.</li></ol></section></aside>
          </div>
        </div>

        {checkoutOpen && <CheckoutModal product={product} quantity={quantity} unitPrice={unitPrice} subtotal={subtotal} onClose={() => setCheckoutOpen(false)} onConfirm={handleCheckoutConfirm} loading={buyLoading} />}
        {selectedSellerId && <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />}
        <PixPaymentModal charge={pixCharge} onClose={() => setPixCharge(null)} onPaid={handlePixPaid} />
        <CryptoPaymentModal charge={cryptoCharge} onClose={() => setCryptoCharge(null)} onPaid={handlePixPaid} />
        {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
      </AppShell>
    );
  }

  // Página de anúncio regular. Dados indisponíveis são mostrados como “—”, nunca estimados.
  const seller = state.userDirectory?.[product.sellerId];
  // Só o dono do anúncio vê o formulário de resposta (o banco revalida via RPC).
  const isProductSeller = !!state.currentUser && state.currentUser.id === product.sellerId;
  const sellerReviews = state.purchases.filter((purchase) => purchase.sellerId === product.sellerId && purchase.reviewed);
  const sellerPositive = sellerReviews.length ? Math.round((sellerReviews.filter((review) => (review.reviewStars || 0) >= 4).length / sellerReviews.length) * 100) : null;
  const relatedProducts = state.products.filter((item) => item.id !== product.id && item.category === product.category && item.approved).slice(0, 8);
  const variationRequired = (product.variations?.length || 0) > 0;
  const filteredVariations = (product.variations || []).filter((variation) => variation.name.toLowerCase().includes(variationSearch.toLowerCase()));
  const createdAt = product.createdAt;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-xs text-white/45 mb-5 overflow-hidden">
          <Link to="/" className="hover:text-white">Início</Link><span>›</span>
          <button onClick={() => navigate(`/loja?cat=${encodeURIComponent(product.category)}`)} className="hover:text-white truncate">{product.category}</button><span>›</span>
          <span className="text-white truncate">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <main className="space-y-5">
            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl overflow-hidden">
              <div className="relative aspect-[16/9] bg-[#0a0a0f]">
                <img src={product.banner || product.image} alt={product.name} className="w-full h-full object-cover" />
                <button onClick={() => setImageOpen(true)} aria-label="Ampliar imagem" className="absolute bottom-4 left-4 p-3 rounded-xl bg-black/70 hover:bg-black text-white"><Expand className="w-5 h-5" /></button>
                <button onClick={() => toggle(product.id)} aria-label="Favoritar" className={`absolute top-4 right-4 p-3 rounded-full ${fav ? "bg-[#0084ff] text-white" : "bg-black/70 text-white"}`}><Heart className={`w-5 h-5 ${fav ? "fill-current" : ""}`} /></button>
              </div>
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="rounded-full px-3 py-1 text-[11px] font-bold bg-[#1a1a20] border border-[#25252e] text-white/70">{product.category}</span>
                  <span className="rounded-full px-3 py-1 text-[11px] font-bold bg-[#0084ff]/15 border border-[#0084ff]/30 text-[#5aaeff]"><Zap className="inline w-3.5 h-3.5 mr-1" />{product.deliveryType === "auto" ? "Entrega automática" : "Entrega manual"}</span>
                  <span className="rounded-full px-3 py-1 text-[11px] font-bold bg-[#1a1a20] border border-[#25252e] text-white/70">Anúncio digital</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{product.name}</h1>
                <div className="grid grid-cols-3 mt-6 border-y border-[#1e1e28] divide-x divide-[#1e1e28]">
                  <div className="py-3"><p className="text-[10px] text-white/35 uppercase font-bold">Disponíveis</p><p className="font-black text-white mt-1">{formatStockLabel(productStock(product))}</p></div>
                  <div className="py-3 px-3"><p className="text-[10px] text-white/35 uppercase font-bold">Vendidos</p><p className="font-black text-white mt-1">{product.sales || "—"}</p></div>
                  <div className="py-3 px-3"><p className="text-[10px] text-white/35 uppercase font-bold">Vendas</p><p className="font-black text-white mt-1">{product.sales || "—"}</p></div>
                </div>
              </div>
            </section>

            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5 sm:p-6">
              <h2 className="text-sm font-black tracking-wide text-white">CARACTERÍSTICAS</h2>
              <dl className="mt-4 divide-y divide-[#1e1e28] text-sm">
                <div className="flex justify-between py-3 gap-6"><dt className="text-white/45">Tipo do anúncio</dt><dd className="font-bold text-white text-right">{product.deliveryType === "auto" ? "Entrega automática" : "Entrega manual"}</dd></div>
                <div className="flex justify-between py-3 gap-6"><dt className="text-white/45">Procedência</dt><dd className="font-bold text-white text-right">Não informada</dd></div>
                <div className="flex justify-between py-3 gap-6"><dt className="text-white/45">Prazo de entrega</dt><dd className="font-bold text-white text-right">{product.deliveryTime || "Não informado"}</dd></div>
              </dl>
            </section>

            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5 sm:p-6">
              <h2 className="text-sm font-black tracking-wide text-white">DESCRIÇÃO</h2>
              <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap text-white/75">{product.description || "O vendedor não adicionou uma descrição."}</p>
              <div className="mt-5 pt-4 border-t border-[#1e1e28] flex flex-wrap items-center gap-3 text-xs text-white/40"><span>Criado em {createdAt ? new Date(createdAt).toLocaleDateString("pt-BR") : "—"}</span><button onClick={handleShare} className="flex items-center gap-1.5 hover:text-white"><Share2 className="w-4 h-4" /> Compartilhar</button><Link to="/suporte" className="flex items-center gap-1.5 hover:text-white"><Flag className="w-4 h-4" /> Denunciar</Link></div>
            </section>

            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5 sm:p-6" aria-label="Perguntas sobre o anúncio">
              <div className="flex items-center justify-between"><h2 className="text-sm font-black tracking-wide text-white">PERGUNTAS ({productQuestions.length})</h2></div>
              <div className="mt-5 space-y-3">
                {questionsStatus === "loading" && <p className="text-sm text-white/40">Carregando perguntas…</p>}
                {questionsStatus === "unavailable" && (
                  <p className="text-sm text-white/40" role="status">Não foi possível carregar as perguntas agora.</p>
                )}
                {productQuestions.slice(0, questionsShown).map((item) => (
                  <article key={item.id} className="rounded-xl bg-[#1a1a20] border border-[#25252e] p-4">
                    <p className="text-xs font-bold text-[#5aaeff]">{item.userName}</p>
                    <p className="text-sm text-white mt-1">{item.text}</p>
                    <p className="text-[11px] text-white/35 mt-2">{new Date(item.date).toLocaleDateString("pt-BR")}</p>
                    {item.answer
                      ? <div className="mt-3 pl-3 border-l-2 border-[#0084ff]"><p className="text-[11px] font-bold text-[#5aaeff]">Resposta do vendedor</p><p className="text-sm text-white/80 mt-1">{item.answer}</p></div>
                      : isProductSeller && questionsStatus === "ready" && (
                        <div className="mt-3 border-t border-[#25252e] pt-3">
                          <label className="sr-only" htmlFor={`answer-${item.id}`}>Responder pergunta</label>
                          <textarea
                            id={`answer-${item.id}`}
                            value={answerDrafts[item.id] || ""}
                            onChange={(event) => setAnswerDrafts((drafts) => ({ ...drafts, [item.id]: event.target.value }))}
                            maxLength={2000}
                            placeholder="Responder ao comprador"
                            className="w-full min-h-16 bg-[#0a0a0f] border border-[#25252e] rounded-xl p-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#0084ff]"
                          />
                          <button
                            onClick={() => void handleAnswerQuestion(item.id)}
                            disabled={sendingAnswer === item.id}
                            className="mt-2 bg-[#0084ff] hover:bg-[#0066cc] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold"
                          >
                            {sendingAnswer === item.id ? "Enviando…" : "Responder"}
                          </button>
                        </div>
                      )}
                  </article>
                ))}
                {!productQuestions.length && questionsStatus === "ready" && <p className="text-sm text-white/40 py-4">Ainda não há perguntas para este anúncio.</p>}
                {productQuestions.length > questionsShown && <button onClick={() => setQuestionsShown((count) => count + 5)} className="text-sm font-bold text-[#5aaeff]">Carregar mais</button>}
              </div>
              {questionsStatus === "unavailable" ? (
                <p className="mt-5 text-[11px] text-white/35 border border-[#25252e] rounded-xl p-3 bg-[#1a1a20]">
                  O envio de perguntas está temporariamente desativado nesta tela até a atualização terminar — nada é salvo localmente.
                </p>
              ) : (
                <div className="mt-5">
                  <label className="sr-only" htmlFor="question-input">Faça uma pergunta</label>
                  <textarea
                    id="question-input"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    maxLength={1000}
                    placeholder="Faça uma pergunta"
                    className="w-full min-h-24 bg-[#0a0a0f] border border-[#25252e] rounded-xl p-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#0084ff]"
                  />
                  <p className="text-[11px] text-white/35 mt-2">Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, links ou telefone).</p>
                  <button
                    onClick={() => void handleSendQuestion()}
                    disabled={sendingQuestion}
                    className="mt-3 bg-[#0084ff] hover:bg-[#0066cc] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-bold"
                  >
                    {sendingQuestion ? "Enviando…" : "Enviar pergunta"}
                  </button>
                </div>
              )}
            </section>

            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5 sm:p-6" aria-label="Avaliações do produto">
              <h2 className="text-sm font-black tracking-wide text-white">AVALIAÇÕES ({reviewCount})</h2>
              <div className="flex items-center gap-3 mt-4">
                <p className="text-3xl font-black text-white">{avgRating || "—"}</p>
                <div>
                  <div className="flex text-[#ffbd2e]">{[1,2,3,4,5].map((star) => <Star key={star} className={`w-4 h-4 ${avgRating && star <= Math.round(Number(avgRating)) ? "fill-current" : "text-white/15"}`} />)}</div>
                  <p className="text-xs text-white/40 mt-1">{reviewCount ? `${reviewCount} avaliação(ões)` : "Sem avaliações ainda"}</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {reviewsStatus === "loading" && reviewCount > 0 && <p className="text-sm text-white/40">Carregando avaliações…</p>}
                {reviewCount === 0 && <p className="text-sm text-white/40 py-2">Seja o primeiro a avaliar este produto após a compra.</p>}
                {productReviews.map((review) => (
                  <article key={review.id} className="border-t border-[#1e1e28] pt-3">
                    <div className="flex items-center gap-1.5">
                      <span className="flex text-[#ffbd2e]">{[1,2,3,4,5].map((star) => <Star key={star} className={`w-3 h-3 ${star <= (review.stars || 0) ? "fill-current" : "text-white/15"}`} />)}</span>
                      <span className="text-[11px] font-bold text-white/60">{review.buyerName}</span>
                    </div>
                    <p className="text-sm text-white mt-1">{review.comment || "Sem comentário."}</p>
                    <p className="text-[11px] text-white/35 mt-1">{new Date(review.createdAt).toLocaleDateString("pt-BR")}</p>
                  </article>
                ))}
              </div>
            </section>
          </main>

          <aside className="lg:sticky lg:top-20 space-y-4">
            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5"><p className="text-[11px] uppercase font-bold text-white/35">Preço</p><p className="text-3xl font-black text-white mt-1">{formatBRL(selectedVariation?.price ?? product.price)}</p>{variationRequired && <div className="relative mt-4"><button onClick={() => setVariationOpen((open) => !open)} className="w-full flex justify-between items-center rounded-xl bg-[#0a0a0f] border border-[#25252e] px-3 py-3 text-sm text-left text-white"><span>{selectedVariation?.name || "Escolha uma variação"}</span><span className="text-white/40">⌄</span></button>{variationOpen && <div className="absolute z-20 mt-2 w-full rounded-xl overflow-hidden bg-[#111114] border border-[#25252e] shadow-2xl"><div className="p-2 border-b border-[#25252e]"><label className="sr-only" htmlFor="variation-search">Buscar variação</label><div className="flex items-center gap-2 px-2"><Search className="w-4 h-4 text-white/40"/><input id="variation-search" autoFocus value={variationSearch} onChange={(event) => setVariationSearch(event.target.value)} placeholder="Buscar variação" className="w-full bg-transparent py-2 text-sm text-white outline-none"/></div></div><div className="max-h-56 overflow-auto">{filteredVariations.map((variation) => <button key={variation.name} onClick={() => { setSelectedVariation(variation); setVariationOpen(false); setVariationSearch(""); }} className="w-full p-3 text-left hover:bg-white/5 border-b border-[#1e1e28]"><span className="block font-bold text-white">{variation.name}</span><span className="text-xs text-[#5aaeff]">{formatBRL(variation.price)} · estoque: não informado</span></button>)}{!filteredVariations.length && <p className="p-3 text-sm text-white/40">Nenhuma variação encontrada.</p>}</div></div>}</div>}<p className="text-xs text-white/40 mt-2">{!sellerIdentityReady ? "Este anúncio ficará disponível quando a conta do vendedor for validada." : variationRequired && !selectedVariation ? "Escolha uma variação para comprar." : "Taxas e total serão detalhados no checkout."}</p><button onClick={handleBuyClick} disabled={buyLoading || !sellerIdentityReady || (variationRequired && !selectedVariation)} className="w-full mt-4 bg-[#ffbd2e] hover:bg-[#e6a829] disabled:opacity-40 disabled:cursor-not-allowed text-black py-3.5 rounded-xl font-black text-sm">{sellerIdentityReady ? "COMPRAR" : "ANÚNCIO EM VALIDAÇÃO"}</button></section>
            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5"><h2 className="font-black text-white">Vendedor</h2><button onClick={() => setSelectedSellerId(product.sellerId)} className="w-full text-left flex gap-3 mt-4"><img src={seller?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(product.seller || "vendedor")}`} alt="" className="w-12 h-12 rounded-full bg-[#1a1a20]"/><div><p className="font-bold text-white">{product.seller || "Vendedor"}</p><p className="text-xs text-white/40 mt-1">{sellerIdentityReady ? `ID público: ${publicSellerId}` : "Conta do vendedor em validação"}</p><p className="text-xs text-white/40 mt-1">{sellerReviews.length ? `${sellerReviews.length} avaliações` : "Novo"}</p></div></button><dl className="mt-4 text-xs divide-y divide-[#1e1e28]"><div className="flex justify-between py-2"><dt className="text-white/40">Membro desde</dt><dd className="text-white">—</dd></div><div className="flex justify-between py-2"><dt className="text-white/40">Avaliações positivas</dt><dd className="text-white">{sellerPositive === null ? "—" : `${sellerPositive}%`}</dd></div><div className="flex justify-between py-2"><dt className="text-white/40">Último acesso</dt><dd className="text-white">—</dd></div></dl></section>
            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5"><h2 className="font-black text-white">Verificações</h2><div className="mt-3 space-y-2 text-sm"><div className="flex justify-between"><span className="text-white/55">Documento</span><span className={seller?.isVerified ? "text-[#00c950]" : "text-white/40"}>{seller?.isVerified ? "Verificado" : "Não informado"}</span></div></div><p className="mt-3 text-[11px] leading-4 text-white/40">E-mail e telefone não são exibidos publicamente.</p></section>
            <section className="bg-[#0084ff]/10 border border-[#0084ff]/30 rounded-2xl p-5 flex gap-3"><Shield className="w-6 h-6 text-[#5aaeff] shrink-0"/><div><h2 className="font-black text-white text-sm">Entrega garantida</h2><p className="text-xs text-white/55 mt-1">Pagamento e entrega acompanham o pedido dentro da ZXMAX.</p></div></section>
          </aside>
        </div>
        <section className="mt-8"><h2 className="text-lg font-black text-white">Anúncios parecidos</h2>{relatedProducts.length ? <div className="mt-4 flex gap-4 overflow-x-auto pb-2">{relatedProducts.map((item) => <Link key={item.id} to={`/produto/${item.id}`} className="shrink-0 w-52 rounded-2xl overflow-hidden bg-[#15151a] border border-[#25252e] hover:border-[#0084ff]"><img src={item.image} alt={item.name} className="w-full aspect-video object-cover"/><div className="p-3"><p className="text-sm font-bold text-white line-clamp-2">{item.name}</p><p className="text-sm font-black text-[#5aaeff] mt-2">{formatBRL(item.price)}</p></div></Link>)}</div> : <p className="mt-3 text-sm text-white/40">Não há outros anúncios desta categoria no momento.</p>}</section>
      </div>
      {imageOpen && <div role="dialog" aria-modal="true" aria-label="Imagem ampliada" className="fixed inset-0 z-[100] bg-black/90 p-4 flex items-center justify-center" onClick={() => setImageOpen(false)}><button onClick={() => setImageOpen(false)} className="absolute top-5 right-5 text-white p-3"><X /></button><img onClick={(event) => event.stopPropagation()} src={product.banner || product.image} alt={product.name} className="max-w-full max-h-full object-contain" /></div>}
      {checkoutOpen && <CheckoutModal product={product} quantity={displayQuantity} unitPrice={unitPrice} subtotal={subtotal} onClose={() => setCheckoutOpen(false)} onConfirm={handleCheckoutConfirm} loading={buyLoading} />}
      {selectedSellerId && <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />}
      <PixPaymentModal charge={pixCharge} onClose={() => setPixCharge(null)} onPaid={handlePixPaid} />
      <CryptoPaymentModal charge={cryptoCharge} onClose={() => setCryptoCharge(null)} onPaid={handlePixPaid} />
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </AppShell>
  );
}
