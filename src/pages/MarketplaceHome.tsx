import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BadgeCheck, Package, Search, ShieldCheck, Store, Zap } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";
import { formatBRL, ROBUX_CATEGORY, storefrontProducts } from "@/lib/catalog";
import { useSiteBranding } from "@/context/SiteBrandingContext";

function ProductCard({ product, onOpen }: { product: any; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#111114] text-left transition hover:-translate-y-0.5 hover:border-white/[0.17] hover:bg-[#131317] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#168cff]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#17171c]">
        {product.image ? (
          <img src={product.image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center">
            <div className="text-center text-white/25">
              <Package className="mx-auto h-7 w-7" />
              <span className="mt-2 block text-[9px] font-semibold uppercase tracking-[0.14em]">Sem imagem</span>
            </div>
          </div>
        )}
        {product.deliveryType === "auto" ? (
          <span className="absolute left-2 top-2 rounded-md border border-emerald-300/15 bg-emerald-400/90 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[#06120b]">
            Automático
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">{product.category}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-10 text-[13px] font-bold leading-5 text-white">{product.name}</h3>
        <p className="mt-2 truncate text-[10px] text-white/36">
          por <span className="font-semibold text-white/58">{product.seller || "Vendedor"}</span>
        </p>
        <div className="mt-auto pt-3">
          <p className="text-[9px] text-white/28">a partir de</p>
          <p className="mt-0.5 text-base font-extrabold tracking-[-0.025em] text-white">{formatBRL(product.price)}</p>
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

  const generalProducts = useMemo(
    () => approved.filter((product) => product.category !== ROBUX_CATEGORY),
    [approved],
  );

  const popularCategories = useMemo(
    () => state.config.categories
      .filter((category) => category !== ROBUX_CATEGORY)
      .map((category) => ({
        name: category,
        count: generalProducts.filter((product) => product.category === category).length,
      }))
      .filter((category) => category.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 6),
    [generalProducts, state.config.categories],
  );

  const featured = useMemo(
    () => [...generalProducts]
      .sort((a, b) => (b.sales + b.rating) - (a.sales + a.rating) || b.id - a.id)
      .slice(0, 6),
    [generalProducts],
  );

  const newest = useMemo(() => {
    const featuredIds = new Set(featured.map((product) => product.id));
    return [...generalProducts]
      .filter((product) => !featuredIds.has(product.id))
      .sort((a, b) => b.id - a.id)
      .slice(0, 4);
  }, [generalProducts, featured]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/loja?q=${encodeURIComponent(value)}` : "/loja");
  };

  const openCategory = (category: string) => {
    if (category === ROBUX_CATEGORY) navigate("/robux");
    else navigate(`/loja?cat=${encodeURIComponent(category)}`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] space-y-9 pb-4">
        <section className="border-b border-white/[0.07] pb-8 pt-3 sm:pb-10 sm:pt-7">
          <div className="max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#66b5ff]">Marketplace digital</p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.045em] text-white sm:text-5xl">
              {branding.heroTitle || "Encontre o que você precisa sem complicação"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/46 sm:text-[15px]">
              {branding.heroSubtitle || "Produtos e serviços digitais com preço, vendedor, entrega e pagamento organizados em um único fluxo."}
            </p>
          </div>

          <form onSubmit={submitSearch} className="mt-6 flex max-w-2xl items-center rounded-xl border border-white/[0.11] bg-[#131317] p-1.5 focus-within:border-[#168cff]/55">
            <Search className="ml-2 h-4 w-4 shrink-0 text-white/30" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar produto, serviço ou vendedor"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/28"
              aria-label="Buscar no marketplace"
            />
            <button type="submit" className="rounded-lg bg-[#168cff] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0f7fdf]">
              Buscar
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link to="/loja" className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-white/[0.035] px-3 py-2 text-[11px] font-semibold text-white/68 transition hover:bg-white/[0.06] hover:text-white">
              Explorar anúncios <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/meus-produtos" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold text-white/48 transition hover:text-white">
              Quero anunciar
            </Link>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white sm:text-lg">Em destaque</h2>
                <p className="mt-0.5 text-[11px] text-white/32">Uma seleção curta para a home não virar um catálogo duplicado.</p>
              </div>
              <Link to="/loja" className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#66b5ff] hover:text-white">
                Ver todos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {featured.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.1] bg-[#101013] px-4 py-9 text-center text-sm text-white/38">
                {catalogStatus === "loading" ? "Carregando anúncios…" : "Ainda não há anúncios aprovados para destacar."}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {featured.map((product) => (
                  <ProductCard key={product.id} product={product} onOpen={() => navigate(`/produto/${product.id}`)} />
                ))}
              </div>
            )}
          </div>

          <aside className="h-fit rounded-xl border border-white/[0.08] bg-[#101013] p-4">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-[#67b5ff]" />
              <h2 className="text-sm font-bold text-white">Acesso rápido</h2>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-white/34">Entre direto na área que faz sentido para você.</p>

            <div className="mt-4 space-y-1">
              {popularCategories.length > 0 ? popularCategories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => openCategory(category.name)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2.5 text-left text-[11px] font-semibold text-white/58 transition hover:bg-white/[0.04] hover:text-white"
                >
                  <span className="truncate">{category.name}</span>
                  <span className="shrink-0 text-[9px] font-medium text-white/25">{category.count}</span>
                </button>
              )) : (
                <p className="rounded-lg bg-white/[0.025] px-3 py-3 text-[11px] text-white/34">As categorias aparecem aqui assim que tiverem anúncios aprovados.</p>
              )}
            </div>

            <div className="mt-4 border-t border-white/[0.07] pt-4">
              <button
                type="button"
                onClick={() => navigate("/robux")}
                className="flex w-full items-center justify-between rounded-lg border border-[#168cff]/20 bg-[#168cff]/[0.07] px-3 py-3 text-left transition hover:bg-[#168cff]/[0.11]"
              >
                <span>
                  <span className="block text-[11px] font-bold text-white">Mercado de Robux</span>
                  <span className="mt-0.5 block text-[9px] text-white/35">Página exclusiva</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-[#67b5ff]" />
              </button>
            </div>
          </aside>
        </section>

        {newest.length > 0 ? (
          <section className="border-t border-white/[0.07] pt-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Chegaram agora</h2>
              <Link to="/loja?sort=recentes" className="text-[11px] font-semibold text-white/42 hover:text-white">Ver novidades</Link>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {newest.map((product) => (
                <ProductCard key={product.id} product={product} onOpen={() => navigate(`/produto/${product.id}`)} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid gap-2.5 border-t border-white/[0.07] pt-7 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#101013] p-4">
            <ShieldCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#67b5ff]" />
            <div><h3 className="text-xs font-bold text-white">Pedido rastreável</h3><p className="mt-1 text-[10px] leading-4 text-white/34">Pagamento, entrega e histórico ficam ligados ao mesmo pedido.</p></div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#101013] p-4">
            <Zap className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-300" />
            <div><h3 className="text-xs font-bold text-white">Entrega automática</h3><p className="mt-1 text-[10px] leading-4 text-white/34">Quando o anúncio oferece automação, a liberação acontece após a confirmação do pagamento.</p></div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#101013] p-4">
            <BadgeCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#67b5ff]" />
            <div><h3 className="text-xs font-bold text-white">Contexto do vendedor</h3><p className="mt-1 text-[10px] leading-4 text-white/34">Perfil público e sinais de verificação ajudam a avaliar antes da compra.</p></div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
