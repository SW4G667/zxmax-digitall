import React, { useMemo, useState } from "react";
import {
  ArrowRight, Bot, Boxes, FileCode2, Gamepad2, KeyRound, Palette, Search,
  ShieldCheck, Sparkles, Store, Wrench,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/StoreContext";
import { ROBUX_CATEGORY, storefrontProducts } from "@/lib/catalog";
import AppShell from "@/components/AppShell";

const descriptions: Record<string, string> = {
  "Bots Discord": "Automação, atendimento, vendas e comunidades.",
  Contas: "Contas e acessos digitais publicados por vendedores.",
  Scripts: "Ferramentas, códigos e automações para projetos.",
  Assinaturas: "Planos, acessos e benefícios digitais.",
  Designs: "Artes, identidades visuais e materiais gráficos.",
  "Designs Digitais": "Artes, identidades visuais e materiais gráficos.",
  "Serviços Online": "Serviços digitais sob demanda.",
  "Consultoria Virtual": "Apoio e orientação para projetos digitais.",
  "Keys de Software": "Licenças e chaves digitais.",
  Arquivos: "Templates, materiais e downloads digitais.",
  "Jogos e Itens": "Itens, moedas e produtos relacionados a jogos.",
};

const iconFor = (category: string) => {
  const name = category.toLocaleLowerCase("pt-BR");
  if (name.includes("robux")) return Sparkles;
  if (name.includes("bot") || name.includes("discord")) return Bot;
  if (name.includes("script") || name.includes("software")) return FileCode2;
  if (name.includes("design")) return Palette;
  if (name.includes("key") || name.includes("licen")) return KeyRound;
  if (name.includes("serviço") || name.includes("consult")) return Wrench;
  if (name.includes("jogo") || name.includes("conta")) return Gamepad2;
  return Boxes;
};

export default function Categorias() {
  const { state, catalogStatus } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const approved = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id),
    [state.products, state.currentUser?.id],
  );

  const categories = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return state.config.categories
      .map((category) => ({
        name: category,
        count: approved.filter((product) => product.category === category).length,
      }))
      .filter((category) => !q || category.name.toLocaleLowerCase("pt-BR").includes(q))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
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
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0d1118] px-5 py-7 sm:px-8 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(22,140,255,.22),transparent_34%)]" />
          <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.19em] text-[#72c0ff]">Diretório do marketplace</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">Encontre o tipo de produto que você procura.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">Navegue por categorias reais da plataforma e abra o catálogo já filtrado, sem misturar tudo em uma única vitrine.</p>
              <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-bold text-white/42">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5"><Store className="h-3.5 w-3.5 text-[#73c0ff]" /> {state.config.categories.length} categorias</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#55d58a]" /> Catálogo publicado</span>
              </div>
            </div>

            <label className="flex h-12 items-center gap-2 rounded-2xl border border-white/[0.1] bg-white px-3.5 shadow-[0_16px_45px_rgba(0,0,0,.2)]">
              <Search className="h-4 w-4 shrink-0 text-black/35" />
              <span className="sr-only">Buscar categoria</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar categoria..." className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-black outline-none placeholder:text-black/35" />
            </label>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
          <button type="button" onClick={() => navigate("/robux")} className="group relative overflow-hidden rounded-[1.75rem] border border-[#ffbd2e]/20 bg-[linear-gradient(135deg,#1b1710,#101217_70%)] p-6 text-left transition hover:border-[#ffbd2e]/40">
            <div className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-[#ffbd2e]/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-5">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#ffbd2e]/20 bg-[#ffbd2e]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#ffd36b]"><Sparkles className="h-3.5 w-3.5" /> Mercado dedicado</span>
                <h2 className="mt-4 text-2xl font-black tracking-tight text-white">Robux e Gift Cards</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/46">Compare ofertas, vendedores, mínimo, estoque e prazo em uma página própria.</p>
              </div>
              <ArrowRight className="h-5 w-5 text-white/25 transition group-hover:translate-x-1 group-hover:text-[#ffd36b]" />
            </div>
          </button>

          <div className="rounded-[1.75rem] border border-white/[0.075] bg-[#101319] p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">Navegação rápida</p>
            <h2 className="mt-2 text-lg font-black text-white">Ainda não sabe onde procurar?</h2>
            <p className="mt-2 text-sm leading-6 text-white/42">Abra o catálogo completo e use busca, ordenação, entrega automática e verificação de vendedor.</p>
            <button onClick={() => navigate("/loja")} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black text-black">Abrir marketplace <ArrowRight className="h-3.5 w-3.5" /></button>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#68b7fa]">Todas as categorias</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Explore por tema</h2>
            </div>
            <p className="text-xs font-bold text-white/30">{catalogStatus === "loading" ? "Atualizando…" : `${categories.length} resultado(s)`}</p>
          </div>

          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.12] bg-[#101319] px-5 py-10 text-center">
              <Search className="mx-auto h-6 w-6 text-[#65b5fa]" />
              <h3 className="mt-3 text-sm font-black text-white">Nenhuma categoria corresponde à busca.</h3>
              <button onClick={() => setQuery("")} className="mt-4 rounded-xl border border-white/[0.1] px-4 py-2.5 text-xs font-black text-white/60">Limpar busca</button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {categories.map((category) => {
                const Icon = iconFor(category.name);
                const isRobux = category.name === ROBUX_CATEGORY;
                return (
                  <button key={category.name} type="button" onClick={() => openCategory(category.name)} className="group rounded-2xl border border-white/[0.075] bg-[#101319] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#168cff]/35 hover:bg-[#121923]">
                    <div className="flex items-start justify-between">
                      <span className={`grid h-11 w-11 place-items-center rounded-xl ${isRobux ? "bg-[#ffbd2e]/12 text-[#ffd36b]" : "bg-[#168cff]/10 text-[#75c1ff]"}`}><Icon className="h-5 w-5" /></span>
                      <ArrowRight className="h-4 w-4 text-white/20 transition group-hover:translate-x-1 group-hover:text-[#70bfff]" />
                    </div>
                    <h3 className="mt-4 text-sm font-black text-white">{category.name}</h3>
                    <p className="mt-1 min-h-10 text-xs leading-5 text-white/38">{descriptions[category.name] ?? "Produtos e serviços digitais publicados pela comunidade."}</p>
                    <p className="mt-4 text-[10px] font-black uppercase tracking-wide text-white/28">{category.count} {category.count === 1 ? "anúncio" : "anúncios"}</p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
