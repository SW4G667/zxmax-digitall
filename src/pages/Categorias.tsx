import React, { useMemo, useState } from "react";
import { Bot, Boxes, Gamepad2, Package, Search, Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";
import { ROBUX_CATEGORY, storefrontProducts } from "@/lib/catalog";
import { useSiteBranding } from "@/context/SiteBrandingContext";

const iconFor = (category: string) => {
  if (category === "Bots Discord") return Bot;
  if (category === "Scripts") return Boxes;
  if (category === "Jogos e Itens") return Gamepad2;
  return Package;
};

export default function Categorias() {
  const { state, catalogStatus } = useStore();
  const { branding } = useSiteBranding();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const approved = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id),
    [state.products, state.currentUser?.id],
  );

  const categories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return state.config.categories
      .map((category) => {
        const products = approved.filter((product) => product.category === category);
        return {
          name: category,
          count: products.length,
          image: products.find((product) => Boolean(product.image))?.image || "",
        };
      })
      .filter((category) => !normalized || category.name.toLocaleLowerCase("pt-BR").includes(normalized))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  }, [approved, query, state.config.categories]);

  const openCategory = (category: string) => {
    navigate(category === ROBUX_CATEGORY ? "/robux" : "/loja?cat=" + encodeURIComponent(category));
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1120px]">
        <header className="border-b border-white/[0.07] pb-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--zx-accent)]">Explore o marketplace</p>
              <h1 className="mt-1.5 text-2xl font-extrabold tracking-[-0.04em] text-white sm:text-3xl">Categorias</h1>
              <p className="mt-1.5 text-xs text-white/38">Escolha uma área para ver somente anúncios públicos aprovados.</p>
            </div>
            <label className="flex h-10 w-full max-w-sm items-center rounded-xl border border-white/[0.09] bg-[#111114] px-3 focus-within:border-[var(--zx-accent)] sm:w-auto sm:min-w-[290px]">
              <Search className="h-4 w-4 text-white/28" />
              <span className="sr-only">Buscar categoria</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar categoria"
                className="ml-2 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/25"
              />
            </label>
          </div>
        </header>

        {categories.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-white/[0.1] bg-[#101013] px-5 py-12 text-center">
            <Search className="mx-auto h-6 w-6 text-white/18" />
            <p className="mt-3 text-sm font-bold text-white">Nenhuma categoria encontrada</p>
            <p className="mt-1 text-[11px] text-white/34">Tente outro termo.</p>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((category) => {
              const Icon = category.name === ROBUX_CATEGORY ? Zap : iconFor(category.name);
              const image = category.name === ROBUX_CATEGORY && branding.robuxBannerUrl
                ? branding.robuxBannerUrl
                : category.image;
              return (
                <button
                  key={category.name}
                  type="button"
                  onClick={() => openCategory(category.name)}
                  className="group overflow-hidden rounded-xl border border-white/[0.075] bg-[#101013] text-left transition hover:-translate-y-0.5 hover:border-white/[0.16]"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#17171c]">
                    {image ? (
                      <img src={image} alt="" className="h-full w-full object-cover opacity-80 transition duration-300 group-hover:scale-[1.035]" />
                    ) : (
                      <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_60%_0%,rgba(22,140,255,.15),transparent_62%)]">
                        <Icon className="h-8 w-8 text-white/22" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
                    {category.name === ROBUX_CATEGORY ? (
                      <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[var(--zx-accent)] px-2 py-1 text-[7px] font-black uppercase tracking-wide text-white">
                        <Sparkles className="h-2.5 w-2.5" /> Mercado próprio
                      </span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <h2 className="truncate text-xs font-bold text-white">{category.name === ROBUX_CATEGORY ? "Robux" : category.name}</h2>
                    <p className="mt-1 text-[9px] text-white/30">{category.count} {category.count === 1 ? "anúncio disponível" : "anúncios disponíveis"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <p className="mt-4 text-[10px] text-white/24">
          {catalogStatus === "loading" ? "Atualizando catálogo…" : categories.length + " categorias exibidas"}
        </p>
      </div>
    </AppShell>
  );
}
