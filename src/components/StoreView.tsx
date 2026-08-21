import React, { useState, useEffect, useMemo } from "react";
import { useStore, ProductVariation } from "@/store/StoreContext";
import { Search, ShoppingCart, MessageSquare, Star, Info, Send, Shield, CheckCircle, Zap, TrendingUp, Gift, Gamepad2, Bot, Key, File, Palette, Briefcase, GraduationCap, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import PixPaymentModal, { PixCharge } from "@/components/PixPaymentModal";
import AuthScreen from "@/components/AuthScreen";
import UserProfileModal from "@/components/UserProfileModal";
import useFavorites from "@/hooks/useFavorites";

const CATEGORY_ICONS: Record<string, any> = {
  "Robux e Gift Cards": Gift,
  "Bots Discord": Bot,
  "Contas": Crown,
  "Scripts": File,
  "Assinaturas": Sparkles,
  "Designs Digitais": Palette,
  "Serviços Online": Briefcase,
  "Consultoria Virtual": GraduationCap,
  "Keys de Software": Key,
  "Arquivos": File,
  "Jogos e Itens": Gamepad2,
};

export default function StoreView() {
  const { state, addProductQuestion, buyProduct, refreshPurchases, savePixCharge } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const { isFavorite } = useFavorites();

  const approved = state.products.filter((p) => p.approved);
  const categories = ["Todos", ...state.config.categories];

  // Deep-link ?cat= and ?q=
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get("cat");
    const q = params.get("q");
    if (cat) setCategory(cat);
    if (q) setSearch(q);
  }, [location.search]);

  useEffect(() => {
    const onSearch = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") {
        setSearch(detail);
        setCategory("Todos");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("zxmax:search", onSearch as EventListener);
    return () => window.removeEventListener("zxmax:search", onSearch as EventListener);
  }, []);

  const filtered = useMemo(() => {
    return approved.filter((p) => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
      const matchCat = category === "Todos" || p.category === category;
      return matchSearch && matchCat;
    });
  }, [approved, search, category]);

  const trending = useMemo(() => {
    return [...approved].sort((a, b) => b.sales - a.sales).slice(0, 8);
  }, [approved]);

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    if (cat !== "Todos") {
      navigate(`/loja?cat=${encodeURIComponent(cat)}`, { replace: true });
    } else {
      navigate(`/loja`, { replace: true });
    }
  };

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* Hero */}
      <div className="hero-gradient rounded-2xl p-6 md:p-10 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/10 backdrop-blur px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border border-white/10">Marketplace #1 do Brasil</span>
            <span className="bg-success/20 text-success-foreground px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1"><Shield className="w-3 h-3" /> Compra Protegida</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3">
            Encontre tudo para <span className="text-primary">dominar</span> no digital
          </h1>
          <p className="text-white/70 text-sm md:text-base mb-6 max-w-xl">
            Robux, bots, contas, scripts e muito mais com entrega imediata e garantia ZXMAX.
          </p>
          {/* Big search */}
          <div className="flex items-center bg-white rounded-xl px-4 py-3 max-w-xl shadow-2xl">
            <Search className="w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar Robux, bots, contas, scripts..."
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-3 text-foreground placeholder:text-muted-foreground"
            />
            <button
              onClick={() => {
                if (search.trim()) {
                  navigate(`/loja?q=${encodeURIComponent(search.trim())}`);
                }
              }}
              className="ml-2 btn-gradient px-5 py-2 rounded-lg text-sm font-bold shrink-0"
            >
              Buscar
            </button>
          </div>
          {/* Trust badges */}
          <div className="flex flex-wrap gap-3 mt-6">
            <div className="flex items-center gap-2 text-[11px] text-white/80 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
              <CheckCircle className="w-4 h-4 text-success" /> Entrega Automática
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/80 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
              <Zap className="w-4 h-4 text-yellow-400" /> Suporte 24h
            </div>
            <div className="flex items-center gap-2 text-[11px] text-white/80 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
              <Shield className="w-4 h-4 text-primary" /> Reembolso Garantido
            </div>
          </div>
        </div>
      </div>

      {/* Category shortcuts with icons */}
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-3">Categorias</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] || Gift;
            const isActive = category === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategorySelect(cat)}
                className={`shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-all min-w-[90px] ${
                  isActive ? "bg-primary text-white border-primary shadow-lg shadow-primary/20" : "bg-card border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/30"
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[11px] font-bold text-center leading-tight">{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Em alta */}
      {category === "Todos" && !search && trending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black text-foreground">Em alta</h2>
            <span className="text-[11px] bg-destructive text-white px-2 py-0.5 rounded-full font-bold uppercase">HOT</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {trending.map((p) => (
              <ProductCard key={`trend-${p.id}`} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* Main grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-foreground">
            {category === "Todos" ? (search ? `Resultados para "${search}"` : "Todos os produtos") : category}
            <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length})</span>
          </h2>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border-2 border-dashed border-border">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-foreground font-bold">Nenhum produto encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Tente outra categoria ou termo de busca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>

      {selectedSellerId && (
        <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />
      )}
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
