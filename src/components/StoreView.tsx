import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { Search, Shield, CheckCircle, Zap, TrendingUp, Gift, Gamepad2, Bot, Key, File, Palette, Briefcase, GraduationCap, Crown, Sparkles, Flame } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import ProductCard from "@/components/ProductCard";
import AuthScreen from "@/components/AuthScreen";
import UserProfileModal from "@/components/UserProfileModal";

const CATEGORY_ICONS: Record<string, any> = {
  "Todos": Sparkles,
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
  const { state } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const approved = useMemo(() => state.products.filter((p) => p.approved), [state.products]);
  const categories = useMemo(() => ["Todos", ...state.config.categories], [state.config.categories]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get("cat");
    const q = params.get("q");
    if (cat && categories.includes(cat)) setCategory(cat);
    if (q) setSearch(q);
  }, [location.search, categories]);

  useEffect(() => {
    const onSearch = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (typeof detail === "string") {
        setSearch(detail);
        if (detail) setCategory("Todos");
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
    return [...approved].sort((a, b) => b.sales - a.sales).slice(0, 6);
  }, [approved]);

  const handleCategorySelect = (cat: string) => {
    setCategory(cat);
    const params = new URLSearchParams(location.search);
    if (cat !== "Todos") params.set("cat", cat);
    else params.delete("cat");
    if (search) params.set("q", search);
    navigate(`/loja?${params.toString()}`, { replace: true });
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    const params = new URLSearchParams(location.search);
    if (val.trim()) params.set("q", val.trim());
    else params.delete("q");
    if (category !== "Todos") params.set("cat", category);
    navigate(`/loja?${params.toString()}`, { replace: true });
  };

  // If Robux category selected, show eldorado-style marketplace
  const isRobuxCategory = category === "Robux e Gift Cards";

  return (
    <div className="space-y-6">
      {/* Top Robux Button - GGMAX style */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <button
          onClick={() => handleCategorySelect("Robux e Gift Cards")}
          className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-black tracking-wide transition-all flex items-center gap-2 ${
            isRobuxCategory ? "bg-[#ffbd2e] text-black" : "bg-[#1a1a20] border border-[#25252e] text-white hover:border-[#0084ff]/50"
          }`}
        >
          <span className="text-base">R$</span> ROBUX
        </button>
        {categories.filter(c => c !== "Robux e Gift Cards").slice(0, 8).map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategorySelect(cat)}
            className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all ${
              category === cat ? "bg-white text-black" : "bg-[#1a1a20] border border-[#25252e] text-white/60 hover:text-white hover:border-white/20"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Hero - GGMAX clean, not AI gradient */}
      <div className="bg-[#111114] border border-[#1e1e28] rounded-2xl p-6 md:p-8">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-[#1a1a20] border border-[#25252e] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white/60">Marketplace #1 do Brasil</span>
            <span className="bg-[#00c950]/10 border border-[#00c950]/20 px-3 py-1 rounded-full text-[10px] font-bold text-[#00c950] flex items-center gap-1"><Shield className="w-3 h-3" /> Compra Protegida</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-2 leading-tight">
            Encontre tudo para <span className="text-[#0084ff]">dominar</span> no digital
          </h1>
          <p className="text-white/50 text-sm mb-5">Robux, bots, contas, scripts e muito mais com entrega imediata.</p>
          
          <div className="flex items-center bg-white rounded-xl px-4 py-3 max-w-xl">
            <Search className="w-5 h-5 text-black/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Buscar Robux, bots, contas, scripts..."
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-3 text-black placeholder:text-black/40"
            />
            <button onClick={() => handleSearch(search)} className="ml-2 bg-[#0084ff] hover:bg-[#0066cc] text-white px-5 py-2 rounded-lg text-sm font-bold transition">Buscar</button>
          </div>

          <div className="flex flex-wrap gap-2 mt-5">
            <span className="flex items-center gap-1.5 text-[11px] text-white/50 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><CheckCircle className="w-3.5 h-3.5 text-[#00c950]" /> Entrega Automática</span>
            <span className="flex items-center gap-1.5 text-[11px] text-white/50 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><Zap className="w-3.5 h-3.5 text-[#ffbd2e]" /> Suporte 24h</span>
            <span className="flex items-center gap-1.5 text-[11px] text-white/50 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><Shield className="w-3.5 h-3.5 text-[#0084ff]" /> Reembolso Garantido</span>
          </div>
        </div>
      </div>

      {/* Categories with icons - GGMAX style */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-white/30 mb-3">Categorias</h2>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] || Gift;
            const isActive = category === cat;
            return (
              <button key={cat} onClick={() => handleCategorySelect(cat)} className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${isActive ? "bg-[#0084ff] border-[#0084ff] text-white" : "bg-[#111114] border-[#1e1e28] text-white/50 hover:text-white hover:border-[#2a2a36]"}`}>
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-bold text-center leading-tight line-clamp-2">{cat}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Em alta - GGMAX */}
      {category === "Todos" && !search && trending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-[#ff4444]" />
            <h2 className="text-base font-black text-white">Em alta</h2>
            <span className="text-[10px] bg-[#ff4444] text-white px-2 py-0.5 rounded-full font-black uppercase">HOT</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {trending.map((p) => (
              <div key={`trend-${p.id}`} onClick={() => navigate(`/produto/${p.id}`)} className="bg-[#111114] border border-[#1e1e28] rounded-xl overflow-hidden cursor-pointer hover:border-[#2a2a36] transition group">
                <div className="aspect-[4/3] bg-[#1a1a20] overflow-hidden"><img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" /></div>
                <div className="p-3">
                  <p className="text-xs font-bold text-white truncate">{p.name}</p>
                  <p className="text-[11px] text-white/40">{p.sales} vendas</p>
                  <p className="text-sm font-black text-white mt-1">R$ {p.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products grid - GGMAX solid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-white">{category === "Todos" ? (search ? `Resultados para "${search}"` : "Todos os produtos") : category} <span className="text-white/30 font-normal">({filtered.length})</span></h2>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-[#111114] border border-[#1e1e28] rounded-2xl">
            <p className="text-white font-bold">Nenhum produto encontrado</p>
            <p className="text-sm text-white/40 mt-1">Tente outra categoria ou termo.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((p) => (
              <div key={p.id} onClick={() => navigate(`/produto/${p.id}`)} className="bg-[#111114] border border-[#1e1e28] rounded-xl overflow-hidden cursor-pointer hover:border-[#2a2a36] transition group">
                <div className="relative aspect-[4/3] bg-[#1a1a20] overflow-hidden">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
                  <div className="absolute top-2 left-2 flex gap-1">
                    {p.deliveryType === "auto" && <span className="bg-[#00c950] text-white text-[9px] px-2 py-0.5 rounded-full font-bold">AUTO</span>}
                    {p.sales > 50 && <span className="bg-[#ef4444] text-white text-[9px] px-2 py-0.5 rounded-full font-black">HOT</span>}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-white text-xs leading-tight line-clamp-2 min-h-[32px]">{p.name}</h3>
                  <p className="text-[11px] text-white/40 mt-1">por <span className="text-[#0084ff] font-semibold">{p.seller}</span></p>
                  <div className="flex items-end justify-between mt-3">
                    <div>
                      <p className="text-[10px] text-white/30 uppercase font-bold">Preço</p>
                      <p className="text-sm font-black text-white">R$ {p.price.toFixed(2)}</p>
                    </div>
                    <span className="bg-[#0084ff] text-white px-3 py-1 rounded-lg text-[11px] font-bold">Ver</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSellerId && <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />}
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
