import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BadgeCheck, CheckCircle, ChevronRight, Coins, Search, SlidersHorizontal, X } from "lucide-react";
import { useStore } from "@/store/StoreContext";
import { formatRobuxPackage, formatRobuxUnitPrice, formatStockLabel, productMinQuantity, productStock, ROBUX_CATEGORY, robuxPackageUnits, unitPriceFromPackage } from "@/lib/catalog";
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
      // Listings without an active public identity must not become offers.
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

  const isLoading = catalogStatus === "loading" && state.products.length === 0;
  const knownStockOffers = offers.filter((offer) => offer.stock !== null).length;
  const bestUnitPrice = offers[0]?.pricePerUnit;

  return (
    <AppShell>
      <main className="mx-auto max-w-7xl">
        <nav aria-label="Navegação estrutural" className="mb-5 flex items-center gap-2 text-xs text-white/45"><Link to="/loja" className="hover:text-white">Início</Link><ChevronRight className="h-3.5 w-3.5" /><span className="font-semibold text-white">Mercado de Robux</span></nav>

        <section className="relative overflow-hidden rounded-[1.75rem] border border-[#168cff]/20 bg-[#101722] px-5 py-6 shadow-[0_22px_65px_rgba(0,79,158,0.12)] sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_89%_0%,rgba(0,132,255,0.26),transparent_33%),radial-gradient(circle_at_0%_100%,rgba(74,200,255,0.1),transparent_28%)]" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end"><div><span className="inline-flex items-center gap-2 rounded-full border border-[#74beff]/25 bg-[#168cff]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#90cdff]"><Coins className="h-3.5 w-3.5" /> Mercado de Robux</span><h1 className="mt-4 text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl">Ofertas de Robux, comparadas de forma clara.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">Cada oferta informa seu valor por unidade, mínimo, estoque e prazo. Você escolhe uma oferta e continua pelo checkout protegido da ZXMAX.</p></div><dl className="grid grid-cols-3 gap-2"><div className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">Ofertas</dt><dd className="mt-1 text-xl font-black text-white">{offers.length}</dd></div><div className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">A partir de</dt><dd className="mt-1 truncate text-xs font-black text-[#9bd5ff]">{bestUnitPrice == null ? "—" : formatRobuxUnitPrice(bestUnitPrice)}</dd></div><div className="rounded-2xl border border-white/[0.09] bg-black/[0.15] p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">Estoque</dt><dd className="mt-1 text-xl font-black text-white">{knownStockOffers}<span className="text-xs font-semibold text-white/45">/{offers.length}</span></dd></div></dl></div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/[0.08] bg-[#11141c] p-4 sm:p-5" aria-labelledby="offer-list-title">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#73bfff]">Escolha a oferta</p><h2 id="offer-list-title" className="mt-1 text-xl font-black text-white">Comparar vendedores</h2></div><div className="flex min-w-0 flex-1 flex-col gap-3 xl:max-w-3xl xl:flex-row xl:justify-end"><label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-white/[0.09] bg-black/[0.15] px-3 text-white/50 focus-within:border-[#168cff]/60"><Search className="h-4 w-4 shrink-0" /><span className="sr-only">Buscar por vendedor ou ID público</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar vendedor ou ID público" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca" className="rounded p-1 text-white/45 hover:text-white"><X className="h-4 w-4" /></button>}</label><div className="flex gap-2 overflow-x-auto scrollbar-hide">{SORT_OPTIONS.map((option) => <button key={option.id} type="button" onClick={() => setSort(option.id)} aria-pressed={sort === option.id} className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl border px-3 text-xs font-bold transition ${sort === option.id ? "border-[#168cff]/60 bg-[#168cff]/15 text-[#a4d8ff]" : "border-white/[0.09] bg-white/[0.035] text-white/55 hover:text-white"}`}>{sort === option.id && <CheckCircle className="h-3.5 w-3.5" />}{option.label}</button>)}</div></div></div>

          {isLoading ? <div className="mt-5 space-y-3" aria-busy="true">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-white/[0.045]" />)}</div> : offers.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-white/[0.12] bg-black/[0.12] px-5 py-12 text-center"><Coins className="mx-auto h-7 w-7 text-[#67b8ff]" /><h3 className="mt-3 text-base font-black text-white">Nenhuma oferta corresponde à busca.</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">Somente anúncios aprovados com perfil público válido aparecem neste mercado.</p><button type="button" onClick={() => { setSearch(""); void refreshProducts(); }} className="mt-5 rounded-xl border border-[#168cff]/35 bg-[#168cff]/10 px-4 py-2.5 text-sm font-bold text-[#a5d9ff] transition hover:bg-[#168cff]/20">Atualizar ofertas</button></div> : <div className="mt-5 grid gap-3">{offers.map((offer) => <article key={offer.productId} className="group rounded-2xl border border-white/[0.08] bg-[#151923] p-4 transition hover:border-[#168cff]/40 hover:bg-[#18202c] sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/[0.1] bg-[#0d1119] text-sm font-black text-[#9bd5ff]">{offer.avatar ? <img src={offer.avatar} alt="" className="h-full w-full object-cover" /> : offer.sellerName.slice(0, 1).toLocaleUpperCase("pt-BR")}</div><div className="min-w-0"><p className="flex items-center gap-1 truncate text-sm font-black text-white">{offer.sellerName}{offer.verified && <BadgeCheck className="h-4 w-4 shrink-0 text-[#5fb8ff]" aria-label="Vendedor verificado" />}</p><p className="mt-1 text-[11px] text-white/45">ID público: {offer.sellerPublicId}</p></div></div><div className="grid grid-cols-3 gap-3 border-y border-white/[0.07] py-3 text-xs lg:w-[390px] lg:border-y-0 lg:border-l lg:py-0 lg:pl-5"><div><p className="text-white/40">Valor/un.</p><p className="mt-1 font-black text-white">{formatRobuxUnitPrice(offer.pricePerUnit)}</p></div><div><p className="text-white/40">Mínimo</p><p className="mt-1 font-bold text-white">{offer.minQty.toLocaleString("pt-BR")}</p></div><div><p className="text-white/40">Prazo</p><p className="mt-1 truncate font-bold text-white">{offer.delivery}</p></div></div><div className="flex items-center justify-between gap-4 lg:w-[190px] lg:flex-col lg:items-end"><div className="text-right"><p className="text-[11px] text-white/45">Estoque: <span className="font-semibold text-white">{formatStockLabel(offer.stock)}</span></p><p className="mt-1 text-[11px] text-white/45">{offer.reviewCount > 0 ? `${offer.positivePct}% positivas em ${offer.reviewCount} avaliação(ões)` : "Sem avaliações registradas"}</p></div><button type="button" onClick={() => navigate(`/produto/${offer.productId}`)} className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#168cff] px-4 text-xs font-black text-white shadow-[0_8px_22px_rgba(0,132,255,0.22)] transition hover:bg-[#0875e6] active:scale-[0.97]">Ver oferta<ChevronRight className="ml-1 h-3.5 w-3.5" /></button></div></div><p className="mt-3 border-t border-white/[0.07] pt-3 text-[11px] text-white/40">Pacote anunciado: {formatRobuxPackage({ price: offer.packagePrice, category: ROBUX_CATEGORY, variations: [{ name: `${offer.packageUnits} Robux` }] })}</p></article>)}</div>}
        </section>
      </main>
    </AppShell>
  );
}
