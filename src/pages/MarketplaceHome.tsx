import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Bot, Boxes, CheckCircle2, ChevronRight, FileCode2,
  Gamepad2, KeyRound, Palette, Search, ShieldCheck, ShoppingBag, Sparkles,
  Store, TrendingUp, Users, Zap,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";
import { formatBRL, ROBUX_CATEGORY, storefrontProducts } from "@/lib/catalog";
import { useSiteBranding } from "@/context/SiteBrandingContext";

const categoryIcon = (category: string) => {
  const value = category.toLocaleLowerCase("pt-BR");
  if (value.includes("bot") || value.includes("discord")) return Bot;
  if (value.includes("script") || value.includes("software")) return FileCode2;
  if (value.includes("design")) return Palette;
  if (value.includes("key") || value.includes("licen")) return KeyRound;
  if (value.includes("jogo") || value.includes("conta")) return Gamepad2;
  return Boxes;
};

export default function MarketplaceHome() {
  const { state, catalogStatus } = useStore();
  const { branding } = useSiteBranding();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const approved = useMemo(
    () => storefrontProducts(state.products, state.currentUser?.id),
    [state.products, state.currentUser?.id],
  );

  const verifiedSellers = useMemo(
    () => Object.values(state.userDirectory || {}).filter((entry) => entry?.isVerified).length,
    [state.userDirectory],
  );

  const automaticCount = useMemo(
    () => approved.filter((product) => product.deliveryType === "auto").length,
    [approved],
  );

  const topCategories = useMemo(() => {
    return state.config.categories
      .map((name) => ({
        name,
        count: approved.filter((product) => product.category === name).length,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"))
      .slice(0, 8);
  }, [approved, state.config.categories]);

  const featured = useMemo(
    () => [...approved]
      .filter((product) => product.category !== ROBUX_CATEGORY)
      .sort((a, b) => (b.sales * 2 + b.rating) - (a.sales * 2 + a.rating) || b.id - a.id)
      .slice(0, 6),
    [approved],
  );

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/loja?q=${encodeURIComponent(trimmed)}` : "/loja");
  };

  return (
    <AppShell>
      <div className="space-y-8 sm:space-y-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0d1118] px-5 py-7 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_8%,rgba(31,139,255,.25),transparent_34%),radial-gradient(circle_at_12%_90%,rgba(0,207,255,.09),transparent_28%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_390px] lg:items-center">
            <div>
              <div className="mb-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-[#4aa8ff]/25 bg-[#168cff]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#9bd4ff]">
                  <ShieldCheck className="h-3.5 w-3.5" /> Marketplace protegido
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-bold text-white/55">
                  <Zap className="h-3.5 w-3.5 text-[#66d8ff]" /> Entrega automática disponível
                </span>
              </div>

              <h1 className="max-w-3xl text-3xl font-black tracking-[-0.055em] text-white sm:text-5xl lg:text-[3.7rem] lg:leading-[1.02]">
                {branding.heroTitle || "Compre e venda produtos digitais com segurança"}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
                {branding.heroSubtitle || "Encontre ofertas digitais, compare vendedores e finalize tudo dentro de um fluxo claro e protegido."}
              </p>

              <form onSubmit={submitSearch} className="mt-6 flex max-w-2xl items-center gap-2 rounded-2xl border border-white/[0.12] bg-white p-2 shadow-[0_18px_60px_rgba(0,0,0,.28)]">
                <Search className="ml-2 h-5 w-5 shrink-0 text-black/35" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar Robux, bots, contas, scripts, serviços..."
                  className="min-w-0 flex-1 bg-transparent px-1 text-sm font-medium text-black outline-none placeholder:text-black/35"
                  aria-label="Buscar no marketplace"
                />
                <button type="submit" className="shrink-0 rounded-xl bg-[#0c86f8] px-4 py-3 text-xs font-black text-white transition hover:bg-[#0575db] sm:px-5">
                  Buscar
                </button>
              </form>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-white/45">
                <Link to="/como-funciona" className="inline-flex items-center gap-1.5 hover:text-white"><CheckCircle2 className="h-3.5 w-3.5 text-[#35d07f]" /> Entenda o fluxo</Link>
                <Link to="/seguranca" className="inline-flex items-center gap-1.5 hover:text-white"><ShieldCheck className="h-3.5 w-3.5 text-[#70bfff]" /> Segurança da plataforma</Link>
                <Link to="/vender" className="inline-flex items-center gap-1.5 hover:text-white"><Store className="h-3.5 w-3.5 text-[#c49dff]" /> Começar a vender</Link>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/[0.09] bg-black/[0.18] p-4 backdrop-blur-sm sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#72bfff]">Acesso rápido</p>
                  <h2 className="mt-1 text-lg font-black text-white">Explore o marketplace</h2>
                </div>
                <Sparkles className="h-5 w-5 text-[#73bdff]" />
              </div>
              <div className="grid gap-2">
                <button onClick={() => navigate("/robux")} className="group flex items-center justify-between rounded-2xl border border-[#ffbf3f]/20 bg-[#ffbf3f]/[0.07] p-4 text-left transition hover:border-[#ffbf3f]/45 hover:bg-[#ffbf3f]/[0.11]">
                  <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffbf3f]/15 text-[#ffd36e]"><Sparkles className="h-5 w-5" /></span><div><p className="text-sm font-black text-white">Mercado de Robux</p><p className="mt-0.5 text-xs text-white/45">Compare ofertas por vendedor</p></div></div>
                  <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-1 group-hover:text-white" />
                </button>
                <button onClick={() => navigate("/categorias")} className="group flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-[#168cff]/35 hover:bg-[#168cff]/[0.07]">
                  <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#168cff]/12 text-[#78c2ff]"><Boxes className="h-5 w-5" /></span><div><p className="text-sm font-black text-white">Todas as categorias</p><p className="mt-0.5 text-xs text-white/45">Navegue por tipo de produto</p></div></div>
                  <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-1 group-hover:text-white" />
                </button>
                <button onClick={() => navigate("/loja?sort=vendidos")} className="group flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition hover:border-[#168cff]/35 hover:bg-[#168cff]/[0.07]">
                  <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#22c55e]/10 text-[#65df91]"><TrendingUp className="h-5 w-5" /></span><div><p className="text-sm font-black text-white">Mais vendidos</p><p className="mt-0.5 text-xs text-white/45">Veja anúncios com mais vendas</p></div></div>
                  <ChevronRight className="h-4 w-4 text-white/30 transition group-hover:translate-x-1 group-hover:text-white" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Anúncios disponíveis", value: catalogStatus === "loading" ? "…" : approved.length.toLocaleString("pt-BR"), icon: ShoppingBag },
            { label: "Categorias", value: state.config.categories.length.toLocaleString("pt-BR"), icon: Boxes },
            { label: "Vendedores verificados", value: verifiedSellers.toLocaleString("pt-BR"), icon: BadgeCheck },
            { label: "Entrega automática", value: automaticCount.toLocaleString("pt-BR"), icon: Zap },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/[0.075] bg-[#101319] p-4 sm:p-5">
              <div className="flex items-center gap-2 text-white/40"><item.icon className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.13em]">{item.label}</span></div>
              <p className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">{item.value}</p>
            </div>
          ))}
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6ebaff]">Descubra</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Categorias do marketplace</h2>
              <p className="mt-1 text-sm text-white/40">Entre direto no tipo de produto que você procura.</p>
            </div>
            <Link to="/categorias" className="hidden items-center gap-1.5 text-xs font-black text-[#78c2ff] hover:text-white sm:flex">Ver todas <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {topCategories.map((category) => {
              const Icon = categoryIcon(category.name);
              const isRobux = category.name === ROBUX_CATEGORY;
              return (
                <button
                  key={category.name}
                  type="button"
                  onClick={() => navigate(isRobux ? "/robux" : `/loja?cat=${encodeURIComponent(category.name)}`)}
                  className="group rounded-2xl border border-white/[0.075] bg-[#101319] p-5 text-left transition hover:-translate-y-0.5 hover:border-[#168cff]/35 hover:bg-[#121923]"
                >
                  <div className="flex items-start justify-between">
                    <span className={`grid h-11 w-11 place-items-center rounded-xl ${isRobux ? "bg-[#ffbd2e]/12 text-[#ffd36b]" : "bg-[#168cff]/10 text-[#75c1ff]"}`}><Icon className="h-5 w-5" /></span>
                    <ArrowRight className="h-4 w-4 text-white/20 transition group-hover:translate-x-1 group-hover:text-[#70bfff]" />
                  </div>
                  <h3 className="mt-4 text-sm font-black text-white">{category.name}</h3>
                  <p className="mt-1 text-xs font-semibold text-white/35">{category.count} {category.count === 1 ? "anúncio" : "anúncios"}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6ebaff]">Em destaque</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Ofertas para explorar</h2>
              <p className="mt-1 text-sm text-white/40">Seleção baseada em vendas e avaliações reais do catálogo.</p>
            </div>
            <Link to="/loja" className="hidden items-center gap-1.5 text-xs font-black text-[#78c2ff] hover:text-white sm:flex">Abrir catálogo <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>

          {featured.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.12] bg-[#101319] px-5 py-10 text-center">
              <ShoppingBag className="mx-auto h-7 w-7 text-[#5caef4]" />
              <h3 className="mt-3 text-sm font-black text-white">Os destaques aparecerão quando houver anúncios publicados.</h3>
              <p className="mt-1 text-xs text-white/40">Nenhum produto fictício é inserido para preencher a vitrine.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((product) => (
                <button key={product.id} onClick={() => navigate(`/produto/${product.id}`)} className="group overflow-hidden rounded-2xl border border-white/[0.075] bg-[#101319] text-left transition hover:-translate-y-0.5 hover:border-[#168cff]/35">
                  <div className="relative h-28 overflow-hidden border-b border-white/[0.06] bg-[linear-gradient(135deg,#111b2a,#0b1018_58%,#17253a)] p-4">
                    <div className="absolute -right-5 -top-7 h-28 w-28 rounded-full bg-[#168cff]/15 blur-2xl" />
                    <div className="relative flex h-full items-end justify-between">
                      <span className="rounded-lg border border-white/[0.09] bg-black/20 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-white/55">{product.category}</span>
                      {product.deliveryType === "auto" && <span className="inline-flex items-center gap-1 rounded-lg border border-[#38d27d]/20 bg-[#38d27d]/10 px-2 py-1 text-[9px] font-black text-[#7be7a5]"><Zap className="h-3 w-3" /> AUTO</span>}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-white">{product.name}</h3>
                    <p className="mt-2 text-[11px] font-semibold text-white/35">{product.seller || "Vendedor"} · {product.sales} vendas</p>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div><p className="text-[10px] font-semibold uppercase tracking-wide text-white/30">A partir de</p><p className="mt-1 text-lg font-black text-white">{formatBRL(product.price)}</p></div>
                      <span className="inline-flex items-center gap-1 text-xs font-black text-[#71bcff]">Ver oferta <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="rounded-[1.75rem] border border-white/[0.08] bg-[#101319] p-6 sm:p-7">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#68b7fa]">Compra simples</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white">Da busca até a entrega, sem esconder etapas.</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Encontre", "Busque, filtre e compare anúncios e vendedores."],
                ["02", "Pague", "Revise o pedido e use as formas de pagamento disponíveis."],
                ["03", "Receba", "Acompanhe o pedido e confirme a entrega dentro da plataforma."],
              ].map(([n, title, text]) => (
                <div key={n} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <span className="text-xs font-black text-[#68b7fa]">{n}</span>
                  <h3 className="mt-3 text-sm font-black text-white">{title}</h3>
                  <p className="mt-1 text-xs leading-5 text-white/42">{text}</p>
                </div>
              ))}
            </div>
            <Link to="/como-funciona" className="mt-5 inline-flex items-center gap-2 text-xs font-black text-[#7ac4ff] hover:text-white">Ver como a ZXMAX funciona <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>

          <div className="rounded-[1.75rem] border border-[#168cff]/20 bg-[linear-gradient(135deg,#0f1a28,#0b1018)] p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#68b7fa]">Para vendedores</p><h2 className="mt-2 text-2xl font-black tracking-tight text-white">Transforme seus produtos digitais em uma vitrine profissional.</h2></div>
              <Users className="h-7 w-7 shrink-0 text-[#6ab8ff]" />
            </div>
            <p className="mt-3 text-sm leading-6 text-white/50">Crie anúncios, acompanhe pedidos, responda clientes e gerencie seu saldo pelo mesmo painel.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/vender" className="rounded-xl bg-[#168cff] px-4 py-3 text-xs font-black text-white hover:bg-[#0877e6]">Quero vender</Link>
              <Link to="/meus-produtos" className="rounded-xl border border-white/[0.11] bg-white/[0.035] px-4 py-3 text-xs font-black text-white/75 hover:bg-white/[0.07] hover:text-white">Meus anúncios</Link>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
