import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/store/StoreContext";
import { Search, Shield, CheckCircle, Zap, Flame, RefreshCw, AlertTriangle, PackageOpen, SlidersHorizontal, BadgeCheck } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthScreen from "@/components/AuthScreen";
import UserProfileModal from "@/components/UserProfileModal";
import { formatBRL, ROBUX_CATEGORY, robuxPackageUnits, storefrontProducts } from "@/lib/catalog";

const PAGE_SIZE = 20;

type SortKey = "relevancia" | "recentes" | "menor" | "maior" | "vendidos";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "relevancia", label: "Relevância" },
  { id: "recentes", label: "Mais recentes" },
  { id: "menor", label: "Menor preço" },
  { id: "maior", label: "Maior preço" },
  { id: "vendidos", label: "Mais vendidos" },
];

function ProductSkeleton() {
  return (
    <div className="bg-[#111114] border border-[#1e1e28] rounded-xl overflow-hidden">
      <div className="aspect-[4/3] bg-white/5 animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-3 rounded bg-white/5 animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-white/5 animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-white/5 animate-pulse" />
      </div>
    </div>
  );
}

export default function StoreView() {
  const { state, catalogStatus, refreshProducts } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState<SortKey>("relevancia");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState<"todos" | "auto" | "manual">("todos");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  // The catalog comes exclusively from the store, which already owns retries and
  // degraded-schema handling. No second data path here: a silent REST fallback
  // is what used to hide real Supabase failures behind an empty grid.
  const approved = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id),
    [state.products, state.currentUser?.id],
  );
  const categories = useMemo(() => ["Todos", ...state.config.categories], [state.config.categories]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [search]);

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

  useEffect(() => { setVisible(PAGE_SIZE); }, [debouncedSearch, category, sort, maxPrice, deliveryFilter, onlyVerified]);

  const priceCeiling = useMemo(() => {
    const highest = approved.reduce((max, p) => Math.max(max, Number(p.price) || 0), 0);
    return Math.max(10, Math.ceil(highest));
  }, [approved]);

  const isVerifiedSeller = useCallback(
    (sellerId: string) => !!state.userDirectory?.[sellerId]?.isVerified,
    [state.userDirectory],
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch;
    const result = approved.filter((p) => {
      const matchSearch = !q
        || p.name.toLowerCase().includes(q)
        || p.category.toLowerCase().includes(q)
        || (p.seller || "").toLowerCase().includes(q)
        || (p.description || "").toLowerCase().includes(q);
      const matchCat = category === "Todos" || p.category === category;
      const matchPrice = maxPrice === null || Number(p.price) <= maxPrice;
      const matchDelivery = deliveryFilter === "todos" || p.deliveryType === deliveryFilter;
      const matchVerified = !onlyVerified || isVerifiedSeller(p.sellerId);
      const inStock = p.stock === undefined || p.stock === null || p.stock > 0;
      return matchSearch && matchCat && matchPrice && matchDelivery && matchVerified && inStock;
    });

    const sorted = [...result];
    switch (sort) {
      case "recentes": sorted.reverse(); break;
      case "menor": sorted.sort((a, b) => Number(a.price) - Number(b.price)); break;
      case "maior": sorted.sort((a, b) => Number(b.price) - Number(a.price)); break;
      case "vendidos": sorted.sort((a, b) => b.sales - a.sales); break;
      default:
        // Relevance: sellers with sales and a rating first, then newest ids.
        sorted.sort((a, b) => (b.sales * 2 + b.rating) - (a.sales * 2 + a.rating) || b.id - a.id);
    }
    return sorted;
  }, [approved, debouncedSearch, category, maxPrice, deliveryFilter, onlyVerified, sort, isVerifiedSeller]);

  const page = filtered.slice(0, visible);
  const trending = useMemo(() => [...approved].sort((a, b) => b.sales - a.sales).filter((p) => p.sales > 0).slice(0, 4), [approved]);

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

  const clearFilters = () => {
    setMaxPrice(null); setDeliveryFilter("todos"); setOnlyVerified(false);
    setSort("relevancia"); setCategory("Todos"); handleSearch("");
  };

  const isRobuxCategory = category === ROBUX_CATEGORY;
  const isFirstLoad = catalogStatus === "loading" && approved.length === 0;
  const hasActiveFilters = maxPrice !== null || deliveryFilter !== "todos" || onlyVerified || !!debouncedSearch || category !== "Todos";

  const priceLabel = (p: (typeof approved)[number]) => {
    if (p.category !== ROBUX_CATEGORY) return formatBRL(p.price);
    const units = robuxPackageUnits(p);
    return units > 1 ? `${formatBRL(p.price)} / ${units.toLocaleString("pt-BR")}` : formatBRL(p.price);
  };

  return (
    <div className="space-y-5">
      {/* Top filters - clean pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" role="tablist" aria-label="Categorias">
        <button
          role="tab"
          aria-selected={isRobuxCategory}
          onClick={() => handleCategorySelect(ROBUX_CATEGORY)}
          className={`shrink-0 px-5 py-2.5 rounded-full text-sm font-black tracking-wide transition-all ${
            isRobuxCategory ? "bg-[#ffbd2e] text-black" : "bg-[#1a1a20] border border-[#25252e] text-white hover:border-[#ffbd2e]/30"
          }`}
        >
          R$ ROBUX
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={category === cat}
            onClick={() => handleCategorySelect(cat)}
            className={`shrink-0 px-4 py-2.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
              category === cat ? "bg-white text-black" : "bg-[#1a1a20] border border-[#25252e] text-white/60 hover:text-white hover:border-white/20"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Hero */}
      <div className="bg-[#111114] border border-[#1e1e28] rounded-2xl p-6 md:p-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="bg-[#1a1a20] border border-[#25252e] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide text-white/50">Marketplace de produtos digitais</span>
          <span className="bg-[#00c950]/10 border border-[#00c950]/20 px-3 py-1 rounded-full text-[10px] font-bold text-[#00c950] flex items-center gap-1"><Shield className="w-3 h-3" /> Compra Protegida</span>
        </div>
        <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-2 leading-tight">
          Encontre tudo para <span className="text-[#0084ff]">dominar</span> no digital
        </h1>
        <p className="text-white/40 text-sm mb-5">Robux, bots, contas, scripts e muito mais com entrega rápida.</p>

        <div className="flex items-center bg-white rounded-xl px-4 py-3 max-w-xl">
          <Search className="w-5 h-5 text-black/30" aria-hidden />
          <label htmlFor="store-search" className="sr-only">Buscar produtos</label>
          <input
            id="store-search"
            type="search"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar Robux, bots, contas, scripts..."
            className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-3 text-black placeholder:text-black/40"
          />
          <button onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="ml-2 bg-[#0084ff] hover:bg-[#0066cc] text-white px-4 py-2 rounded-lg text-sm font-bold transition flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4" /> Filtros
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mt-5">
          <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><CheckCircle className="w-3.5 h-3.5 text-[#00c950]" /> Entrega Automática</span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><Zap className="w-3.5 h-3.5 text-[#ffbd2e]" /> Suporte 24h</span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-[#1a1a20] border border-[#25252e] px-3 py-1.5 rounded-full"><Shield className="w-3.5 h-3.5 text-[#0084ff]" /> Reembolso Garantido</span>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-[#111114] border border-[#1e1e28] rounded-2xl p-4 grid gap-4 md:grid-cols-4">
          <div>
            <label htmlFor="sort" className="text-[10px] font-black uppercase tracking-wide text-white/30 block mb-1.5">Ordenar por</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="w-full p-2.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none">
              {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="price" className="text-[10px] font-black uppercase tracking-wide text-white/30 block mb-1.5">
              Até {maxPrice === null ? "qualquer valor" : formatBRL(maxPrice)}
            </label>
            <input
              id="price" type="range" min={2} max={priceCeiling} step={1}
              value={maxPrice ?? priceCeiling}
              onChange={(e) => { const v = Number(e.target.value); setMaxPrice(v >= priceCeiling ? null : v); }}
              className="w-full accent-[#0084ff]"
            />
          </div>
          <div>
            <label htmlFor="delivery" className="text-[10px] font-black uppercase tracking-wide text-white/30 block mb-1.5">Entrega</label>
            <select id="delivery" value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value as typeof deliveryFilter)} className="w-full p-2.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none">
              <option value="todos">Todas</option>
              <option value="auto">Automática</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className="flex flex-col justify-between">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} className="accent-[#0084ff] w-4 h-4" />
              Somente vendedores verificados
            </label>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs font-bold text-[#0084ff] hover:underline text-left">Limpar filtros</button>
            )}
          </div>
        </div>
      )}

      {/* Em alta */}
      {category === "Todos" && !debouncedSearch && trending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-[#ff4444]" aria-hidden />
            <h2 className="text-sm font-black text-white uppercase tracking-wide">Em alta</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {trending.map((p) => (
              <button key={`trend-${p.id}`} onClick={() => navigate(`/produto/${p.id}`)} className="text-left bg-[#111114] border border-[#1e1e28] rounded-xl overflow-hidden cursor-pointer hover:border-[#2a2a36] focus:outline-none focus:ring-2 focus:ring-[#0084ff] transition group">
                <div className="aspect-[4/3] bg-[#1a1a20] overflow-hidden"><img src={p.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" /></div>
                <div className="p-3">
                  <p className="text-xs font-bold text-white truncate">{p.name}</p>
                  <p className="text-sm font-black text-white mt-1">{priceLabel(p)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="text-sm font-bold text-white">
            {category === "Todos" ? (debouncedSearch ? `Resultados para "${search}"` : "Todos os produtos") : category}{" "}
            {!isFirstLoad && <span className="text-white/30">({filtered.length})</span>}
          </h2>
          <button
            onClick={() => void refreshProducts()}
            className="text-white/40 hover:text-white text-xs font-bold flex items-center gap-1.5 transition"
            aria-label="Atualizar catálogo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${catalogStatus === "loading" ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>

        {isFirstLoad ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3" aria-busy="true" aria-live="polite">
            {Array.from({ length: 10 }).map((_, i) => <ProductSkeleton key={i} />)}
            <span className="sr-only">Carregando produtos…</span>
          </div>
        ) : catalogStatus === "error" && approved.length === 0 ? (
          <div className="text-center py-16 bg-[#111114] border border-[#ef4444]/20 rounded-2xl" role="alert">
            <AlertTriangle className="w-8 h-8 mx-auto text-[#ef4444] mb-3" aria-hidden />
            <p className="text-white font-bold text-sm">Não conseguimos carregar o catálogo</p>
            <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">Isso é uma falha de conexão com o servidor, não uma loja vazia. Tente novamente em instantes.</p>
            <button onClick={() => void refreshProducts()} className="mt-4 bg-[#0084ff] hover:bg-[#0066cc] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition">
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-[#111114] border border-[#1e1e28] rounded-2xl">
            <PackageOpen className="w-8 h-8 mx-auto text-white/20 mb-3" aria-hidden />
            <p className="text-white font-bold text-sm">
              {hasActiveFilters ? "Nenhum produto para esses filtros" : "Ainda não há anúncios publicados"}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {hasActiveFilters ? "Ajuste a busca ou limpe os filtros." : "Assim que a moderação aprovar os primeiros anúncios, eles aparecem aqui."}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-4 bg-[#1a1a20] border border-[#25252e] hover:border-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {catalogStatus === "error" && (
              <p className="mb-3 text-[11px] text-[#ffbd2e] flex items-center gap-1.5" role="status">
                <AlertTriangle className="w-3.5 h-3.5" /> Conexão instável — mostrando os últimos anúncios carregados.
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {page.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/produto/${p.id}`)}
                  className="text-left bg-[#111114] border border-[#1e1e28] rounded-xl overflow-hidden cursor-pointer hover:border-[#2a2a36] focus:outline-none focus:ring-2 focus:ring-[#0084ff] transition group flex flex-col"
                >
                  <div className="relative aspect-[4/3] bg-[#1a1a20] overflow-hidden">
                    <img src={p.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
                    <div className="absolute top-2 left-2 flex gap-1">
                      {!p.approved && <span className="bg-[#ffbd2e] text-black text-[9px] px-2 py-0.5 rounded-full font-black">EM ANÁLISE</span>}
                      {p.deliveryType === "auto" && <span className="bg-[#00c950] text-white text-[9px] px-2 py-0.5 rounded-full font-black">AUTO</span>}
                    </div>
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <h3 className="font-bold text-white text-xs leading-tight line-clamp-2 min-h-[32px]">{p.name}</h3>
                    <p className="text-[11px] text-white/40 mt-1 truncate flex items-center gap-1">
                      por <span className="text-[#0084ff]">{p.seller}</span>
                      {isVerifiedSeller(p.sellerId) && <BadgeCheck className="w-3 h-3 text-[#0084ff] shrink-0" aria-label="Vendedor verificado" />}
                    </p>
                    <p className="text-sm font-black text-white mt-2">{priceLabel(p)}</p>
                    {p.sales > 0 && <p className="text-[10px] text-white/30 mt-0.5">{p.sales} vendas</p>}
                  </div>
                </button>
              ))}
            </div>
            {visible < filtered.length && (
              <div className="flex justify-center mt-5">
                <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className="bg-[#1a1a20] border border-[#25252e] hover:border-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition">
                  Carregar mais ({filtered.length - visible})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedSellerId && <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />}
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
