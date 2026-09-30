import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine, BarChart3, CheckCircle2, Clock3, Copy, CreditCard, Download,
  FileText, Headset, Home, ListChecks, Menu, MessageSquare, Package, Plus,
  Receipt, RefreshCw, RotateCcw, ShieldCheck, ShoppingBag, TicketCheck,
  UserRound, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/store/StoreContext";
import { useSiteBranding } from "@/context/SiteBrandingContext";
import { formatBRL } from "@/lib/catalog";
import AuthScreen from "@/components/AuthScreen";
import NotificationBell from "@/components/NotificationBell";
import DiscordIcon from "@/components/DiscordIcon";
import ProfileModal from "@/components/ProfileModal";
import InventoryView from "@/components/InventoryView";
import MyPurchasesView from "@/components/MyPurchasesView";
import SupportView from "@/components/SupportView";
import BannedScreen from "@/components/BannedScreen";

type AppTab = "home" | "gateway" | "sales" | "products" | "support" | "refunds" | "account";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type DashboardData = {
  balance: number;
  marketplaceBalance: number;
  gatewayBalance: number;
  salesCount: number;
  salesValue: number;
  marketplacePending: number;
  pendingOrders: number;
  messageCount: number;
  questionCount: number;
  activeListings: number;
  openTickets: number;
  ticketCount: number;
  refundCount: number;
  documentVerified: boolean;
  gatewayAuthorized: boolean;
  gatewayGross: number;
  gatewayNet: number;
  gatewaySettings: { depositFeePercent: number; withdrawFee: number; minWithdraw: number };
  recentSales: Array<{ id: number; amount: number; status: string; createdAt: string; buyerPublicId: string; fundsAvailableAt?: string }>;
  ledger: Array<{ id: number; amount: number; kind: string; description: string; createdAt: string; availableAt: string }>;
  withdrawals: Array<{ id: number; amount: number; fee: number; netAmount: number; method: string; status: string; createdAt: string }>;
  charges: Array<{ id: number; amount: number; providerAmount?: number; providerNetAmount?: number; platformFee?: number; creditedAmount?: number; description: string; status: string; qrCode?: string; createdAt: string; expiresAt?: string }>;
  refunds: Array<{ id: number; amount: number; reason?: string; refundedAt?: string; asSeller?: boolean }>;
  dailyRevenue: Array<{ day: string; amount: number }>;
};

const emptyData: DashboardData = {
  balance: 0, marketplaceBalance: 0, gatewayBalance: 0, salesCount: 0, salesValue: 0,
  marketplacePending: 0, pendingOrders: 0, messageCount: 0, questionCount: 0,
  activeListings: 0, openTickets: 0, ticketCount: 0, refundCount: 0,
  documentVerified: false, gatewayAuthorized: false, gatewayGross: 0, gatewayNet: 0,
  gatewaySettings: { depositFeePercent: 0, withdrawFee: 0, minWithdraw: 5 },
  recentSales: [], ledger: [], withdrawals: [], charges: [], refunds: [], dailyRevenue: [],
};

const statusLabel: Record<string, string> = {
  pending: "Pendente", paid: "Pago", creating: "Criando", expired: "Expirada",
  failed: "Falhou", approved: "Concluído", rejected: "Recusado", delivered: "Entregue",
  delivered_pending_confirmation: "Aguardando confirmação", cancelled: "Cancelado", refunded: "Reembolsado",
};

const NAV: Array<{ id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "home", label: "Início", icon: Home },
  { id: "gateway", label: "Cobranças", icon: CreditCard },
  { id: "sales", label: "Vendas", icon: ShoppingBag },
  { id: "support", label: "Tickets", icon: Headset },
  { id: "account", label: "Conta", icon: UserRound },
];

export default function AppDashboard() {
  const { user, profile, loading, banned, isAdmin } = useAuth();
  const { state } = useStore();
  const { branding } = useSiteBranding();
  const [data, setData] = useState<DashboardData>(emptyData);
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState<AppTab>(() => {
    const queryTab = new URLSearchParams(window.location.search).get("appTab") as AppTab | null;
    if (queryTab && ["home","gateway","sales","products","support","refunds","account"].includes(queryTab)) return queryTab;
    if (new URLSearchParams(window.location.search).has("order")) return "sales";
    const saved = window.sessionStorage.getItem("zxmax_app_tab") as AppTab | null;
    return saved && ["home","gateway","sales","products","support","refunds","account"].includes(saved) ? saved : "home";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [chargeBusy, setChargeBusy] = useState(false);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  const discordInvite = branding.discordInviteUrl || state.config.discordLink || "";

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [{ data: payload, error }, { data: gatewayAuthorized, error: gatewayAccessError }] = await Promise.all([
      (supabase as any).rpc("get_my_app_dashboard_secure"),
      (supabase as any).rpc("can_use_merchant_gateway"),
    ]);
    setBusy(false);
    if (error || !payload) {
      if (!banned) toast.error("Não foi possível atualizar o painel agora.");
      return;
    }
    setData({
      ...emptyData,
      ...payload,
      balance: Number(payload.balance || 0),
      marketplaceBalance: Number(payload.marketplaceBalance || 0),
      gatewayBalance: Number(payload.gatewayBalance || 0),
      salesCount: Number(payload.salesCount || 0),
      salesValue: Number(payload.salesValue || 0),
      marketplacePending: Number(payload.marketplacePending || 0),
      pendingOrders: Number(payload.pendingOrders || 0),
      messageCount: Number(payload.messageCount || 0),
      questionCount: Number(payload.questionCount || 0),
      activeListings: Number(payload.activeListings || 0),
      openTickets: Number(payload.openTickets || 0),
      ticketCount: Number(payload.ticketCount || 0),
      refundCount: Number(payload.refundCount || 0),
      documentVerified: payload.documentVerified === true,
      gatewayAuthorized: !gatewayAccessError && gatewayAuthorized === true,
      gatewayGross: Number(payload.gatewayGross || 0),
      gatewayNet: Number(payload.gatewayNet || 0),
      gatewaySettings: {
        depositFeePercent: Number(payload.gatewaySettings?.depositFeePercent || 0),
        withdrawFee: Number(payload.gatewaySettings?.withdrawFee || 0),
        minWithdraw: Number(payload.gatewaySettings?.minWithdraw || 5),
      },
      recentSales: Array.isArray(payload.recentSales) ? payload.recentSales : [],
      ledger: Array.isArray(payload.ledger) ? payload.ledger : [],
      withdrawals: Array.isArray(payload.withdrawals) ? payload.withdrawals : [],
      charges: Array.isArray(payload.charges) ? payload.charges : [],
      refunds: Array.isArray(payload.refunds) ? payload.refunds : [],
      dailyRevenue: Array.isArray(payload.dailyRevenue) ? payload.dailyRevenue : [],
    });
  }, [user, banned]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    window.sessionStorage.setItem("zxmax_app_tab", tab);
    setMenuOpen(false);
  }, [tab]);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(Boolean(standalone));
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

  const switchTab = (next: AppTab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const install = async () => {
    if (installed) return toast.info("O aplicativo ZXMAX já está instalado.");
    if (!installPrompt) {
      toast.info("Abra o menu do navegador e escolha “Instalar aplicativo”.");
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstallPrompt(null);
  };

  const createCharge = async () => {
    const amount = Number(String(chargeAmount).replace(",", "."));
    const description = chargeDescription.trim();
    if (!data.gatewayAuthorized) return toast.error("Sua conta ainda não está autorizada para usar cobranças do App Gateway.");
    if (!Number.isFinite(amount) || amount < 2 || amount > 5000) return toast.error("Use um valor entre R$ 2,00 e R$ 5.000,00.");
    if (description.length < 4 || description.length > 120) return toast.error("Descreva a cobrança em 4 a 120 caracteres.");

    setChargeBusy(true);
    const { data: result, error } = await supabase.functions.invoke("merchant-charge", { body: { action: "create", amount, description } });
    setChargeBusy(false);
    if (error || result?.error || !result?.charge) return toast.error(result?.error || "Não foi possível criar a cobrança.");
    setChargeAmount("");
    setChargeDescription("");
    setChargeOpen(false);
    await load();
    if (result.charge.qrCode) {
      await navigator.clipboard?.writeText(String(result.charge.qrCode)).catch(() => undefined);
      toast.success("Cobrança criada. PIX copia e cola copiado.");
    } else toast.success("Cobrança criada.");
  };

  const checkCharge = async (id: number) => {
    const tid = toast.loading("Consultando pagamento...");
    const { data: result, error } = await supabase.functions.invoke("merchant-charge", { body: { action: "check", chargeId: id } });
    if (error || result?.error) {
      toast.error(result?.error || "Não foi possível consultar a cobrança.", { id: tid });
      return;
    }
    toast.success(result?.paid ? `Pagamento confirmado. ${formatBRL(Number(result.credited || 0))} entrou no saldo Gateway.` : "Pagamento ainda pendente.", { id: tid });
    await load();
  };

  const requestGatewayWithdraw = async () => {
    const amount = Number(String(withdrawAmount).replace(",", "."));
    if (!data.gatewayAuthorized) return toast.error("Sua conta ainda não está autorizada para sacar pelo App Gateway.");
    if (!profile?.pix_key) return toast.error("Cadastre uma chave Pix na sua conta antes de sacar.");
    if (!Number.isFinite(amount) || amount < data.gatewaySettings.minWithdraw) return toast.error(`Saque mínimo: ${formatBRL(data.gatewaySettings.minWithdraw)}.`);
    if (amount > data.gatewayBalance) return toast.error("Saldo Gateway insuficiente.");

    setWithdrawBusy(true);
    const idempotency = `gateway:${user?.id}:${amount}:${new Date().toISOString().slice(0,16)}`;
    const { error } = await (supabase as any).rpc("request_gateway_withdrawal", {
      _amount: amount,
      _pix_key: profile.pix_key,
      _idempotency_key: idempotency,
    });
    setWithdrawBusy(false);
    if (error) return toast.error(error.message || "Não foi possível solicitar o saque.");
    setWithdrawOpen(false);
    setWithdrawAmount("");
    toast.success("Saque do App Gateway solicitado.");
    await load();
  };

  const copy = async (value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success("PIX copia e cola copiado.");
  };

  const gatewayLedger = useMemo(() => data.ledger.filter((entry) => entry.kind === "merchant_charge_credit"), [data.ledger]);
  const maxDay = useMemo(() => Math.max(1, ...data.dailyRevenue.map((item) => Number(item.amount || 0))), [data.dailyRevenue]);
  const totalRevenue = data.salesValue + data.gatewayNet;

  if (loading) return <div className="min-h-screen bg-black" />;
  if (user && banned) return <BannedScreen />;

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto flex min-h-screen max-w-md flex-col justify-between px-6 py-8">
          <div className="flex items-center justify-between">
            <span className="text-lg font-black tracking-[-0.05em]">{branding.siteName || "ZXMAX"}</span>
            {!installed ? <button onClick={() => void install()} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold text-white/55"><Download className="mr-1.5 inline h-3.5 w-3.5" />Instalar</button> : null}
          </div>
          <div className="py-12">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]"><Wallet className="h-6 w-6 text-white/70" /></div>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-white/35">ZXMAX Management</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.045em]">Gerencie tudo sem sair do app.</h1>
            <p className="mt-3 text-sm leading-6 text-white/38">Cobranças, vendas, carteira, tickets, produtos e perfil em uma interface separada do marketplace.</p>
            <button onClick={() => setAuthOpen(true)} className="mt-8 w-full rounded-2xl bg-white py-3.5 text-sm font-black text-black">Entrar na minha conta</button>
          </div>
          <p className="text-[10px] leading-4 text-white/22">O aplicativo instalado abre somente a área de gerenciamento. A loja pública continua separada no navegador.</p>
        </div>
        {authOpen ? <AuthScreen onClose={() => setAuthOpen(false)} /> : null}
      </div>
    );
  }

  const renderHome = () => (
    <div className="space-y-4">
      <section className="rounded-[26px] border border-white/[0.07] bg-[#09090b] p-5">
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/30">Saldo Gateway</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-black tracking-[-0.05em]">{formatBRL(data.gatewayBalance)}</p>
            <p className="mt-1 text-[10px] text-white/30">Cobranças confirmadas entram aqui imediatamente.</p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.05]"><ArrowDownToLine className="h-5 w-5 text-emerald-300" /></div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <button onClick={() => setChargeOpen(true)} className="rounded-xl bg-white px-2 py-3 text-[10px] font-black text-black">Cobrar</button>
          <button onClick={() => setWithdrawOpen(true)} className="rounded-xl border border-white/10 bg-white/[0.035] px-2 py-3 text-[10px] font-bold text-white/65">Sacar</button>
          <button onClick={() => switchTab("gateway")} className="rounded-xl border border-white/10 bg-white/[0.035] px-2 py-3 text-[10px] font-bold text-white/65">Extrato</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2.5">
        {[
          ["Rendimento total", formatBRL(totalRevenue), BarChart3],
          ["Vendas", data.salesCount.toLocaleString("pt-BR"), ShoppingBag],
          ["Tickets abertos", data.openTickets.toLocaleString("pt-BR"), TicketCheck],
          ["Reembolsos", data.refundCount.toLocaleString("pt-BR"), RotateCcw],
          ["Mensagens", data.messageCount.toLocaleString("pt-BR"), MessageSquare],
          ["Perguntas", data.questionCount.toLocaleString("pt-BR"), ListChecks],
        ].map(([label,value,Icon]) => (
          <div key={String(label)} className="rounded-2xl border border-white/[0.065] bg-[#09090b] p-4">
            <Icon className="h-4 w-4 text-white/38" />
            <p className="mt-3 text-lg font-black text-white">{value}</p>
            <p className="mt-1 text-[9px] font-semibold text-white/28">{label}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-white/[0.065] bg-[#09090b] p-4">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs font-black">Receita · 7 dias</p><p className="mt-1 text-[9px] text-white/28">Vendas pagas + cobranças líquidas.</p></div>
          <button onClick={() => void load()} disabled={busy} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-white/45 disabled:opacity-30"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /></button>
        </div>
        <div className="mt-5 flex h-28 items-end gap-2">
          {data.dailyRevenue.map((item) => {
            const height=Math.max(4,Math.round((Number(item.amount||0)/maxDay)*100));
            return <div key={item.day} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="w-full rounded-t-md bg-white/70" style={{ height: `${height}%` }} title={formatBRL(item.amount)} />
              <span className="text-[8px] text-white/24">{new Date(item.day+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short"}).replace(".","")}</span>
            </div>;
          })}
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        <button onClick={() => switchTab("products")} className="rounded-2xl border border-white/[0.065] bg-[#09090b] p-4 text-left"><Package className="h-5 w-5 text-white/45" /><p className="mt-3 text-xs font-black">Produtos</p><p className="mt-1 text-[9px] text-white/28">{data.activeListings} anúncio(s) ativo(s)</p></button>
        <button onClick={() => switchTab("sales")} className="rounded-2xl border border-white/[0.065] bg-[#09090b] p-4 text-left"><Clock3 className="h-5 w-5 text-white/45" /><p className="mt-3 text-xs font-black">A receber</p><p className="mt-1 text-[9px] text-white/28">{formatBRL(data.marketplacePending)} em segurança</p></button>
        <button onClick={() => switchTab("refunds")} className="rounded-2xl border border-white/[0.065] bg-[#09090b] p-4 text-left"><RotateCcw className="h-5 w-5 text-white/45" /><p className="mt-3 text-xs font-black">Histórico de reembolso</p><p className="mt-1 text-[9px] text-white/28">{data.refundCount} registro(s)</p></button>
      </section>

      <section className="rounded-2xl border border-white/[0.065] bg-[#09090b]">
        <div className="border-b border-white/[0.055] p-4"><p className="text-xs font-black">Separação dos saldos</p><p className="mt-1 text-[9px] leading-4 text-white/28">O App Gateway libera cobranças confirmadas na hora. Vendas de produtos só entram na carteira depois da confirmação da entrega e do prazo de segurança.</p></div>
        <div className="grid grid-cols-2 gap-px bg-white/[0.055]">
          <div className="bg-[#09090b] p-4"><p className="text-[9px] text-white/28">Gateway</p><p className="mt-1 text-base font-black">{formatBRL(data.gatewayBalance)}</p><p className="mt-1 text-[8px] text-emerald-300/65">Disponível imediato</p></div>
          <div className="bg-[#09090b] p-4"><p className="text-[9px] text-white/28">Marketplace</p><p className="mt-1 text-base font-black">{formatBRL(data.marketplaceBalance)}</p><p className="mt-1 text-[8px] text-white/28">Após entrega + segurança</p></div>
        </div>
      </section>
    </div>
  );

  const renderGateway = () => (
    <div className="space-y-4">
      <section className="rounded-[26px] border border-white/[0.07] bg-[#09090b] p-5">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">Carteira Gateway</p><p className="mt-2 text-3xl font-black tracking-[-0.05em]">{formatBRL(data.gatewayBalance)}</p></div>
          <ShieldCheck className="h-5 w-5 text-emerald-300/80" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={() => setChargeOpen(true)} className="rounded-xl bg-white py-3 text-[11px] font-black text-black">Nova cobrança</button>
          <button onClick={() => setWithdrawOpen(true)} className="rounded-xl border border-white/10 py-3 text-[11px] font-bold text-white/65">Solicitar saque</button>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[8px] text-white/25">Bruto recebido</p><p className="mt-1 text-xs font-black">{formatBRL(data.gatewayGross)}</p></div>
          <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[8px] text-white/25">Líquido histórico</p><p className="mt-1 text-xs font-black">{formatBRL(data.gatewayNet)}</p></div>
          <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[8px] text-white/25">Taxa depósito</p><p className="mt-1 text-xs font-black">{data.gatewaySettings.depositFeePercent.toFixed(2).replace(".",",")}%</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.065] bg-[#09090b]">
        <div className="flex items-center justify-between border-b border-white/[0.055] p-4"><div><p className="text-xs font-black">Cobranças</p><p className="mt-1 text-[9px] text-white/28">Confirmação direta no gateway antes do crédito.</p></div><button onClick={() => setChargeOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl bg-white text-black"><Plus className="h-4 w-4" /></button></div>
        {data.charges.length===0 ? <p className="p-7 text-center text-[10px] text-white/28">Nenhuma cobrança criada.</p> :
          <div className="divide-y divide-white/[0.055]">{data.charges.map((charge)=>(
            <article key={charge.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-xs font-bold">{charge.description}</p><p className="mt-1 text-[9px] text-white/25">#{charge.id} · {new Date(charge.createdAt).toLocaleString("pt-BR")}</p></div>
                <div className="text-right"><p className="text-sm font-black">{formatBRL(charge.amount)}</p><p className={`mt-1 text-[8px] font-bold ${charge.status==="paid"?"text-emerald-300":charge.status==="pending"?"text-amber-300":"text-white/28"}`}>{statusLabel[charge.status]||charge.status}</p></div>
              </div>
              {charge.status==="paid" ? <p className="mt-2 text-[9px] text-white/32">Crédito líquido: <b className="text-white/70">{formatBRL(charge.creditedAmount || 0)}</b>{Number(charge.platformFee||0)>0 ? ` · taxa ZXMAX ${formatBRL(charge.platformFee)}` : ""}</p> : null}
              {charge.status==="pending" ? <div className="mt-3 flex gap-2"><button onClick={()=>void copy(charge.qrCode)} disabled={!charge.qrCode} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[9px] font-bold text-white/55 disabled:opacity-30"><Copy className="h-3 w-3" /> Copiar PIX</button><button onClick={()=>void checkCharge(charge.id)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-bold text-white/70"><RefreshCw className="h-3 w-3" /> Verificar</button></div> : null}
            </article>
          ))}</div>}
      </section>

      <section className="rounded-2xl border border-white/[0.065] bg-[#09090b]">
        <div className="border-b border-white/[0.055] p-4"><p className="text-xs font-black">Extrato Gateway</p><p className="mt-1 text-[9px] text-white/28">Créditos de cobranças confirmadas.</p></div>
        {gatewayLedger.length===0 ? <p className="p-7 text-center text-[10px] text-white/28">Sem movimentações.</p> :
          <div className="divide-y divide-white/[0.055]">{gatewayLedger.map((entry)=><div key={entry.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-white/65">{entry.description}</p><p className="mt-1 text-[8px] text-white/22">{new Date(entry.createdAt).toLocaleString("pt-BR")}</p></div><p className="text-xs font-black text-emerald-300">+{formatBRL(entry.amount)}</p></div>)}</div>}
      </section>
    </div>
  );

  const renderRefunds = () => (
    <section className="rounded-2xl border border-white/[0.065] bg-[#09090b]">
      <div className="border-b border-white/[0.055] p-4"><p className="text-xs font-black">Histórico de reembolsos</p><p className="mt-1 text-[9px] text-white/28">Pedidos em que você participou como comprador ou vendedor.</p></div>
      {data.refunds.length===0 ? <p className="p-8 text-center text-[10px] text-white/28">Nenhum reembolso registrado.</p> :
        <div className="divide-y divide-white/[0.055]">{data.refunds.map((refund)=><article key={refund.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold">Pedido #{refund.id}</p><p className="mt-1 text-[8px] text-white/25">{refund.asSeller ? "Você vendeu" : "Você comprou"} · {refund.refundedAt ? new Date(refund.refundedAt).toLocaleString("pt-BR") : "data indisponível"}</p></div><p className="text-xs font-black">{formatBRL(refund.amount)}</p></div><p className="mt-3 rounded-xl bg-white/[0.025] p-3 text-[9px] leading-4 text-white/42">{refund.reason || "Motivo não informado."}</p></article>)}</div>}
    </section>
  );

  const renderAccount = () => (
    <div className="space-y-4">
      <section className="rounded-[26px] border border-white/[0.07] bg-[#09090b] p-5">
        <div className="flex items-center gap-4">
          <img src={profile?.avatar_url || state.currentUser?.avatar} alt="" className="h-16 w-16 rounded-2xl border border-white/10 bg-white/[0.03] object-cover" />
          <div className="min-w-0"><p className="truncate text-lg font-black">{profile?.display_name || state.currentUser?.name || "Usuário"}</p><p className="mt-1 text-[9px] text-white/28">ID {profile?.public_id || state.currentUser?.publicId || "—"}</p><p className="mt-1 truncate text-[9px] text-white/28">{user.email}</p></div>
        </div>
        <button onClick={()=>setProfileOpen(true)} className="mt-5 w-full rounded-xl bg-white py-3 text-[10px] font-black text-black">Editar perfil, foto, PIX e documentos</button>
      </section>
      <section className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-white/[0.065] bg-[#09090b] p-4"><p className="text-[9px] text-white/28">Saldo Gateway</p><p className="mt-1 text-base font-black">{formatBRL(data.gatewayBalance)}</p></div>
        <div className="rounded-2xl border border-white/[0.065] bg-[#09090b] p-4"><p className="text-[9px] text-white/28">Saldo Marketplace</p><p className="mt-1 text-base font-black">{formatBRL(data.marketplaceBalance)}</p></div>
      </section>
      <section className="rounded-2xl border border-white/[0.065] bg-[#09090b] p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black">Acesso financeiro</p><p className="mt-1 text-[9px] text-white/28">{data.documentVerified ? "Documentos aprovados para cobranças e saques." : isAdmin && data.gatewayAuthorized ? "Conta administrativa autorizada sem alterar o status dos documentos." : "Envie e aprove os documentos para liberar cobranças e saques."}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-black ${data.gatewayAuthorized?"bg-emerald-300/10 text-emerald-300":"bg-amber-300/10 text-amber-200"}`}>{data.documentVerified?"DOCUMENTOS OK":isAdmin&&data.gatewayAuthorized?"ACESSO ADMIN":"PENDENTE"}</span></div>
      </section>
      {!installed ? <button onClick={()=>void install()} className="flex w-full items-center justify-between rounded-2xl border border-white/[0.065] bg-[#09090b] p-4 text-left"><span><span className="block text-xs font-black">Instalar ZXMAX</span><span className="mt-1 block text-[9px] text-white/28">Instala o aplicativo de gerenciamento.</span></span><Download className="h-4 w-4 text-white/40" /></button> : <div className="flex items-center gap-2 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.035] p-4 text-[10px] font-bold text-emerald-200"><CheckCircle2 className="h-4 w-4" /> Aplicativo instalado neste dispositivo.</div>}
    </div>
  );

  const content = tab==="home" ? renderHome()
    : tab==="gateway" ? renderGateway()
    : tab==="sales" ? <MyPurchasesView initialScope="sales" />
    : tab==="products" ? <InventoryView />
    : tab==="support" ? <SupportView />
    : tab==="refunds" ? renderRefunds()
    : renderAccount();

  return (
    <div className="min-h-screen bg-black pb-24 text-white">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-2 px-3">
          <button onClick={()=>switchTab("home")} className="text-sm font-black tracking-[-0.05em]">{branding.siteName || "ZXMAX"}</button>
          <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-[7px] font-black uppercase tracking-[0.12em] text-white/32">App</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            {discordInvite ? <a href={discordInvite} target="_blank" rel="noopener noreferrer" className="grid h-9 w-9 place-items-center rounded-xl border border-[#5865F2]/20 bg-[#5865F2]/[0.05] text-white/65" aria-label="Abrir Discord"><DiscordIcon className="h-4 w-4" /></a> : null}
            <button onClick={()=>setProfileOpen(true)} className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]" aria-label="Perfil">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-4 w-4 text-white/55" />}</button>
            <button onClick={()=>setMenuOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025]" aria-label="Menu"><Menu className="h-4 w-4 text-white/55" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-3 py-4">{content}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.07] bg-black/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {NAV.map((item)=>{const Icon=item.icon; const active=tab===item.id; return <button key={item.id} onClick={()=>switchTab(item.id)} className={`flex min-h-12 flex-col items-center justify-center rounded-xl text-[8px] font-bold transition ${active?"bg-white text-black":"text-white/35"}`}><Icon className="mb-1 h-4 w-4" />{item.label}{item.id==="support"&&data.openTickets>0?<span className={`absolute ml-7 -mt-7 rounded-full px-1 text-[7px] ${active?"bg-black text-white":"bg-white text-black"}`}>{data.openTickets}</span>:null}</button>})}
        </div>
      </nav>

      {menuOpen ? <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm" onClick={()=>setMenuOpen(false)}>
        <aside className="absolute right-0 top-0 h-full w-[86%] max-w-sm overflow-y-auto border-l border-white/[0.08] bg-[#060607] p-4" onClick={(e)=>e.stopPropagation()}>
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/28">Gerenciamento</p><p className="mt-1 text-lg font-black">ZXMAX App</p></div><button onClick={()=>setMenuOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10"><X className="h-4 w-4" /></button></div>
          <div className="mt-5 grid gap-1">
            {[
              ["home","Visão geral",Home],["gateway","Cobranças e Gateway",CreditCard],["sales","Vendas e entregas",ShoppingBag],
              ["products","Produtos e estoque",Package],["support","Tickets e suporte",Headset],["refunds","Reembolsos",RotateCcw],["account","Perfil e conta",UserRound],
            ].map(([id,label,Icon]: any)=><button key={id} onClick={()=>switchTab(id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-[11px] font-bold ${tab===id?"bg-white text-black":"text-white/55 hover:bg-white/[0.04]"}`}><Icon className="h-4 w-4" />{label}</button>)}
          </div>
          <div className="my-5 h-px bg-white/[0.07]" />
          <p className="px-3 text-[8px] font-black uppercase tracking-[0.14em] text-white/22">Ajuda e documentos</p>
          <div className="mt-2 grid gap-1">
            {[["Central de ajuda","/central-de-ajuda"],["Termos de uso","/termos"],["Privacidade","/privacidade"],["Regras","/regras"],["Reembolsos e política","/reembolsos"],["Tarifas e prazos","/tarifas-e-prazos"]].map(([label,href])=><a key={href} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl px-3 py-3 text-[10px] font-semibold text-white/45 hover:bg-white/[0.04] hover:text-white"><span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" />{label}</span></a>)}
          </div>
          {discordInvite ? <a href={discordInvite} target="_blank" rel="noopener noreferrer" className="mt-5 flex items-center gap-3 rounded-xl border border-[#5865F2]/20 bg-[#5865F2]/[0.05] px-3 py-3 text-[10px] font-bold text-white/60"><DiscordIcon className="h-4 w-4" /> Entrar no Discord da ZXMAX</a> : null}
        </aside>
      </div> : null}

      {chargeOpen ? <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onClick={()=>setChargeOpen(false)}>
        <section className="w-full max-w-md rounded-[24px] border border-white/[0.09] bg-[#09090b] p-5" onClick={(e)=>e.stopPropagation()}>
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">App Gateway</p><h2 className="mt-1 text-lg font-black">Criar cobrança PIX</h2></div><button onClick={()=>setChargeOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10"><X className="h-4 w-4" /></button></div>
          {!data.gatewayAuthorized ? <div className="mt-5 rounded-xl border border-amber-300/10 bg-amber-300/[0.04] p-4 text-[10px] leading-5 text-amber-100/60">Sua conta ainda não está autorizada para criar cobranças. Usuários comuns precisam de documentos aprovados.</div> : <>
            <label className="mt-5 block text-[9px] font-bold uppercase text-white/28">Valor<input value={chargeAmount} onChange={(e)=>setChargeAmount(e.target.value)} inputMode="decimal" placeholder="50,00" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black p-3 text-sm text-white outline-none" /></label>
            <label className="mt-3 block text-[9px] font-bold uppercase text-white/28">Descrição<input value={chargeDescription} onChange={(e)=>setChargeDescription(e.target.value)} maxLength={120} placeholder="Ex.: serviço digital" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black p-3 text-sm text-white outline-none" /></label>
            <div className="mt-4 rounded-xl bg-white/[0.025] p-3 text-[9px] leading-4 text-white/35">Taxa de depósito ZXMAX: <b className="text-white/70">{data.gatewaySettings.depositFeePercent.toFixed(2).replace(".",",")}%</b>. O valor líquido entra no saldo Gateway somente após confirmação direta do provedor.</div>
            <button onClick={()=>void createCharge()} disabled={chargeBusy} className="mt-5 w-full rounded-xl bg-white py-3 text-sm font-black text-black disabled:opacity-40">{chargeBusy?"Criando...":"Gerar PIX"}</button>
          </>}
        </section>
      </div> : null}

      {withdrawOpen ? <div className="fixed inset-0 z-[90] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onClick={()=>setWithdrawOpen(false)}>
        <section className="w-full max-w-md rounded-[24px] border border-white/[0.09] bg-[#09090b] p-5" onClick={(e)=>e.stopPropagation()}>
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">Saldo Gateway</p><h2 className="mt-1 text-lg font-black">Solicitar saque</h2></div><button onClick={()=>setWithdrawOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10"><X className="h-4 w-4" /></button></div>
          <div className="mt-5 rounded-xl bg-white/[0.025] p-4"><p className="text-[9px] text-white/28">Disponível</p><p className="mt-1 text-2xl font-black">{formatBRL(data.gatewayBalance)}</p><p className="mt-1 text-[9px] text-white/28">Taxa: {formatBRL(data.gatewaySettings.withdrawFee)} · mínimo {formatBRL(data.gatewaySettings.minWithdraw)}</p></div>
          <label className="mt-4 block text-[9px] font-bold uppercase text-white/28">Valor<input value={withdrawAmount} onChange={(e)=>setWithdrawAmount(e.target.value)} inputMode="decimal" placeholder={String(data.gatewaySettings.minWithdraw).replace(".",",")} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black p-3 text-sm text-white outline-none" /></label>
          <p className="mt-3 text-[9px] leading-4 text-white/32">Destino: {profile?.pix_key || "nenhuma chave Pix cadastrada"}</p>
          <button onClick={()=>void requestGatewayWithdraw()} disabled={withdrawBusy} className="mt-5 w-full rounded-xl bg-white py-3 text-sm font-black text-black disabled:opacity-40">{withdrawBusy?"Solicitando...":"Solicitar saque"}</button>
        </section>
      </div> : null}

      <ProfileModal open={profileOpen} onClose={()=>setProfileOpen(false)} />
    </div>
  );
}
