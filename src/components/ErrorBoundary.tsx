import React from "react";
import { Home, RefreshCw, ShieldCheck } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  incidentId?: string;
}

const createIncidentId = () => {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8).toUpperCase()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  return `ZX-${suffix}`;
};

const safeRoute = () => typeof window === "undefined" ? "/" : window.location.pathname.slice(0, 180) || "/";

function reportRenderFailure(incidentId: string) {
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  if (!baseUrl.startsWith("https://") || !anonKey) return;
  void fetch(`${baseUrl}/functions/v1/security-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({
      eventType: "ui.render",
      outcome: "failure",
      context: {
        incidentId,
        route: safeRoute(),
        version: String(import.meta.env.VITE_APP_VERSION || "unknown").slice(0, 80),
      },
    }),
  }).catch(() => undefined);
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    void error;
    return { hasError: true, incidentId: createIncidentId() };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) console.error("ErrorBoundary caught:", error, info);
    const incidentId = this.state.incidentId;
    if (!incidentId) return;
    reportRenderFailure(incidentId);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, incidentId: undefined });
  };

  handleHome = () => {
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative min-h-screen overflow-hidden bg-[#070910] px-5 py-10 text-white sm:grid sm:place-items-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(0,132,255,0.22),transparent_30%),radial-gradient(circle_at_92%_90%,rgba(0,95,190,0.16),transparent_28%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

          <main className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center sm:min-h-0" aria-labelledby="error-title">
            <section className="w-full rounded-[1.75rem] border border-white/10 bg-[#10121b]/95 p-6 shadow-[0_32px_100px_rgba(0,0,0,0.52)] backdrop-blur-xl sm:p-9">
              <div className="mb-8 flex items-center justify-between">
                <div className="text-2xl font-black tracking-[-0.07em] text-white">ZX<span className="text-[#168cff]">MAX</span></div>
                <div className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" /> Ambiente protegido
                </div>
              </div>

              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#168cff]/20 bg-[#168cff]/10 text-[#51a9ff] shadow-[0_0_42px_rgba(0,132,255,0.16)]">
                <span className="text-2xl font-black">!</span>
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#51a9ff]">Falha temporária</p>
              <h1 id="error-title" className="text-2xl font-black tracking-tight text-white sm:text-3xl">Não foi possível abrir esta página.</h1>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/55">Tente novamente. Se o problema continuar, volte à vitrine e reabra o produto a partir do catálogo.</p>

              <div className="mt-7 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-xs leading-5 text-white/45">
                Nenhum dado de pagamento ou acesso foi alterado. Para sua segurança, detalhes técnicos não são exibidos nesta tela.
                {this.state.incidentId && <span className="mt-2 block font-semibold text-white/60">Código de incidente: {this.state.incidentId}</span>}
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button onClick={this.handleReset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 text-sm font-bold text-white transition duration-150 hover:bg-white/10 active:scale-[0.97]">
                  <RefreshCw className="h-4 w-4" /> Tentar novamente
                </button>
                <button onClick={this.handleHome} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#168cff] px-4 text-sm font-black text-white shadow-[0_10px_28px_rgba(0,132,255,0.25)] transition duration-150 hover:bg-[#0875e6] active:scale-[0.97]">
                  <Home className="h-4 w-4" /> Voltar à vitrine
                </button>
              </div>
              <button onClick={this.handleReload} className="mt-4 w-full text-xs font-semibold text-white/35 transition hover:text-white/70">Recarregar a aplicação</button>
            </section>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}
