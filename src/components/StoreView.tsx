import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/hooks/useAuth";
import { Search, Shield, CheckCircle, Zap, Flame, Sparkles } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthScreen from "@/components/AuthScreen";
import UserProfileModal from "@/components/UserProfileModal";

export default function StoreView() {
  const { state } = useStore();
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const approved = useMemo(() => {
    return state.products.filter((p) => {
      if (p.approved) return true;
      if (isAdmin) return true;
      if (user && (p.sellerId === user.id || p.sellerEmail === user.email)) return true;
      return false;
    });
  }, [state.products, isAdmin, user]);
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
    return [...approved].sort((a, b) => b.sales - a.sales).slice(0, 4);
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

  const isRobuxCategory = category === "Robux e Gift Cards";

  return (
    <div className="space-y-5">
      {(state.globalNotices || []).slice(0, 2).map((n) => (
        <div key={n.id} className="bg-[#0084ff]/10 border border-[#0084ff]/20 rounded-2xl px-4 py-3 text-sm text-white">
          {n.text}
        </div>
      ))}
      {/* Top filters - GGMAX style, clean pills, no squares */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        <button
          onClick={() => handleCategorySelect("Robux e Gift Cards")}
          className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-black tracking-wide transition-all ${
            isRobuxCategory ? "bg-[#ffbd2e] text-black" : "bg-[#1a1a20] border border-[#25252e] text-white hover:border-[#ffbd2e]/30"
          }`}
        >
          R$ ROBUX
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategorySelect(cat)}
            className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              category === cat ? "bg-white text-black" : "bg-[#1a1a20] border border-[#25252e] text-white/60 hover:text-white hover:border-white/20"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Hero - GGMAX minimal */}
      <div className="bg-[#111114] border border-[#1e1e28] rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="bg-[#1a1a20] border border-[#25252e] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white/50">Marketplace #1 do Brasil</span>
          <span className="bg-[#00c950]/10 border border-[#00c950]/20 px-3 py-1 rounded-full text-[10px] font-bold text-[#00c950] flex items-center gap-1"><Shield className="w-3 h-3" /> Compra Protegida</span>
        </div>
        <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-2 leading-tight">
          Encontre tudo para <span className="text-[#0084ff]">dominar</span> no digital
        </h1>
        <p className="text-white/40 text-sm mb-5">Robux, bots, contas, scripts e muito mais com entrega imediata.</p>
        
        <div className="flex items-center bg-white rounded-xl px-4 py-3 max-w-xl">
          <Search className="w-5 h-5 text-black/30" />
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
          <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><CheckCircle className="w-3.5 h-3.5 text-[#00c950]" /> Entrega Automática</span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><Zap className="w-3.5 h-3.5 text-[#ffbd2e]" /> Suporte 24h</span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><Shield className="w-3.5 h-3.5 text-[#0084ff]" /> Reembolso Garantido</span>
        </div>
      </div>

      {/* Em alta */}
      {category === "Todos" && !search && trending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-[#ff4444]" />
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Em alta</h2>
            <span className="text-[10px] bg-[#ff4444] text-white px-2 py-0.5 rounded-full font-black">HOT</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {trending.map((p) => (
              <div key={`trend-${p.id}`} onClick={() => navigate(`/produto/${p.id}`)} className="bg-[#111114] border border-[#1e1e28] rounded-xl overflow-hidden cursor-pointer hover:border-[#2a2a36] transition group">
                <div className="aspect-[4/3] bg-[#1a1a20] overflow-hidden"><img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" /></div>
                <div className="p-3">
                  <p className="text-xs font-bold text-white truncate">{p.name}</p>
                  <p className="text-sm font-black text-white mt-1">R$ {p.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {category === "Todos" && !search && approved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#0084ff]" />
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Recém chegados</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...approved].slice(0, 4).map((p) => (
              <div key={`new-${p.id}`} onClick={() => navigate(`/produto/${p.id}`)} className="bg-[#111114] border border-[#1e1e28] rounded-xl overflow-hidden cursor-pointer hover:border-[#2a2a36] transition group">
                <div className="aspect-[4/3] bg-[#1a1a20] overflow-hidden"><img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" /></div>
                <div className="p-3">
                  <p className="text-xs font-bold text-white truncate">{p.name}</p>
                  <p className="text-sm font-black text-white mt-1">R$ {p.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div>
        <h2 className="text-sm font-bold text-white mb-3">{category === "Todos" ? (search ? `Resultados para "${search}"` : "Todos os produtos") : category} <span className="text-white/30">({filtered.length})</span></h2>

        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-[#111114] border border-[#1e1e28] rounded-2xl">
            <p className="text-white font-bold text-sm">Nenhum produto encontrado</p>
            <p className="text-xs text-white/40 mt-1">Tente outra categoria</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((p) => (
              <div key={p.id} onClick={() => navigate(`/produto/${p.id}`)} className="bg-[#111114] border border-[#1e1e28] rounded-xl overflow-hidden cursor-pointer hover:border-[#2a2a36] transition group">
                <div className="relative aspect-[4/3] bg-[#1a1a20] overflow-hidden">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
                  {p.sales > 50 && <span className="absolute top-2 left-2 bg-[#ef4444] text-white text-[9px] px-2 py-0.5 rounded-full font-black">HOT</span>}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-white text-xs leading-tight line-clamp-2 min-h-[32px]">{p.name}</h3>
                  <p className="text-[11px] text-white/40 mt-1 truncate">por <span className="text-[#0084ff]">{p.seller}</span></p>
                  <p className="text-sm font-black text-white mt-2">R$ {p.price.toFixed(2)}</p>
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
