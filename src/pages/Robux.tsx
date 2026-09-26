import React, { useMemo, useState } from "react";
import { BadgeCheck, ChevronRight, Search, Star } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";
import {
  formatBRL,
  formatRobuxPackage,
  formatRobuxUnitPrice,
  formatStockLabel,
  productMinQuantity,
  productStock,
  ROBUX_CATEGORY,
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
  { id: "barato", label: "Menor preço" },
  { id: "min", label: "Menor mínimo" },
  { id: "recomendado", label: "Mais avaliações" },
];

export default function RobuxPage() {
  const { state, catalogStatus, refreshProducts } = useStore();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>("barato");
  const [search, setSearch] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const offers = useMemo<RobuxOffer[]>(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    const max = Number(maxPrice);

    const listed = state.products
      .filter((product) => product.category === ROBUX_CATEGORY && product.approved)
      .map((product) => {
        const identity = state.userDirectory?.[product.sellerId];
        const sellerPublicId = product.sellerPublicId || identity?.publicId || "";
        const reviewCount = Number(product.reviewCount || 0);
        const positive = Number(product.reviewPositive || 0);

        return {
          productId: product.id,
          productName: product.name,
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

  return (
    <AppShell>
      <div className="mx-auto max-w-[1180px]">
        <nav className="mb-5 flex items-center gap-2 text-[11px] text-white/35" aria-label="Navegação estrutural">
          <Link to="/" className="hover:text-white">Início</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/categorias" className="hover:text-white">Categorias</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-white/70">Robux</span>
        </nav>

        <header className="mb-6 border-b border-white/[0.07] pb-5">
          <p className="text-xs font-medium text-white/35">Mercado de Robux</p>
          <h1 className="mt-1 text-3xl font-bold tracking-[-0.035em] text-white">Robux Roblox</h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/35">Categorias</h2>
              <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-[#101013]">
                {[
                  ["Robux", "/robux"],
                  ["Roblox no catálogo", "/loja?q=Roblox"],
                  ["Contas", "/loja?cat=Contas"],
                  ["Jogos e itens", "/loja?cat=Jogos%20e%20Itens"],
                  ["Todas as categorias", "/categorias"],
                ].map(([label, to], index, all) => (
                  <Link
                    key={to}
                    to={to}
                    className={`block px-3 py-3 text-xs transition hover:bg-white/[0.035] ${index < all.length - 1 ? "border-b border-white/[0.06]" : ""} ${to === "/robux" ? "font-semibold text-white" : "text-white/48"}`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/35">Filtros</h2>
              <div className="space-y-3 rounded-lg border border-white/[0.08] bg-[#101013] p-3">
                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-white/42">Vendedor ou anúncio</span>
                  <div className="flex h-10 items-center rounded-md border border-white/[0.09] bg-[#0b0b0e] px-2.5 focus-within:border-[#168cff]/60">
                    <Search className="h-3.5 w-3.5 text-white/28" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Filtrar..."
                      className="ml-2 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/24"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-white/42">Preço máximo do pacote</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={maxPrice}
                    onChange={(event) => setMaxPrice(event.target.value)}
                    placeholder="R$ 0,00"
                    className="h-10 w-full rounded-md border border-white/[0.09] bg-[#0b0b0e] px-3 text-xs text-white outline-none placeholder:text-white/24 focus:border-[#168cff]/60"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[11px] text-white/42">Ordenar por</span>
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortKey)}
                    className="h-10 w-full rounded-md border border-white/[0.09] bg-[#0b0b0e] px-3 text-xs text-white outline-none focus:border-[#168cff]/60"
                  >
                    {SORT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                </label>

                {(search || maxPrice) ? (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setMaxPrice(""); }}
                    className="text-[11px] font-semibold text-[#63afff] hover:text-white"
                  >
                    Limpar filtros
                  </button>
                ) : null}
              </div>
            </section>
          </aside>

          <main>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">Ofertas de Robux</h2>
                <p className="mt-0.5 text-[11px] text-white/32">Somente anúncios aprovados com perfil público válido aparecem neste mercado.</p>
              </div>
              <span className="text-[11px] text-white/28">{offers.length} ofertas</span>
            </div>

            {isLoading ? (
              <div className="space-y-2" aria-busy="true">
                {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-white/[0.035]" />)}
              </div>
            ) : offers.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/[0.1] bg-[#101013] px-5 py-12 text-center">
                <p className="text-sm font-semibold text-white">Nenhuma oferta encontrada.</p>
                <p className="mt-1 text-xs text-white/38">Somente anúncios aprovados com perfil público válido aparecem neste mercado.</p>
                <button type="button" onClick={() => void refreshProducts()} className="mt-4 text-xs font-semibold text-[#62afff] hover:text-white">Atualizar ofertas</button>
              </div>
            ) : (
              <div className="space-y-2">
                {offers.map((offer) => (
                  <article key={offer.productId} className="rounded-lg border border-white/[0.08] bg-[#111114] p-4 transition hover:border-white/[0.17]">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_145px] md:items-center">
                      <div className="flex min-w-0 gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-white/[0.08] bg-[#19191e] text-xs font-bold text-white/60">
                          {offer.image ? <img src={offer.image} alt="" className="h-full w-full object-cover" /> : "R$"}
                        </div>
                        <div className="min-w-0">
                          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">{offer.productName}</h3>
                          <p className="mt-1 flex items-center gap-1 truncate text-[11px] text-white/42">
                            {offer.sellerName}
                            {offer.verified ? <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#55a9ff]" aria-label="Vendedor verificado" /> : null}
                          </p>
                          <p className="mt-0.5 text-[10px] text-white/25">ID público: {offer.sellerPublicId}</p>
                          <p className="mt-1 text-[10px] text-white/30">
                            {offer.reviewCount > 0 ? (
                              <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-[#f5b642] text-[#f5b642]" /> {offer.positivePct}% positivas · {offer.reviewCount} avaliações</span>
                            ) : "Sem avaliações registradas"}
                          </p>
                        </div>
                      </div>

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                        <div><dt className="text-white/28">Valor/un.</dt><dd className="mt-0.5 font-semibold text-white">{formatRobuxUnitPrice(offer.pricePerUnit)}</dd></div>
                        <div><dt className="text-white/28">Mínimo</dt><dd className="mt-0.5 font-medium text-white/72">{offer.minQty.toLocaleString("pt-BR")}</dd></div>
                        <div><dt className="text-white/28">Estoque</dt><dd className="mt-0.5 font-medium text-white/72">{formatStockLabel(offer.stock)}</dd></div>
                        <div><dt className="text-white/28">Prazo</dt><dd className="mt-0.5 truncate font-medium text-white/72">{offer.delivery}</dd></div>
                      </dl>

                      <div className="md:text-right">
                        <p className="text-[10px] text-white/28">Pacote anunciado</p>
                        <p className="mt-1 text-sm font-bold text-white">{formatBRL(offer.packagePrice)}</p>
                        <p className="mt-0.5 text-[10px] text-white/32">{formatRobuxPackage({ price: offer.packagePrice, category: ROBUX_CATEGORY, variations: [{ name: `${offer.packageUnits} Robux` }] })}</p>
                        <button
                          type="button"
                          onClick={() => navigate(`/produto/${offer.productId}`)}
                          className="mt-3 rounded-md bg-[#168cff] px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-[#0878dc]"
                        >
                          Ver oferta
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </AppShell>
  );
}
