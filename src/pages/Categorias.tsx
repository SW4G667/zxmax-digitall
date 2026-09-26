import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";
import { ROBUX_CATEGORY, storefrontProducts } from "@/lib/catalog";

export default function Categorias() {
  const { state, catalogStatus } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const approved = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id),
    [state.products, state.currentUser?.id],
  );

  const categories = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return state.config.categories
      .map((category) => ({
        name: category,
        count: approved.filter((product) => product.category === category).length,
      }))
      .filter((category) => !normalized || category.name.toLocaleLowerCase("pt-BR").includes(normalized))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [approved, query, state.config.categories]);

  const openCategory = (category: string) => {
    if (category === ROBUX_CATEGORY) {
      navigate("/robux");
      return;
    }
    navigate(`/loja?cat=${encodeURIComponent(category)}`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Categorias</h1>
          <p className="mt-1 text-sm text-white/40">Encontre a seção certa do marketplace.</p>
        </div>

        <label className="mb-6 flex h-11 max-w-md items-center rounded-lg border border-white/[0.1] bg-[#151519] px-3 focus-within:border-[#168cff]/60">
          <Search className="h-4 w-4 text-white/30" />
          <span className="sr-only">Buscar categoria</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtre aqui..."
            className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
          />
        </label>

        <div className="rounded-lg border border-white/[0.08] bg-[#101013]">
          {categories.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-white/40">Nenhuma categoria encontrada.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category, index) => (
                <button
                  key={category.name}
                  onClick={() => openCategory(category.name)}
                  className={`flex items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] ${index < categories.length - 1 ? "border-b border-white/[0.06]" : ""} sm:border-b sm:border-r sm:border-white/[0.06]`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">{category.name}</span>
                    <span className="mt-0.5 block text-[10px] text-white/30">{category.count} {category.count === 1 ? "anúncio" : "anúncios"}</span>
                  </span>
                  <span className="text-xs text-white/25">›</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-4 text-[11px] text-white/25">
          {catalogStatus === "loading" ? "Atualizando catálogo…" : `${categories.length} categorias encontradas`}
        </p>
      </div>
    </AppShell>
  );
}
