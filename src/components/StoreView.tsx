import React, { useState, useRef } from "react";
import { useStore } from "@/store/StoreContext";
import { StarEmoji, FireEmoji, RocketEmoji, ShieldEmoji, ChatEmoji } from "@/components/CustomEmojis";
import { Search, X, CheckCircle, AlertTriangle, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export default function StoreView() {
  const { state, addProductQuestion, buyProduct } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [question, setQuestion] = useState("");

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
    ? state.products.filter((p) => p.sellerEmail === product.sellerEmail && p.approved)
    : [];
  const sellerSales = product
    ? state.purchases.filter((p) => sellerProducts.some((sp) => sp.id === p.productId)).length
    : 0;

  

  const [buyLoading, setBuyLoading] = useState(false);

  const handleBuy = async () => {
    if (!product || !state.currentUser) {
      toast.error("Você precisa estar logado para comprar.");
      return;
    }

    if (product.price < 0.50) {
      toast.error("O preço mínimo para pagamento é R$ 0,50.");
      return;
    }

    buyProduct(product.id);

    setBuyLoading(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      console.log("Iniciando checkout AbacatePay para:", {
        productName: product.name,
        priceInCents: Math.round(product.price * 100),
        buyerEmail: state.currentUser.email,
      });

      const { data, error } = await supabase.functions.invoke("create-abacatepay-checkout", {
        body: {
          productName: product.name,
          priceInCents: Math.round(product.price * 100),
          buyerEmail: state.currentUser.email,
        },
      });

      if (error) {
        console.error("Erro na invocação da função:", error);
        throw error;
      }

      console.log("Resposta do AbacatePay:", data);

      if (data?.url) {
        toast.success("Redirecionando para pagamento...");
        window.open(data.url, "_blank");
      } else if (data?.error) {
        console.error("Erro retornado pela API:", data.error);
        toast.error("Erro ao criar sessão de pagamento: " + data.error);
      } else {
        console.error("Resposta inesperada:", data);
        toast.error("Erro ao criar sessão de pagamento. Tente novamente.");
      }
    } catch (err: any) {
      console.error("Erro completo no handleBuy:", err);
      toast.error("Erro ao conectar com pagamento: " + (err.message || "Tente novamente."));
    } finally {
      setBuyLoading(false);
    }
  };

  const handleSendQuestion = () => {
    if (!question.trim() || !product) return;
    addProductQuestion(product.id, question.trim());
    toast.success("Pergunta enviada ao vendedor!");
    setQuestion("");
  };

  const productQuestions = product?.questions || [];

  return (
    <div className="animate-fade-in-up">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground">Descobrir</h1>
          <RocketEmoji className="w-8 h-8" />
        </div>
        <p className="text-muted-foreground">Os melhores produtos digitais com entrega imediata.</p>
      </div>

      {/* Search mobile */}
      <div className="md:hidden flex items-center bg-card rounded-2xl px-4 py-3 mb-6 border border-border/40">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produtos..." className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-foreground placeholder:text-muted-foreground" />
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
        {categories.map((cat) => (
          <button key={cat} onClick={() => setCategory(cat)} className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${category === cat ? "btn-gradient" : "bg-card border border-border/40 text-muted-foreground hover:text-foreground"}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((p, i) => (
          <div key={p.id} onClick={() => setSelectedProduct(p.id)} className="glass-card overflow-hidden group animate-fade-in-up cursor-pointer" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="relative h-48 overflow-hidden">
              <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />
              <div className="absolute top-3 right-3 bg-card/90 backdrop-blur px-3 py-1 rounded-full text-[11px] font-bold text-foreground shadow-sm">{p.category}</div>
              {p.sales > 50 && (
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-destructive/90 backdrop-blur px-2 py-1 rounded-full">
                  <FireEmoji className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold text-destructive-foreground">HOT</span>
                </div>
              )}
            </div>
            <div className="p-5">
              <div className="flex justify-between items-start mb-1">
                <h3 className="font-bold text-foreground leading-tight">{p.name}</h3>
                <div className="flex items-center gap-0.5 shrink-0">
                  <StarEmoji className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold text-foreground">{p.rating || "Novo"}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-1">por <span className="text-primary font-semibold">{p.seller}</span></p>
              <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{p.description}</p>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Preço</p>
                  <p className="text-xl font-black text-foreground">R$ {p.price.toFixed(2)}</p>
                </div>
                <span className="btn-gradient px-5 py-2.5 text-sm">Ver Produto</span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">{p.sales} vendas</p>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <p className="text-2xl mb-2">🏜️</p>
          <p className="text-muted-foreground font-medium">Nenhum produto encontrado.</p>
        </div>
      )}

      {/* ── GGMAX-style Product Detail Modal ── */}
      {product && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-foreground/50 backdrop-blur-sm"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="glass-card w-full max-w-2xl bg-card animate-fade-in-up overflow-hidden max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed close button - always visible */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-3 right-3 z-[10] bg-card/90 backdrop-blur p-2 rounded-full shadow-lg hover:bg-muted transition"
              title="Fechar"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>

            {/* Banner */}
            <div className="relative h-44 sm:h-64">
              <img src={product.banner || product.image} className="w-full h-full object-cover" alt={product.name} />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card/95 to-transparent p-5 pt-14">
                <h2 className="text-lg sm:text-2xl font-black text-foreground leading-tight">{product.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">{product.category}</p>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {/* Seller section */}
              <div className="bg-muted rounded-2xl p-4 flex items-center gap-4">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(product.seller)}`}
                  className="w-12 h-12 rounded-full bg-primary/10 border-2 border-card shadow"
                  alt={product.seller}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm">{product.seller}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <div className="flex items-center gap-0.5">
                      <StarEmoji className="w-3.5 h-3.5" />
                      <span className="text-xs font-bold text-foreground">{avgRating || "Novo"}</span>
                      <span className="text-[10px] text-muted-foreground">({productReviews.length})</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">· {sellerSales} vendas</span>
                  </div>
                </div>
              </div>

              {/* Verification badges */}
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

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Descrição</h4>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{product.description}</p>
              </div>

              {/* Variations */}
              {product.variations && product.variations.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Variações</h4>
                  <div className="flex flex-wrap gap-2">
                    {product.variations.map((v, i) => (
                      <span key={i} className="px-3 py-1.5 bg-muted rounded-full text-xs font-semibold text-foreground">
                        {v.name} — R$ {v.price.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Vendas</p>
                  <p className="text-lg font-black text-foreground">{product.sales}</p>
                </div>
                <div className="bg-muted p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Entrega</p>
                  <p className="text-lg font-black text-foreground">{product.deliveryType === "auto" ? "Auto" : "Manual"}</p>
                </div>
                <div className="bg-muted p-3 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Nota</p>
                  <p className="text-lg font-black text-foreground flex items-center justify-center gap-1">
                    <StarEmoji className="w-4 h-4" /> {avgRating || "—"}
                  </p>
                </div>
              </div>

              {/* Reviews */}
              {productReviews.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Avaliações recentes</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {productReviews.slice(0, 5).map((r) => (
                      <div key={r.id} className="bg-muted p-3 rounded-xl">
                        <div className="flex gap-0.5 mb-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <StarEmoji key={s} className="w-3 h-3" filled={s <= (r.reviewStars || 0)} />
                          ))}
                        </div>
                        <p className="text-xs text-foreground">{r.reviewComment}</p>
                        <p className="text-[9px] text-muted-foreground mt-1">{r.buyerEmail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Questions / Perguntas section */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                  <ChatEmoji className="w-4 h-4" /> Perguntas ({productQuestions.length})
                </h4>

                {/* Existing questions */}
                {productQuestions.length > 0 && (
                  <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                    {productQuestions.map((q) => (
                      <div key={q.id} className="bg-muted rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(q.userName)}`}
                            className="w-5 h-5 rounded-full"
                            alt=""
                          />
                          <span className="text-xs font-bold text-foreground">{q.userName}</span>
                          <span className="text-[9px] text-muted-foreground">{new Date(q.date).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <p className="text-xs text-foreground">{q.text}</p>
                        {q.answer && (
                          <div className="mt-2 pl-3 border-l-2 border-primary/40">
                            <p className="text-[10px] font-bold text-primary mb-0.5">Resposta do vendedor:</p>
                            <p className="text-xs text-foreground">{q.answer}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {state.currentUser ? (
                  <div className="flex gap-2">
                    <input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSendQuestion(); }}
                      placeholder="Faça uma pergunta ao vendedor..."
                      className="flex-1 p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary"
                    />
                    <button onClick={handleSendQuestion} className="btn-gradient px-4 py-2 text-sm">
                      Enviar
                    </button>
                  </div>
                ) : (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-center">
                    <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
                      Faça login para enviar perguntas ao vendedor.
                    </p>
                  </div>
                )}
              </div>

              {/* Payment info */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                <ShieldEmoji className="w-5 h-5 mx-auto mb-2" />
                <p className="text-sm font-bold text-foreground">Pagamento seguro via AbacatePay</p>
                <p className="text-xs text-muted-foreground mt-1">Ao clicar em COMPRAR, você será redirecionado para o checkout seguro com PIX.</p>
              </div>

              {/* Price + Buy */}
              <div className="flex items-center justify-between bg-muted rounded-2xl p-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Preço</p>
                  <p className="text-2xl sm:text-3xl font-black text-foreground">R$ {product.price.toFixed(2)}</p>
                </div>
                <button onClick={handleBuy} disabled={buyLoading} className="btn-gradient px-6 sm:px-8 py-3 text-sm sm:text-base font-black rounded-2xl shadow-lg hover:scale-105 transition-transform disabled:opacity-50">
                  {buyLoading ? "Processando..." : "COMPRAR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
