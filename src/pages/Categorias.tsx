import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, ArrowRight, PackageOpen } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";
import { formatBRL, storefrontProducts } from "@/lib/catalog";

/**
 * Índice de categorias. A contagem e o "a partir de" saem do catálogo real —
 * categoria sem anúncio aparece como vazia em vez de prometer conteúdo que
 * não existe.
 */
export default function Categorias() {
  const { state, catalogStatus } = useStore();
  const navigate = useNavigate();

  const products = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id),
    [state.products, state.currentUser?.id],
  );

  const categories = useMemo(() => {
    return state.config.categories.map((name) => {
      const items = products.filter((p) => p.category === name);
      const cheapest = items.reduce<number | null>(
        (min, p) => (min === null || Number(p.price) < min ? Number(p.price) : min),
        null,
      );
      return { name, count: items.length, cheapest, cover: items[0]?.image };
    });
  }, [state.config.categories, products]);

  const withItems = categories.filter((c) => c.count > 0);
  const empty = categories.filter((c) => c.count === 0);
  const loading = catalogStatus === "loading" && products.length === 0;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-5">
        <nav aria-label="Trilha de navegação" className="flex items-center gap-2 text-xs text-white/40">
          <Link to="/loja" className="hover:text-white">Loja</Link>
          <span>/</span>
          <span className="text-white font-bold">Categorias</span>
        </nav>

        <header>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-[#0084ff]" aria-hidden /> Categorias
          </h1>
          <p className="text-white/40 text-sm mt-1">Escolha um tipo de produto para ver todos os anúncios disponíveis.</p>
        </header>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />)}
            <span className="sr-only">Carregando categorias…</span>
          </div>
        ) : (
          <>
            {withItems.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {withItems.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => navigate(`/loja?cat=${encodeURIComponent(cat.name)}`)}
                    className="text-left bg-[#111114] border border-[#1e1e28] rounded-2xl overflow-hidden hover:border-[#0084ff]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0084ff] transition group"
                  >
                    <div className="h-24 bg-[#1a1a20] overflow-hidden relative">
                      {cat.cover
                        ? <img src={cat.cover} alt="" loading="lazy" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition duration-300" />
                        : <div className="w-full h-full flex items-center justify-center"><LayoutGrid className="w-6 h-6 text-white/10" /></div>}
                    </div>
                    <div className="p-4">
                      <h2 className="font-bold text-white text-sm flex items-center justify-between gap-2">
                        <span className="truncate">{cat.name}</span>
                        <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-[#0084ff] transition shrink-0" aria-hidden />
                      </h2>
                      <p className="text-[11px] text-white/40 mt-1">
                        {cat.count} {cat.count === 1 ? "anúncio" : "anúncios"}
                        {cat.cheapest !== null && <> · a partir de <span className="text-white/70 font-bold">{formatBRL(cat.cheapest)}</span></>}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {withItems.length === 0 && (
              <div className="text-center py-16 bg-[#111114] border border-[#1e1e28] rounded-2xl">
                <PackageOpen className="w-8 h-8 mx-auto text-white/20 mb-3" aria-hidden />
                <p className="text-white font-bold text-sm">Ainda não há anúncios publicados</p>
                <p className="text-xs text-white/40 mt-1">Assim que a moderação aprovar os primeiros, as categorias aparecem aqui.</p>
              </div>
            )}

            {empty.length > 0 && withItems.length > 0 && (
              <section>
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 mb-3">Ainda sem anúncios</h2>
                <div className="flex flex-wrap gap-2">
                  {empty.map((cat) => (
                    <span key={cat.name} className="px-3 py-1.5 rounded-full bg-[#1a1a20] border border-[#25252e] text-white/30 text-xs font-bold">
                      {cat.name}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
