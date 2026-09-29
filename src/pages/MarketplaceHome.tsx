import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Boxes,
  Gamepad2,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { Product, useStore } from "@/store/StoreContext";
import { formatBRL, lowestProductPrice, productHasAutoDelivery, productHasMixedDelivery, ROBUX_CATEGORY, isRobuxCategory, storefrontProducts } from "@/lib/catalog";
import { useSiteBranding } from "@/context/SiteBrandingContext";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Bots Discord": Bot,
  "Contas": BadgeCheck,
  "Scripts": Boxes,
  "Jogos e Itens": Gamepad2,
};

function MarketplaceCard({
  product,
  verified,
  onOpen,
}: {
  product: Product;
  verified?: boolean;
  onOpen: () => void;
}) {
  const hasAutoDelivery = productHasAutoDelivery(product);
  const mixedDelivery = productHasMixedDelivery(product);
  const variationCount = isRobuxCategory(product.category) ? 0 : (product.variations?.length || 0);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-white/[0.075] bg-[#101013] text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/[0.16] hover:bg-[#121216] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--zx-accent)]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#17171c]">
        {product.image ? (
          <img src={product.image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]" loading="lazy" />
        ) : (
          <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.06),transparent_42%)]">
            <div className="text-center text-white/20">
              <Package className="mx-auto h-7 w-7" />
              <span className="mt-2 block text-[8px] font-bold uppercase tracking-[0.14em]">Imagem não enviada</span>
            </div>
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {hasAutoDelivery ? (
            <span className="rounded-md border border-emerald-300/15 bg-emerald-400/90 px-1.5 py-1 text-[7px] font-black uppercase tracking-wide text-[#06120b]">{mixedDelivery ? "Auto + manual" : "Entrega automática"}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <p className="truncate text-[8px] font-black uppercase tracking-[0.12em] text-white/27">{product.category}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-9 text-[12px] font-bold leading-[18px] text-white sm:text-[13px]">{product.name}</h3>
        <div className="mt-2 flex min-w-0 items-center gap-1 text-[9.5px] text-white/36">
          <span className="truncate">{product.seller || "Vendedor"}</span>
          {verified ? <BadgeCheck className="h-3 w-3 shrink-0 text-[var(--zx-accent)]" /> : null}
        </div>
        <div className="mt-auto pt-3">
          <p className="text-[8px] text-white/24">a partir de</p>
          <p className="mt-0.5 text-[15px] font-extrabold tracking-[-0.025em] text-white sm:text-base">{formatBRL(lowestProductPrice(product))}</p>
          {variationCount > 0 ? <p className="mt-0.5 text-[8px] text-white/28">{variationCount} opções</p> : null}
        </div>
      </div>
    </button>
  );
}

function ProductRow({
  title,
  subtitle,
  products,
  onOpen,
  verified,
  moreTo,
}: {
  title: string;
  subtitle?: string;
  products: Product[];
  onOpen: (id: number) => void;
  verified: (sellerId: string) => boolean;
  moreTo: string;
}) {
  if (!products.length) return null;
  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold tracking-[-0.025em] text-white sm:text-xl">{title}</h2>
          {subtitle ? <p className="mt-1 text-[10px] leading-4 text-white/30 sm:text-[11px]">{subtitle}</p> : null}
        </div>
        <Link to={moreTo} className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-[var(--zx-accent)] transition hover:text-white">
          Ver todos <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {products.slice(0, 4).map((product) => (
          <MarketplaceCard
            key={product.id}
            product={product}
            verified={verified(product.sellerId)}
            onOpen={() => onOpen(product.id)}
          />
        ))}
      </div>
    </section>
  );
}

export default function MarketplaceHome() {
  const { state, catalogStatus } = useStore();
  const { branding } = useSiteBranding();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const publicProducts = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id),
    [state.products, state.currentUser?.id],
  );

  const homeProducts = useMemo(
    () => publicProducts.filter((product) => !isRobuxCategory(product.category)),
    [publicProducts],
  );

  const verifiedSeller = (sellerId: string) => Boolean(state.userDirectory?.[sellerId]?.isVerified);

  const newest = useMemo(
    () => [...homeProducts].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 4),
    [homeProducts],
  );

  const featured = useMemo(
    () => [...homeProducts]
      .sort((a, b) => (Number(b.sales || 0) + Number(b.rating || 0) * 2) - (Number(a.sales || 0) + Number(a.rating || 0) * 2) || b.id - a.id)
      .slice(0, 4),
    [homeProducts],
  );

  const robux = useMemo(() => [] as Product[], []);

  const namedSections = useMemo(
    () => ["Bots Discord", "Contas", "Scripts"]
      .map((category) => ({
        category,
        products: homeProducts.filter((product) => product.category === category).slice(0, 4),
      }))
      .filter((section) => section.products.length > 0),
    [homeProducts],
  );

  const categoryTiles = useMemo(() => {
    const configured = state.config.categories.filter((category) => !isRobuxCategory(category));
    const categories = configured.slice(0, 8);
    return categories.map((category) => {
      const products = homeProducts.filter((product) => product.category === category);
      const image = products.find((product) => Boolean(product.image))?.image || "";
      return { category, count: products.length, image };
    });
  }, [homeProducts, state.config.categories]);

  const promoBanners = [branding.promoBanner1Url, branding.promoBanner2Url, branding.promoBanner3Url].filter(Boolean);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/loja?q=${encodeURIComponent(value)}` : "/loja");
  };

  const openCategory = (category: string) => {
    navigate(category === ROBUX_CATEGORY ? "/robux" : `/loja?cat=${encodeURIComponent(category)}`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px] space-y-9 pb-3">
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.075] bg-[#0f0f13]">
          {branding.heroBannerUrl ? (
            <>
              <img src={branding.heroBannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#090a0d] via-[#090a0d]/90 to-[#090a0d]/35" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_5%,rgba(22,140,255,.18),transparent_34%),radial-gradient(circle_at_10%_100%,rgba(91,33,182,.10),transparent_36%)]" />
          )}

          <div className="relative px-4 py-6 sm:px-7 sm:py-9 lg:px-10 lg:py-11">
            <div className="max-w-[650px]">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/48">
                <Sparkles className="h-3 w-3 text-[var(--zx-accent)]" /> Marketplace digital
              </div>
              <h1 className="mt-4 max-w-[620px] text-[31px] font-extrabold leading-[1.04] tracking-[-0.05em] text-white sm:text-5xl">
                {branding.heroTitle}
              </h1>
              <p className="mt-3 max-w-[560px] text-xs leading-5 text-white/48 sm:text-sm sm:leading-6">
                {branding.heroSubtitle}
              </p>

              <form onSubmit={submitSearch} className="mt-5 flex max-w-[610px] items-center rounded-xl border border-white/[0.12] bg-[#111116]/95 p-1.5 shadow-2xl shadow-black/15 focus-within:border-[var(--zx-accent)]">
                <Search className="ml-2 h-4 w-4 shrink-0 text-white/28" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="O que você está procurando?"
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-xs text-white outline-none placeholder:text-white/28 sm:text-sm"
                  aria-label="Buscar no marketplace"
                />
                <button type="submit" className="rounded-lg bg-[var(--zx-accent)] px-4 py-2.5 text-[11px] font-bold text-white transition hover:brightness-110 sm:px-5">
                  Buscar
                </button>
              </form>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link to="/loja" className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.035] px-3 py-2 text-[10px] font-bold text-white/78 transition hover:bg-white/[0.07] hover:text-white">
                  Explorar anúncios <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link to="/meus-produtos" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold text-white/45 transition hover:text-white">
                  Quero anunciar
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-extrabold tracking-[-0.025em] text-white sm:text-xl">Categorias populares</h2>
              <p className="mt-1 text-[10px] text-white/30">Acesse rapidamente o tipo de produto que procura.</p>
            </div>
            <Link to="/categorias" className="text-[10px] font-bold text-[var(--zx-accent)] hover:text-white">Ver todas</Link>
          </div>
          <div className="-mx-3 flex snap-x gap-2.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-4 sm:px-0 lg:grid-cols-8">
            {categoryTiles.map(({ category, count, image }) => {
              const Icon = category === ROBUX_CATEGORY ? Zap : CATEGORY_ICONS[category] || Package;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => openCategory(category)}
                  className="group relative min-w-[105px] snap-start overflow-hidden rounded-xl border border-white/[0.075] bg-[#101013] text-left transition hover:border-white/[0.16] sm:min-w-0"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-[#17171c]">
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-cover opacity-75 transition duration-300 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_0%,rgba(22,140,255,.15),transparent_65%)]">
                        <Icon className="h-6 w-6 text-white/24" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-[10px] font-bold text-white">{category === ROBUX_CATEGORY ? "Robux" : category}</p>
                    <p className="mt-0.5 text-[8px] text-white/28">{count} anúncio{count === 1 ? "" : "s"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {promoBanners.length ? (
          <section className="grid gap-3 sm:grid-cols-3">
            {promoBanners.map((url, index) => (
              <div key={url} className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#101013]">
                <img src={url} alt={`Banner promocional ${index + 1}`} className="aspect-[16/6] h-full w-full object-cover" />
              </div>
            ))}
          </section>
        ) : null}

        {robux.length ? (
          <section className="overflow-hidden rounded-2xl border border-white/[0.075] bg-[#0f0f13]">
            <div className="grid lg:grid-cols-[280px_1fr]">
              <button onClick={() => navigate("/robux")} className="relative min-h-[170px] overflow-hidden border-b border-white/[0.07] text-left lg:border-b-0 lg:border-r">
                {branding.robuxBannerUrl || robux[0]?.image ? (
                  <img src={branding.robuxBannerUrl || robux[0]?.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
                <div className="relative flex h-full min-h-[170px] flex-col justify-end p-5">
                  <span className="text-[8px] font-black uppercase tracking-[0.16em] text-[var(--zx-accent)]">Mercado dedicado</span>
                  <h2 className="mt-1 text-2xl font-extrabold tracking-[-0.04em] text-white">Robux</h2>
                  <p className="mt-1 text-[10px] leading-4 text-white/42">Compare pacotes e vendedores em uma página própria.</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-white">Abrir mercado <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </button>
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
                {robux.map((product) => (
                  <MarketplaceCard key={product.id} product={product} verified={verifiedSeller(product.sellerId)} onOpen={() => navigate(`/produto/${product.id}`)} />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <ProductRow
          title="Em destaque"
          subtitle="Ofertas públicas aprovadas, sem misturar anúncios que ainda estão em análise."
          products={featured}
          onOpen={(id) => navigate(`/produto/${id}`)}
          verified={verifiedSeller}
          moreTo="/loja?sort=vendidos"
        />

        <ProductRow
          title="Novidades"
          subtitle={catalogStatus === "loading" ? "Carregando anúncios…" : "Os anúncios aprovados mais recentes da plataforma."}
          products={newest}
          onOpen={(id) => navigate(`/produto/${id}`)}
          verified={verifiedSeller}
          moreTo="/loja?sort=recentes"
        />

        {namedSections.map((section) => (
          <ProductRow
            key={section.category}
            title={section.category}
            products={section.products}
            onOpen={(id) => navigate(`/produto/${id}`)}
            verified={verifiedSeller}
            moreTo={`/loja?cat=${encodeURIComponent(section.category)}`}
          />
        ))}

        {publicProducts.length === 0 && catalogStatus !== "loading" ? (
          <section className="rounded-xl border border-dashed border-white/[0.1] bg-[#101013] px-5 py-10 text-center">
            <Package className="mx-auto h-7 w-7 text-white/20" />
            <h2 className="mt-3 text-sm font-bold text-white">A vitrine está sendo preparada</h2>
            <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-white/34">Anúncios em análise ficam somente no painel do vendedor e da moderação. Quando forem aprovados, aparecem aqui.</p>
          </section>
        ) : null}

        <section className="grid gap-2.5 border-t border-white/[0.07] pt-7 sm:grid-cols-3">
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#101013] p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--zx-accent)]" />
            <div><h3 className="text-xs font-bold text-white">Pedido organizado</h3><p className="mt-1 text-[9.5px] leading-4 text-white/32">Pagamento, entrega e histórico permanecem ligados ao mesmo pedido.</p></div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#101013] p-4">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <div><h3 className="text-xs font-bold text-white">Entrega automática</h3><p className="mt-1 text-[9.5px] leading-4 text-white/32">Anúncios compatíveis liberam a entrega após a confirmação do pagamento.</p></div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#101013] p-4">
            <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--zx-accent)]" />
            <div><h3 className="text-xs font-bold text-white">Vendedores identificados</h3><p className="mt-1 text-[9.5px] leading-4 text-white/32">Perfis e sinais de verificação ajudam na decisão de compra.</p></div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
