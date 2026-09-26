import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Search, ShieldCheck, Star, Zap } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";
import { formatBRL, ROBUX_CATEGORY, storefrontProducts } from "@/lib/catalog";
import { useSiteBranding } from "@/context/SiteBrandingContext";

function ProductCard({ product, onOpen }: { product: any; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#111114] text-left transition hover:border-white/[0.18]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#18181d]">
        {product.image ? (
          <img src={product.image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-[#16161b]" />
        )}
        {product.deliveryType === "auto" ? (
          <span className="absolute left-2 top-2 rounded bg-[#20b46a] px-2 py-1 text-[9px] font-bold text-white">ENTREGA AUTOMÁTICA</span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/35">{product.category}</p>
        <h3 className="mt-1 line-clamp-2 min-h-10 text-[13px] font-semibold leading-5 text-white">{product.name}</h3>
        <p className="mt-2 truncate text-[11px] text-white/40">por <span className="text-white/65">{product.seller || "Vendedor"}</span></p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <p className="text-[10px] text-white/30">a partir de</p>
            <p className="mt-0.5 text-base font-bold text-white">{formatBRL(product.price)}</p>
          </div>
          {product.rating > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-white/40"><Star className="h-3 w-3 fill-[#f5b642] text-[#f5b642]" /> {Number(product.rating).toFixed(1)}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

export default function MarketplaceHome() {
  const { state, catalogStatus } = useStore();
  const { branding } = useSiteBranding();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const approved = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id),
    [state.products, state.currentUser?.id],
  );

  const popularCategories = useMemo(
    () => state.config.categories
      .map((category) => ({
        name: category,
        count: approved.filter((product) => product.category === category).length,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 8),
    [approved, state.config.categories],
  );

  const featured = useMemo(
    () => [...approved]
      .filter((product) => product.category !== ROBUX_CATEGORY)
      .sort((a, b) => (b.sales + b.rating) - (a.sales + a.rating) || b.id - a.id)
      .slice(0, 5),
    [approved],
  );

  const popular = useMemo(
    () => [...approved]
      .sort((a, b) => b.sales - a.sales || b.rating - a.rating || b.id - a.id)
      .slice(0, 5),
    [approved],
  );

  const newest = useMemo(
    () => [...approved].sort((a, b) => b.id - a.id).slice(0, 5),
    [approved],
  );

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/loja?q=${encodeURIComponent(value)}` : "/loja");
  };

  const openCategory = (category: string) => {
    if (category === ROBUX_CATEGORY) navigate("/robux");
    else navigate(`/loja?cat=${encodeURIComponent(category)}`);
  };

  const section = (title: string, items: any[], link: string) => (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-white sm:text-lg">{title}</h2>
        <Link to={link} className="inline-flex items-center gap-1 text-xs font-semibold text-[#56aaff] hover:text-white">
          Ver mais <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/[0.1] bg-[#101013] px-4 py-8 text-center text-sm text-white/40">
          {catalogStatus === "loading" ? "Carregando anúncios…" : "Nenhum anúncio disponível nesta seção."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} onOpen={() => navigate(`/produto/${product.id}`)} />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1240px] space-y-9">
        <section className="py-5 text-center sm:py-9">
          <h1 className="mx-auto max-w-3xl text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">
            {branding.heroTitle || "Comprar e vender produtos digitais"}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/48 sm:text-base">
            {branding.heroSubtitle || "Contas, jogos, Robux, gift cards, serviços e produtos digitais em um só lugar."}
          </p>

          <form onSubmit={submitSearch} className="mx-auto mt-6 flex max-w-2xl items-center rounded-lg border border-white/[0.12] bg-white p-1.5 shadow-sm">
            <Search className="ml-2 h-4 w-4 shrink-0 text-black/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="O que você está procurando?"
              className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-black outline-none placeholder:text-black/40"
              aria-label="Buscar no marketplace"
            />
            <button type="submit" className="rounded-md bg-[#168cff] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#0878dc]">
              Buscar
            </button>
          </form>

          <Link to="/como-funciona" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-white/42 hover:text-white">
            Como funciona? <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-white sm:text-lg">Categorias populares</h2>
            <Link to="/categorias" className="text-xs font-semibold text-[#56aaff] hover:text-white">Ver todas categorias</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {popularCategories.map((category) => (
              <button
                key={category.name}
                onClick={() => openCategory(category.name)}
                className="rounded-lg border border-white/[0.08] bg-[#111114] px-3 py-4 text-left transition hover:border-white/[0.18] hover:bg-[#151519]"
              >
                <p className="truncate text-xs font-semibold text-white">{category.name}</p>
                <p className="mt-1 text-[10px] text-white/30">{category.count} anúncios</p>
              </button>
            ))}
          </div>
        </section>

        {section("Em destaque", featured, "/loja")}
        {section("Mais populares", popular, "/loja?sort=vendidos")}
        {section("Outros anúncios", newest, "/loja?sort=recentes")}

        <section className="grid gap-3 border-t border-white/[0.07] pt-7 md:grid-cols-3">
          <div className="flex gap-3 rounded-lg border border-white/[0.06] bg-[#101013] p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5caeff]" />
            <div><h3 className="text-sm font-semibold text-white">Compra segura</h3><p className="mt-1 text-xs leading-5 text-white/38">Pagamento e pedido ficam ligados ao fluxo da plataforma.</p></div>
          </div>
          <div className="flex gap-3 rounded-lg border border-white/[0.06] bg-[#101013] p-4">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-[#5fd48f]" />
            <div><h3 className="text-sm font-semibold text-white">Entrega automática</h3><p className="mt-1 text-xs leading-5 text-white/38">Anúncios compatíveis podem entregar após a confirmação do pagamento.</p></div>
          </div>
          <div className="flex gap-3 rounded-lg border border-white/[0.06] bg-[#101013] p-4">
            <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#5caeff]" />
            <div><h3 className="text-sm font-semibold text-white">Vendedores identificados</h3><p className="mt-1 text-xs leading-5 text-white/38">Perfis públicos e verificações adicionam contexto à compra.</p></div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
