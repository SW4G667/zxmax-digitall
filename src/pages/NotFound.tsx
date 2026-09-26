import { ArrowLeft, Compass, Home, LifeBuoy, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const safePath = location.pathname.length > 90 ? "esta rota" : location.pathname;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#070910] px-5 py-10 text-white" aria-labelledby="not-found-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_11%_15%,rgba(0,132,255,0.23),transparent_32%),radial-gradient(circle_at_88%_86%,rgba(14,86,185,0.18),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <section className="relative w-full max-w-xl rounded-[1.75rem] border border-white/10 bg-[#10121b]/95 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.52)] backdrop-blur-xl sm:p-9">
        <div className="flex items-center justify-between gap-4">
          <Link to="/loja" className="rounded-md text-2xl font-black tracking-[-0.07em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#51a9ff]">ZX<span className="text-[#168cff]">MAX</span></Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Navegação segura</span>
        </div>

        <div className="mt-10 grid grid-cols-[auto_1fr] items-end gap-4">
          <span className="text-6xl font-black tracking-[-0.09em] text-[#51a9ff] sm:text-7xl">404</span>
          <div className="pb-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#51a9ff]">Rota não encontrada</p><p className="mt-1 text-xs text-white/40">A navegação não alterou sua conta, pedidos ou pagamentos.</p></div>
        </div>

        <h1 id="not-found-title" className="mt-7 text-2xl font-black tracking-tight text-white sm:text-3xl">Esta página não está disponível.</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">O endereço <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-xs text-white/70">{safePath}</span> pode ter sido movido, removido ou digitado de forma diferente.</p>

        <nav className="mt-7 grid gap-3 sm:grid-cols-2" aria-label="Próximos destinos">
          <Link to="/loja" className="group rounded-2xl border border-[#168cff]/25 bg-[#168cff]/10 p-4 transition hover:border-[#168cff]/55 hover:bg-[#168cff]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#51a9ff]"><Home className="h-5 w-5 text-[#6eb8ff]" /><p className="mt-3 text-sm font-black text-white">Ir para a vitrine</p><p className="mt-1 text-xs leading-5 text-white/50">Veja anúncios e categorias disponíveis.</p></Link>
          <Link to="/suporte" className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#51a9ff]"><LifeBuoy className="h-5 w-5 text-white/70" /><p className="mt-3 text-sm font-black text-white">Abrir suporte</p><p className="mt-1 text-xs leading-5 text-white/50">Peça ajuda se chegou aqui por um link interno.</p></Link>
        </nav>

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
          <button onClick={() => navigate(-1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-bold text-white transition hover:bg-white/[0.09] active:scale-[0.97]"><ArrowLeft className="h-4 w-4" /> Voltar</button>
          <Link to="/categorias" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#82c3ff] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#51a9ff]"><Compass className="h-4 w-4" /> Explorar categorias</Link>
        </div>
      </section>
    </main>
  );
}
