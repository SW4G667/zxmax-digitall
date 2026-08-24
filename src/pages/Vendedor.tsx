import React, { useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { BadgeCheck, Package, Star, ShoppingBag, ArrowLeft, CalendarDays, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";
import { formatBRL, ROBUX_CATEGORY, robuxPackageUnits, storefrontProducts } from "@/lib/catalog";

/**
 * Página pública do vendedor. Tudo aqui vem de dado real:
 * - anúncios: catálogo já filtrado pela RLS (só aprovados para terceiros);
 * - reputação: avaliações reais de compras concluídas, nunca número inventado;
 * - selo verificado: `profiles.is_verified_seller`.
 * Quando não há dado, a página diz isso em vez de preencher com número falso.
 */
export default function Vendedor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { state, catalogStatus } = useStore();
  const [tab, setTab] = useState<"anuncios" | "avaliacoes">("anuncios");

  const sellerId = id ?? "";
  const directory = state.userDirectory?.[sellerId];

  const products = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id).filter((p) => p.sellerId === sellerId),
    [state.products, state.currentUser?.id, sellerId],
  );

  const reviews = useMemo(
    () => state.purchases.filter((p) => p.sellerId === sellerId && p.reviewed && p.reviewStars),
    [state.purchases, sellerId],
  );

  const sellerName = directory?.name || products[0]?.seller || "Vendedor";
  const publicId = directory?.publicId || products[0]?.sellerPublicId || "—";
  const isVerified = !!directory?.isVerified;
  const avatar = directory?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(sellerName)}`;
  const totalSales = products.reduce((sum, p) => sum + (p.sales || 0), 0);
  const avgRating = reviews.length
    ? (reviews.reduce((a, r) => a + (r.reviewStars || 0), 0) / reviews.length)
    : null;

  const priceLabel = (p: (typeof products)[number]) => {
    if (p.category !== ROBUX_CATEGORY) return formatBRL(p.price);
    const units = robuxPackageUnits(p);
    return units > 1 ? `${formatBRL(p.price)} / ${units.toLocaleString("pt-BR")}` : formatBRL(p.price);
  };

  if (catalogStatus === "loading" && products.length === 0) {
    return (
      <AppShell>
        <div className="max-w-5xl mx-auto space-y-4" aria-busy="true">
          <div className="h-40 rounded-2xl bg-white/5 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 rounded-xl bg-white/5 animate-pulse" />)}
          </div>
          <span className="sr-only">Carregando perfil do vendedor…</span>
        </div>
      </AppShell>
    );
  }

  if (!directory && products.length === 0) {
    return (
      <AppShell>
        <div className="text-center py-20">
          <p className="text-white font-bold">Vendedor não encontrado</p>
          <p className="text-white/40 text-sm mt-1">Este perfil não existe ou ainda não tem anúncios publicados.</p>
          <button onClick={() => navigate("/loja")} className="bg-[#0084ff] text-white px-6 py-3 rounded-xl font-bold text-sm mt-4">
            Voltar para a loja
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-5">
        <nav aria-label="Trilha de navegação" className="flex items-center gap-2 text-xs text-white/40">
          <Link to="/loja" className="hover:text-white flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Loja</Link>
          <span>/</span>
          <span className="text-white font-bold truncate">{sellerName}</span>
        </nav>

        <header className="bg-[#111114] border border-[#1e1e28] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <img src={avatar} alt="" className="w-20 h-20 rounded-2xl bg-[#1a1a20] border border-[#25252e] object-cover" />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-white flex items-center gap-2">
                {sellerName}
                {isVerified && <BadgeCheck className="w-5 h-5 text-[#0084ff]" aria-label="Vendedor verificado" />}
              </h1>
              <p className="text-xs text-white/40 mt-1 font-mono">ID {publicId}</p>
              {isVerified ? (
                <span className="inline-flex items-center gap-1.5 mt-2 bg-[#00c950]/10 border border-[#00c950]/20 text-[#00c950] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                  <ShieldCheck className="w-3 h-3" /> Vendedor verificado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 mt-2 bg-white/5 border border-white/10 text-white/40 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                  Conta ainda não verificada
                </span>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-[#1a1a20] border border-[#25252e] rounded-xl p-3 text-center">
              <dt className="text-[10px] uppercase font-bold text-white/30 flex items-center justify-center gap-1"><Package className="w-3 h-3" /> Anúncios</dt>
              <dd className="text-xl font-black text-white mt-1">{products.length}</dd>
            </div>
            <div className="bg-[#1a1a20] border border-[#25252e] rounded-xl p-3 text-center">
              <dt className="text-[10px] uppercase font-bold text-white/30 flex items-center justify-center gap-1"><ShoppingBag className="w-3 h-3" /> Vendas</dt>
              <dd className="text-xl font-black text-white mt-1">{totalSales}</dd>
            </div>
            <div className="bg-[#1a1a20] border border-[#25252e] rounded-xl p-3 text-center">
              <dt className="text-[10px] uppercase font-bold text-white/30 flex items-center justify-center gap-1"><Star className="w-3 h-3" /> Avaliação</dt>
              <dd className="text-xl font-black text-white mt-1">
                {avgRating !== null ? avgRating.toFixed(1) : <span className="text-sm text-white/40 font-bold">Novo</span>}
              </dd>
            </div>
          </dl>
        </header>

        <div className="flex gap-1 border-b border-[#1e1e28]" role="tablist">
          {([["anuncios", `Anúncios (${products.length})`], ["avaliacoes", `Avaliações (${reviews.length})`]] as const).map(([key, label]) => (
            <button
              key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition ${tab === key ? "border-[#0084ff] text-[#0084ff]" : "border-transparent text-white/40 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "anuncios" ? (
          products.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-14 bg-[#111114] border border-[#1e1e28] rounded-2xl">
              Este vendedor ainda não tem anúncios publicados.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {products.map((p) => (
                <button
                  key={p.id} onClick={() => navigate(`/produto/${p.id}`)}
                  className="text-left bg-[#111114] border border-[#1e1e28] rounded-xl overflow-hidden hover:border-[#2a2a36] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0084ff] transition group"
                >
                  <div className="aspect-[4/3] bg-[#1a1a20] overflow-hidden relative">
                    <img src={p.image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                    {!p.approved && <span className="absolute top-2 left-2 bg-[#ffbd2e] text-black text-[9px] px-2 py-0.5 rounded-full font-black">EM ANÁLISE</span>}
                  </div>
                  <div className="p-3">
                    <h3 className="font-bold text-white text-xs leading-tight line-clamp-2 min-h-[32px]">{p.name}</h3>
                    <p className="text-sm font-black text-white mt-1.5">{priceLabel(p)}</p>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : reviews.length === 0 ? (
          <p className="text-center text-white/40 text-sm py-14 bg-[#111114] border border-[#1e1e28] rounded-2xl">
            Nenhuma avaliação ainda. As notas aparecem aqui depois que compradores confirmam a entrega.
          </p>
        ) : (
          <ul className="space-y-2">
            {reviews.map((r) => (
              <li key={r.id} className="bg-[#111114] border border-[#1e1e28] rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5" aria-label={`${r.reviewStars} de 5 estrelas`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < (r.reviewStars || 0) ? "text-[#ffbd2e] fill-[#ffbd2e]" : "text-white/15"}`} />
                    ))}
                  </span>
                  <span className="text-[11px] text-white/30 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {r.reviewComment && <p className="text-sm text-white/80 mt-2 break-words">{r.reviewComment}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
