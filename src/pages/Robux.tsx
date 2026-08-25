import React, { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useStore } from "@/store/StoreContext";
import { formatBRL, formatRobuxPackage, formatStockLabel, productMinQuantity, productStock, ROBUX_CATEGORY, robuxPackageUnits, unitPriceFromPackage } from "@/lib/catalog";
import AppShell from "@/components/AppShell";
import { ShieldCheck, Zap, BadgeCheck, Star, ThumbsUp, Search, X, Bitcoin, CreditCard } from "lucide-react";

type SortKey = "recomendado" | "barato" | "min";

interface RobuxOffer {
  id: number;
  productId: number;
  sellerName: string;
  sellerId: string;
  verified: boolean;
  packagePrice: number;
  packageUnits: number;
  pricePerUnit: number;
  stock: number | null;
  minQty: number;
  delivery: string;
  rating: number | null;
  reviewCount: number;
  positivePct: number | null;
  image: string;
}

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "barato", label: "Mais barato" },
  { id: "recomendado", label: "Recomendado" },
  { id: "min", label: "Menor qtd. mín." },
];

export default function RobuxPage() {
  const { state, catalogStatus, refreshProducts } = useStore();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortKey>("barato");
  const [search, setSearch] = useState("");

  const offers = useMemo<RobuxOffer[]>(() => {
    const robux = state.products.filter((p) => p.category === ROBUX_CATEGORY && p.approved);
    const list: RobuxOffer[] = robux.map((p) => {
      const units = robuxPackageUnits(p);
      const positivePct =
        p.reviewCount && p.reviewCount > 0 ? Math.round((p.reviewPositive ?? 0) / p.reviewCount * 100) : null;
      return {
        id: p.id,
        productId: p.id,
        sellerName: p.seller,
        sellerId: p.sellerId,
        verified: !!state.userDirectory?.[p.sellerId]?.isVerified,
        packagePrice: p.price,
        packageUnits: units,
        pricePerUnit: unitPriceFromPackage(p),
        stock: productStock(p),
        minQty: productMinQuantity(p) ?? units,
        delivery: p.deliveryTime || "Combinado com o vendedor",
        rating: p.reviewCount && p.reviewCount > 0 ? Number((p.reviewAvg ?? 0).toFixed(1)) : null,
        reviewCount: p.reviewCount ?? 0,
        positivePct,
        image: p.image,
      };
    });
    const q = search.trim().toLowerCase();
    const filtered = q ? list.filter((o) => o.sellerName.toLowerCase().includes(q)) : list;
    if (sort === "barato") filtered.sort((a, b) => a.pricePerUnit - b.pricePerUnit);
    else if (sort === "min") filtered.sort((a, b) => a.minQty - b.minQty);
    else filtered.sort((a, b) => (b.reviewCount + (b.positivePct ?? 0)) - (a.reviewCount + (a.positivePct ?? 0)));
    return filtered;
  }, [state.products, state.userDirectory, sort, search]);

  const isLoading = catalogStatus === "loading" && state.products.length === 0;

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav aria-label="Navegação" className="flex items-center gap-2 text-xs text-white/40 mb-4">
          <Link to="/loja" className="hover:text-white">Loja</Link>
          <span>/</span>
          <span className="text-white font-bold">Robux</span>
        </nav>

        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-2xl border border-[#25252e] bg-[#111114] p-6 md:p-8 mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0084ff]/10 via-transparent to-[#ffbd2e]/5" aria-hidden />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="bg-[#ffbd2e] text-black text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-full">Roblox</span>
              <span className="bg-[#00c950]/10 border border-[#00c950]/20 px-3 py-1 rounded-full text-[10px] font-bold text-[#00c950] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Compra Protegida
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-white/40 bg-[#1a1a20] border border-[#25252e] px-3 py-1 rounded-full">
                <Bitcoin className="w-3 h-3 text-[#ffbd2e]" /> Crypto
                <CreditCard className="w-3 h-3 text-[#0084ff]" /> PIX
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white mb-2 leading-tight">
              Robux a partir de <span className="text-[#0084ff]">preços de atacado</span>
            </h1>
            <p className="text-white/40 text-sm mb-4">Compare vendedores, estoque e prazo — escolha a oferta ideal para você.</p>
            <div className="flex items-center bg-white rounded-xl px-4 py-2.5 max-w-md">
              <Search className="w-4 h-4 text-black/30" aria-hidden />
              <label htmlFor="robux-search" className="sr-only">Buscar vendedor</label>
              <input
                id="robux-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por vendedor"
                className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-black placeholder:text-black/40"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Limpar busca" className="text-black/40 hover:text-black">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Sorting */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-sm font-black text-white uppercase tracking-wide">
            Ofertas de Robux ({offers.length})
          </h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSort(opt.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold border transition ${
                  sort === opt.id
                    ? "bg-[#ffbd2e]/10 border-[#ffbd2e] text-[#ffbd2e]"
                    : "bg-[#1a1a20] border-[#25252e] text-white/50 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <div className="text-center py-16 bg-[#111114] border border-[#1e1e28] rounded-2xl">
            <p className="text-white font-bold text-sm">Nenhuma oferta de Robux no momento</p>
            <p className="text-xs text-white/40 mt-1">Volte em breve — novos vendedores entram o tempo todo.</p>
            <button
              onClick={() => void refreshProducts()}
              className="mt-4 bg-[#0084ff] hover:bg-[#0066cc] text-white px-5 py-2.5 rounded-xl text-sm font-bold"
            >
              Atualizar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {offers.map((offer, idx) => (
              <article
                key={offer.id}
                onClick={() => navigate(`/produto/${offer.productId}`)}
                className={`bg-[#15151a] border border-[#25252e] rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition hover:border-[#2a2a36] ${
                  idx === 0 ? "border-l-4 border-l-[#ffbd2e]" : ""
                }`}
              >
                <img src={offer.image} alt="" className="w-16 h-16 rounded-xl bg-[#1a1a20] object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-white text-sm truncate">{offer.sellerName}</p>
                    {offer.verified && <BadgeCheck className="w-3.5 h-3.5 text-[#0084ff] shrink-0" aria-label="Vendedor verificado" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px]">
                    {offer.reviewCount > 0 ? (
                      <span className="flex items-center gap-1 text-[#00c950] font-bold">
                        <ThumbsUp className="w-3 h-3" /> {offer.positivePct ?? 0}% positivas
                      </span>
                    ) : (
                      <span className="text-white/40">Novo • 0 avaliações</span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-[11px] text-white/50">
                    <span>Estoque: <b className="text-white">{offer.stock != null ? offer.stock.toLocaleString("pt-BR") : "—"}</b></span>
                    <span>Qtd. mín.: <b className="text-white">{offer.minQty.toLocaleString("pt-BR")}</b></span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-white/40">por un.</p>
                  <p className="font-black text-white">{formatBRL(offer.pricePerUnit)}</p>
                  <p className="text-[10px] text-white/40">{formatRobuxPackage({ price: offer.packagePrice, category: ROBUX_CATEGORY, variations: [{ name: `${offer.packageUnits} Robux`, price: offer.packagePrice }] })}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/produto/${offer.productId}`); }}
                    className="mt-2 bg-[#2B7FFF] hover:bg-[#1a6eef] text-white text-[11px] font-black px-3 py-1.5 rounded-lg"
                  >
                    Ver oferta
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-white/30 flex-wrap">
          <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-[#00c950]" /> Garantia</span>
          <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-[#ffbd2e]" /> Rápido</span>
          <span className="flex items-center gap-1"><Star className="w-3 h-3 text-[#0084ff]" /> Avaliações reais</span>
        </div>
      </div>
    </AppShell>
  );
}
