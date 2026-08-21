import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useStore, ProductVariation } from "@/store/StoreContext";
import { ArrowLeft, Shield, CheckCircle, Zap, Star, MessageSquare, Share2, Flag, Heart, ShoppingCart, Send, Eye } from "lucide-react";
import { toast } from "sonner";
import ProductCard from "@/components/ProductCard";
import PixPaymentModal, { PixCharge } from "@/components/PixPaymentModal";
import AuthScreen from "@/components/AuthScreen";
import UserProfileModal from "@/components/UserProfileModal";
import AppShell from "@/components/AppShell";
import useFavorites from "@/hooks/useFavorites";
import { supabase } from "@/integrations/supabase/client";

export default function ProdutoPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, addProductQuestion, buyProduct, refreshPurchases, savePixCharge } = useStore();
  const { isFavorite, toggle } = useFavorites();
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "reviews" | "questions">("info");
  const [question, setQuestion] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [buyLoading, setBuyLoading] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);
  const [showShare, setShowShare] = useState(false);

  const productId = Number(id);
  const product = state.products.find((p) => p.id === productId);

  const productReviews = useMemo(() => {
    if (!product) return [];
    return state.purchases.filter((p) => p.productId === product.id && p.reviewed);
  }, [product, state.purchases]);

  const avgRating = productReviews.length > 0 ? (productReviews.reduce((a, r) => a + (r.reviewStars || 0), 0) / productReviews.length).toFixed(1) : null;

  const sellerProducts = useMemo(() => {
    if (!product) return [];
    return state.products.filter((p) => p.sellerId === product.sellerId && p.approved && p.id !== product.id).slice(0, 5);
  }, [product, state.products]);

  const sellerSales = useMemo(() => {
    if (!product) return 0;
    const sellerProds = state.products.filter((p) => p.sellerId === product.sellerId && p.approved);
    return state.purchases.filter((p) => sellerProds.some((sp) => sp.id === p.productId)).length;
  }, [product, state.products, state.purchases]);

  const productQuestions = product?.questions || [];

  useEffect(() => {
    if (product) setSelectedVariation(null);
  }, [product?.id]);

  if (!product) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-3xl mb-3">😕</p>
          <p className="text-foreground font-bold">Produto não encontrado</p>
          <button onClick={() => navigate("/loja")} className="btn-gradient px-6 py-3 rounded-xl font-bold text-sm mt-4">Voltar para a loja</button>
        </div>
      </AppShell>
    );
  }

  const price = selectedVariation ? selectedVariation.price : product.price;

  const handleBuy = async () => {
    if (!state.currentUser) {
      setAuthOpen(true);
      return;
    }
    if (price < 2) {
      toast.error("O valor mínimo para pagamento via PIX é R$ 2,00.");
      return;
    }
    setBuyLoading(true);
    try {
      const purchaseId = await buyProduct(product.id, selectedVariation || undefined);
      if (!purchaseId) throw new Error("Não foi possível registrar a compra.");
      const { data, error } = await supabase.functions.invoke("create-evopay-pix", {
        body: {
          purchaseId,
          productName: selectedVariation ? `${product.name} - ${selectedVariation.name}` : product.name,
          amount: price,
          buyerName: state.currentUser.name,
        },
      });
      if (error) throw error;
      if (data?.qrCodeText) {
        savePixCharge(purchaseId, { evopayId: data.id, qrCodeText: data.qrCodeText, expiresAt: data.expiresAt || new Date(Date.now() + 3600 * 1000).toISOString() });
        setPixCharge({ evopayId: data.id, qrCodeText: data.qrCodeText, amount: data.amount ?? price, qrCodeUrl: data.qrCodeUrl, purchaseId });
      } else if (data?.error) {
        toast.error("Erro ao gerar PIX: " + data.error);
      } else {
        toast.error("Erro ao gerar cobrança PIX. Tente novamente.");
      }
    } catch (err: any) {
      toast.error("Erro ao conectar com pagamento: " + (err.message || "Tente novamente."));
    } finally {
      setBuyLoading(false);
    }
  };

  const handlePixPaid = async () => {
    void refreshPurchases();
    toast.success("Pagamento confirmado! Acesse 'Minhas Compras' para ver a entrega.");
    // Try to send transactional emails (buyer + seller) via edge function - idempotent
    try {
      const latest = state.purchases.find((p) => p.productId === product.id && p.buyerId === state.currentUser?.id);
      if (latest) {
        await supabase.functions.invoke("send-email", {
          body: { type: "purchase_confirmed", purchaseId: latest.id },
        });
      }
    } catch {}
  };

  const handleSendQuestion = () => {
    if (!question.trim()) return;
    addProductQuestion(product.id, question.trim());
    toast.success("Pergunta enviada ao vendedor!");
    setQuestion("");
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const fav = isFavorite(product.id);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 overflow-x-auto scrollbar-hide">
          <Link to="/loja" className="hover:text-foreground">Loja</Link>
          <span>/</span>
          <button onClick={() => navigate(`/loja?cat=${encodeURIComponent(product.category)}`)} className="hover:text-foreground">{product.category}</button>
          <span>/</span>
          <span className="text-foreground font-semibold truncate">{product.name}</span>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Left */}
          <div className="space-y-6">
            {/* Image grande */}
            <div className="glass-card overflow-hidden">
              <div className="relative aspect-[16/10] bg-muted">
                <img src={product.banner || product.image} alt={product.name} className="w-full h-full object-cover" />
                <div className="absolute top-3 left-3 flex gap-2">
                  {product.deliveryType === "auto" && <span className="badge-auto">Auto</span>}
                  {product.sales > 50 && <span className="badge-hot">HOT</span>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggle(product.id); }}
                  className={`absolute top-3 right-3 p-2.5 rounded-full backdrop-blur-md transition ${fav ? "bg-primary text-white" : "bg-card/80 text-muted-foreground"}`}
                >
                  <Heart className={`w-5 h-5 ${fav ? "fill-current" : ""}`} />
                </button>
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-black text-foreground leading-tight">{product.name}</h1>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs bg-muted px-2.5 py-1 rounded-full font-bold">{product.category}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="w-3.5 h-3.5" /> {product.sales} vendas</span>
                      {avgRating && <span className="flex items-center gap-1 text-xs font-bold"><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> {avgRating} ({productReviews.length})</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={handleShare} className="p-2 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground"><Share2 className="w-4 h-4" /></button>
                    <button onClick={() => toast.info("Denúncia registrada. Nossa equipe vai analisar.")} className="p-2 rounded-lg bg-muted hover:bg-muted/70 text-muted-foreground"><Flag className="w-4 h-4" /></button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b border-border/40 mt-6 overflow-x-auto scrollbar-hide">
                  {[
                    { id: "info", label: "Informações" },
                    { id: "reviews", label: `Avaliações (${productReviews.length})` },
                    { id: "questions", label: `Dúvidas (${productQuestions.length})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setDetailTab(t.id as any)}
                      className={`px-4 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition ${detailTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="pt-5">
                  {detailTab === "info" && (
                    <div className="space-y-5">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{product.description}</p>

                      {product.variations && product.variations.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Variações</p>
                          <div className="grid gap-2">
                            <button onClick={() => setSelectedVariation(null)} className={`p-3 rounded-xl border text-left transition ${!selectedVariation ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold">Padrão</span>
                                <span className="text-sm font-black text-primary">R$ {product.price.toFixed(2)}</span>
                              </div>
                            </button>
                            {product.variations.map((v, i) => (
                              <button key={i} onClick={() => setSelectedVariation(v)} className={`p-3 rounded-xl border text-left transition ${selectedVariation?.name === v.name ? "border-primary bg-primary/5" : "border-border hover:bg-muted"}`}>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-bold">{v.name}</span>
                                  <span className="text-sm font-black text-primary">R$ {v.price.toFixed(2)}</span>
                                </div>
                                {v.description && <p className="text-[11px] text-muted-foreground mt-1">{v.description}</p>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Garantias */}
                      <div className="grid sm:grid-cols-3 gap-3">
                        <div className="bg-success/10 border border-success/20 rounded-xl p-3">
                          <Shield className="w-5 h-5 text-success mb-1" />
                          <p className="text-xs font-bold text-foreground">Compra Protegida</p>
                          <p className="text-[11px] text-muted-foreground">Reembolso garantido</p>
                        </div>
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3">
                          <Zap className="w-5 h-5 text-primary mb-1" />
                          <p className="text-xs font-bold text-foreground">Entrega {product.deliveryType === "auto" ? "Automática" : "Manual"}</p>
                          <p className="text-[11px] text-muted-foreground">{product.deliveryType === "auto" ? "Imediata" : "Via chat"}</p>
                        </div>
                        <div className="bg-muted rounded-xl p-3 border border-border/40">
                          <CheckCircle className="w-5 h-5 text-foreground mb-1" />
                          <p className="text-xs font-bold text-foreground">Suporte 24h</p>
                          <p className="text-[11px] text-muted-foreground">Equipe pronta</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {detailTab === "reviews" && (
                    <div className="space-y-3">
                      {productReviews.length === 0 ? <p className="text-sm text-muted-foreground italic text-center py-10">Nenhuma avaliação ainda.</p> :
                        productReviews.map((r, i) => (
                          <div key={i} className="bg-muted/50 p-4 rounded-xl border border-border/20">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">{(r.buyerPublicId || "ZX").slice(0, 2).toUpperCase()}</div>
                                <span className="text-xs font-bold">Comprador #{r.buyerPublicId || r.buyerId.slice(0, 6)}</span>
                                <div className="flex">{[...Array(5)].map((_, j) => <Star key={j} className={`w-3 h-3 ${j < (r.reviewStars || 0) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />)}</div>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs">{r.reviewComment}</p>
                          </div>
                        ))}
                    </div>
                  )}
                  {detailTab === "questions" && (
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Tire sua dúvida..." className="flex-1 input-gg" />
                        <button onClick={handleSendQuestion} className="btn-gradient p-3 rounded-xl"><Send className="w-4 h-4" /></button>
                      </div>
                      {productQuestions.length === 0 ? <p className="text-sm text-muted-foreground italic text-center py-10">Nenhuma pergunta ainda.</p> :
                        productQuestions.map((q) => (
                          <div key={q.id} className="space-y-2">
                            <div className="bg-muted/50 p-3 rounded-xl"><p className="text-[10px] font-bold text-primary uppercase">{q.userName}</p><p className="text-xs">{q.text}</p></div>
                            {q.answer && <div className="ml-6 bg-primary/5 p-3 rounded-xl border border-primary/10"><p className="text-[10px] font-bold text-success uppercase">Resposta do vendedor</p><p className="text-xs">{q.answer}</p></div>}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vendedor */}
            <div className="glass-card p-5">
              <h3 className="font-bold text-foreground mb-3">Vendedor</h3>
              <button onClick={() => setSelectedSellerId(product.sellerId)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted hover:bg-muted/80 transition text-left">
                <img src={state.userDirectory?.[product.sellerId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.seller}`} className="w-12 h-12 rounded-full bg-primary/10" alt={product.seller} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{product.seller}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">ID: {product.sellerPublicId || state.userDirectory?.[product.sellerId]?.publicId || "—"}</p>
                  <p className="text-[11px] text-muted-foreground">{sellerSales} vendas • {avgRating || "Novo"}</p>
                </div>
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Anúncios parecidos */}
            {sellerProducts.length > 0 && (
              <div>
                <h3 className="font-bold text-foreground mb-3">Anúncios parecidos</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {sellerProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sticky buy box desktop */}
          <div className="lg:sticky lg:top-20 h-fit space-y-4">
            <div className="glass-card p-5">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <p className="text-[11px] uppercase font-bold text-muted-foreground">Preço</p>
                  <p className="text-3xl font-black text-foreground">R$ {price.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Entrega</p>
                  <p className="text-xs font-bold text-success">{product.deliveryType === "auto" ? "Automática" : "Manual"}</p>
                </div>
              </div>

              {selectedVariation && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
                  <p className="text-xs font-bold text-foreground">{selectedVariation.name}</p>
                  <p className="text-[11px] text-muted-foreground">R$ {selectedVariation.price.toFixed(2)}</p>
                </div>
              )}

              <button onClick={handleBuy} disabled={buyLoading} className="w-full btn-gradient py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                {buyLoading ? "Processando..." : <><ShoppingCart className="w-5 h-5" /> Comprar agora</>}
              </button>

              <div className="mt-4 space-y-2 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-success" /> Compra protegida e reembolso garantido</div>
                <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5 text-primary" /> Entrega {product.deliveryType === "auto" ? "imediata" : "via chat"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile fixed bar */}
        <div className="lg:hidden fixed bottom-20 left-0 right-0 p-3 bg-card/95 backdrop-blur-xl border-t border-border/60 z-40">
          <div className="flex items-center gap-3 max-w-7xl mx-auto">
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Total</p>
              <p className="text-lg font-black">R$ {price.toFixed(2)}</p>
            </div>
            <button onClick={handleBuy} disabled={buyLoading} className="flex-1 btn-gradient py-3 rounded-xl font-bold text-sm disabled:opacity-50">
              {buyLoading ? "Processando..." : "Comprar"}
            </button>
          </div>
        </div>
      </div>

      {selectedSellerId && <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />}
      <PixPaymentModal charge={pixCharge} onClose={() => setPixCharge(null)} onPaid={handlePixPaid} />
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </AppShell>
  );
}
