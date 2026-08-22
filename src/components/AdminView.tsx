import React, { useState, useEffect } from "react";
import { useStore, Product, Withdrawal, Purchase } from "@/store/StoreContext";
import { MoneyEmoji, PackageEmoji, ChatEmoji, StarEmoji, ShieldEmoji } from "@/components/CustomEmojis";
import {
  X,
  Check,
  Send,
  User,
  Trash2,
  ShieldAlert,
  FileText,
  Settings,
  Users,
  Tag,
  ArrowLeft,
  ExternalLink,
  Webhook,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  Lock,
  Wallet,
  ArrowDownToLine,
  Info,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import MyPurchasesView from "@/components/MyPurchasesView";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import TwoFactorPanel from "@/components/TwoFactorPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AdminCategoriesPanel, AdminAllProductsPanel, AdminPurchasesPanel, AdminTicketsPanel, AdminTagsPanel, AdminPlatformPanel } from "@/components/AdminMorePanels";

interface WebhookLog {
  id: number;
  source: string;
  event_type: string | null;
  status: string | null;
  order_id: number | null;
  charge_id: string | null;
  payload: any;
  error: string | null;
  created_at: string;
}

export default function AdminView() {
  const {
    state,
    approveProduct,
    rejectProduct,
    approveWithdraw,
    rejectWithdraw,
    approvePurchase,
    revertPurchase,
    requestWithdraw,
    banUser,
    unbanUser,
    updateConfig,
    publishNotice,
    deleteNotice,
    createUserTag,
    deleteUserTag,
    assignUserTag,
    unassignUserTag,
    sendAdminChat,
    verifyUser,
    reviewSellerDocument,
    saveGatewaySettings,
  } = useStore();
  const { mfaEnabled, isAdmin } = useAuth();
  const [tab, setTab] = useState<
    | "dashboard"
    | "products"
    | "catalog"
    | "purchases"
    | "withdrawals"
    | "admin_wallet"
    | "notices"
    | "users"
    | "tags"
    | "adminchat"
    | "documents"
    | "verifications"
    | "disputes"
    | "config"
    | "webhooks"
    | "apis"
    | "security"
    | "roles"
    | "categories"
    | "tickets"
    | "platform"
  >("dashboard");

  const [withdrawSubTab, setWithdrawSubTab] = useState<"sellers" | "admin_wallet">("sellers");
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [kyc, setKyc] = useState<any[]>([]);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycNotes, setKycNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [chatMsg, setChatMsg] = useState("");
  const [rules, setRules] = useState(state.config.rules);
  const [commission, setCommission] = useState(state.config.commission);
  const [instantFee, setInstantFee] = useState(state.config.instantFee);
  const [minWithdrawConfig, setMinWithdrawConfig] = useState(state.config.minWithdraw || 5.0);
  const [withdrawFeeConfig, setWithdrawFeeConfig] = useState(state.config.withdrawFee || 1.2);

  // Admin withdrawal form state
  const [adminWithdrawAmount, setAdminWithdrawAmount] = useState("");
  const [adminPixKey, setAdminPixKey] = useState(state.currentUser?.pixKey || "");
  const [adminWithdrawBusy, setAdminWithdrawBusy] = useState(false);

  // Discord config
  const [discordMode, setDiscordMode] = useState(state.config.discordMode);
  const [discordClientId, setDiscordClientId] = useState(state.config.discordClientId);
  const [discordRedirectUri, setDiscordRedirectUri] = useState(state.config.discordRedirectUri);
  const [discordScopes, setDiscordScopes] = useState(state.config.discordScopes);
  const [discordServerLink, setDiscordServerLink] = useState(state.config.discordServerLink);

  // EvoPay config (active payment gateway)
  const [evopayMode, setEvopayMode] = useState(state.config.evopayMode);
  const [evopayApiKey, setEvopayApiKey] = useState("");

  // Auth mode
  const [authMode, setAuthMode] = useState(state.config.authMode);
  const [banIdentifier, setBanIdentifier] = useState("");
  const [banReason, setBanReason] = useState("");
  const [selectedDisputeId, setSelectedDisputeId] = useState<number | null>(null);

  const pendingProducts = state.products.filter((p) => !p.approved);
  const pendingWithdrawals = state.withdrawals.filter((w) => w.status === "pending" && w.method !== "admin_fee");
  const sellerWithdrawals = state.withdrawals.filter((w) => w.method !== "admin_fee");
  const adminFeeWithdrawals = state.withdrawals.filter((w) => w.method === "admin_fee");
  const adminMessages = state.adminChat || [];
  const globalNotices = state.globalNotices || [];
  const disputes = state.purchases.filter((p) => p.status === "dispute");
  const pendingDocuments = (state.sellerDocuments || []).filter((d) => d.status === "pending");

  useEffect(() => {
    if (state.currentUser?.pixKey && !adminPixKey) {
      setAdminPixKey(state.currentUser.pixKey);
    }
  }, [state.currentUser?.pixKey]);

  const handleSaveConfig = async () => {
    updateConfig({
      rules,
      commission,
      instantFee,
      minWithdraw: minWithdrawConfig,
      withdrawFee: withdrawFeeConfig,
      authMode,
      discordMode,
      discordClientId,
      discordRedirectUri,
      discordScopes,
      discordServerLink,
      discordLink: discordServerLink,
      evopayMode,
    });
    const tid = toast.loading("Salvando configurações...");
    const ok = await saveGatewaySettings({ evopayMode, evopayApiKey: evopayApiKey.trim() || undefined });

    // Also update fees in app_settings table
    try {
      await (supabase as any).from("app_settings").upsert(
        {
          key: "fees",
          value: {
            commission,
            instant_fee: instantFee,
            min_withdraw: minWithdrawConfig,
            withdraw_fee: withdrawFeeConfig,
          },
        },
        { onConflict: "key" }
      );
    } catch {}

    if (ok) {
      setEvopayApiKey("");
      toast.success("Configurações salvas!", { id: tid });
    } else {
      toast.error("Configurações locais salvas, mas falha ao salvar as credenciais do gateway.", { id: tid });
    }
  };

  const handleAdminWithdraw = async () => {
    const minW = state.config.minWithdraw || 5.0;
    const fee = state.config.withdrawFee || 1.2;
    const amountNum = parseFloat(adminWithdrawAmount) || state.adminFeeBalance;

    if (!adminPixKey.trim()) {
      return toast.error("Informe a chave Pix para receber o saque.");
    }
    if (amountNum < minW) {
      return toast.error(`O valor mínimo de saque é R$ ${minW.toFixed(2).replace(".", ",")}.`);
    }
    if (amountNum > state.adminFeeBalance) {
      return toast.error(`Saldo de taxas insuficiente. Disponível: R$ ${state.adminFeeBalance.toFixed(2).replace(".", ",")}`);
    }

    setAdminWithdrawBusy(true);
    const tid = toast.loading("Processando solicitação de saque de taxas do admin...");
    try {
      await requestWithdraw("admin_fee", {
        amount: amountNum,
        pixKey: adminPixKey.trim(),
      });
      setAdminWithdrawAmount("");
      toast.success(`Solicitação de saque de R$ ${amountNum.toFixed(2)} registrada com sucesso!`, { id: tid });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao solicitar saque do saldo admin.", { id: tid });
    } finally {
      setAdminWithdrawBusy(false);
    }
  };

  const handleBan = async () => {
    if (!banIdentifier.trim()) return toast.error("Digite o ID numérico do usuário.");
    const ok = await banUser(banIdentifier.trim(), banReason.trim() || "Violação das regras da plataforma");
    if (!ok) return toast.error("Não foi possível banir. Confira o ID numérico.");
    toast.success("Usuário banido.");
    setBanIdentifier("");
    setBanReason("");
  };

  const openDocument = async (path: string) => {
    if (!path || typeof path !== "string") {
      toast.error("Caminho do documento inválido");
      return;
    }
    const cleanPath = path.trim();
    if (!cleanPath) {
      toast.error("Documento sem arquivo");
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "get_document_url", filePath: cleanPath } });
      if (!error && data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        return;
      }
    } catch (e) {
      console.error("admin-verify failed", e);
    }

    try {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(cleanPath, 60 * 10);
      if (error) throw error;
      if (!data?.signedUrl) throw new Error("URL vazia");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error("Não foi possível abrir documento: " + (e?.message || "verifique storage"));
    }
  };

  const loadWebhookLogs = async () => {
    setLogsLoading(true);
    const { data, error } = await (supabase as any)
      .from("webhook_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogsLoading(false);
    if (error) {
      toast.error("Não foi possível carregar os logs do webhook.");
      return;
    }
    setWebhookLogs((data || []) as WebhookLog[]);
  };

  const loadKyc = async () => {
    setKycLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "get_kyc" } });
      if (!error && data?.kyc) {
        setKyc(data.kyc);
        setKycLoading(false);
        return;
      }
    } catch {}
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select(
        "user_id, public_id, email, display_name, full_name, cpf, birth_date, phone, city, state, verification_selfie_path, verification_status, verification_notes, verification_submitted_at, is_verified_seller"
      )
      .not("verification_status", "is", null)
      .neq("verification_status", "none")
      .order("verification_submitted_at", { ascending: false });
    setKycLoading(false);
    if (error) return toast.error("Não foi possível carregar as verificações.");
    setKyc(data || []);
  };

  const reviewKyc = async (userId: string, approved: boolean) => {
    const tid = toast.loading(approved ? "Aprovando..." : "Recusando...");
    try {
      if (approved) {
        const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "verify_user", userId } });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Falha");
        toast.success("Usuário verificado!", { id: tid });
      } else {
        const { data, error } = await supabase.functions.invoke("admin-verify", {
          body: { action: "reject_user", userId, notes: kycNotes[userId]?.trim() || "Documentos ilegíveis" },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Falha");
        toast.success("Verificação recusada.", { id: tid });
      }
    } catch (e: any) {
      if (approved) {
        const ok = await verifyUser(userId);
        ok ? toast.success("Usuário verificado! (fallback)", { id: tid }) : toast.error("Falha ao verificar: " + (e?.message || ""), { id: tid });
      } else {
        const { error } = await (supabase as any)
          .from("profiles")
          .update({
            verification_status: "rejected",
            is_verified_seller: false,
            verification_notes: kycNotes[userId]?.trim() || "Documentos ilegíveis",
          } as any)
          .eq("user_id", userId);
        error ? toast.error("Falha ao recusar: " + error.message, { id: tid }) : toast.success("Recusado (fallback)", { id: tid });
      }
    }
    await loadKyc();
  };

  const [docs, setDocs] = useState<any[]>([]);
  const loadDocs = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "get_documents" } });
      if (!error && data?.documents) {
        setDocs(data.documents);
        return;
      }
    } catch {}
    const { data } = await (supabase as any)
      .from("seller_documents")
      .select("id, user_id, file_path, file_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setDocs(data);
  };

  useEffect(() => {
    if (tab === "webhooks") void loadWebhookLogs();
    if (tab === "verifications") void loadKyc();
    if (tab === "documents") void loadDocs();
    if (tab === "dashboard") {
      void loadWebhookLogs();
      void loadDocs();
    }
  }, [tab]);

  if (selectedDisputeId) {
    return (
      <div className="animate-fade-in-up pb-20">
        <button
          onClick={() => setSelectedDisputeId(null)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para disputas
        </button>
        <MyPurchasesView initialSelectedId={selectedDisputeId} />
      </div>
    );
  }

  const withdrawFee = state.config.withdrawFee || 1.20;
  const minWithdraw = state.config.minWithdraw || 5.00;

  return (
    <div className="animate-fade-in-up pb-20 px-3 sm:px-4">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2 flex items-center gap-3">
              Painel Administrativo
              {mfaEnabled ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] bg-success/15 text-success border border-success/20 px-3 py-1 rounded-full font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> 2FA Ativo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[11px] bg-destructive/15 text-destructive border border-destructive/20 px-3 py-1 rounded-full font-bold">
                  <Lock className="w-3.5 h-3.5" /> 2FA Inativo
                </span>
              )}
            </h1>
            <p className="text-muted-foreground text-sm">
              Gestão de taxas, carteira da plataforma, produtos, saques e segurança.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {[
          { id: "dashboard", label: "Dashboard", icon: ShieldCheck },
          { id: "withdrawals", label: "Saques & Carteira Admin", icon: Wallet, count: pendingWithdrawals.length },
          { id: "security", label: "Segurança 2FA", icon: KeyRound },
          { id: "products", label: "Pendentes", icon: PackageEmoji, count: pendingProducts.length },
          { id: "catalog", label: "Catálogo", icon: PackageEmoji },
          { id: "purchases", label: "Compras", icon: FileText },
          { id: "categories", label: "Categorias", icon: Tag },
          { id: "disputes", label: "Disputas", icon: ShieldAlert, count: disputes.length },
          { id: "documents", label: "Documentos", icon: FileText, count: pendingDocuments.length },
          { id: "verifications", label: "Verificações", icon: ShieldEmoji },
          { id: "roles", label: "Cargos", icon: Users },
          { id: "tickets", label: "Tickets", icon: ChatEmoji },
          { id: "users", label: "Usuários", icon: Users },
          { id: "tags", label: "Tags", icon: Tag },
          { id: "notices", label: "Avisos", icon: StarEmoji },
          { id: "adminchat", label: "Chat Equipe", icon: ChatEmoji },
          { id: "webhooks", label: "Webhooks", icon: Webhook },
          { id: "apis", label: "APIs", icon: KeyRound },
          { id: "platform", label: "Plataforma", icon: Settings },
          { id: "config", label: "Config", icon: Settings },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
              tab === t.id ? "btn-gradient shadow-lg" : "bg-card border border-border/40 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon && <t.icon className="w-4 h-4" />}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* DASHBOARD TAB */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          {/* CARTEIRA ADMIN & TAXAS DA PLATAFORMA (DESTAQUE) */}
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-[#0c1a2e] via-[#0a0f1d] to-[#0a0a0f] border-2 border-[#0084ff]/30 shadow-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-80 h-80 bg-[#0084ff]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-black uppercase tracking-wider bg-[#0084ff] text-white px-3 py-1 rounded-full flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Saldo da Taxa Admin
                  </span>
                  <span className="text-xs text-white/50">Comissão de {state.config.commission}%</span>
                </div>
                <h3 className="text-3xl sm:text-4xl font-black text-white">
                  R$ {state.adminFeeBalance.toFixed(2).replace(".", ",")}
                </h3>
                <p className="text-xs text-white/60 mt-1">
                  Lucro líquido de comissões disponível para o administrador sacar via Pix.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setTab("withdrawals");
                    setWithdrawSubTab("admin_wallet");
                  }}
                  className="px-6 py-3.5 rounded-2xl bg-[#0084ff] hover:bg-[#0066cc] text-white font-black text-sm flex items-center gap-2 shadow-lg shadow-[#0084ff]/30 transition"
                >
                  <ArrowDownToLine className="w-4 h-4" /> Sacar Saldo Admin (Pix)
                </button>
              </div>
            </div>

            {/* Separador de Custódia */}
            <div className="grid sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/10 text-xs">
              <div className="bg-white/[0.03] border border-white/10 p-3.5 rounded-xl">
                <p className="text-white/40 font-bold uppercase text-[10px]">Em Custódia dos Vendedores</p>
                <p className="text-lg font-black text-white mt-0.5">
                  R$ {state.totalSellerCustodyBalance.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-[10px] text-white/40 mt-1">
                  Pertence aos vendedores (não sacar no gateway).
                </p>
              </div>

              <div className="bg-white/[0.03] border border-white/10 p-3.5 rounded-xl">
                <p className="text-white/40 font-bold uppercase text-[10px]">Receita Total Arrecadada</p>
                <p className="text-lg font-black text-[#00c950] mt-0.5">
                  R$ {state.totalPlatformCommissionEarned.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-[10px] text-white/40 mt-1">
                  Total de taxas desde o início.
                </p>
              </div>

              <div className="bg-white/[0.03] border border-white/10 p-3.5 rounded-xl">
                <p className="text-white/40 font-bold uppercase text-[10px]">Volume Total de Vendas (GMV)</p>
                <p className="text-lg font-black text-white mt-0.5">
                  R$ {state.totalPlatformGrossSales.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-[10px] text-white/40 mt-1">
                  Total transacionado na plataforma.
                </p>
              </div>
            </div>
          </div>

          {/* Cards de Métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-border/40">
              <p className="text-xs text-muted-foreground uppercase font-bold">Total Produtos</p>
              <p className="text-2xl font-black text-foreground mt-1">{state.products.length}</p>
              <p className="text-xs text-primary font-semibold">{pendingProducts.length} pendentes</p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-border/40">
              <p className="text-xs text-muted-foreground uppercase font-bold">Vendas Concluídas</p>
              <p className="text-2xl font-black text-foreground mt-1">{state.purchases.length}</p>
              <p className="text-xs text-success font-semibold">
                {state.purchases.filter((p) => p.status === "paid" || p.status === "delivered").length} pagas
              </p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-border/40">
              <p className="text-xs text-muted-foreground uppercase font-bold">Saques Pendentes</p>
              <p className="text-2xl font-black text-foreground mt-1">{pendingWithdrawals.length}</p>
              <p className="text-xs text-[#ffbd2e] font-semibold">{state.withdrawals.length} no total</p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-border/40">
              <p className="text-xs text-muted-foreground uppercase font-bold">Disputas</p>
              <p className="text-2xl font-black text-foreground mt-1">{disputes.length}</p>
              <p className="text-xs text-destructive font-semibold">
                {disputes.length > 0 ? "Atenção necessária" : "Tudo resolvido"}
              </p>
            </div>
          </div>

          {/* Ações Rápidas */}
          <div className="glass-card p-6 rounded-2xl border border-border/40 space-y-3">
            <h3 className="font-bold text-foreground">Ações Rápidas</h3>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => {
                  setTab("withdrawals");
                  setWithdrawSubTab("admin_wallet");
                }}
                className="bg-[#0084ff] text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Wallet className="w-3.5 h-3.5" /> Sacar Taxas Admin
              </button>
              <button
                onClick={() => {
                  setTab("withdrawals");
                  setWithdrawSubTab("sellers");
                }}
                className="bg-[#00c950] text-black px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow"
              >
                <MoneyEmoji className="w-3.5 h-3.5" /> Pagar Saques ({pendingWithdrawals.length})
              </button>
              <button
                onClick={() => setTab("products")}
                className="bg-card border border-border/40 text-foreground px-4 py-2.5 rounded-xl text-xs font-bold"
              >
                Aprovar Anúncios ({pendingProducts.length})
              </button>
              <button
                onClick={() => setTab("disputes")}
                className="bg-destructive/10 text-destructive border border-destructive/20 px-4 py-2.5 rounded-xl text-xs font-bold"
              >
                Disputas ({disputes.length})
              </button>
              <button
                onClick={() => setTab("security")}
                className="bg-card border border-border/40 text-foreground px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Google Authenticator 2FA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WITHDRAWALS & ADMIN WALLET TAB */}
      {tab === "withdrawals" && (
        <div className="space-y-6">
          {/* Sub-tabs for Withdrawals */}
          <div className="flex gap-2 p-1.5 bg-muted/60 rounded-2xl border border-border/40 w-fit">
            <button
              onClick={() => setWithdrawSubTab("sellers")}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                withdrawSubTab === "sellers" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-4 h-4" /> Saques de Vendedores
              {pendingWithdrawals.length > 0 && (
                <span className="bg-destructive text-white px-2 py-0.5 rounded-full text-[10px] font-black">
                  {pendingWithdrawals.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setWithdrawSubTab("admin_wallet")}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                withdrawSubTab === "admin_wallet" ? "bg-[#0084ff] text-white shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Wallet className="w-4 h-4" /> Carteira & Saque Admin (Taxas)
            </button>
          </div>

          {/* SUB-TAB: ADMIN WALLET & WITHDRAW */}
          {withdrawSubTab === "admin_wallet" && (
            <div className="space-y-6">
              {/* Carteira Card */}
              <div className="glass-card p-6 sm:p-8 rounded-3xl border-2 border-[#0084ff]/30 bg-gradient-to-b from-[#0c1a2e] to-[#0a0a0f]">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0084ff] mb-2">
                  <Wallet className="w-4 h-4" /> Carteira de Lucros da Plataforma
                </div>
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-3xl sm:text-4xl font-black text-white">
                      R$ {state.adminFeeBalance.toFixed(2).replace(".", ",")}
                    </h3>
                    <p className="text-xs text-white/50 mt-1">Saldo acumulado das taxas de comissão ({state.config.commission}% por venda).</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold bg-[#0084ff]/20 text-[#0084ff] border border-[#0084ff]/30 px-3 py-1.5 rounded-full">
                      Saque Mínimo: R$ {minWithdraw.toFixed(2).replace(".", ",")} · Taxa Pix: R$ {withdrawFee.toFixed(2).replace(".", ",")}
                    </span>
                  </div>
                </div>

                {/* Explicação de Custódia */}
                <div className="grid sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/10 text-xs">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <p className="font-bold text-white flex items-center gap-1.5 text-sm">
                      <ShieldCheck className="w-4 h-4 text-[#00c950]" /> Dinheiro em Custódia dos Vendedores
                    </p>
                    <p className="text-2xl font-black text-white mt-1">
                      R$ {state.totalSellerCustodyBalance.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-[11px] text-white/50 mt-2 leading-relaxed">
                      Este montante é a soma do saldo de todos os vendedores do site. Fica seguro na conta do gateway e só é pago quando cada vendedor solicitar o saque.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
                    <p className="font-bold text-white flex items-center gap-1.5 text-sm">
                      <TrendingUp className="w-4 h-4 text-[#0084ff]" /> Total Arrecadado em Comissões
                    </p>
                    <p className="text-2xl font-black text-[#00c950] mt-1">
                      R$ {state.totalPlatformCommissionEarned.toFixed(2).replace(".", ",")}
                    </p>
                    <p className="text-[11px] text-white/50 mt-2 leading-relaxed">
                      Total histórico bruto de comissões cobradas sobre R$ {state.totalPlatformGrossSales.toFixed(2).replace(".", ",")} em vendas finalizadas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Formulário de Saque do Admin */}
              <div className="glass-card p-6 sm:p-8 rounded-3xl border border-border/40 space-y-4">
                <h4 className="font-black text-lg text-foreground flex items-center gap-2">
                  <ArrowDownToLine className="w-5 h-5 text-primary" /> Solicitar Saque do Saldo Admin (Pix)
                </h4>
                <p className="text-xs text-muted-foreground">
                  Transfira as comissões acumuladas diretamente para sua conta bancária via Pix.
                </p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                      Valor a Sacar (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                        R$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min={minWithdraw}
                        max={state.adminFeeBalance}
                        value={adminWithdrawAmount}
                        onChange={(e) => setAdminWithdrawAmount(e.target.value)}
                        placeholder={state.adminFeeBalance >= minWithdraw ? state.adminFeeBalance.toFixed(2) : "0,00"}
                        className="w-full pl-10 pr-20 py-3.5 rounded-xl bg-muted border border-border/40 text-foreground font-bold text-base focus:ring-2 focus:ring-primary outline-none"
                      />
                      {state.adminFeeBalance >= minWithdraw && (
                        <button
                          type="button"
                          onClick={() => setAdminWithdrawAmount(state.adminFeeBalance.toFixed(2))}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-black bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition"
                        >
                          Tudo
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                      Chave Pix do Admin
                    </label>
                    <input
                      type="text"
                      value={adminPixKey}
                      onChange={(e) => setAdminPixKey(e.target.value)}
                      placeholder="CPF, e-mail, telefone ou chave aleatória"
                      className="w-full px-4 py-3.5 rounded-xl bg-muted border border-border/40 text-foreground font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                {/* Resumo do Saque */}
                {(() => {
                  const amt = adminWithdrawAmount ? parseFloat(adminWithdrawAmount) : state.adminFeeBalance;
                  const valid = !isNaN(amt) && amt >= minWithdraw && amt <= state.adminFeeBalance;
                  const net = valid ? Math.max(0, amt - withdrawFee) : 0;
                  return (
                    <div className="rounded-xl bg-muted/60 p-4 border border-border/30 space-y-2 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Valor Solicitado das Taxas:</span>
                        <span className="font-bold text-foreground">
                          R$ {(valid ? amt : (state.adminFeeBalance >= minWithdraw ? state.adminFeeBalance : 0)).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Taxa de transferência Pix:</span>
                        <span className="font-bold text-destructive">
                          - R$ {withdrawFee.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-border/30 flex justify-between text-sm font-black">
                        <span className="text-foreground">Valor Líquido a Receber no Pix:</span>
                        <span className="text-success text-base">
                          R$ {net.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <button
                  onClick={handleAdminWithdraw}
                  disabled={adminWithdrawBusy || state.adminFeeBalance < minWithdraw || !adminPixKey.trim()}
                  className="w-full py-4 rounded-xl bg-[#0084ff] hover:bg-[#0066cc] text-white font-black text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-[#0084ff]/25"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  {adminWithdrawBusy ? "Processando Saque..." : "Sacar Taxas do Admin via Pix"}
                </button>
              </div>

              {/* Histórico de Saques do Admin */}
              <div className="glass-card p-6 rounded-3xl border border-border/40 space-y-3">
                <h4 className="font-black text-foreground">Histórico de Saques do Admin ({adminFeeWithdrawals.length})</h4>
                {adminFeeWithdrawals.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center italic">
                    Nenhum saque de taxas realizado ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {adminFeeWithdrawals.map((w) => (
                      <div key={w.id} className="p-4 rounded-xl bg-muted/60 border border-border/30 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-black text-foreground">
                            R$ {w.amount.toFixed(2).replace(".", ",")}
                            <span className="text-xs font-normal text-muted-foreground ml-2">
                              (Líquido: R$ {(w.netAmount || (w.amount - withdrawFee)).toFixed(2).replace(".", ",")})
                            </span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(w.createdAt).toLocaleString("pt-BR")} · Pix: <span className="font-mono">{w.pixKey}</span>
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                            w.status === "approved"
                              ? "bg-success/15 text-success"
                              : w.status === "rejected"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-[#ffbd2e]/15 text-[#ffbd2e]"
                          }`}
                        >
                          {w.status === "approved" ? "Pago" : w.status === "rejected" ? "Recusado" : "Pendente"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUB-TAB: SELLERS WITHDRAWALS */}
          {withdrawSubTab === "sellers" && (
            <div className="space-y-4">
              <h3 className="font-bold text-foreground">
                Solicitações de Saque de Vendedores ({pendingWithdrawals.length})
              </h3>
              {pendingWithdrawals.length === 0 ? (
                <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
                  <p className="text-muted-foreground">Nenhuma solicitação de saque de vendedor pendente.</p>
                </div>
              ) : (
                pendingWithdrawals.map((w) => (
                  <div key={w.id} className="glass-card p-5 rounded-2xl flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase">{w.method === "instant" ? "Saque Instantâneo" : "Saque Normal"}</p>
                      <p className="text-xl font-black text-foreground">
                        R$ {w.amount.toFixed(2).replace(".", ",")}
                        <span className="text-xs font-normal text-muted-foreground ml-2">
                          (Líquido a pagar: R$ {(w.netAmount || (w.amount - withdrawFee)).toFixed(2).replace(".", ",")})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Usuário: {w.userEmail}</p>
                      <p className="text-[11px] text-foreground mt-1">
                        Chave Pix: <span className="font-mono font-bold text-primary">{w.pixKey || "—"}</span>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const tid = toast.loading("Processando pagamento via Pix...");
                          try {
                            await approveWithdraw(w.id);
                            toast.success("Saque aprovado e enviado via Pix!", { id: tid });
                          } catch (err: any) {
                            toast.error("Erro ao processar saque: " + (err?.message || "Tente novamente."), { id: tid });
                          }
                        }}
                        className="px-4 py-2.5 bg-success hover:bg-success/90 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition"
                      >
                        <Check className="w-4 h-4" /> Aprovar & Pagar Pix
                      </button>
                      <button
                        onClick={async () => {
                          const reason = window.prompt("Motivo da recusa (o vendedor verá esta mensagem):", "");
                          if (reason === null) return;
                          try {
                            await rejectWithdraw(w.id, reason);
                            toast.error("Saque recusado.");
                          } catch (err: any) {
                            toast.error(err?.message || "Erro ao recusar o saque.");
                          }
                        }}
                        className="px-4 py-2.5 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl text-xs font-bold flex items-center gap-1.5 transition"
                      >
                        <X className="w-4 h-4" /> Recusar
                      </button>
                    </div>
                  </div>
                ))
              )}

              <h3 className="font-bold text-foreground pt-4">Histórico de Saques de Vendedores</h3>
              {sellerWithdrawals.filter((w) => w.status !== "pending").length === 0 ? (
                <div className="bg-card rounded-3xl p-6 text-center border-2 border-dashed border-border">
                  <p className="text-sm text-muted-foreground">Nenhum saque processado ainda.</p>
                </div>
              ) : (
                sellerWithdrawals
                  .filter((w) => w.status !== "pending")
                  .map((w) => (
                    <div key={w.id} className="glass-card p-4 rounded-xl flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          R$ {w.amount.toFixed(2).replace(".", ",")} · {w.userEmail}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(w.createdAt).toLocaleString("pt-BR")}
                          {w.retryOf ? ` · reenvio do #${w.retryOf}` : ""} · Pix: {w.pixKey}
                        </p>
                        {w.status === "rejected" && w.rejectionReason && (
                          <p className="text-[11px] text-destructive mt-1">Motivo: {w.rejectionReason}</p>
                        )}
                        {w.status === "approved" && w.providerTxId && (
                          <p className="text-[11px] text-muted-foreground font-mono mt-1">TX: {w.providerTxId}</p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg ${
                          w.status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {w.status === "approved" ? "Pago" : "Recusado"}
                      </span>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      )}

      {/* PRODUCTS TAB */}
      {tab === "products" && (
        <div className="space-y-4">
          <h3 className="font-bold text-foreground">Produtos Pendentes ({pendingProducts.length})</h3>
          {pendingProducts.length === 0 ? (
            <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
              <p className="text-muted-foreground">Nenhum produto aguardando aprovação.</p>
            </div>
          ) : (
            pendingProducts.map((p) => (
              <div key={p.id} className="glass-card p-5 flex items-center gap-5">
                <img src={p.image} className="w-16 h-16 rounded-xl object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-foreground truncate">{p.name}</h4>
                  <p className="text-xs text-muted-foreground">Vendedor: {p.seller} ({p.sellerEmail})</p>
                  <p className="text-sm font-black text-primary mt-1">R$ {p.price.toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => { const ok = await approveProduct(p.id); ok ? toast.success("Produto aprovado!") : toast.error("Falha ao aprovar."); }} className="p-3 bg-success/10 text-success rounded-xl hover:bg-success/20 transition"><Check className="w-5 h-5" /></button>
                  <button onClick={async () => { const ok = await rejectProduct(p.id); ok ? toast.error("Produto rejeitado.") : toast.error("Falha ao rejeitar."); }} className="p-3 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition"><X className="w-5 h-5" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* SECURITY / 2FA TAB */}
      {tab === "security" && (
        <div className="space-y-6 max-w-2xl">
          <div className="glass-card p-6 border border-white/10 bg-[#0a0a0f] rounded-2xl">
            <h3 className="font-black text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-success" /> Autenticação Google Authenticator (2FA)
            </h3>
            <p className="text-xs text-white/60 mt-2 leading-relaxed">
              Exija o código de 6 dígitos gerado pelo Google Authenticator para proteger a entrada no painel de administração. Você só precisa digitar o código ao fazer login na conta; durante a navegação seu acesso permanece desbloqueado.
            </p>
          </div>
          <TwoFactorPanel />
        </div>
      )}

      {/* DISPUTES TAB */}
      {tab === "disputes" && (
        <div className="space-y-4">
          <h3 className="font-bold text-foreground">Disputas em Aberto ({disputes.length})</h3>
          {disputes.length === 0 ? (
            <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
              <p className="text-muted-foreground">Nenhuma disputa ativa.</p>
            </div>
          ) : (
            disputes.map((d) => {
              const prod = state.products.find((p) => p.id === d.productId);
              return (
                <div key={d.id} className="glass-card p-5 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-foreground">{prod?.name}</h4>
                      <p className="text-xs text-muted-foreground">Comprador: {d.buyerEmail}</p>
                      <p className="text-xs text-muted-foreground">Vendedor: {d.sellerEmail}</p>
                    </div>
                    <span className="bg-destructive/10 text-destructive text-[10px] font-bold px-2 py-1 rounded-full uppercase">Disputa</span>
                  </div>
                  <div className="bg-muted p-3 rounded-xl">
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Última Mensagem:</p>
                    <p className="text-sm text-foreground italic">"{d.messages[d.messages.length - 1]?.text || "Sem mensagens"}"</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setSelectedDisputeId(d.id)} className="flex-1 min-w-[120px] py-2 bg-primary/10 text-primary text-xs font-bold rounded-xl">Entrar no Chat</button>
                    <button onClick={() => { approvePurchase(d.id); toast.success("Disputa resolvida para o vendedor."); }} className="flex-1 min-w-[120px] py-2 bg-success/10 text-success text-xs font-bold rounded-xl">Resolver p/ Vendedor</button>
                    <button onClick={() => { revertPurchase(d.id); toast.success("Compra revertida para análise."); }} className="flex-1 min-w-[120px] py-2 bg-destructive/10 text-destructive text-xs font-bold rounded-xl">Reembolsar Comprador</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VERIFICATIONS (KYC) TAB */}
      {tab === "verifications" && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">Verificação de Identidade (KYC)</h3>
            <button onClick={loadKyc} className="text-xs font-bold text-primary flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Atualizar
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Confira a selfie com documento e papel ZXMAX.</p>
          {kycLoading ? (
            <p className="text-center text-xs text-muted-foreground py-10">Carregando...</p>
          ) : kyc.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">Nenhuma verificação pendente.</p>
          ) : (
            <div className="space-y-4">
              {kyc.map((k) => (
                <div key={k.user_id} className="p-4 bg-muted rounded-xl border border-border/40">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{k.full_name || k.display_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">ID: {k.public_id} · {k.email}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${k.verification_status === "approved" ? "bg-success/10 text-success" : k.verification_status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                      {k.verification_status}
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-1 text-[11px] text-muted-foreground mb-3">
                    <p>CPF: <span className="text-foreground">{k.cpf || "—"}</span></p>
                    <p>Nascimento: <span className="text-foreground">{k.birth_date || "—"}</span></p>
                    <p>Telefone: <span className="text-foreground">{k.phone || "—"}</span></p>
                    <p>Cidade/UF: <span className="text-foreground">{[k.city, k.state].filter(Boolean).join("/") || "—"}</span></p>
                  </div>
                  {k.verification_status === "pending" && (
                    <input
                      value={kycNotes[k.user_id] || ""}
                      onChange={(e) => setKycNotes((n) => ({ ...n, [k.user_id]: e.target.value }))}
                      placeholder="Motivo (caso recuse)"
                      className="w-full p-2.5 mb-3 rounded-lg bg-card border border-border/40 text-xs text-foreground outline-none focus:ring-2 ring-primary"
                    />
                  )}
                  <div className="flex gap-2 flex-wrap">
                    {k.verification_selfie_path && (
                      <button onClick={() => openDocument(k.verification_selfie_path)} className="px-3 py-2 bg-card text-foreground text-xs font-bold rounded-lg flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Ver foto
                      </button>
                    )}
                    <button onClick={() => reviewKyc(k.user_id, true)} className="px-3 py-2 bg-success text-white text-xs font-bold rounded-lg">Aprovar</button>
                    <button onClick={() => reviewKyc(k.user_id, false)} className="px-3 py-2 bg-destructive/10 text-destructive text-xs font-bold rounded-lg">Recusar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {tab === "documents" && (
        <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Verificação de Documentos</h3>
            <button onClick={loadDocs} className="text-xs font-bold text-[#0084ff] flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Atualizar</button>
          </div>
          <p className="text-sm text-white/40 mb-6">Aprove documentos de vendedores para liberar saques.</p>
          <div className="space-y-4">
            {(docs.length === 0 && (state.sellerDocuments || []).length === 0) ? (
              <p className="text-center text-xs text-white/40 py-10">Nenhum documento enviado ainda.</p>
            ) : (docs.length > 0 ? docs : state.sellerDocuments || []).map((doc: any) => (
              <div key={doc.id} className="p-4 bg-muted rounded-xl border border-border/40">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{doc.userEmail || "Usuário"}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">ID: {doc.userPublicId || doc.user_public_id || ""}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{doc.fileName}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${doc.status === "approved" ? "bg-success/10 text-success" : doc.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{doc.status}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openDocument(doc.file_path || doc.filePath || "")} className="px-3 py-2 bg-card text-foreground text-xs font-bold rounded-lg flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Abrir</button>
                  <button onClick={async () => { 
                    const tid = toast.loading("Aprovando...");
                    try {
                      const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "verify_user", userId: doc.user_id, documentId: doc.id } });
                      if (error || data?.error) throw new Error(data?.error || error?.message);
                      reviewSellerDocument(doc.id, "approved");
                      toast.success("Documento aprovado!", { id: tid });
                      void loadDocs();
                    } catch (e: any) {
                      reviewSellerDocument(doc.id, "approved");
                      const ok = await verifyUser(doc.user_id);
                      if (ok) toast.success("Aprovado!", { id: tid });
                      else toast.error("Erro ao verificar: " + (e?.message || "tente novamente"), { id: tid });
                    }
                  }} className="px-3 py-2 bg-[#00c950] text-white text-xs font-bold rounded-lg">Aprovar</button>
                  <button onClick={() => { reviewSellerDocument(doc.id, "rejected"); toast.error("Documento rejeitado."); }} className="px-3 py-2 bg-destructive/10 text-destructive text-xs font-bold rounded-lg">Rejeitar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NOTICES TAB */}
      {tab === "notices" && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold text-foreground mb-4">Publicar Novo Aviso</h3>
            <textarea
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              placeholder="Digite o texto do aviso global..."
              className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-sm text-foreground mb-4"
              rows={3}
            />
            <button 
              onClick={() => { publishNotice(notice); setNotice(""); toast.success("Aviso publicado!"); }} 
              className="btn-gradient px-6 py-3 rounded-xl font-bold text-sm w-full sm:w-auto"
            >
              Publicar Aviso
            </button>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-foreground px-1">Avisos Ativos ({globalNotices.length})</h3>
            {globalNotices.length === 0 ? (
              <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
                <p className="text-muted-foreground">Nenhum aviso publicado.</p>
              </div>
            ) : (
              globalNotices.map((n) => (
                <div key={n.id} className="glass-card p-4 flex justify-between items-center">
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="text-sm text-foreground">{n.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.date).toLocaleString()}</p>
                  </div>
                  <button onClick={() => { deleteNotice(n.id); toast.error("Aviso removido."); }} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ADMIN CHAT TAB */}
      {tab === "adminchat" && (
        <div className="glass-card flex flex-col h-[60vh]">
          <div className="p-4 border-b border-border/40 bg-muted/30">
            <h3 className="font-bold text-foreground">Chat da Equipe</h3>
            <p className="text-[10px] text-muted-foreground uppercase">Apenas administradores podem ver</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {adminMessages.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm italic">Nenhuma mensagem ainda.</p>
            ) : (
              adminMessages.map((m, i) => (
                <div key={i} className={`flex ${m.from === state.currentUser?.email ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${m.from === state.currentUser?.email ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                    <p className="text-[9px] font-bold mb-1 opacity-70 uppercase">{m.from}</p>
                    <p>{m.text}</p>
                    <p className="text-[8px] mt-1 opacity-50 text-right">{new Date(m.date).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-border/40 bg-card">
            <div className="flex gap-2">
              <input 
                value={chatMsg} 
                onChange={(e) => setChatMsg(e.target.value)} 
                onKeyDown={(e) => e.key === "Enter" && (sendAdminChat(state.currentUser!.email, chatMsg), setChatMsg(""))}
                placeholder="Sua mensagem para a equipe..." 
                className="flex-1 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" 
              />
              <button 
                onClick={() => { sendAdminChat(state.currentUser!.email, chatMsg); setChatMsg(""); }} 
                className="btn-gradient p-3 rounded-xl"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEBHOOKS TAB */}
      {tab === "webhooks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Eventos do Webhook EvoPay</h3>
              <p className="text-xs text-muted-foreground">Últimos 100 eventos recebidos e cobranças geradas.</p>
            </div>
            <button onClick={() => loadWebhookLogs()} className="shrink-0 p-2.5 rounded-xl bg-card border border-border/40 text-muted-foreground hover:text-foreground transition">
              <RefreshCw className={`w-4 h-4 ${logsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="glass-card p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-1">URL do Webhook (cole no painel EvoPay)</p>
            <input readOnly value={state.config.evopayWebhookUrl} onClick={(e) => (e.target as HTMLInputElement).select()} className="w-full p-3 rounded-xl bg-muted text-xs text-foreground font-mono select-all" />
          </div>

          {logsLoading ? (
            <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
              <p className="text-muted-foreground">Carregando eventos...</p>
            </div>
          ) : webhookLogs.length === 0 ? (
            <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
              <p className="text-muted-foreground">Nenhum evento recebido ainda.</p>
            </div>
          ) : (
            webhookLogs.map((log) => {
              const isError = log.status === "error" || (log.status || "").startsWith("error") || !!log.error;
              return (
                <div key={log.id} className="glass-card p-4">
                  <button onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="w-full flex items-center gap-3 text-left">
                    <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${isError ? "bg-destructive" : log.status === "created" ? "bg-primary" : "bg-success"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-sm truncate">
                        {log.event_type || "EVENTO"} <span className="text-muted-foreground font-normal">— {log.status}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()} {log.order_id ? `• Pedido #${log.order_id}` : ""} {log.charge_id ? `• Cobrança ${log.charge_id}` : ""}
                      </p>
                    </div>
                  </button>
                  {log.error && (
                    <p className="text-xs text-destructive mt-2 bg-destructive/10 p-2 rounded-lg break-words">{log.error}</p>
                  )}
                  {expandedLog === log.id && (
                    <pre className="mt-3 text-[10px] text-foreground bg-muted p-3 rounded-xl overflow-x-auto max-h-72">{JSON.stringify(log.payload, null, 2)}</pre>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CONFIG TAB */}
      {tab === "config" && (
        <div className="space-y-6">
          {/* Taxas */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-foreground">Taxas e Limites da Plataforma</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Comissão Geral (%)</label>
                <input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-bold" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Taxa Saque Instantâneo (%)</label>
                <input type="number" value={instantFee} onChange={(e) => setInstantFee(Number(e.target.value))} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-bold" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Saque Mínimo (R$)</label>
                <input type="number" step="0.50" value={minWithdrawConfig} onChange={(e) => setMinWithdrawConfig(Number(e.target.value))} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-bold" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Taxa Fixa Saque Pix (R$)</label>
                <input type="number" step="0.10" value={withdrawFeeConfig} onChange={(e) => setWithdrawFeeConfig(Number(e.target.value))} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-bold" />
              </div>
            </div>
          </div>

          {/* EvoPay */}
          <div className="glass-card p-6 space-y-4 border-2 border-primary/20">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-foreground">Credenciais EvoPay (PIX) <span className="text-[10px] text-primary">• Gateway ativo</span></h3>
              <div className="flex gap-1 bg-muted rounded-xl p-1">
                <button onClick={() => setEvopayMode("automatic")} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${evopayMode === "automatic" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Automático</button>
                <button onClick={() => setEvopayMode("manual")} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${evopayMode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Manual</button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Webhook URL (cole no painel EvoPay)</label>
              <input readOnly value={state.config.evopayWebhookUrl} onClick={(e) => { (e.target as HTMLInputElement).select(); }} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-mono select-all" />
            </div>
            {evopayMode === "manual" ? (
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">API Key</label>
                <input type="password" value={evopayApiKey} onChange={(e) => setEvopayApiKey(e.target.value)} placeholder={state.config.evopayApiKey ? "•••••••• (já configurada — preencha para alterar)" : "Cole sua API Key da EvoPay"} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-mono" />
                <p className="text-[10px] text-muted-foreground mt-1">A chave é guardada com segurança no servidor e usada para gerar cobranças e saques.</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Usando a API Key padrão configurada nos secrets do backend (EVOPAY_API_KEY).</p>
            )}
          </div>

          {/* Regras */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-foreground">Regras da Plataforma</h3>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-sm text-foreground font-mono"
              rows={8}
            />
          </div>

          <button onClick={handleSaveConfig} className="btn-gradient w-full py-3.5 rounded-xl font-bold sticky bottom-4">Salvar Todas as Configurações</button>
        </div>
      )}

      {/* OTHER PANELS */}
      {tab === "apis" && <IntegrationsPanel />}
      {tab === "catalog" && <AdminAllProductsPanel />}
      {tab === "purchases" && <AdminPurchasesPanel />}
      {tab === "categories" && <AdminCategoriesPanel />}
      {tab === "tickets" && <AdminTicketsPanel />}
      {tab === "tags" && <AdminTagsPanel />}
      {tab === "platform" && <AdminPlatformPanel />}

      {tab === "roles" && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
            <h3 className="font-black text-white flex items-center gap-2"><Users className="w-5 h-5 text-[#0084ff]" /> Cargos e Permissões</h3>
            <p className="text-xs text-white/50 mt-2">Dê acesso admin por e-mail e gerencie administradores.</p>
          </div>

          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6 space-y-4">
            <h4 className="font-bold text-white">Dar cargo por e-mail</h4>
            <div className="grid gap-3">
              <input id="role-email" placeholder="E-mail do usuário" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none" />
              <select id="role-select" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm">
                <option value="admin">Admin (total)</option>
                <option value="moderator">Moderador (produtos + disputas)</option>
                <option value="support">Suporte (chat)</option>
                <option value="finance">Financeiro (saques)</option>
              </select>
              <button
                onClick={async () => {
                  const emailInput = document.getElementById("role-email") as HTMLInputElement;
                  const roleSelect = document.getElementById("role-select") as HTMLSelectElement;
                  const email = emailInput?.value?.trim();
                  const role = roleSelect?.value;
                  if (!email) return toast.error("Digite e-mail");
                  const { data: prof } = await supabase.from("profiles").select("user_id").eq("email", email).maybeSingle();
                  if (!prof?.user_id) return toast.error("Usuário não encontrado");
                  const { error } = await supabase.from("user_roles").upsert({ user_id: prof.user_id, role: role as any }, { onConflict: "user_id,role" });
                  if (error) return toast.error(error.message);
                  toast.success(`Cargo ${role} dado para ${email}`);
                  emailInput.value = "";
                }}
                className="bg-[#0084ff] text-white px-6 py-3 rounded-xl font-bold text-sm"
              >
                Dar acesso
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-bold text-foreground mb-4">Gerenciar Usuários</h3>
          <div className="grid gap-2">
            <input value={banIdentifier} onChange={(e) => setBanIdentifier(e.target.value)} placeholder="ID numérico do usuário" className="w-full p-3 rounded-xl bg-muted border-none text-sm text-foreground" />
            <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Motivo do banimento" rows={3} className="w-full p-3 rounded-xl bg-muted border-none text-sm text-foreground resize-none" />
            <button onClick={handleBan} className="bg-destructive text-white px-4 py-3 rounded-xl text-xs font-bold">Banir Usuário</button>
          </div>
        </div>
      )}
    </div>
  );
}
