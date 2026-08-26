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
import { formatBRL, formatRobuxPackage, formatStockLabel, productMinQuantity, productStock, ROBUX_CATEGORY, robuxPackageUnits, unitPriceFromPackage } from "@/lib/catalog";
import { checkoutTotals } from "@/lib/fees";
import CryptoPaymentModal, { CryptoCharge } from "@/components/CryptoPaymentModal";
import { unwrapEdgeCall } from "@/lib/edgeErrors";
import { checkoutMethods, classifyPaymentMethods, paymentMethodsNotice, PaymentMethodsState } from "@/lib/paymentMethods";
import { friendlyQuestionError, isSchemaMissing } from "@/lib/questionErrors";
import { containsExternalContact } from "@/lib/externalContact";

// Eldorado-style seller row
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
    { id: "zennith_pix", label: "PIX · Zennith", icon: <CreditCard className="w-5 h-5" />, selectedClass: "bg-[#0084ff] border-[#0084ff] text-white" },
    { id: "vexopay_pix", label: "PIX · Vexo", icon: <CreditCard className="w-5 h-5" />, selectedClass: "bg-[#00c950] border-[#00c950] text-black" },
    { id: "crypto", label: "Crypto", icon: <Bitcoin className="w-5 h-5" />, selectedClass: "bg-[#ffbd2e] border-[#ffbd2e] text-black" },
    { id: "card", label: "Cartão (Stripe)", icon: <CreditCard className="w-5 h-5" />, selectedClass: "bg-white border-white text-black" },
    { id: "boleto", label: "Boleto (Stripe)", icon: <Package className="w-5 h-5" />, selectedClass: "bg-white border-white text-black" },
  ];

  return (
    <div role="dialog" aria-modal="true" aria-label="Checkout ZXMAX" className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#15151a] border border-[#25252e] rounded-2xl w-full max-w-md overflow-y-auto overscroll-contain max-h-[calc(100dvh-2rem)] animate-fade-in-up my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[#1e1e28] sticky top-0 bg-[#15151a] z-10">
          <h3 className="font-black text-white text-lg">Checkout ZXMAX</h3>
          <p className="text-xs text-white/40 mt-1">{product.name} • {quantity.toLocaleString("pt-BR")} {product.category === ROBUX_CATEGORY ? "Robux" : "un."}{method ? ` • ${method.toUpperCase()}` : ""}</p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase text-white/30 mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {methodButtons.map(({ id, label, icon, selectedClass }) => {
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
              : method === "zennith_pix" ? "Pagar com PIX · Zennith"
              : method === "vexopay_pix" ? "Pagar com PIX · Vexo"
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

  const isRobux = product?.category === ROBUX_CATEGORY;

  // For Robux, aggregate all sellers in same category as offers
  const sellerOffers: SellerOffer[] = useMemo(() => {
    if (!isRobux) return [];
    const robuxProducts = state.products.filter((p) => p.category === ROBUX_CATEGORY && p.approved);
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
  }, [state.products, isRobux, sortBy, state.purchases]);

  const currentOffer = useMemo(() => {
    if (!isRobux) return null;
    return sellerOffers.find((o) => o.id === productId) || sellerOffers[0];
  }, [sellerOffers, productId, isRobux]);

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
    ? remoteQuestions.map((q) => ({ id: q.id, userEmail: "", userName: "Comprador", text: q.body, date: q.created_at, answer: q.answer || undefined, answerDate: q.answered_at || undefined }))
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
            ? `Função de PIX (${method === "zennith_pix" ? "ZennithPay" : "VexoPay"}) ainda não publicada. Avise o suporte.`
            : res.errorMessage ?? "O provedor de PIX não devolveu o código. Tente novamente.";
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
    try {
      const latest = state.purchases.find((p) => p.productId === product.id && p.buyerId === state.currentUser?.id);
      if (latest) {
        await supabase.functions.invoke("send-email", { body: { type: "purchase_confirmed", purchaseId: latest.id } });
      }
    } catch {}
  };

  const persistLegacyQuestions = async (next: Array<{ id: number; userEmail: string; userName: string; text: string; date: string; answer?: string; answerDate?: string }>) => {
    const { error } = await (supabase as any).from("products").update({ questions: next }).eq("id", product.id);
    return error;
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
    const { error } = await (supabase as any).rpc("ask_product_question", { _product_id: product.id, _body: clean });
    if (error && isSchemaMissing(error)) {
      const next = [
        ...(product.questions || []),
        {
          id: Date.now(),
          userEmail: state.currentUser.email || "",
          userName: state.currentUser.name || "Comprador",
          text: clean,
          date: new Date().toISOString(),
        },
      ];
      const upErr = await persistLegacyQuestions(next);
      setSendingQuestion(false);
      if (upErr) {
        toast.error(friendlyQuestionError(upErr, "ask"));
        return;
      }
      addProductQuestion(product.id, clean);
      toast.success("Pergunta enviada ao vendedor.");
      setQuestion("");
      return;
    }
    setSendingQuestion(false);
    if (error) {
      toast.error(friendlyQuestionError(error, "ask"));
      return;
    }
    toast.success("Pergunta enviada ao vendedor.");
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

  // Robux view like Eldorado.gg
  if (isRobux && currentOffer) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-white/40 mb-4">
            <Link to="/loja" className="hover:text-white">Loja</Link>
            <span>/</span>
            <span className="text-white">Roblox</span>
            <span>/</span>
            <span className="text-white font-bold">Moeda</span>
          </div>

          <div className="bg-[#ffbd2e] text-black text-xs font-bold px-4 py-2 rounded-full inline-flex items-center gap-2 mb-4">
            Aceitamos <span className="bg-black/10 px-2 py-0.5 rounded">PIX</span> e <span className="flex items-center gap-1"><Bitcoin className="w-3 h-3" /> Crypto</span>
          </div>

          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <div className="space-y-4">
              {/* Seller header */}
              <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={state.userDirectory?.[currentOffer.sellerId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentOffer.sellerName}`} className="w-12 h-12 rounded-full bg-[#1a1a20] border border-[#25252e]" alt="" />
                    <div>
                      <p className="font-black text-white flex items-center gap-1.5">{currentOffer.sellerName} {currentOffer.verified && <BadgeCheck className="w-4 h-4 text-[#0084ff]" aria-label="Vendedor verificado" />}</p>
                      <p className="text-xs flex items-center gap-2">
                        {currentOffer.reviews > 0 ? (
                          <>
                            <span className="flex items-center gap-1 text-[#00c950]"><ThumbsUp className="w-3.5 h-3.5" /> {currentOffer.positivePct}%</span>
                            <span className="text-[#0084ff] underline cursor-pointer" onClick={() => setDetailTab("reviews")}>{currentOffer.reviews} avaliações</span>
                          </>
                        ) : (
                          <span className="text-white/40">Novo • Nenhuma avaliação ainda</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40">Valor</p>
                    <p className="font-black text-white text-lg">{formatRobuxPackage(currentOffer.product)}</p>
                  </div>
                </div>

                {/* Quantity selector like Eldorado */}
                <div className="mt-6 bg-[#1a1a20] border border-[#25252e] rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setQuantity(Math.max(currentOffer.minQty, quantity - currentOffer.packageUnits))} className="w-12 h-12 rounded-xl bg-[#25252e] hover:bg-[#2a2a36] text-white flex items-center justify-center transition"><Minus className="w-4 h-4" /></button>
                    <div className="flex-1 bg-[#0a0a0f] border border-[#1e1e28] rounded-xl h-12 flex items-center justify-center font-black text-white text-lg">{quantity.toLocaleString()}</div>
                    <button onClick={() => setQuantity(currentOffer.stock != null ? Math.min(currentOffer.stock, quantity + currentOffer.packageUnits) : quantity + currentOffer.packageUnits)} className="w-12 h-12 rounded-xl bg-[#25252e] hover:bg-[#2a2a36] text-white flex items-center justify-center transition"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="flex justify-between text-xs mt-3 text-white/40">
                    <span>Qtd. mín.: {currentOffer.minQty.toLocaleString("pt-BR")}</span>
                    <span>Estoque: {formatStockLabel(currentOffer.stock)}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-white/60">Prazo de entrega</span><span className="font-bold text-white">{currentOffer.delivery}</span></div>
                  <div className="border-t border-[#1e1e28] pt-3 flex justify-between text-lg font-black"><span className="text-white">Total: {formatBRL(total)}</span><span className="text-white/40 text-xs font-normal">inclui taxa de {formatBRL(BUYER_FEE)}</span></div>
                </div>

                <button onClick={handleBuyClick} disabled={buyLoading} className="w-full mt-5 bg-[#ffbd2e] hover:bg-[#e6a829] text-black py-4 rounded-xl font-black text-base transition disabled:opacity-50">Comprar agora</button>

                <div className="mt-4 space-y-2.5">
                  <div className="flex gap-2 text-xs"><Shield className="w-4 h-4 text-[#0084ff] shrink-0" /><span className="font-bold text-white">Garantia de reembolso</span><span className="text-white/40">Protegido pelo TradeShield</span></div>
                  <div className="flex gap-2 text-xs"><Zap className="w-4 h-4 text-[#ffbd2e] shrink-0" /><span className="font-bold text-white">Checkout rápido</span><span className="flex gap-1"><span className="bg-[#00c950] text-white px-2 py-0.5 rounded text-[10px] font-bold">PIX</span><span className="bg-[#ffbd2e] text-black px-2 py-0.5 rounded text-[10px] font-bold">CRYPTO</span></span></div>
                  <div className="flex gap-2 text-xs"><MessageSquare className="w-4 h-4 text-[#0084ff] shrink-0" /><span className="font-bold text-white">Atendimento 24 horas por dia</span><span className="text-white/40">Tira sua dúvida!</span></div>
                </div>
              </div>

              {/* Other sellers like Eldorado */}
              <div className="bg-[#15151a] border border-[#25252e] rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-[#1e1e28]">
                  <h3 className="font-black text-white text-lg">Outros vendedores ({sellerOffers.length})</h3>
                  <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide">
                    {[
                      { id: "recomendado", label: "Recomendado" },
                      { id: "barato", label: "Mais barato primeiro" },
                      { id: "min", label: "Menor qtd. mín." },
                    ].map((opt) => (
                      <button key={opt.id} onClick={() => setSortBy(opt.id as any)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition ${sortBy === opt.id ? "bg-[#ffbd2e]/10 border-[#ffbd2e] text-[#ffbd2e]" : "bg-[#1a1a20] border-[#25252e] text-white/50 hover:text-white"}`}>
                        {sortBy === opt.id && <CheckCircle className="w-3 h-3 inline mr-1" />}{opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="divide-y divide-[#1e1e28]">
                  {sellerOffers.map((offer) => (
                    <div key={offer.id} className={`p-4 hover:bg-[#1a1a20] transition cursor-pointer ${offer.id === productId ? "bg-[#0084ff]/5 border-l-2 border-l-[#0084ff]" : ""}`} onClick={() => navigate(`/produto/${offer.id}`)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3 min-w-0 flex-1">
                          <img src={state.userDirectory?.[offer.sellerId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${offer.sellerName}`} className="w-10 h-10 rounded-full bg-[#1a1a20] border border-[#25252e] shrink-0" alt="" />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-white text-sm flex items-center gap-1 truncate">{offer.sellerName} {offer.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#0084ff]" aria-label="Vendedor verificado" />}</p>
                            <p className="text-xs flex items-center gap-2">
                              {offer.reviews > 0 ? (
                                <>
                                  <span className="flex items-center gap-1 text-[#00c950]"><ThumbsUp className="w-3 h-3" /> {offer.positivePct}%</span>
                                  <span className="text-[#0084ff] underline">{offer.reviews} avaliações</span>
                                </>
                              ) : (
                                <span className="text-white/40">Novo • 0 avaliações</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-white">{formatRobuxPackage(offer.product)}</p>
                          {offer.id === productId && <span className="text-[10px] bg-[#ffbd2e] text-black px-2 py-0.5 rounded-full font-bold">Oferta atual</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                        <div><p className="text-white/40">Estoque</p><p className="font-bold text-white">{formatStockLabel(offer.stock)}</p></div>
                        <div><p className="text-white/40">Qtd. mín.</p><p className="font-bold text-white">{offer.minQty}</p></div>
                        <div><p className="text-white/40">Entrega</p><p className="font-bold text-white">{offer.delivery}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5">
                <p className="text-xs uppercase font-bold text-white/30 mb-1">Preço</p>
                <p className="text-3xl font-black text-white">{formatBRL(total)}</p>
                <p className="text-xs text-white/40 mt-1">{quantity.toLocaleString("pt-BR")} Robux · {formatBRL(subtotal)} + {formatBRL(BUYER_FEE)}</p>
                <button onClick={handleBuyClick} className="w-full mt-4 bg-[#ffbd2e] text-black py-3.5 rounded-xl font-black">Comprar agora</button>
              </div>

              <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5">
                <h4 className="font-bold text-white mb-3">Vendedor</h4>
                <button onClick={() => setSelectedSellerId(product.sellerId)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-[#1a1a20] border border-[#25252e] hover:border-[#2a2a36] transition text-left">
                  <img src={state.userDirectory?.[product.sellerId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.seller}`} className="w-10 h-10 rounded-full" alt="" />
                  <div className="flex-1 min-w-0"><p className="font-bold text-white text-sm truncate">{product.seller}</p><p className="text-[11px] text-white/40">ID: {product.sellerPublicId || "—"}</p></div>
                </button>
              </div>
            </div>
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
            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5"><p className="text-[11px] uppercase font-bold text-white/35">Preço</p><p className="text-3xl font-black text-white mt-1">{formatBRL(selectedVariation?.price ?? product.price)}</p>{variationRequired && <div className="relative mt-4"><button onClick={() => setVariationOpen((open) => !open)} className="w-full flex justify-between items-center rounded-xl bg-[#0a0a0f] border border-[#25252e] px-3 py-3 text-sm text-left text-white"><span>{selectedVariation?.name || "Escolha uma variação"}</span><span className="text-white/40">⌄</span></button>{variationOpen && <div className="absolute z-20 mt-2 w-full rounded-xl overflow-hidden bg-[#111114] border border-[#25252e] shadow-2xl"><div className="p-2 border-b border-[#25252e]"><label className="sr-only" htmlFor="variation-search">Buscar variação</label><div className="flex items-center gap-2 px-2"><Search className="w-4 h-4 text-white/40"/><input id="variation-search" autoFocus value={variationSearch} onChange={(event) => setVariationSearch(event.target.value)} placeholder="Buscar variação" className="w-full bg-transparent py-2 text-sm text-white outline-none"/></div></div><div className="max-h-56 overflow-auto">{filteredVariations.map((variation) => <button key={variation.name} onClick={() => { setSelectedVariation(variation); setVariationOpen(false); setVariationSearch(""); }} className="w-full p-3 text-left hover:bg-white/5 border-b border-[#1e1e28]"><span className="block font-bold text-white">{variation.name}</span><span className="text-xs text-[#5aaeff]">{formatBRL(variation.price)} · estoque: não informado</span></button>)}{!filteredVariations.length && <p className="p-3 text-sm text-white/40">Nenhuma variação encontrada.</p>}</div></div>}</div>}<p className="text-xs text-white/40 mt-2">{variationRequired && !selectedVariation ? "Escolha uma variação para comprar." : "Taxas e total serão detalhados no checkout."}</p><button onClick={handleBuyClick} disabled={buyLoading || (variationRequired && !selectedVariation)} className="w-full mt-4 bg-[#ffbd2e] hover:bg-[#e6a829] disabled:opacity-40 disabled:cursor-not-allowed text-black py-3.5 rounded-xl font-black text-sm">COMPRAR</button></section>
            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5"><h2 className="font-black text-white">Vendedor</h2><button onClick={() => setSelectedSellerId(product.sellerId)} className="w-full text-left flex gap-3 mt-4"><img src={seller?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(product.seller)}`} alt="" className="w-12 h-12 rounded-full bg-[#1a1a20]"/><div><p className="font-bold text-white">{product.seller}</p><p className="text-xs text-white/40 mt-1">{sellerReviews.length ? `${sellerReviews.length} avaliações` : "Novo"}</p></div></button><dl className="mt-4 text-xs divide-y divide-[#1e1e28]"><div className="flex justify-between py-2"><dt className="text-white/40">Membro desde</dt><dd className="text-white">—</dd></div><div className="flex justify-between py-2"><dt className="text-white/40">Avaliações positivas</dt><dd className="text-white">{sellerPositive === null ? "—" : `${sellerPositive}%`}</dd></div><div className="flex justify-between py-2"><dt className="text-white/40">Último acesso</dt><dd className="text-white">—</dd></div></dl></section>
            <section className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5"><h2 className="font-black text-white">Verificações</h2><div className="mt-3 space-y-2 text-sm">{[["E-mail", null], ["Telefone", null], ["Documentos", seller?.isVerified ? true : null]].map(([label, verified]) => <div key={String(label)} className="flex justify-between"><span className="text-white/55">{String(label)}</span><span className={verified === true ? "text-[#00c950]" : "text-white/40"}>{verified === true ? "Verificado" : "—"}</span></div>)}</div></section>
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
