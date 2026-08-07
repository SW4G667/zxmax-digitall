import React, { useState } from "react";
import { useStore, ProductVariation } from "@/store/StoreContext";
import { StarEmoji, FireEmoji, RocketEmoji, ShieldEmoji, ChatEmoji } from "@/components/CustomEmojis";
import { Search, X, CheckCircle, ShoppingCart, MessageSquare, Star, Info, Send } from "lucide-react";
import { toast } from "sonner";
import UserProfileModal from "@/components/UserProfileModal";
import PixPaymentModal, { PixCharge } from "@/components/PixPaymentModal";
import AuthScreen from "@/components/AuthScreen";

export default function StoreView() {
  const { state, addProductQuestion, buyProduct, refreshPurchases, savePixCharge } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [question, setQuestion] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "reviews" | "questions">("info");
  const [authOpen, setAuthOpen] = useState(false);

  const approved = state.products.filter((p) => p.approved);
  const categories = ["Todos", ...state.config.categories];
  const filtered = approved.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "Todos" || p.category === category;
    return matchSearch && matchCat;
  });

  const product = selectedProduct ? state.products.find((p) => p.id === selectedProduct) : null;
  const productReviews = product
    ? state.purchases.filter((p) => p.productId === product.id && p.reviewed)
    : [];
  const avgRating = productReviews.length > 0
    ? (productReviews.reduce((a, r) => a + (r.reviewStars || 0), 0) / productReviews.length).toFixed(1)
    : null;
  const sellerProducts = product
    ? state.products.filter((p) => p.sellerId === product.sellerId && p.approved)
    : [];
  const sellerSales = product
    ? state.purchases.filter((p) => sellerProducts.some((sp) => sp.id === p.productId)).length
    : 0;

  const [buyLoading, setBuyLoading] = useState(false);
  const [pixCharge, setPixCharge] = useState<PixCharge | null>(null);
  const [paidPurchaseId, setPaidPurchaseId] = useState<number | null>(null);

  const handleBuy = async () => {
    if (!product || !state.currentUser) {
      setAuthOpen(true);
      return;
    }

    const price = selectedVariation ? selectedVariation.price : product.price;

    if (price < 5) {
      toast.error("O valor mínimo para pagamento via PIX é R$ 5,00.");
      return;
    }

    setBuyLoading(true);
    try {
      const purchaseId = await buyProduct(product.id, selectedVariation || undefined);
      if (!purchaseId) throw new Error("Não foi possível registrar a compra.");
      const { supabase } = await import("@/integrations/supabase/client");
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
        setPaidPurchaseId(purchaseId);
        savePixCharge(purchaseId, { evopayId: data.id, qrCodeText: data.qrCodeText, expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() });
        setPixCharge({ evopayId: data.id, qrCodeText: data.qrCodeText, amount: data.amount ?? price });
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

  const handlePixPaid = () => {
    void refreshPurchases();
    toast.success("Pagamento confirmado! Acesse 'Minhas Compras' para ver a entrega.");
  };


  const handleSendQuestion = () => {
    if (!question.trim() || !product) return;
    addProductQuestion(product.id, question.trim());
    toast.success("Pergunta enviada ao vendedor!");
    setQuestion("");
  };

  const productQuestions = product?.questions || [];

  const [visibleCount, setVisibleCount] = useState(12);
  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="store-ember animate-fade-in-up -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 py-8 sm:py-10 min-h-[85vh] sm:rounded-3xl">
      {/* Header + busca */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div className="space-y-2">
          <h1 className="store-card-title text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            Descobrir <span className="text-primary">ZXMAX</span>
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium uppercase tracking-widest">
            Marketplace de Ativos Digitais
          </p>
        </div>

        <div className="relative w-full md:w-96 group">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="O que você está procurando?"
            className="w-full bg-card border border-border text-foreground pl-12 pr-5 py-4 rounded-2xl outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground"
          />
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
      </div>

      {/* Categorias */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-8 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setCategory(cat); setVisibleCount(12); }}
            className={`shrink-0 px-6 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all active:scale-95 ${
              category === cat
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grade de produtos */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-3xl py-20 text-center">
          <p className="store-card-title text-lg font-bold text-foreground">Nenhum produto encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">Tente outra categoria ou busca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {visible.map((p, i) => (
            <div
              key={p.id}
              onClick={() => { setSelectedProduct(p.id); setSelectedVariation(null); setDetailTab("info"); }}
              className="group bg-card border border-border rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 hover:border-primary hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-fade-in-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="relative aspect-[4/3] bg-background overflow-hidden">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700"
                />
                {p.sales > 50 && (
                  <div className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] font-black uppercase px-2 py-1 rounded-md tracking-tighter shadow-xl">
                    Destaque
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-card to-transparent" />
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={state.userDirectory?.[p.sellerId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.seller)}`}
                    alt={p.seller}
                    className="w-6 h-6 rounded-full bg-muted object-cover shrink-0"
                  />
                  <span className="text-xs font-bold text-foreground truncate">{p.seller}</span>
                  {state.userDirectory?.[p.sellerId]?.isVerified && (
                    <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                </div>

                <h3 className="store-card-title text-foreground font-bold text-lg leading-tight line-clamp-2 h-12">
                  {p.name}
                </h3>

                <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                  <span className="text-primary font-bold">★ {p.rating || "Novo"}</span>
                  <span>({p.sales} vendas)</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-primary font-black text-xl">R$ {p.price.toFixed(2)}</span>
                  <span className="bg-primary text-primary-foreground p-2.5 rounded-xl group-hover:brightness-110 transition-all">
                    <ShoppingCart className="w-5 h-5" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {visibleCount < filtered.length && (
        <div className="flex items-center justify-center pt-10">
          <button
            onClick={() => setVisibleCount((c) => c + 12)}
            className="px-10 py-4 bg-card border border-border text-foreground rounded-2xl font-bold hover:bg-muted transition-all"
          >
            Carregar Mais Produtos
          </button>
        </div>
      )}


      {/* Product Detail Modal */}
      {product && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-foreground/50 backdrop-blur-sm" onClick={() => setSelectedProduct(null)}>
          <div className="glass-card w-full max-w-2xl bg-card animate-fade-in-up overflow-hidden max-h-[90vh] flex flex-col relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedProduct(null)} className="absolute top-3 right-3 z-[10] bg-card/90 backdrop-blur p-2 rounded-full shadow-lg hover:bg-muted transition">
              <X className="w-5 h-5 text-foreground" />
            </button>

            <div className="overflow-y-auto flex-1">
              {/* Banner */}
              <div className="relative h-44 sm:h-64 shrink-0">
                <img src={product.banner || product.image} className="w-full h-full object-cover" alt={product.name} />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card/95 to-transparent p-5 pt-14">
                  <h2 className="text-lg sm:text-2xl font-black text-foreground leading-tight">{product.name}</h2>
                  <p className="text-xs text-muted-foreground mt-1">{product.category}</p>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-6">
                {/* Seller section */}
                <button onClick={() => setSelectedSellerId(product.sellerId)} className="w-full bg-muted rounded-2xl p-4 flex items-center gap-4 hover:bg-muted/80 transition text-left">
                  <img src={state.userDirectory?.[product.sellerId]?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(product.seller)}`} className="w-12 h-12 rounded-full bg-primary/10 border-2 border-card shadow object-cover" alt={product.seller} />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-sm">{product.seller}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">ID: {product.sellerPublicId || state.userDirectory?.[product.sellerId]?.publicId || "indisponível"}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <div className="flex items-center gap-0.5">
                        <StarEmoji className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold text-foreground">{avgRating || "Novo"}</span>
                        <span className="text-[10px] text-muted-foreground">({productReviews.length})</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">· {sellerSales} vendas</span>
                    </div>
                  </div>
                </button>

                {/* Tabs Header */}
                <div className="flex gap-1 border-b border-border/40 overflow-x-auto scrollbar-hide">
                  {[
                    { id: "info", label: "Informações", icon: Info },
                    { id: "reviews", label: `Avaliações (${productReviews.length})`, icon: Star },
                    { id: "questions", label: `Dúvidas (${productQuestions.length})`, icon: MessageSquare },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setDetailTab(t.id as any)}
                      className={`px-4 py-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${detailTab === t.id ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    >
                      <t.icon className="w-3.5 h-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="animate-fade-in-up">
                  {detailTab === "info" && (
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-2">
                        <div className="flex items-center gap-1.5 bg-success/10 text-success px-3 py-1.5 rounded-full text-xs font-bold">
                          <CheckCircle className="w-3.5 h-3.5" /> Vendedor Verificado
                        </div>
                        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold">
                          <ShieldEmoji className="w-3.5 h-3.5" /> Entrega Garantida
                        </div>
                        {product.deliveryType === "auto" && (
                          <div className="flex items-center gap-1.5 bg-accent/10 text-accent-foreground px-3 py-1.5 rounded-full text-xs font-bold">
                            <RocketEmoji className="w-3.5 h-3.5" /> Entrega Automática
                          </div>
                        )}
                      </div>

                      {product.variations && product.variations.length > 0 && (
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-muted-foreground uppercase">Escolha uma opção</p>
                          <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => setSelectedVariation(null)} className={`p-3 rounded-xl border text-left transition ${!selectedVariation ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"}`}>
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-foreground">Padrão</span>
                                <span className="text-sm font-black text-primary">R$ {product.price.toFixed(2)}</span>
                              </div>
                            </button>
                            {product.variations.map((v, i) => (
                              <button key={i} onClick={() => setSelectedVariation(v)} className={`p-3 rounded-xl border text-left transition ${selectedVariation?.name === v.name ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted"}`}>
                                <div className="flex justify-between items-center">
                                  <span className="text-sm font-bold text-foreground">{v.name}</span>
                                  <span className="text-sm font-black text-primary">R$ {v.price.toFixed(2)}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-xs font-bold text-muted-foreground uppercase">Descrição</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{product.description}</p>
                      </div>
                    </div>
                  )}

                  {detailTab === "reviews" && (
                    <div className="space-y-4">
                      {productReviews.length === 0 ? (
                        <p className="text-center py-10 text-muted-foreground text-sm italic">Nenhuma avaliação ainda.</p>
                      ) : (
                        productReviews.map((r, i) => (
                          <div key={i} className="bg-muted/50 p-4 rounded-2xl border border-border/20">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                  {(r.buyerPublicId || "ZX").substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-foreground">Comprador #{r.buyerPublicId || r.buyerId.slice(0, 6)}</p>
                                  <div className="flex gap-0.5">
                                    {[...Array(5)].map((_, j) => <StarEmoji key={j} className="w-2.5 h-2.5" filled={j < (r.reviewStars || 0)} />)}
                                  </div>
                                </div>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-foreground leading-relaxed">{r.reviewComment}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {detailTab === "questions" && (
                    <div className="space-y-6">
                      <div className="flex gap-2">
                        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Tire sua dúvida com o vendedor..." className="flex-1 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-sm text-foreground" />
                        <button onClick={handleSendQuestion} className="btn-gradient p-3 rounded-xl"><Send className="w-4 h-4" /></button>
                      </div>
                      <div className="space-y-4">
                        {productQuestions.length === 0 ? (
                          <p className="text-center py-10 text-muted-foreground text-sm italic">Nenhuma pergunta ainda.</p>
                        ) : (
                          productQuestions.map((q) => (
                            <div key={q.id} className="space-y-2">
                              <div className="bg-muted/50 p-4 rounded-2xl border border-border/20">
                                <p className="text-[10px] font-bold text-primary uppercase mb-1">{q.userName}</p>
                                <p className="text-xs text-foreground">{q.text}</p>
                              </div>
                              {q.answer && (
                                <div className="ml-6 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                                  <p className="text-[10px] font-bold text-success uppercase mb-1">Resposta do Vendedor</p>
                                  <p className="text-xs text-foreground">{q.answer}</p>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Purchase Action */}
            <div className="p-4 sm:p-6 bg-card border-t border-border/40 shrink-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Total</p>
                  <p className="text-2xl font-black text-foreground">R$ {(selectedVariation ? selectedVariation.price : product.price).toFixed(2)}</p>
                </div>
                <button onClick={handleBuy} disabled={buyLoading} className="flex-1 btn-gradient py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50">
                  {buyLoading ? "Processando..." : <><ShoppingCart className="w-5 h-5" /> Comprar Agora</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSellerId && (
        <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />
      )}

      <PixPaymentModal charge={pixCharge} onClose={() => setPixCharge(null)} onPaid={handlePixPaid} />
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
