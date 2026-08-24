import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useStore, ProductVariation, Product } from "@/store/StoreContext";
import { Shield, CheckCircle, Zap, Star, MessageSquare, Share2, Flag, Heart, ShoppingCart, Send, Eye, Minus, Plus, ThumbsUp, BadgeCheck, Clock, Package, CreditCard, Bitcoin } from "lucide-react";
import { toast } from "sonner";
import PixPaymentModal, { PixCharge } from "@/components/PixPaymentModal";
import AuthScreen from "@/components/AuthScreen";
import UserProfileModal from "@/components/UserProfileModal";
import AppShell from "@/components/AppShell";
import useFavorites from "@/hooks/useFavorites";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, ROBUX_CATEGORY, robuxPackageUnits, unitPriceFromPackage } from "@/lib/catalog";

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
  verified: boolean;
}

function CheckoutModal({ product, quantity, unitPrice, subtotal, onClose, onConfirm, loading, feePercent }: { product: Product; quantity: number; unitPrice: number; subtotal: number; onClose: () => void; onConfirm: (method: string, cpf: string) => void; loading: boolean; feePercent: number }) {
  const [method, setMethod] = useState<"pix" | "crypto" | "card" | "boleto">("pix");
  const [cpf, setCpf] = useState("");
  const [available, setAvailable] = useState<Record<string, boolean>>({ pix: true, crypto: true, card: true, boleto: true });
  const fee = subtotal * (feePercent / 100);
  const total = subtotal + fee;

  useEffect(() => {
    // Check gateway health - if fails, mark as unavailable
    const checkHealth = async () => {
      try {
        const { data } = await supabase.functions.invoke("integrations-config", { body: { action: "get" } });
        const evopayOk = !!data?.integrations?.evopay?.apiKey_masked || !!data?.integrations?.vexopay?.clientId;
        const stripeOk = !!data?.integrations?.stripe?.secretKey_masked;
        setAvailable({
          pix: evopayOk || true, // PIX fallback true, will show error if fails
          crypto: !!data?.integrations?.vexopay?.clientId || !!data?.integrations?.vexopay?.clientId_masked || true,
          card: stripeOk || true,
          boleto: stripeOk || true,
        });
      } catch {
        // Keep all available, will handle error on confirm
      }
    };
    void checkHealth();
  }, []);

  const handleConfirm = () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (method === "pix" || method === "crypto") {
      if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
        toast.error("Digite um CPF/CNPJ válido (11 ou 14 dígitos) para PIX/Crypto");
        return;
      }
    }
    onConfirm(method, cleanCpf);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#15151a] border border-[#25252e] rounded-2xl w-full max-w-md overflow-hidden animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-[#1e1e28]">
          <h3 className="font-black text-white text-lg">Checkout ZXMAX</h3>
          <p className="text-xs text-white/40 mt-1">{product.name} • {quantity.toLocaleString("pt-BR")} {product.category === ROBUX_CATEGORY ? "Robux" : "un."} • {method.toUpperCase()}</p>
        </div>
        
        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold uppercase text-white/30 mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMethod("pix")} disabled={!available.pix} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition relative ${method === "pix" ? "bg-[#0084ff] border-[#0084ff] text-white" : "bg-[#1a1a20] border-[#25252e] text-white/60 hover:border-white/20"} ${!available.pix ? "opacity-40 cursor-not-allowed" : ""}`}>
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold">PIX</span>
                {!available.pix && <span className="absolute top-1 right-1 text-[8px] bg-red-500 text-white px-1 rounded">Indisponível</span>}
              </button>
              <button onClick={() => setMethod("crypto")} disabled={!available.crypto} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition relative ${method === "crypto" ? "bg-[#ffbd2e] border-[#ffbd2e] text-black" : "bg-[#1a1a20] border-[#25252e] text-white/60 hover:border-white/20"} ${!available.crypto ? "opacity-40 cursor-not-allowed" : ""}`}>
                <Bitcoin className="w-5 h-5" />
                <span className="text-xs font-bold">Crypto</span>
                {!available.crypto && <span className="absolute top-1 right-1 text-[8px] bg-red-500 text-white px-1 rounded">Indisponível</span>}
              </button>
              <button onClick={() => setMethod("card")} disabled={!available.card} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition relative ${method === "card" ? "bg-white border-white text-black" : "bg-[#1a1a20] border-[#25252e] text-white/60 hover:border-white/20"} ${!available.card ? "opacity-40 cursor-not-allowed" : ""}`}>
                <CreditCard className="w-5 h-5" />
                <span className="text-xs font-bold">Cartão (Stripe)</span>
                {!available.card && <span className="absolute top-1 right-1 text-[8px] bg-red-500 text-white px-1 rounded">Indisponível</span>}
              </button>
              <button onClick={() => setMethod("boleto")} disabled={!available.boleto} className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition relative ${method === "boleto" ? "bg-white border-white text-black" : "bg-[#1a1a20] border-[#25252e] text-white/60 hover:border-white/20"} ${!available.boleto ? "opacity-40 cursor-not-allowed" : ""}`}>
                <Package className="w-5 h-5" />
                <span className="text-xs font-bold">Boleto (Stripe)</span>
                {!available.boleto && <span className="absolute top-1 right-1 text-[8px] bg-red-500 text-white px-1 rounded">Indisponível</span>}
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-2">Se alguma forma estiver com problemas, fica indisponível automaticamente. Configure credenciais Stripe em Admin → APIs.</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-white/30 mb-2">CPF para pagamento</p>
            <input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white placeholder:text-white/20 text-sm focus:border-[#0084ff] outline-none" />
            <p className="text-[10px] text-white/30 mt-1">Obrigatório para PIX e Crypto (VexoPay exige documento)</p>
          </div>

          <div className="bg-[#0a0a0f] border border-[#1e1e28] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-xs"><span className="text-white/40">Preço unitário</span><span className="text-white">{formatBRL(unitPrice * (product.category === ROBUX_CATEGORY ? robuxPackageUnits(product) : 1))} / {product.category === ROBUX_CATEGORY ? `${robuxPackageUnits(product).toLocaleString("pt-BR")} Robux` : "un."}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/40">Quantidade</span><span className="text-white">{quantity}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/40">Subtotal</span><span className="text-white">{formatBRL(subtotal)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-white/40">Taxa plataforma ({feePercent}%)</span><span className="text-[#ffbd2e]">+ {formatBRL(fee)}</span></div>
            <div className="h-px bg-[#1e1e28] my-2" />
            <div className="flex justify-between font-black"><span className="text-white">Total</span><span className="text-white text-lg">{formatBRL(total)}</span></div>
            <p className="text-[10px] text-white/30">A taxa é da plataforma. O vendedor recebe {formatBRL(subtotal)}.</p>
          </div>

          <button onClick={handleConfirm} disabled={loading} className="w-full bg-[#ffbd2e] hover:bg-[#e6a829] text-black py-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
            {loading ? "Processando..." : method === "pix" ? "Pagar com PIX" : "Pagar com Crypto"}
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
  const { state, addProductQuestion, buyProduct, refreshPurchases, savePixCharge, catalogStatus, refreshProducts } = useStore();
  const { isFavorite, toggle } = useFavorites();
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "reviews" | "questions">("info");
  const [question, setQuestion] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [sortBy, setSortBy] = useState<"recomendado" | "barato" | "min">("barato");

  const productId = Number(id);
  const product = state.products.find((p) => p.id === productId);

  const isRobux = product?.category === ROBUX_CATEGORY;

  // For Robux, aggregate all sellers in same category as offers
  const sellerOffers: SellerOffer[] = useMemo(() => {
    if (!isRobux) return [];
    const robuxProducts = state.products.filter((p) => p.category === ROBUX_CATEGORY && p.approved);
    const offers: SellerOffer[] = robuxProducts.map((p) => {
      // Real reviews from purchases, not fake 100
      const realReviews = state.purchases.filter((pu) => pu.productId === p.id && pu.reviewed);
      const realRating = realReviews.length > 0 ? realReviews.reduce((a, r) => a + (r.reviewStars || 0), 0) / realReviews.length : 0;
      return {
        id: p.id,
        product: p,
        pricePerUnit: unitPriceFromPackage(p),
        packageUnits: robuxPackageUnits(p),
        packagePrice: p.price,
        stock: p.stock ?? null,
        minQty: p.minQuantity ?? robuxPackageUnits(p),
        delivery: p.deliveryTime || "Combinado com o vendedor",
        sellerName: p.seller,
        sellerId: p.sellerId,
        rating: realReviews.length > 0 ? Number((realRating * 20).toFixed(1)) : 0, // 0 until someone reviews
        reviews: realReviews.length, // 0 initially, not 100 fake
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

  const productReviews = useMemo(() => {
    if (!product) return [];
    return state.purchases.filter((p) => p.productId === product.id && p.reviewed);
  }, [product, state.purchases]);

  const avgRating = productReviews.length > 0 ? (productReviews.reduce((a, r) => a + (r.reviewStars || 0), 0) / productReviews.length).toFixed(1) : null;
  const productQuestions = product?.questions || [];

  useEffect(() => {
    if (product) {
      setSelectedVariation(null);
      if (isRobux) setQuantity(product.minQuantity ?? robuxPackageUnits(product));
    }
  }, [product?.id, isRobux]);

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
  const feePercent = state.config.commission || 10;
  const total = Math.round(subtotal * (1 + feePercent / 100) * 100) / 100;

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

  const handleCheckoutConfirm = async (method: string, cpf: string) => {
    setBuyLoading(true);
    try {
      // Save CPF to profile
      if (state.currentUser) {
        await supabase.from("profiles").update({ cpf } as any).eq("user_id", state.currentUser.id);
      }

      const purchaseId = await buyProduct(product.id, selectedVariation || undefined);
      if (!purchaseId) throw new Error("Falha ao criar pedido");

      if (method === "pix") {
        const { data, error } = await supabase.functions.invoke("create-evopay-pix", {
          body: {
            purchaseId,
            productName: selectedVariation ? `${product.name} - ${selectedVariation.name}` : product.name,
            amount: subtotal,
            buyerName: state.currentUser?.name,
          },
        });
        if (error) throw error;
        if (data?.qrCodeText) {
          savePixCharge(purchaseId, { evopayId: data.id, qrCodeText: data.qrCodeText, expiresAt: data.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString() });
          setPixCharge({ evopayId: data.id, qrCodeText: data.qrCodeText, amount: total, qrCodeUrl: data.qrCodeUrl, purchaseId });
          setCheckoutOpen(false);
        } else {
          toast.error("Erro ao gerar PIX: " + (data?.error || "tente novamente"));
        }
      } else if (method === "crypto") {
        const { data, error } = await supabase.functions.invoke("create-vexopay-crypto", {
          body: {
            purchaseId,
            amount: total,
            network: "TRC20",
            description: product.name,
          },
        });
        if (error) throw error;
        if (data?.address || data?.qrCode) {
          toast.success(`Crypto criada! Envie exatamente ${formatBRL(total)} para o endereço.`);
          setCheckoutOpen(false);
          if (data.qrCode) window.open(data.qrCode, "_blank");
        } else {
          toast.error("Erro Crypto: " + (data?.error || "tente novamente"));
        }
      } else {
        // Stripe card/boleto
        const { data, error } = await supabase.functions.invoke("create-stripe-checkout", {
          body: {
            purchaseId,
            amount: total,
            productName: product.name,
            paymentMethod: method,
          },
        });
        if (error) throw error;
        if (data?.url) {
          toast.success("Redirecionando para Stripe...");
          window.location.href = data.url;
        } else {
          toast.error("Erro Stripe: " + (data?.error || "configure credenciais em Admin → APIs"));
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar compra");
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

  const handleSendQuestion = () => {
    if (!question.trim()) return;
    // Sanitize: remove emojis that shouldn't appear in chat
    const clean = question.trim().replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, "");
    if (!clean) return toast.error("Pergunta inválida");
    addProductQuestion(product.id, clean);
    toast.success("Pergunta enviada!");
    setQuestion("");
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
            Agora aceitamos <span className="italic">PayPal</span> e <span className="flex items-center gap-1"><Bitcoin className="w-3 h-3" /> Crypto</span>
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
                            <span className="flex items-center gap-1 text-[#00c950]"><ThumbsUp className="w-3.5 h-3.5" /> {currentOffer.rating}%</span>
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
                    <p className="font-black text-white text-lg">{formatBRL(currentOffer.packagePrice)} <span className="text-sm font-normal text-white/40">/ {currentOffer.packageUnits.toLocaleString("pt-BR")} Robux</span></p>
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
                    <span>{currentOffer.stock != null ? `Em estoque: ${currentOffer.stock.toLocaleString("pt-BR")}` : "Estoque informado pelo vendedor"}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-white/60">Prazo de entrega</span><span className="font-bold text-white">{currentOffer.delivery}</span></div>
                  <div className="border-t border-[#1e1e28] pt-3 flex justify-between text-lg font-black"><span className="text-white">Total: {formatBRL(total)}</span><span className="text-white/40 text-xs font-normal">taxa {feePercent}% inclusa</span></div>
                </div>

                <button onClick={handleBuyClick} disabled={buyLoading} className="w-full mt-5 bg-[#ffbd2e] hover:bg-[#e6a829] text-black py-4 rounded-xl font-black text-base transition disabled:opacity-50">Comprar agora</button>

                <div className="mt-4 space-y-2.5">
                  <div className="flex gap-2 text-xs"><Shield className="w-4 h-4 text-[#0084ff] shrink-0" /><span className="font-bold text-white">Garantia de reembolso</span><span className="text-white/40">Protegido pelo TradeShield</span></div>
                  <div className="flex gap-2 text-xs"><Zap className="w-4 h-4 text-[#ffbd2e] shrink-0" /><span className="font-bold text-white">Checkout rápido</span><span className="flex gap-1"><span className="bg-[#00c950] text-white px-2 py-0.5 rounded text-[10px] font-bold">PIX</span><span className="bg-black border border-white/10 text-white px-2 py-0.5 rounded text-[10px]">Apple Pay</span><span className="bg-[#0084ff] text-white px-2 py-0.5 rounded text-[10px]">G Pay</span><span className="bg-[#ffbd2e] text-black px-2 py-0.5 rounded text-[10px]">PayPal</span></span></div>
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
                                  <span className="flex items-center gap-1 text-[#00c950]"><ThumbsUp className="w-3 h-3" /> {offer.rating}%</span>
                                  <span className="text-[#0084ff] underline">{offer.reviews} avaliações</span>
                                </>
                              ) : (
                                <span className="text-white/40">Novo • 0 avaliações</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-white">{formatBRL(offer.packagePrice)} <span className="text-xs font-normal text-white/40">/ {offer.packageUnits.toLocaleString("pt-BR")}</span></p>
                          {offer.id === productId && <span className="text-[10px] bg-[#ffbd2e] text-black px-2 py-0.5 rounded-full font-bold">Oferta atual</span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-3 text-xs">
                        <div><p className="text-white/40">Estoque</p><p className="font-bold text-white">{offer.stock != null ? offer.stock.toLocaleString("pt-BR") : "—"}</p></div>
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
                <p className="text-xs text-white/40 mt-1">{quantity.toLocaleString("pt-BR")} Robux · {formatBRL(subtotal)} + taxa {feePercent}%</p>
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

        {checkoutOpen && <CheckoutModal product={product} quantity={quantity} unitPrice={unitPrice} subtotal={subtotal} onClose={() => setCheckoutOpen(false)} onConfirm={handleCheckoutConfirm} loading={buyLoading} feePercent={feePercent} />}
        {selectedSellerId && <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />}
        <PixPaymentModal charge={pixCharge} onClose={() => setPixCharge(null)} onPaid={handlePixPaid} />
        {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
      </AppShell>
    );
  }

  // Regular product view (non-Robux) - GGMAX solid style
  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-white/40 mb-4">
          <Link to="/loja" className="hover:text-white">Loja</Link>
          <span>/</span>
          <button onClick={() => navigate(`/loja?cat=${encodeURIComponent(product.category)}`)} className="hover:text-white">{product.category}</button>
          <span>/</span>
          <span className="text-white font-bold truncate">{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div className="space-y-4">
            <div className="bg-[#15151a] border border-[#25252e] rounded-2xl overflow-hidden">
              <div className="relative aspect-[16/10] bg-[#0a0a0f]">
                <img src={product.banner || product.image} alt={product.name} className="w-full h-full object-cover" />
                <button onClick={() => toggle(product.id)} className={`absolute top-3 right-3 p-2.5 rounded-full transition ${isFavorite(product.id) ? "bg-[#0084ff] text-white" : "bg-black/60 text-white/60 hover:text-white"}`}>
                  <Heart className={`w-5 h-5 ${isFavorite(product.id) ? "fill-current" : ""}`} />
                </button>
              </div>
              <div className="p-5">
                <h1 className="text-xl font-black text-white leading-tight">{product.name}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs bg-[#1a1a20] border border-[#25252e] px-2.5 py-1 rounded-full font-bold text-white/60">{product.category}</span>
                  <span className="flex items-center gap-1 text-xs text-white/40"><Eye className="w-3.5 h-3.5" /> {product.sales} vendas</span>
                </div>

                <div className="flex gap-1 border-b border-[#1e1e28] mt-6">
                  {[
                    { id: "info", label: "Informações" },
                    { id: "reviews", label: `Avaliações (${productReviews.length})` },
                    { id: "questions", label: `Dúvidas (${productQuestions.length})` },
                  ].map((t) => (
                    <button key={t.id} onClick={() => setDetailTab(t.id as any)} className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${detailTab === t.id ? "border-[#0084ff] text-[#0084ff]" : "border-transparent text-white/40 hover:text-white"}`}>{t.label}</button>
                  ))}
                </div>

                <div className="pt-5">
                  {detailTab === "info" && (
                    <div className="space-y-4">
                      <p className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{product.description}</p>
                      {product.variations && product.variations.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase text-white/30 mb-2">Variações</p>
                          <div className="grid gap-2">
                            {product.variations.map((v, i) => (
                              <button key={i} onClick={() => setSelectedVariation(v)} className={`p-3 rounded-xl border text-left transition ${selectedVariation?.name === v.name ? "bg-[#0084ff]/10 border-[#0084ff] text-white" : "bg-[#1a1a20] border-[#25252e] text-white/60 hover:border-white/20"}`}>
                                <div className="flex justify-between"><span className="font-bold">{v.name}</span><span className="font-black text-[#0084ff]">{formatBRL(v.price)}</span></div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-[#00c950]/10 border border-[#00c950]/20 rounded-xl p-3"><Shield className="w-4 h-4 text-[#00c950] mb-1" /><p className="text-xs font-bold text-white">Protegido</p><p className="text-[10px] text-white/40">Reembolso</p></div>
                        <div className="bg-[#0084ff]/10 border border-[#0084ff]/20 rounded-xl p-3"><Zap className="w-4 h-4 text-[#0084ff] mb-1" /><p className="text-xs font-bold text-white">Entrega</p><p className="text-[10px] text-white/40">{product.deliveryType === "auto" ? "Auto" : "Manual"}</p></div>
                        <div className="bg-[#1a1a20] border border-[#25252e] rounded-xl p-3"><Clock className="w-4 h-4 text-white/60 mb-1" /><p className="text-xs font-bold text-white">Suporte</p><p className="text-[10px] text-white/40">24h</p></div>
                      </div>
                    </div>
                  )}
                  {detailTab === "reviews" && (
                    <div className="space-y-2">
                      {productReviews.length === 0 ? <p className="text-sm text-white/40 text-center py-10">Sem avaliações</p> : productReviews.map((r, i) => (
                        <div key={i} className="bg-[#1a1a20] border border-[#25252e] p-3 rounded-xl"><p className="text-xs text-white">{r.reviewComment}</p></div>
                      ))}
                    </div>
                  )}
                  {detailTab === "questions" && (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Tire sua dúvida..." className="flex-1 bg-[#0a0a0f] border border-[#25252e] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:border-[#0084ff] outline-none" />
                        <button onClick={handleSendQuestion} className="bg-[#0084ff] p-3 rounded-xl text-white"><Send className="w-4 h-4" /></button>
                      </div>
                      {productQuestions.map((q) => (
                        <div key={q.id} className="bg-[#1a1a20] border border-[#25252e] p-3 rounded-xl"><p className="text-[10px] font-bold text-[#0084ff] uppercase">{q.userName}</p><p className="text-xs text-white mt-1">{q.text}</p></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:sticky lg:top-20 h-fit space-y-3">
            <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5">
              <p className="text-[11px] uppercase font-bold text-white/30">Total com taxa</p>
              <p className="text-3xl font-black text-white">{formatBRL(total)}</p>
              <p className="text-xs text-white/40">{formatBRL(subtotal)} + {feePercent}% de taxa</p>
              <button onClick={handleBuyClick} disabled={buyLoading} className="w-full mt-4 bg-[#0084ff] hover:bg-[#0066cc] text-white py-3.5 rounded-xl font-black text-sm transition disabled:opacity-50">Comprar agora</button>
            </div>
          </div>
        </div>
      </div>

      {checkoutOpen && <CheckoutModal product={product} quantity={displayQuantity} unitPrice={unitPrice} subtotal={subtotal} onClose={() => setCheckoutOpen(false)} onConfirm={handleCheckoutConfirm} loading={buyLoading} feePercent={feePercent} />}
      {selectedSellerId && <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />}
      <PixPaymentModal charge={pixCharge} onClose={() => setPixCharge(null)} onPaid={handlePixPaid} />
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </AppShell>
  );
}
