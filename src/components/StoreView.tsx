import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useStore } from "@/store/StoreContext";
import { Search, Shield, CheckCircle, Zap, Flame, RefreshCw, AlertTriangle, PackageOpen, SlidersHorizontal } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import AuthScreen from "@/components/AuthScreen";
import UserProfileModal from "@/components/UserProfileModal";
import ProductCard from "@/components/ProductCard";
import { formatBRL, ROBUX_CATEGORY, storefrontProducts } from "@/lib/catalog";

const PAGE_SIZE = 20;

type SortKey = "relevancia" | "recentes" | "menor" | "maior" | "vendidos";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "relevancia", label: "Relevância" },
  { id: "recentes", label: "Mais recentes" },
  { id: "menor", label: "Menor preço" },
  { id: "maior", label: "Maior preço" },
  { id: "vendidos", label: "Mais vendidos" },
];

const CATEGORY_TILES: { id: string; label: string; emoji: string; to: string }[] = [
  { id: "robux", label: "Robux", emoji: "💎", to: "/robux" },
  { id: "contas", label: "Contas", emoji: "🎮", to: "/loja?cat=Contas" },
  { id: "bots", label: "Bots Discord", emoji: "🤖", to: "/loja?cat=Bots%20Discord" },
  { id: "scripts", label: "Scripts", emoji: "📜", to: "/loja?cat=Scripts" },
  { id: "assinaturas", label: "Assinaturas", emoji: "⭐", to: "/loja?cat=Assinaturas" },
  { id: "jogos", label: "Jogos e Itens", emoji: "🕹️", to: "/loja?cat=Jogos%20e%20Itens" },
  { id: "keys", label: "Keys", emoji: "🔑", to: "/loja?cat=Keys%20de%20Software" },
  { id: "servicos", label: "Serviços", emoji: "🛠️", to: "/loja?cat=Servi%C3%A7os%20Online" },
];

function ProductSkeleton() {
  return (
    <div className="gg-card overflow-hidden">
      <div className="aspect-[16/10] bg-[var(--gg-surface-2)] animate-pulse" />
      <div className="p-3 space-y-2">
        <div className="h-3 rounded bg-[var(--gg-surface-2)] animate-pulse" />
        <div className="h-3 w-2/3 rounded bg-[var(--gg-surface-2)] animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-[var(--gg-surface-2)] animate-pulse" />
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

  const approved = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id),
    [state.products, state.currentUser?.id],
  );
  const nonRobux = useMemo(
    () => approved.filter((p) => p.category !== ROBUX_CATEGORY),
    [approved],
  );
  const categories = useMemo(
    () => ["Todos", ...state.config.categories.filter((c) => c !== ROBUX_CATEGORY)],
    [state.config.categories],
  );

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
    const highest = nonRobux.reduce((max, p) => Math.max(max, Number(p.price) || 0), 0);
    return Math.max(10, Math.ceil(highest));
  }, [nonRobux]);

  const isVerifiedSeller = useCallback(
    (sellerId: string) => !!state.userDirectory?.[sellerId]?.isVerified,
    [state.userDirectory],
  );

  const filtered = useMemo(() => {
    const q = debouncedSearch;
    const result = nonRobux.filter((p) => {
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
        sorted.sort((a, b) => (b.sales * 2 + b.rating) - (a.sales * 2 + a.rating) || b.id - a.id);
    }
    return sorted;
  }, [nonRobux, debouncedSearch, category, maxPrice, deliveryFilter, onlyVerified, sort, isVerifiedSeller]);

  const page = filtered.slice(0, visible);
  const trending = useMemo(() => [...nonRobux].sort((a, b) => b.sales - a.sales).filter((p) => p.sales > 0).slice(0, 4), [nonRobux]);
  const showHome = category === "Todos" && !debouncedSearch;

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

  const isFirstLoad = catalogStatus === "loading" && approved.length === 0;
  const hasActiveFilters = maxPrice !== null || deliveryFilter !== "todos" || onlyVerified || !!debouncedSearch || category !== "Todos";

  return (
    <div className="space-y-6">
      {showHome && (
        <section className="rounded-2xl bg-[var(--gg-surface)] border border-[var(--gg-border)] px-5 py-8 md:px-10 md:py-12 text-center">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[var(--gg-text)] leading-tight">
            comprar e vender
          </h1>
          <p className="mt-3 text-sm md:text-base text-[var(--gg-muted)] max-w-2xl mx-auto">
            contas, jogos, gift cards, gold, itens digitais e mais!
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(search); }}
            className="mt-6 mx-auto flex items-center bg-[var(--gg-surface-2)] rounded-full px-4 h-12 max-w-xl"
          >
            <Search className="w-5 h-5 text-[var(--gg-faint)]" aria-hidden />
            <label htmlFor="store-search" className="sr-only">Buscar produtos</label>
            <input
              id="store-search"
              type="search"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="O que você está procurando?"
              className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-3 text-[var(--gg-text)] placeholder:text-[var(--gg-faint)]"
            />
            <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="ml-2 text-[var(--gg-muted)] hover:text-[var(--gg-blue)] p-2">
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      {showHome && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[var(--gg-text)]">Categorias populares</h2>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-3">
            {CATEGORY_TILES.map((tile) => (
              <button
                key={tile.id}
                onClick={() => navigate(tile.to)}
                className="gg-card p-3 flex flex-col items-center gap-2 hover:border-[var(--gg-blue)] transition"
              >
                <span className="text-2xl" aria-hidden>{tile.emoji}</span>
                <span className="text-[11px] font-semibold text-[var(--gg-text)] text-center leading-tight">{tile.label}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" role="tablist" aria-label="Categorias">
        <button
          onClick={() => navigate("/robux")}
          className="shrink-0 px-4 py-2 rounded-full text-xs font-bold bg-[var(--gg-blue)] text-white hover:bg-[var(--gg-blue-hover)] transition"
        >
          Robux
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            role="tab"
            aria-selected={category === cat}
            onClick={() => handleCategorySelect(cat)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition whitespace-nowrap ${
              category === cat
                ? "bg-[var(--gg-text)] text-[var(--gg-surface)]"
                : "bg-[var(--gg-surface)] border border-[var(--gg-border)] text-[var(--gg-muted)] hover:text-[var(--gg-text)]"
            }`}
          >
            {cat}
          </button>
        ))}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className="shrink-0 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--gg-surface)] border border-[var(--gg-border)] text-[var(--gg-muted)]"
        >
          Filtros
        </button>
      </div>

      {showFilters && (
        <div className="gg-card p-4 grid gap-4 md:grid-cols-4">
          <div>
            <label htmlFor="sort" className="text-[10px] font-black uppercase tracking-wide text-[var(--gg-faint)] block mb-1.5">Ordenar por</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="input-gg">
              {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="price" className="text-[10px] font-black uppercase tracking-wide text-[var(--gg-faint)] block mb-1.5">
              Até {maxPrice === null ? "qualquer valor" : formatBRL(maxPrice)}
            </label>
            <input
              id="price" type="range" min={2} max={priceCeiling} step={1}
              value={maxPrice ?? priceCeiling}
              onChange={(e) => { const v = Number(e.target.value); setMaxPrice(v >= priceCeiling ? null : v); }}
              className="w-full accent-[var(--gg-blue)]"
            />
          </div>
          <div>
            <label htmlFor="delivery" className="text-[10px] font-black uppercase tracking-wide text-[var(--gg-faint)] block mb-1.5">Entrega</label>
            <select id="delivery" value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value as typeof deliveryFilter)} className="input-gg">
              <option value="todos">Todas</option>
              <option value="auto">Automática</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          <div className="flex flex-col justify-between">
            <label className="flex items-center gap-2 text-sm text-[var(--gg-text)] cursor-pointer">
              <input type="checkbox" checked={onlyVerified} onChange={(e) => setOnlyVerified(e.target.checked)} className="accent-[var(--gg-blue)] w-4 h-4" />
              Somente vendedores verificados
            </label>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-2 text-xs font-bold text-[var(--gg-blue)] hover:underline text-left">Limpar filtros</button>
            )}
          </div>
        </div>
      )}

      {showHome && trending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-[#ef4444]" aria-hidden />
            <h2 className="text-base font-bold text-[var(--gg-text)]">Em destaque</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {trending.map((p) => (
              <ProductCard key={`trend-${p.id}`} product={p} verified={isVerifiedSeller(p.sellerId)} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="text-base font-bold text-[var(--gg-text)]">
            {category === "Todos" ? (debouncedSearch ? `Resultados para "${search}"` : "Mais populares") : category}{" "}
            {!isFirstLoad && <span className="text-[var(--gg-faint)] font-medium">({filtered.length})</span>}
          </h2>
          <button
            onClick={() => void refreshProducts()}
            className="text-[var(--gg-muted)] hover:text-[var(--gg-text)] text-xs font-bold flex items-center gap-1.5 transition"
            aria-label="Atualizar catálogo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${catalogStatus === "loading" ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>

        {isFirstLoad ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-busy="true" aria-live="polite">
            {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
            <span className="sr-only">Carregando produtos…</span>
          </div>
        ) : catalogStatus === "error" && approved.length === 0 ? (
          <div className="text-center py-16 gg-card" role="alert">
            <AlertTriangle className="w-8 h-8 mx-auto text-[#ef4444] mb-3" aria-hidden />
            <p className="text-[var(--gg-text)] font-bold text-sm">Não conseguimos carregar o catálogo</p>
            <p className="text-xs text-[var(--gg-muted)] mt-1 max-w-sm mx-auto">Isso é uma falha de conexão com o servidor, não uma loja vazia. Tente novamente em instantes.</p>
            <button onClick={() => void refreshProducts()} className="mt-4 bg-[var(--gg-blue)] hover:bg-[var(--gg-blue-hover)] text-white px-5 py-2.5 rounded-full text-sm font-bold transition">
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 gg-card">
            <PackageOpen className="w-8 h-8 mx-auto text-[var(--gg-faint)] mb-3" aria-hidden />
            <p className="text-[var(--gg-text)] font-bold text-sm">
              {hasActiveFilters ? "Nenhum produto para esses filtros" : "Ainda não há anúncios publicados"}
            </p>
            <p className="text-xs text-[var(--gg-muted)] mt-1">
              {hasActiveFilters ? "Ajuste a busca ou limpe os filtros." : "Assim que a moderação aprovar os primeiros anúncios, eles aparecem aqui."}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-4 border border-[var(--gg-border)] hover:border-[var(--gg-blue)] text-[var(--gg-text)] px-5 py-2.5 rounded-full text-sm font-bold transition">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {catalogStatus === "error" && (
              <p className="mb-3 text-[11px] text-amber-600 flex items-center gap-1.5" role="status">
                <AlertTriangle className="w-3.5 h-3.5" /> Conexão instável — mostrando os últimos anúncios carregados.
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {page.map((p) => (
                <ProductCard key={p.id} product={p} verified={isVerifiedSeller(p.sellerId)} />
              ))}
            </div>
            {visible < filtered.length && (
              <div className="flex justify-center mt-5">
                <button onClick={() => setVisible((v) => v + PAGE_SIZE)} className="border border-[var(--gg-border)] hover:border-[var(--gg-blue)] text-[var(--gg-text)] px-6 py-3 rounded-full text-sm font-bold transition bg-[var(--gg-surface)]">
                  Carregar mais ({filtered.length - visible})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showHome && (
        <section className="grid md:grid-cols-3 gap-3 pt-4">
          <div className="gg-card p-5 flex gap-3">
            <Shield className="w-6 h-6 text-[var(--gg-blue)] shrink-0" />
            <div>
              <p className="font-bold text-sm">Compra segura</p>
              <p className="text-xs text-[var(--gg-muted)] mt-1">entrega garantida ou o seu dinheiro de volta.</p>
            </div>
          </div>
          <div className="gg-card p-5 flex gap-3">
            <CheckCircle className="w-6 h-6 text-[#00c950] shrink-0" />
            <div>
              <p className="font-bold text-sm">Suporte 24 horas</p>
              <p className="text-xs text-[var(--gg-muted)] mt-1">equipe pronta para te atender sempre que precisar.</p>
            </div>
          </div>
          <div className="gg-card p-5 flex gap-3">
            <Zap className="w-6 h-6 text-amber-500 shrink-0" />
            <div>
              <p className="font-bold text-sm">Programa de recompensa</p>
              <p className="text-xs text-[var(--gg-muted)] mt-1">seja recompensado pelas suas compras e vendas.</p>
            </div>
          </div>
        </section>
      )}

      {selectedSellerId && <UserProfileModal open={!!selectedSellerId} onClose={() => setSelectedSellerId(null)} userId={selectedSellerId} />}
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
