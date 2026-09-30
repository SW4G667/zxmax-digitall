import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  BarChart3, CheckCircle, Clock, Copy, Download, MessageSquare, Package,
  Plus, Receipt, RefreshCw, ShieldCheck, ShoppingBag, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/store/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/catalog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type DashboardData = {
  balance: number;
  salesCount: number;
  salesValue: number;
  pendingOrders: number;
  messageCount: number;
  questionCount: number;
  activeListings: number;
  documentVerified: boolean;
  recentSales: Array<{ id: number; amount: number; status: string; createdAt: string; buyerPublicId: string }>;
  ledger: Array<{ id: number; amount: number; kind: string; description: string; createdAt: string; availableAt: string }>;
  withdrawals: Array<{ id: number; amount: number; fee: number; netAmount: number; status: string; createdAt: string }>;
  charges: Array<{ id: number; amount: number; providerAmount?: number; providerNetAmount?: number; description: string; status: string; qrCode?: string; createdAt: string; expiresAt?: string }>;
};

const emptyData: DashboardData = {
  balance: 0, salesCount: 0, salesValue: 0, pendingOrders: 0, messageCount: 0,
  questionCount: 0, activeListings: 0, documentVerified: false,
  recentSales: [], ledger: [], withdrawals: [], charges: [],
};

const statusLabel: Record<string, string> = {
  pending: "Pendente", paid: "Pago", creating: "Criando", expired: "Expirada",
  failed: "Falhou", approved: "Concluído", rejected: "Recusado",
};

export default function AppDashboard() {
  const { user, loading } = useAuth();
  const { state } = useStore();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [busy, setBusy] = useState(true);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeBusy, setChargeBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data: payload, error } = await (supabase as any).rpc("get_my_app_dashboard");
    setBusy(false);
    if (error || !payload) {
      toast.error("Não foi possível atualizar o painel agora.");
      return;
    }
    setData({
      ...emptyData,
      ...payload,
      balance: Number(payload.balance || 0),
      salesCount: Number(payload.salesCount || 0),
      salesValue: Number(payload.salesValue || 0),
      pendingOrders: Number(payload.pendingOrders || 0),
      messageCount: Number(payload.messageCount || 0),
      questionCount: Number(payload.questionCount || 0),
      activeListings: Number(payload.activeListings || 0),
      documentVerified: payload.documentVerified === true,
      recentSales: Array.isArray(payload.recentSales) ? payload.recentSales : [],
      ledger: Array.isArray(payload.ledger) ? payload.ledger : [],
      withdrawals: Array.isArray(payload.withdrawals) ? payload.withdrawals : [],
      charges: Array.isArray(payload.charges) ? payload.charges : [],
    });
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const displayStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches;
    const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(Boolean(displayStandalone || iosStandalone));

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const appInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      toast.success("ZXMAX instalado.");
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const install = async () => {
    if (installed) return toast.info("O aplicativo ZXMAX já está instalado neste dispositivo.");
    if (!installPrompt) {
      toast.info("No navegador, abra o menu e escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  const createCharge = async () => {
    const amount = Number(String(chargeAmount).replace(",", "."));
    const description = chargeDescription.trim();
    if (!data.documentVerified) {
      toast.error("Aprovação de documentos é obrigatória para criar cobranças.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 2 || amount > 5000) {
      toast.error("Use um valor entre R$ 2,00 e R$ 5.000,00.");
      return;
    }
    if (description.length < 4 || description.length > 120) {
      toast.error("Descreva a cobrança em 4 a 120 caracteres.");
      return;
    }
    setChargeBusy(true);
    const { data: result, error } = await supabase.functions.invoke("merchant-charge", {
      body: { action: "create", amount, description },
    });
    setChargeBusy(false);
    if (error || result?.error || !result?.charge) {
      toast.error(result?.error || "Não foi possível criar a cobrança.");
      return;
    }
    setChargeAmount("");
    setChargeDescription("");
    setChargeOpen(false);
    await load();
    if (result.charge.qrCode) {
      await navigator.clipboard?.writeText(String(result.charge.qrCode)).catch(() => undefined);
      toast.success("Cobrança criada. PIX copia e cola copiado.");
    } else {
      toast.success("Cobrança criada.");
    }
  };

  const checkCharge = async (id: number) => {
    const tid = toast.loading("Consultando pagamento...");
    const { data: result, error } = await supabase.functions.invoke("merchant-charge", {
      body: { action: "check", chargeId: id },
    });
    if (error || result?.error) {
      toast.error(result?.error || "Não foi possível consultar a cobrança.", { id: tid });
      return;
    }
    toast.success(result?.paid ? "Pagamento confirmado e creditado." : "Pagamento ainda pendente.", { id: tid });
    await load();
  };

  const copy = async (value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success("PIX copia e cola copiado.");
  };

  const latestCharge = useMemo(() => data.charges.find((charge) => charge.status === "pending"), [data.charges]);

  if (loading) {
    return <div className="min-h-screen bg-[#08090d]" />;
  }
  if (!user) return <Navigate to="/loja?login=1" replace />;

  return (
    <AppShell hideFooter>
      <main className="mx-auto max-w-[1120px] pb-10">
        <section className="overflow-hidden rounded-[1.7rem] border border-white/[0.08] bg-[#101116] p-5 shadow-2xl sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--zx-accent)]">ZXMAX App</p>
              <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white sm:text-3xl">Seu negócio em um painel.</h1>
              <p className="mt-2 max-w-xl text-xs leading-5 text-white/42">Vendas, saldo, mensagens, perguntas, cobranças e saques com dados reais da sua conta.</p>
            </div>
            <button
              type="button"
              onClick={() => void install()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 text-xs font-bold text-white transition hover:bg-white/[0.08]"
            >
              {installed ? <CheckCircle className="h-4 w-4 text-emerald-300" /> : <Download className="h-4 w-4 text-[var(--zx-accent)]" />}
              {installed ? "Aplicativo instalado" : "Instalar aplicativo"}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-black/20 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/32">Saldo disponível</p>
                <p className="mt-1 text-3xl font-black text-white">{formatBRL(data.balance)}</p>
                <p className="mt-1 text-[10px] text-white/30">Valores liberados e créditos da carteira, descontando saques reservados.</p>
              </div>
              <Wallet className="h-6 w-6 text-white/18" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => navigate("/sacar")} className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-2 py-3 text-[10px] font-bold text-white/68 hover:bg-white/[0.07]">Sacar</button>
              <button onClick={() => setChargeOpen(true)} className="rounded-xl bg-[var(--zx-accent)] px-2 py-3 text-[10px] font-black text-white">Cobrar</button>
              <button onClick={() => document.getElementById("zx-extrato")?.scrollIntoView({ behavior: "smooth" })} className="rounded-xl border border-white/[0.08] bg-white/[0.035] px-2 py-3 text-[10px] font-bold text-white/68 hover:bg-white/[0.07]">Extrato</button>
            </div>
          </div>
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Vendas", data.salesCount, ShoppingBag],
            ["Em andamento", data.pendingOrders, Clock],
            ["Mensagens", data.messageCount, MessageSquare],
            ["Perguntas", data.questionCount, Receipt],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-white/[0.075] bg-[#101116] p-4">
              <Icon className="h-4 w-4 text-[var(--zx-accent)]" />
              <p className="mt-3 text-2xl font-black text-white">{Number(value).toLocaleString("pt-BR")}</p>
              <p className="mt-1 text-[10px] font-semibold text-white/35">{label}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-3 md:grid-cols-3">
          <button onClick={() => navigate("/meus-produtos")} className="rounded-2xl border border-white/[0.075] bg-[#101116] p-4 text-left transition hover:border-white/[0.16]">
            <Package className="h-5 w-5 text-[#7dc2ff]" />
            <p className="mt-3 text-sm font-black text-white">Meus anúncios</p>
            <p className="mt-1 text-[11px] text-white/36">{data.activeListings} ativo(s)</p>
          </button>
          <button onClick={() => navigate("/minhas-compras?scope=sales")} className="rounded-2xl border border-white/[0.075] bg-[#101116] p-4 text-left transition hover:border-white/[0.16]">
            <BarChart3 className="h-5 w-5 text-emerald-300" />
            <p className="mt-3 text-sm font-black text-white">Vendas e entregas</p>
            <p className="mt-1 text-[11px] text-white/36">{formatBRL(data.salesValue)} registrado</p>
          </button>
          <button onClick={() => void load()} disabled={busy} className="rounded-2xl border border-white/[0.075] bg-[#101116] p-4 text-left transition hover:border-white/[0.16] disabled:opacity-50">
            <RefreshCw className={`h-5 w-5 text-white/55 ${busy ? "animate-spin" : ""}`} />
            <p className="mt-3 text-sm font-black text-white">Atualizar dados</p>
            <p className="mt-1 text-[11px] text-white/36">Recarrega saldo e estatísticas</p>
          </button>
        </section>

        <section className="mt-5 rounded-2xl border border-white/[0.075] bg-[#101116]">
          <div className="flex items-center justify-between border-b border-white/[0.065] p-4">
            <div>
              <h2 className="text-sm font-black text-white">Cobranças</h2>
              <p className="mt-1 text-[10px] text-white/32">Disponível somente para conta com documentos aprovados.</p>
            </div>
            <button onClick={() => setChargeOpen(true)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--zx-accent)] px-3 py-2 text-[10px] font-black text-white"><Plus className="h-3.5 w-3.5" /> Nova</button>
          </div>
          {!data.documentVerified ? (
            <div className="p-5">
              <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.055] p-4">
                <p className="text-xs font-bold text-amber-100">Verificação de documentos necessária</p>
                <p className="mt-1 text-[11px] leading-5 text-amber-100/55">Finalize a verificação do perfil para liberar cobranças e saques.</p>
                <button onClick={() => navigate("/perfil")} className="mt-3 rounded-lg border border-amber-200/20 px-3 py-2 text-[10px] font-bold text-amber-100">Ir para verificação</button>
              </div>
            </div>
          ) : data.charges.length === 0 ? (
            <p className="p-6 text-center text-xs text-white/35">Nenhuma cobrança criada.</p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {data.charges.slice(0, 8).map((charge) => (
                <div key={charge.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-white">{charge.description}</p>
                      <p className="mt-1 text-[10px] text-white/32">#{charge.id} · {new Date(charge.createdAt).toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-white">{formatBRL(charge.amount)}</p>
                      <p className={`mt-1 text-[9px] font-bold ${charge.status === "paid" ? "text-emerald-300" : charge.status === "pending" ? "text-amber-300" : "text-white/35"}`}>{statusLabel[charge.status] || charge.status}</p>
                    </div>
                  </div>
                  {charge.status === "pending" ? (
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => void copy(charge.qrCode)} disabled={!charge.qrCode} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-[10px] font-bold text-white/60 disabled:opacity-30"><Copy className="h-3.5 w-3.5" /> Copiar PIX</button>
                      <button onClick={() => void checkCharge(charge.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--zx-accent)]/30 bg-[var(--zx-accent)]/10 px-3 py-2 text-[10px] font-bold text-[#8dcdff]"><RefreshCw className="h-3.5 w-3.5" /> Verificar</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="zx-extrato" className="mt-5 rounded-2xl border border-white/[0.075] bg-[#101116]">
          <div className="border-b border-white/[0.065] p-4">
            <h2 className="text-sm font-black text-white">Extrato da carteira</h2>
            <p className="mt-1 text-[10px] text-white/32">Créditos, vendas liberadas, reembolsos e ajustes registrados no servidor.</p>
          </div>
          {data.ledger.length === 0 ? (
            <p className="p-6 text-center text-xs text-white/35">Nenhuma movimentação na carteira.</p>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {data.ledger.slice(0, 20).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white/72">{entry.description}</p>
                    <p className="mt-1 text-[9px] text-white/28">{new Date(entry.createdAt).toLocaleString("pt-BR")} · {entry.kind}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-black ${entry.amount >= 0 ? "text-emerald-300" : "text-red-300"}`}>{entry.amount >= 0 ? "+" : ""}{formatBRL(entry.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {latestCharge?.qrCode ? (
          <section className="mt-4 rounded-xl border border-[var(--zx-accent)]/20 bg-[var(--zx-accent)]/[0.045] p-4">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#7dc2ff]">Cobrança pendente mais recente</p>
            <p className="mt-2 text-xs text-white/55">PIX #{latestCharge.id} · {formatBRL(latestCharge.amount)}</p>
          </section>
        ) : null}
      </main>

      {chargeOpen ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => setChargeOpen(false)}>
          <section className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111116] p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--zx-accent)]">Cobrança PIX</p>
                <h2 className="mt-1 text-lg font-black text-white">Criar cobrança</h2>
              </div>
              <button onClick={() => setChargeOpen(false)} className="rounded-lg p-2 text-white/40 hover:bg-white/5"><X className="h-4 w-4" /></button>
            </div>
            {!data.documentVerified ? (
              <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-xs leading-5 text-amber-100/70">
                Seus documentos precisam estar aprovados antes de criar cobranças.
              </div>
            ) : (
              <>
                <label className="mt-5 block text-[10px] font-bold uppercase text-white/35">Valor
                  <input value={chargeAmount} onChange={(event) => setChargeAmount(event.target.value)} inputMode="decimal" placeholder="50,00" className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-[#09090d] p-3 text-sm text-white outline-none focus:border-[var(--zx-accent)]" />
                </label>
                <label className="mt-3 block text-[10px] font-bold uppercase text-white/35">Descrição
                  <input value={chargeDescription} onChange={(event) => setChargeDescription(event.target.value)} maxLength={120} placeholder="Ex.: serviço de design" className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-[#09090d] p-3 text-sm text-white outline-none focus:border-[var(--zx-accent)]" />
                </label>
                <div className="mt-4 flex gap-2 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] p-3 text-[10px] leading-4 text-emerald-100/60">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  O saldo só é creditado depois da confirmação direta no gateway. Pagamentos fora da ZXMAX não são reconhecidos automaticamente.
                </div>
                <button onClick={() => void createCharge()} disabled={chargeBusy} className="mt-5 w-full rounded-xl bg-[var(--zx-accent)] py-3 text-sm font-black text-white disabled:opacity-45">{chargeBusy ? "Criando..." : "Gerar PIX"}</button>
              </>
            )}
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
