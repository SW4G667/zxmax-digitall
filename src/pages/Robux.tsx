import React, { useMemo, useState } from "react";
import { BadgeCheck, ChevronRight, RefreshCw, Search, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useSiteBranding } from "@/context/SiteBrandingContext";
import { useStore } from "@/store/StoreContext";
import {
  formatBRL,
  formatRobuxUnitPrice,
  formatStockLabel,
  productMinQuantity,
  productStock,
  ROBUX_CATEGORY,
  isRobuxCategory,
  robuxPackageUnits,
  unitPriceFromPackage,
} from "@/lib/catalog";

type SortKey = "barato" | "min" | "recomendado";

interface RobuxOffer {
  productId: number;
  productName: string;
  sellerId: string;
  sellerName: string;
  sellerPublicId: string;
  verified: boolean;
  documentVerified: boolean;
  sellerAvatar?: string;
  packagePrice: number;
  packageUnits: number;
  pricePerUnit: number;
  stock: number | null;
  minQty: number;
  delivery: string;
  reviewCount: number;
  positivePct: number | null;
  image?: string;
}

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "barato", label: "Mais barato" },
  { id: "min", label: "Menor mínimo" },
  { id: "recomendado", label: "Mais avaliações" },
];

export default function RobuxPage() {
  const { state, catalogStatus, refreshProducts } = useStore();
  const { branding } = useSiteBranding();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>("barato");
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const offers = useMemo<RobuxOffer[]>(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const max = Number(maxPrice);

    const listed = state.products
      .filter((product) => isRobuxCategory(product.category) && product.approved)
      .map((product) => {
        const identity = state.userDirectory?.[product.sellerId];
        const sellerPublicId = String(product.sellerPublicId || identity?.publicId || "");
        const reviewCount = Number(product.reviewCount || 0);
        const positive = Number(product.reviewPositive || 0);

        return {
          productId: product.id,
          productName: product.name,
          sellerId: product.sellerId,
          sellerName: identity?.name || product.seller || "",
          sellerPublicId,
          verified: Boolean(identity?.isVerified),
          documentVerified: Boolean(identity?.documentVerified),
          sellerAvatar: identity?.avatar,
          packagePrice: Number(product.price) || 0,
          packageUnits: robuxPackageUnits(product),
          pricePerUnit: unitPriceFromPackage(product),
          stock: productStock(product),
          minQty: productMinQuantity(product) ?? robuxPackageUnits(product),
          delivery: product.deliveryTime || "Não informado",
          reviewCount,
          positivePct: reviewCount > 0 ? Math.round((positive / reviewCount) * 100) : null,
          image: product.image,
        };
      })
      .filter((offer) => Boolean(offer.sellerPublicId && offer.sellerName));

    const filtered = listed.filter((offer) => {
      const matchesSearch = !query || `${offer.productName} ${offer.sellerName} ${offer.sellerPublicId}`
        .toLocaleLowerCase("pt-BR")
        .includes(query);
      const matchesPrice = !Number.isFinite(max) || max <= 0 || offer.packagePrice <= max;
      return matchesSearch && matchesPrice;
    });

    return filtered.sort((left, right) => {
      if (sort === "min") return left.minQty - right.minQty || left.pricePerUnit - right.pricePerUnit;
      if (sort === "recomendado") return right.reviewCount - left.reviewCount || left.pricePerUnit - right.pricePerUnit;
      return left.pricePerUnit - right.pricePerUnit || left.packagePrice - right.packagePrice;
    });
  }, [maxPrice, search, sort, state.products, state.userDirectory]);

  const isLoading = catalogStatus === "loading" && state.products.length === 0;
  const hasFilters = Boolean(search.trim() || maxPrice);
  const bestUnitPrice = offers.length ? Math.min(...offers.map((offer) => offer.pricePerUnit)) : null;
  const knownStock = offers.reduce((sum, offer) => sum + (offer.stock == null ? 0 : offer.stock), 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1120px]">
        <nav className="mb-5 flex items-center gap-2 text-[11px] text-white/32" aria-label="Navegação estrutural">
          <Link to="/" className="hover:text-white">Início</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/categorias" className="hover:text-white">Categorias</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-white/70">Robux</span>
        </nav>

        <header className="relative overflow-hidden rounded-2xl border border-white/[0.075] bg-[#101013]">
          {branding.robuxBannerUrl ? (
            <>
              <img src={branding.robuxBannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#090a0d] via-[#090a0d]/88 to-[#090a0d]/35" />
            </>
          ) : null}
          <div className="relative flex min-h-[180px] flex-col justify-end gap-4 p-5 sm:min-h-[210px] sm:flex-row sm:items-end sm:justify-between sm:p-7">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--zx-accent)]">Mercado de Robux</p>
              <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-4xl">Robux Roblox</h1>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-white/55 sm:text-sm sm:leading-6">
                Escolha quantos Robux quer comprar, compare o preço final e o prazo, depois pague pelo checkout protegido.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-semibold text-white/65">
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5">1. Escolha uma oferta</span>
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5">2. Defina a quantidade</span>
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5">3. Pague e acompanhe</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void refreshProducts()}
              className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-lg border border-white/[0.1] bg-black/10 px-3 text-[10px] font-semibold text-white/55 transition hover:bg-white/[0.05] hover:text-white sm:self-auto"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${catalogStatus === "loading" ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </header>

        <section className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Como comprar Robux">
          {[
            ["1", "Escolha uma oferta", "Compare preço por Robux, mínimo, estoque e prazo."],
            ["2", "Informe a quantidade", "Você pode comprar a partir do mínimo definido pelo vendedor."],
            ["3", "Pague e acompanhe", "Depois do pagamento, entrega e conversa ficam no pedido protegido."],
          ].map(([step, title, description]) => (
            <div key={step} className="rounded-xl border border-white/[0.08] bg-[#101013] p-3.5">
              <div className="flex items-start gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#ffbd2e] text-xs font-black text-black">{step}</span>
                <div><p className="text-xs font-bold text-white">{title}</p><p className="mt-1 text-[10px] leading-4 text-white/40">{description}</p></div>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-[9px] uppercase tracking-wide text-white/35">Ofertas</p><p className="mt-1 text-lg font-black text-white">{offers.length}</p></div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-[9px] uppercase tracking-wide text-white/35">Melhor preço</p><p className="mt-1 truncate text-sm font-black text-[#75c5ff]">{bestUnitPrice == null ? "—" : formatRobuxUnitPrice(bestUnitPrice)}</p></div>
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3"><p className="text-[9px] uppercase tracking-wide text-white/35">Estoque visível</p><p className="mt-1 text-lg font-black text-white">{knownStock ? knownStock.toLocaleString("pt-BR") : "—"}</p></div>
        </section>

        <section className="mt-5 rounded-lg border border-white/[0.08] bg-[#101013] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/35">Ordenar ofertas</p>
              <p className="mt-1 text-[10px] text-white/28">Compare por preço, compra mínima ou avaliações.</p>
            </div>
            <div role="group" aria-label="Ordenar ofertas" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:px-0">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={sort === option.id}
                  onClick={() => setSort(option.id)}
                  className={`shrink-0 rounded-md border px-3 py-2 text-[10px] font-bold transition ${
                    sort === option.id
                      ? "border-[#f5b642]/50 bg-[#f5b642] text-black"
                      : "border-white/[0.09] bg-[#0b0b0e] text-white/55 hover:border-white/[0.16] hover:text-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px_auto]">
            <label className="flex h-10 min-w-0 items-center rounded-md border border-white/[0.09] bg-[#0b0b0e] px-3 focus-within:border-[var(--zx-accent)]">
              <Search className="h-4 w-4 shrink-0 text-white/28" />
              <span className="sr-only">Buscar oferta de Robux</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar vendedor ou oferta..."
                className="ml-2 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/24"
              />
            </label>

            <label className="block">
              <span className="sr-only">Preço máximo do pacote</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="Preço máximo"
                className="h-10 w-full rounded-md border border-white/[0.09] bg-[#0b0b0e] px-3 text-xs text-white outline-none placeholder:text-white/24 focus:border-[var(--zx-accent)]"
              />
            </label>

            <button
              type="button"
              disabled={!hasFilters}
              onClick={() => { setSearch(""); setMaxPrice(""); }}
              className="h-10 rounded-md border border-white/[0.08] px-3 text-[11px] font-semibold text-white/42 transition hover:bg-white/[0.035] hover:text-white disabled:cursor-default disabled:opacity-30"
            >
              Limpar filtros
            </button>
          </div>
        </section>

        <div className="mt-6 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Escolha onde comprar</h2>
            <p className="mt-1 text-[11px] leading-5 text-white/42">Compare principalmente <strong className="text-white/70">preço por Robux</strong>, compra mínima e prazo. Toque em “Comprar” para escolher a quantidade.</p>
          </div>
          <span className="shrink-0 text-[11px] text-white/25">{offers.length} {offers.length === 1 ? "oferta" : "ofertas"}</span>
        </div>

        {isLoading ? (
          <div className="mt-3 space-y-2" aria-busy="true" aria-live="polite">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-white/[0.035]" />)}
          </div>
        ) : catalogStatus === "error" && offers.length === 0 ? (
          <div className="mt-3 rounded-lg border border-red-400/15 bg-red-500/[0.04] px-5 py-10 text-center">
            <p className="text-sm font-semibold text-white">Não foi possível carregar as ofertas agora.</p>
            <button type="button" onClick={() => void refreshProducts()} className="mt-3 text-xs font-semibold text-[var(--zx-accent)] hover:text-white">Tentar novamente</button>
          </div>
        ) : offers.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-white/[0.1] bg-[#101013] px-5 py-12 text-center">
            <p className="text-sm font-semibold text-white">Nenhuma oferta encontrada.</p>
            <p className="mt-1 text-xs text-white/36">Ajuste os filtros ou aguarde novos anúncios aprovados.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {offers.map((offer) => (
              <article key={offer.productId} className="rounded-lg border border-white/[0.08] bg-[#111114] p-4 transition hover:border-white/[0.16]">
                <div className="grid gap-4 md:grid-cols-[minmax(0,1.25fr)_minmax(250px,.9fr)_150px] md:items-center">
                  <div className="flex min-w-0 gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-white/[0.08] bg-[#19191e] text-xs font-bold text-white/50">
                      {offer.image ? <img src={offer.image} alt="" className="h-full w-full object-cover" loading="lazy" /> : "R$"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">{offer.productName}</h3>
                      <div className="mt-1.5 flex min-w-0 items-center gap-2">
                        <img
                          src={offer.sellerAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(offer.sellerName)}`}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded-full border border-white/[0.08] bg-[#0d0d11] object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 truncate text-[11px] font-semibold text-white/65">
                            {offer.sellerName}
                            {offer.documentVerified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--zx-accent)]" aria-label="Documento verificado" /> : null}
                          </p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {offer.documentVerified && <span className="rounded bg-[#168cff]/10 px-1.5 py-0.5 text-[8px] font-bold text-[#70bdff]">Documento</span>}
                          </div>
                        </div>
                      </div>
                      <p className="mt-1 text-[10px] text-white/25">ID público: {offer.sellerPublicId}</p>
                      <p className="mt-1 text-[10px] text-white/30">
                        {offer.reviewCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3 w-3 fill-[#f5b642] text-[#f5b642]" />
                            {offer.positivePct}% positivas · {offer.reviewCount} avaliações
                          </span>
                        ) : "Sem avaliações registradas"}
                      </p>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-[11px] sm:grid-cols-4 md:grid-cols-2">
                    <div>
                      <dt className="text-white/28">Valor/un.</dt>
                      <dd className="mt-0.5 font-semibold text-[var(--zx-accent)]">{formatRobuxUnitPrice(offer.pricePerUnit)}</dd>
                    </div>
                    <div>
                      <dt className="text-white/28">Mínimo</dt>
                      <dd className="mt-0.5 font-medium text-white/72">{offer.minQty.toLocaleString("pt-BR")} Robux</dd>
                    </div>
                    <div>
                      <dt className="text-white/28">Estoque</dt>
                      <dd className="mt-0.5 font-medium text-white/72">{formatStockLabel(offer.stock)}</dd>
                    </div>
                    <div>
                      <dt className="text-white/28">Prazo</dt>
                      <dd className="mt-0.5 truncate font-medium text-white/72">{offer.delivery}</dd>
                    </div>
                  </dl>

                  <div className="border-t border-white/[0.06] pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0 md:text-right">
                    <p className="text-[10px] text-white/28">{offer.packageUnits.toLocaleString("pt-BR")} Robux</p>
                    <p className="mt-1 text-base font-bold text-white">{formatBRL(offer.packagePrice)}</p>
                    <button
                      type="button"
                      onClick={() => navigate(`/produto/${offer.productId}`)}
                      className="mt-3 w-full rounded-md bg-[var(--zx-accent)] px-4 py-2 text-[11px] font-semibold text-white transition hover:brightness-110 md:w-auto"
                    >
                      Escolher oferta
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
