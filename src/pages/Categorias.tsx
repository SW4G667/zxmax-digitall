import { ArrowRight, Boxes, CheckCircle2, Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/StoreContext";
import { ROBUX_CATEGORY, storefrontProducts } from "@/lib/catalog";

const categoryDescriptions: Record<string, string> = {
  "Bots Discord": "Automação, atendimento e comunidades.",
  Contas: "Acessos digitais com descrição clara.",
  Scripts: "Ferramentas para projetos e automações.",
  Assinaturas: "Acessos e benefícios digitais.",
  Designs: "Artes, identidades e recursos criativos.",
  "Designs Digitais": "Artes, identidades e recursos criativos.",
  "Serviços Online": "Serviços digitais sob demanda.",
  "Consultoria Virtual": "Orientação para projetos digitais.",
  "Keys de Software": "Licenças e chaves de software.",
  Arquivos: "Templates, materiais e downloads.",
  "Jogos e Itens": "Itens digitais e experiências de jogo.",
};

export default function Categorias() {
  const { state, catalogStatus } = useStore();
  const navigate = useNavigate();
  const approved = storefrontProducts(state.products, state.currentUser?.id);
  const categories = state.config.categories;

  const openCategory = (category: string) => {
    if (category === ROBUX_CATEGORY) {
      navigate("/robux");
      return;
    }
    navigate(`/loja?cat=${encodeURIComponent(category)}`);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <section className="relative overflow-hidden rounded-3xl border border-[#1e1e28] bg-[#111114] p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-primary">
            <Boxes className="h-3.5 w-3.5" /> Descobrir categorias
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Encontre seu próximo produto digital.</h1>
          <p className="mt-3 text-sm leading-6 text-white/50 sm:text-base">Navegue por categorias reais da ZXMAX e filtre ofertas sem perder o contexto da loja.</p>
          <button
            type="button"
            onClick={() => navigate("/loja")}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#111114]"
          >
            <Search className="h-4 w-4" /> Buscar na loja
          </button>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="categories-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="categories-title" className="text-xl font-black text-white">Categorias disponíveis</h2>
            <p className="mt-1 text-sm text-white/40">Escolha um tema para abrir a vitrine já filtrada.</p>
          </div>
          <span className="text-xs font-bold text-white/35">{categories.length} categorias</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const count = approved.filter((product) => product.category === category).length;
            const isRobux = category === ROBUX_CATEGORY;
            return (
              <button
                key={category}
                type="button"
                onClick={() => openCategory(category)}
                className="group rounded-2xl border border-[#1e1e28] bg-[#111114] p-5 text-left transition hover:-translate-y-0.5 hover:border-primary/45 hover:bg-[#15151b] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className={`rounded-xl p-2.5 ${isRobux ? "bg-[#ffbd2e]/15 text-[#ffbd2e]" : "bg-primary/10 text-primary"}`}>
                    {isRobux ? <Sparkles className="h-5 w-5" /> : <Boxes className="h-5 w-5" />}
                  </span>
                  <ArrowRight className="h-5 w-5 text-white/25 transition group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <h3 className="mt-5 text-base font-black text-white">{category}</h3>
                <p className="mt-1 min-h-10 text-sm leading-5 text-white/45">{categoryDescriptions[category] ?? "Produtos digitais publicados pela comunidade."}</p>
                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-white/50">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00c950]" />
                  {catalogStatus === "loading" ? "Atualizando catálogo" : `${count} ${count === 1 ? "anúncio publicado" : "anúncios publicados"}`}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
