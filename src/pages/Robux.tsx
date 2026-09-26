import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, CheckCircle2, ChevronRight, CircleDollarSign, Coins,
  PackageCheck, Search, ShieldCheck, ShoppingCart, Sparkles, Star, X,
} from "lucide-react";
import { useStore } from "@/store/StoreContext";
import {
  formatBRL, formatRobuxPackage, formatRobuxUnitPrice, formatStockLabel,
  productMinQuantity, productStock, ROBUX_CATEGORY, robuxPackageUnits, unitPriceFromPackage,
} from "@/lib/catalog";
import AppShell from "@/components/AppShell";

type SortKey = "barato" | "min" | "recomendado";

interface RobuxOffer {
  productId: number;
  sellerId: string;
  sellerName: string;
  sellerPublicId: string;
  verified: boolean;
  packagePrice: number;
  packageUnits: number;
  pricePerUnit: number;
  stock: number | null;
  minQty: number;
  delivery: string;
  reviewCount: number;
  positivePct: number | null;
  avatar?: string;
}

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "barato", label: "Menor valor/un." },
  { id: "min", label: "Menor mínimo" },
  { id: "recomendado", label: "Mais avaliações" },
];

export default function RobuxPage() {
  const { state, catalogStatus, refreshProducts } = useStore();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>("barato");
  const [search, setSearch] = useState("");
  const [desired, setDesired] = useState(1000);

  const offers = useMemo<RobuxOffer[]>(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const listed = state.products
      .filter((product) => product.category === ROBUX_CATEGORY && product.approved)
      .map((product) => {
        const identity = state.userDirectory?.[product.sellerId];
        const sellerPublicId = product.sellerPublicId || identity?.publicId || "";
        const reviewCount = Number(product.reviewCount || 0);
        const positive = Number(product.reviewPositive || 0);
        return {
          productId: product.id,
          sellerId: product.sellerId,
          sellerName: identity?.name || product.seller || "",
          sellerPublicId,
          verified: Boolean(identity?.isVerified),
          packagePrice: product.price,
          packageUnits: robuxPackageUnits(product),
          pricePerUnit: unitPriceFromPackage(product),
          stock: productStock(product),
          minQty: productMinQuantity(product) ?? robuxPackageUnits(product),
          delivery: product.deliveryTime || "Não informado",
          reviewCount,
          positivePct: reviewCount > 0 ? Math.round((positive / reviewCount) * 100) : null,
          avatar: identity?.avatar,
        };
      })
      .filter((offer) => Boolean(offer.sellerPublicId && offer.sellerName));

    const filtered = query
      ? listed.filter((offer) => `${offer.sellerName} ${offer.sellerPublicId}`.toLocaleLowerCase("pt-BR").includes(query))
      : listed;

    return filtered.sort((left, right) => {
      if (sort === "min") return left.minQty - right.minQty || left.pricePerUnit - right.pricePerUnit;
      if (sort === "recomendado") return right.reviewCount - left.reviewCount || left.pricePerUnit - right.pricePerUnit;
      return left.pricePerUnit - right.pricePerUnit || left.minQty - right.minQty;
    });
  }, [search, sort, state.products, state.userDirectory]);

  const allRobuxOffers = useMemo(
    () => state.products.filter((product) => product.category === ROBUX_CATEGORY && product.approved),
    [state.products],
  );

  const bestUnitPrice = useMemo(() => {
    let best: number | null = null;
    for (const product of allRobuxOffers) {
      const unit = unitPriceFromPackage(product);
      if (unit > 0 && (best === null || unit < best)) best = unit;
    }
    return best;
  }, [allRobuxOffers]);

  const verifiedCount = useMemo(() => offers.filter((offer) => offer.verified).length, [offers]);

  const simulation = useMemo(() => {
    const qty = Math.max(1, Number(desired) || 1);
    const compatible = offers
      .filter((offer) => qty >= offer.minQty && (offer.stock === null || offer.stock >= qty))
      .map((offer) => {
        const packages = Math.max(1, Math.ceil(qty / Math.max(1, offer.packageUnits)));
        return { offer, packages, estimated: packages * offer.packagePrice };
      })
      .sort((a, b) => a.estimated - b.estimated || a.offer.pricePerUnit - b.offer.pricePerUnit);
    return compatible[0] || null;
  }, [desired, offers]);

  const isLoading = catalogStatus === "loading" && state.products.length === 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <nav aria-label="Navegação estrutural" className="flex items-center gap-2 text-[11px] font-semibold text-white/35">
          <Link to="/" className="hover:text-white">Início</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/categorias" className="hover:text-white">Categorias</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-white/70">Robux</span>
        </nav>

        <section className="relative overflow-hidden rounded-[2rem] border border-[#ffbd2e]/18 bg-[#101217] px-5 py-7 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,rgba(255,189,46,.15),transparent_32%),radial-gradient(circle_at_20%_100%,rgba(22,140,255,.14),transparent_30%)]" />
          <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-end">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#ffbd2e]/20 bg-[#ffbd2e]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#ffd36b]">
                <Sparkles className="h-3.5 w-3.5" /> Mercado de Robux
              </span>
              <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-[-0.055em] text-white sm:text-5xl">Compare vendedores antes de escolher sua oferta.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">Veja valor por unidade, mínimo, estoque, prazo e reputação em uma página dedicada. A compra continua pelo checkout normal da ZXMAX.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/seguranca" className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold text-white/45 hover:text-white"><ShieldCheck className="h-3.5 w-3.5 text-[#5fc3ff]" /> Compra protegida</Link>
                <Link to="/como-funciona" className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold text-white/45 hover:text-white"><CheckCircle2 className="h-3.5 w-3.5 text-[#68d993]" /> Como funciona</Link>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3.5"><dt className="text-[9px] font-black uppercase tracking-[0.13em] text-white/30">Ofertas</dt><dd className="mt-2 text-xl font-black text-white">{allRobuxOffers.length}</dd></div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3.5"><dt className="text-[9px] font-black uppercase tracking-[0.13em] text-white/30">Verificados</dt><dd className="mt-2 text-xl font-black text-white">{verifiedCount}</dd></div>
              <div className="rounded-2xl border border-white/[0.08] bg-black/[0.18] p-3.5"><dt className="text-[9px] font-black uppercase tracking-[0.13em] text-white/30">A partir de</dt><dd className="mt-2 truncate text-xs font-black text-[#ffd36b]">{bestUnitPrice == null ? "—" : formatRobuxUnitPrice(bestUnitPrice)}</dd></div>
            </dl>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[1.6rem] border border-white/[0.075] bg-[#101319] p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffbd2e]/10 text-[#ffd36b]"><CircleDollarSign className="h-5 w-5" /></span>
              <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">Simulador</p><h2 className="mt-1 text-lg font-black text-white">Quanto você quer comprar?</h2></div>
            </div>
            <label className="mt-5 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-white/32">Quantidade de Robux</span>
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.09] bg-black/[0.16] p-2">
                <Coins className="ml-2 h-4 w-4 text-[#ffd36b]" />
                <input type="number" min={1} step={1} value={desired} onChange={(event) => setDesired(Math.max(1, Number(event.target.value) || 1))} className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm font-black text-white outline-none" />
              </div>
            </label>
            {simulation ? (
              <div className="mt-4 rounded-2xl border border-[#168cff]/18 bg-[#168cff]/[0.06] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#76c2ff]">Melhor estimativa compatível</p>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div><p className="text-sm font-black text-white">{simulation.offer.sellerName}</p><p className="mt-1 text-xs text-white/38">{simulation.packages} pacote(s) · {formatRobuxPackage({ price: simulation.offer.packagePrice, category: ROBUX_CATEGORY, variations: [{ name: `${simulation.offer.packageUnits} Robux` }] })}</p></div>
                  <p className="text-lg font-black text-white">{formatBRL(simulation.estimated)}</p>
                </div>
                <button onClick={() => navigate(`/produto/${simulation.offer.productId}`)} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#168cff] px-4 py-2.5 text-xs font-black text-white hover:bg-[#0877e6]">Abrir oferta <ArrowRight className="h-3.5 w-3.5" /></button>
                <p className="mt-3 text-[10px] leading-4 text-white/28">Estimativa baseada nos pacotes anunciados. Confirme quantidade, preço e condições na página do produto antes de pagar.</p>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-white/[0.1] p-4 text-xs leading-5 text-white/38">Nenhuma oferta atual atende essa quantidade considerando mínimo e estoque informado.</p>
            )}
          </div>

          <div className="rounded-[1.6rem] border border-white/[0.075] bg-[#101319] p-5 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#68b7fa]">Outros produtos Roblox</p>
            <h2 className="mt-2 text-lg font-black text-white">Procure além de Robux</h2>
            <p className="mt-2 text-sm leading-6 text-white/42">Contas, itens, gamepasses e outros anúncios relacionados podem aparecer no catálogo geral quando publicados por vendedores.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {[
                ["Roblox no catálogo", "/loja?q=Roblox"],
                ["Contas", "/loja?cat=Contas"],
                ["Jogos e itens", "/loja?cat=Jogos%20e%20Itens"],
                ["Todas categorias", "/categorias"],
              ].map(([label, to]) => (
                <Link key={label} to={to} className="group flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-[11px] font-black text-white/55 transition hover:border-[#168cff]/25 hover:text-white">
                  {label}<ChevronRight className="h-3.5 w-3.5 text-white/20 transition group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-white/[0.075] bg-[#0f1218] p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#68b7fa]">Comparador</p>
              <h2 className="mt-1 text-xl font-black text-white">Ofertas disponíveis</h2>
              <p className="mt-1 text-xs text-white/35">Somente anúncios aprovados com identidade pública válida entram nesta lista.</p>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 xl:max-w-3xl xl:flex-row xl:justify-end">
              <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-white/[0.09] bg-black/[0.15] px-3 text-white/50 focus-within:border-[#168cff]/55">
                <Search className="h-4 w-4 shrink-0" />
                <span className="sr-only">Buscar vendedor</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar vendedor ou ID público" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28" />
                {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca" className="rounded p-1 text-white/35 hover:text-white"><X className="h-4 w-4" /></button>}
              </label>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {SORT_OPTIONS.map((option) => (
                  <button key={option.id} type="button" onClick={() => setSort(option.id)} aria-pressed={sort === option.id} className={`min-h-11 shrink-0 rounded-xl border px-3 text-[11px] font-black transition ${sort === option.id ? "border-[#168cff]/45 bg-[#168cff]/12 text-[#8fceff]" : "border-white/[0.08] bg-white/[0.025] text-white/45 hover:text-white"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-5 grid gap-3">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
          ) : offers.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/[0.12] bg-black/[0.12] px-5 py-12 text-center">
              <Coins className="mx-auto h-7 w-7 text-[#67b8ff]" />
              <h3 className="mt-3 text-base font-black text-white">Nenhuma oferta corresponde à busca.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/42">Tente limpar a busca ou atualizar o catálogo.</p>
              <button type="button" onClick={() => { setSearch(""); void refreshProducts(); }} className="mt-5 rounded-xl border border-[#168cff]/30 bg-[#168cff]/10 px-4 py-2.5 text-xs font-black text-[#9bd5ff]">Atualizar ofertas</button>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              {offers.map((offer, index) => (
                <article key={offer.productId} className="group rounded-2xl border border-white/[0.075] bg-[#141821] p-4 transition hover:border-[#168cff]/35 hover:bg-[#161e29] sm:p-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(330px,.9fr)_190px] lg:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/[0.09] bg-[#0d1118] text-sm font-black text-[#9bd5ff]">
                        {offer.avatar ? <img src={offer.avatar} alt="" className="h-full w-full object-cover" /> : offer.sellerName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {index === 0 && sort === "barato" && <span className="rounded-full bg-[#ffbd2e]/12 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[#ffd36b]">Melhor preço</span>}
                          {offer.verified && <span className="inline-flex items-center gap-1 rounded-full bg-[#168cff]/10 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[#82c9ff]"><BadgeCheck className="h-3 w-3" /> Verificado</span>}
                        </div>
                        <p className="mt-2 flex items-center gap-1.5 truncate text-sm font-black text-white">{offer.sellerName}</p>
                        <p className="mt-1 text-[10px] font-semibold text-white/30">ID público: {offer.sellerPublicId}</p>
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-white/35">
                          {offer.reviewCount > 0 ? <><Star className="h-3 w-3 fill-[#ffbd2e] text-[#ffbd2e]" /><span>{offer.positivePct}% positivas · {offer.reviewCount} avaliações</span></> : <span>Sem avaliações registradas</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <div className="rounded-xl border border-white/[0.06] bg-black/[0.12] p-3"><p className="text-[9px] font-black uppercase tracking-wide text-white/25">Valor/un.</p><p className="mt-1 text-xs font-black text-white">{formatRobuxUnitPrice(offer.pricePerUnit)}</p></div>
                      <div className="rounded-xl border border-white/[0.06] bg-black/[0.12] p-3"><p className="text-[9px] font-black uppercase tracking-wide text-white/25">Mínimo</p><p className="mt-1 text-xs font-black text-white">{offer.minQty.toLocaleString("pt-BR")}</p></div>
                      <div className="rounded-xl border border-white/[0.06] bg-black/[0.12] p-3"><p className="text-[9px] font-black uppercase tracking-wide text-white/25">Estoque</p><p className="mt-1 truncate text-xs font-black text-white">{formatStockLabel(offer.stock)}</p></div>
                      <div className="rounded-xl border border-white/[0.06] bg-black/[0.12] p-3"><p className="text-[9px] font-black uppercase tracking-wide text-white/25">Prazo</p><p className="mt-1 truncate text-xs font-black text-white">{offer.delivery}</p></div>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-end">
                      <div className="lg:text-right"><p className="text-[9px] font-black uppercase tracking-wide text-white/25">Pacote</p><p className="mt-1 text-xs font-black text-white">{formatBRL(offer.packagePrice)} / {offer.packageUnits.toLocaleString("pt-BR")}</p></div>
                      <button onClick={() => navigate(`/produto/${offer.productId}`)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl bg-[#168cff] px-4 text-xs font-black text-white transition hover:bg-[#0875e6]">Ver oferta <ChevronRight className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            { icon: Search, title: "1. Compare", text: "Veja mínimo, preço por unidade, estoque, prazo e vendedor antes de escolher." },
            { icon: ShoppingCart, title: "2. Abra a oferta", text: "Confira o anúncio completo e ajuste a quantidade dentro do fluxo de compra." },
            { icon: PackageCheck, title: "3. Finalize e acompanhe", text: "Pague pelo checkout disponível e acompanhe o pedido dentro da sua conta." },
          ].map((step) => (
            <article key={step.title} className="rounded-2xl border border-white/[0.075] bg-[#101319] p-5">
              <step.icon className="h-5 w-5 text-[#69b8fb]" />
              <h3 className="mt-4 text-sm font-black text-white">{step.title}</h3>
              <p className="mt-2 text-xs leading-5 text-white/40">{step.text}</p>
            </article>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
