import React, { useState, useEffect, useMemo } from "react";
import { useStore } from "@/store/StoreContext";
import { Search, Shield, CheckCircle, Zap, Flame } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthScreen from "@/components/AuthScreen";
import UserProfileModal from "@/components/UserProfileModal";
import useSiteBranding from "@/hooks/useSiteBranding";
import ProductCard from "@/components/ProductCard";

export default function StoreView() {
  const { state } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const { branding } = useSiteBranding();

  const [fallbackProducts, setFallbackProducts] = useState<any[]>([]);

  // Fallback: if no products for anon, try direct REST fetch to products_public view
  useEffect(() => {
    if (state.products.length === 0) {
      const fetchPublic = async () => {
        try {
          const url = import.meta.env.VITE_SUPABASE_URL;
          const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (!url || !key) return;
          // Try products_public view via REST
          const resp = await fetch(`${url}/rest/v1/products_public?select=*&order=created_at.desc&limit=100`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
          });
          const data = await resp.json();
          if (Array.isArray(data) && data.length > 0) {
            console.log("Fallback REST products_public loaded:", data.length);
            setFallbackProducts(data.map((p: any) => ({
              id: Number(p.id),
              name: p.name,
              price: Number(p.price),
              category: p.category,
              seller: p.seller_name,
              sellerId: p.seller_id,
              sellerPublicId: p.seller_public_id,
              sales: p.sales || 0,
              rating: Number(p.rating || 0),
              image: p.image,
              banner: p.banner,
              description: p.description,
              approved: p.approved,
              deliveryType: p.delivery_type,
              variations: p.variations || [],
              questions: p.questions || [],
              stock: p.stock || 500,
              minQuantity: p.min_quantity || 100,
              deliveryTime: p.delivery_time || "11 min - 1 h",
            })));
          } else {
            // If still empty, try products table with approved=true via REST
            const resp2 = await fetch(`${url}/rest/v1/products?select=*&approved=eq.true&order=created_at.desc&limit=100`, {
              headers: { apikey: key, Authorization: `Bearer ${key}` },
            });
            const data2 = await resp2.json();
            if (Array.isArray(data2) && data2.length > 0) {
              setFallbackProducts(data2.map((p: any) => ({
                id: Number(p.id),
                name: p.name,
                price: Number(p.price),
                category: p.category,
                seller: p.seller_name,
                sellerId: p.seller_id,
                sales: p.sales || 0,
                rating: Number(p.rating || 0),
                image: p.image,
                description: p.description,
                approved: p.approved,
                deliveryType: p.delivery_type,
              })));
            }
          }
        } catch (e) {
          console.error("Fallback fetch failed", e);
        }
      };
      void fetchPublic();
    }
  }, [state.products.length]);

  const approved = useMemo(() => {
    const all = state.products.length > 0 ? state.products : fallbackProducts;
    return all;
  }, [state.products, fallbackProducts]);
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
          <span className="bg-[#1a1a20] border border-[#25252e] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white/50">Marketplace de produtos digitais</span>
          <span className="bg-[#00c950]/10 border border-[#00c950]/20 px-3 py-1 rounded-full text-[10px] font-bold text-[#00c950] flex items-center gap-1"><Shield className="w-3 h-3" /> Compra Protegida</span>
        </div>
        <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-2 leading-tight">
          {branding.heroTitle}
        </h1>
        <p className="text-white/40 text-sm mb-5">{branding.heroSubtitle}</p>
        
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
          <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><Zap className="w-3.5 h-3.5 text-[#ffbd2e]" /> Entrega conforme anúncio</span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><Shield className="w-3.5 h-3.5 text-[#0084ff]" /> Pedidos rastreados</span>
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
            {trending.map((p) => <ProductCard key={`trend-${p.id}`} product={p} />)}
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
            {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>

      {selectedSellerId && <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />}
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
