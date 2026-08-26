import React, { useState, useEffect } from "react";
import { useStore, Product, Withdrawal, Purchase } from "@/store/StoreContext";
import { MoneyEmoji, PackageEmoji, ChatEmoji, StarEmoji, ShieldEmoji } from "@/components/CustomEmojis";
import { X, Check, Send, User, Trash2, ShieldAlert, FileText, Settings, Users, Tag, ArrowLeft, ExternalLink, Eye, Webhook, RefreshCw, KeyRound, ShieldCheck, Lock, BarChart3, ShoppingBag, Ban, Wrench, Wrench as MaintenanceIcon } from "lucide-react";
import { toast } from "sonner";
import MyPurchasesView from "@/components/MyPurchasesView";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import TwoFactorPanel from "@/components/TwoFactorPanel";
import { AdminTagsPanel } from "@/components/AdminMorePanels";
import {
  AdminStatsPanel,
  AdminPurchasesPanel,
  AdminModerationPanel,
  AdminToolsPanel,
  AdminSessionPanel,
} from "@/components/AdminExtraPanels";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { formatBRL, isValidProductPrice, parsePriceInput } from "@/lib/catalog";

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

export const ADMIN_TABS = [
  "dashboard", "stats", "orders", "moderation", "tools", "products", "withdrawals",
  "notices", "users", "tags", "adminchat", "documents", "verifications", "disputes",
  "config", "webhooks", "apis", "security", "roles",
] as const;
export type AdminTab = (typeof ADMIN_TABS)[number];

export default function AdminView() {
  const { state, approveProduct, rejectProduct, approveWithdraw, rejectWithdraw, approvePurchase, revertPurchase, banUser, unbanUser, updateConfig, publishNotice, deleteNotice, sendAdminChat, verifyUser } = useStore();
  const { mfaEnabled, isAdmin } = useAuth();
  // The active section lives in the URL so the side menu can deep-link to a
  // real admin area (?tab=products) and the browser back button works.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (ADMIN_TABS.includes(searchParams.get("tab") as AdminTab) ? searchParams.get("tab") : "dashboard") as AdminTab;
  const setTab = React.useCallback((next: AdminTab) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next === "dashboard") params.delete("tab"); else params.set("tab", next);
      return params;
    }, { replace: true });
  }, [setSearchParams]);
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
  const [banIdentifier, setBanIdentifier] = useState("");
  const [banReason, setBanReason] = useState("");
  const [selectedDisputeId, setSelectedDisputeId] = useState<number | null>(null);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformSaving, setPlatformSaving] = useState(false);
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [minProductPrice, setMinProductPrice] = useState("2,00");
  const [minWithdraw, setMinWithdraw] = useState("5,00");

  const pendingProducts = state.products.filter((p) => !p.approved);
  const pendingWithdrawals = state.withdrawals.filter((w) => w.status === "pending");
  const adminMessages = state.adminChat || [];
  const globalNotices = state.globalNotices || [];
  const disputes = state.purchases.filter(p => p.status === "dispute");
  const pendingDocuments = (state.sellerDocuments || []).filter(d => d.status === "pending");

  const handleSaveConfig = async () => {
    updateConfig({
      rules, commission, instantFee,
    });
    toast.success("Preferências locais atualizadas. Pagamentos e OAuth são administrados na aba APIs & Credenciais.");
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
    if (!path || typeof path !== 'string') {
      toast.error("Caminho do documento inválido");
      return;
    }
    // Sanitize path
    const cleanPath = path.trim();
    if (!cleanPath) {
      toast.error("Documento sem arquivo");
      return;
    }
    try {
      // Try via admin-verify edge function (service role) - bypass RLS
      const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "get_document_url", filePath: cleanPath } });
      if (!error && data?.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (error) console.error("admin-verify get_document_url error", error);
    } catch (e) {
      console.error("admin-verify failed", e);
    }
    toast.error("Não foi possível abrir o documento no momento.");
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
    const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "get_verifications" } });
    setKycLoading(false);
    if (error) return toast.error("Não foi possível carregar as verificações.");
    setKyc(data?.verifications || []);
  };

  const reviewKyc = async (userId: string, approved: boolean) => {
    const tid = toast.loading(approved ? "Aprovando..." : "Recusando...");
    try {
      if (approved) {
        const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "verify_user", userId } });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Falha");
        toast.success("Usuário verificado!", { id: tid });
      } else {
        const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "reject_user", userId, notes: kycNotes[userId]?.trim() || "Documentos ilegíveis" } });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Falha");
        toast.success("Verificação recusada.", { id: tid });
      }
    } catch (e: any) {
      toast.error("Falha ao revisar a verificação. Nenhuma alteração foi aplicada.", { id: tid });
    }
    await loadKyc();
  };

  const reviewDocument = async (doc: any, approved: boolean) => {
    const tid = toast.loading(approved ? "Aprovando documento..." : "Recusando documento...");
    try {
      const { data, error } = await supabase.functions.invoke("admin-verify", {
        body: {
          action: approved ? "verify_user" : "reject_user",
          userId: doc.user_id,
          documentId: doc.id,
          ...(approved ? {} : { notes: "Documento recusado pela revisão administrativa" }),
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Falha");
      toast.success(approved ? "Documento aprovado e vendedor verificado." : "Documento recusado.", { id: tid });
      await loadDocs();
      await loadKyc();
    } catch {
      toast.error("Falha ao revisar o documento. Nenhuma alteração foi aplicada.", { id: tid });
    }
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
    toast.error("Não foi possível carregar os documentos.");
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

  const loadPlatformSettings = React.useCallback(async () => {
    setPlatformLoading(true);
    const { data, error } = await (supabase as any).rpc("get_admin_platform_settings");
    setPlatformLoading(false);
    if (error) { toast.error("Não foi possível carregar as configurações da plataforma."); return; }
    setMaintenance(!!data?.maintenance);
    setMaintenanceMessage(String(data?.message || ""));
    setMinProductPrice(formatBRL(data?.minProductPrice ?? 2).replace("R$ ", ""));
    setMinWithdraw(formatBRL(data?.minWithdraw ?? 5).replace("R$ ", ""));
  }, []);

  useEffect(() => { if (tab === "config") void loadPlatformSettings(); }, [tab, loadPlatformSettings]);

  const savePlatformSettings = async () => {
    const parsedPrice = parsePriceInput(minProductPrice);
    const parsedWithdraw = parsePriceInput(minWithdraw);
    if (!isValidProductPrice(parsedPrice)) { toast.error("Use um preço mínimo entre R$ 2,00 e R$ 1.000.000,00."); return; }
    if (parsedWithdraw < 5 || parsedWithdraw > 1_000_000) { toast.error("Use um saque mínimo entre R$ 5,00 e R$ 1.000.000,00."); return; }
    setPlatformSaving(true);
    const { error } = await (supabase as any).rpc("update_platform_settings", {
      _maintenance: maintenance,
      _message: maintenanceMessage.trim(),
      _min_product_price: parsedPrice,
      _min_withdraw: parsedWithdraw,
    });
    setPlatformSaving(false);
    if (error) { toast.error(error.message || "Não foi possível salvar a plataforma."); return; }
    toast.success(maintenance ? "Modo manutenção ativado para visitantes." : "Plataforma reaberta para visitantes.");
  };

  if (selectedDisputeId) {
    return (
      <div className="animate-fade-in-up pb-20">
        <button onClick={() => setSelectedDisputeId(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar para disputas
        </button>
        <MyPurchasesView initialSelectedId={selectedDisputeId} />
      </div>
    );
  }


  return (
    <div className="animate-fade-in-up pb-20">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-foreground mb-2 flex items-center gap-3">
              Painel Admin
              {mfaEnabled ? <span className="inline-flex items-center gap-1.5 text-[11px] bg-success/15 text-success border border-success/20 px-3 py-1 rounded-full"><ShieldCheck className="w-3.5 h-3.5" /> 2FA Ativo</span> : <span className="inline-flex items-center gap-1.5 text-[11px] bg-destructive/15 text-destructive border border-destructive/20 px-3 py-1 rounded-full"><Lock className="w-3.5 h-3.5" /> 2FA Inativo</span>}
            </h1>
            <p className="text-muted-foreground">Gerenciamento global da plataforma. Acesso protegido.</p>
          </div>
        </div>
        {!mfaEnabled && (
          <div className="mt-6 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-5">
            <div className="flex gap-3">
              <div className="p-2.5 rounded-xl bg-destructive/15 text-destructive h-fit"><ShieldAlert className="w-5 h-5" /></div>
              <div className="flex-1">
                <p className="font-black text-foreground">Proteja seu painel admin com 2FA</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Administradores sem autenticador estão vulneráveis. Ative o Google Authenticator para exigir código de 6 dígitos ao logar no painel admin. O QR Code some após ativação e só o código é pedido no login.</p>
                <div className="mt-4"><TwoFactorPanel /></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {[
          { id: "dashboard", label: "Dashboard", icon: ShieldCheck },
          { id: "stats", label: "Estatísticas", icon: BarChart3 },
          { id: "orders", label: "Pedidos", icon: ShoppingBag },
          { id: "moderation", label: "Moderação", icon: Ban },
          { id: "tools", label: "Ferramentas", icon: Wrench },
          { id: "roles", label: "Cargos", icon: Users },
          { id: "tags", label: "Tags", icon: Tag },
          { id: "security", label: "Segurança 2FA", icon: ShieldCheck },
          { id: "products", label: "Produtos", icon: PackageEmoji, count: pendingProducts.length },
          { id: "withdrawals", label: "Saques", icon: MoneyEmoji, count: pendingWithdrawals.length },
          { id: "disputes", label: "Disputas", icon: ShieldAlert, count: disputes.length },
          { id: "documents", label: "Documentos", icon: FileText, count: pendingDocuments.length },
          { id: "verifications", label: "Verificações", icon: ShieldEmoji },
          { id: "users", label: "Usuários", icon: Users },
          { id: "notices", label: "Avisos", icon: StarEmoji },
          { id: "adminchat", label: "Chat Equipe", icon: ChatEmoji },
          { id: "webhooks", label: "Webhooks", icon: Webhook },
          { id: "apis", label: "APIs & Credenciais", icon: KeyRound },
          { id: "config", label: "Config", icon: Settings },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${tab === t.id ? "btn-gradient" : "bg-card border border-border/40 text-muted-foreground"}`}
          >
            {t.icon && <t.icon className="w-4 h-4" />}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {tab === "products" && <AdminProductModeration />}

      {/* Withdrawals Tab */}
      {tab === "withdrawals" && (
        <div className="space-y-4">
          <h3 className="font-bold text-foreground">Solicitações de Saque ({pendingWithdrawals.length})</h3>
          {pendingWithdrawals.length === 0 ? (
            <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
              <p className="text-muted-foreground">Nenhuma solicitação de saque pendente.</p>
            </div>
          ) : (
            pendingWithdrawals.map((w) => (
              <div key={w.id} className="glass-card p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">{w.method === "instant" ? "Saque Instantâneo" : "Saque Normal"}</p>
                  <p className="text-xl font-black text-foreground">R$ {w.amount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Usuário: {w.userEmail}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">ID: {w.userId}</p>
                  <p className="text-[11px] text-foreground mt-1">Chave Pix: <span className="font-mono">{w.pixKey || "—"}</span></p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const tid = toast.loading("Processando saque via PIX...");
                      try {
                        await approveWithdraw(w.id);
                        toast.success("Saque aprovado e enviado via PIX!", { id: tid });
                      } catch (err: any) {
                        toast.error("Erro ao processar saque: " + (err?.message || "Tente novamente."), { id: tid });
                      }
                    }}
                    className="p-3 bg-success/10 text-success rounded-xl hover:bg-success/20 transition"
                  ><Check className="w-5 h-5" /></button>
                  <button
                    onClick={async () => {
                      const reason = window.prompt("Motivo da recusa (o usuário verá esta mensagem e poderá reenviar):", "");
                      if (reason === null) return;
                      try {
                        await rejectWithdraw(w.id, reason);
                        toast.error("Saque recusado.");
                      } catch (err: any) {
                        toast.error(err?.message || "Erro ao recusar o saque.");
                      }
                    }}
                    className="p-3 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition"
                  ><X className="w-5 h-5" /></button>
                </div>
              </div>
            ))
          )}

          <h3 className="font-bold text-foreground pt-4">Histórico de saques</h3>
          {state.withdrawals.filter((w) => w.status !== "pending").length === 0 ? (
            <div className="bg-card rounded-3xl p-6 text-center border-2 border-dashed border-border">
              <p className="text-sm text-muted-foreground">Nenhum saque processado ainda.</p>
            </div>
          ) : (
            state.withdrawals
              .filter((w) => w.status !== "pending")
              .map((w) => (
                <div key={w.id} className="glass-card p-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">R$ {w.amount.toFixed(2)} · {w.userEmail}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(w.createdAt).toLocaleString("pt-BR")}
                      {w.retryOf ? ` · reenvio do #${w.retryOf}` : ""}
                    </p>
                    {w.status === "rejected" && w.rejectionReason && (
                      <p className="text-[11px] text-destructive mt-1">Motivo: {w.rejectionReason}</p>
                    )}
                    {w.status === "approved" && w.providerTxId && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-1">TX: {w.providerTxId}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg ${w.status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {w.status === "approved" ? "Pago" : "Recusado"}
                  </span>
                </div>
              ))
          )}
        </div>
      )}

      {/* Disputes Tab */}
      {tab === "disputes" && (
        <div className="space-y-4">
          <h3 className="font-bold text-foreground">Disputas em Aberto ({disputes.length})</h3>
          {disputes.length === 0 ? (
            <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
              <p className="text-muted-foreground">Nenhuma disputa ativa.</p>
            </div>
          ) : (
            disputes.map((d) => {
              const prod = state.products.find(p => p.id === d.productId);
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
                    <button onClick={() => { revertPurchase(d.id); toast.success("Compra voltou para pendente/reembolso manual."); }} className="flex-1 min-w-[120px] py-2 bg-destructive/10 text-destructive text-xs font-bold rounded-xl">Reembolsar Comprador</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Identity Verifications (KYC) Tab */}
      {tab === "verifications" && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">Verificação de identidade</h3>
            <button onClick={loadKyc} className="text-xs font-bold text-primary flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Atualizar
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-6">Confira se a foto mostra o rosto, o documento e o papel escrito ZXMAX, e se os dados batem.</p>
          {kycLoading ? (
            <p className="text-center text-xs text-muted-foreground py-10">Carregando...</p>
          ) : kyc.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-10">Nenhuma verificação enviada ainda.</p>
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

      {/* Documents Tab */}
      {tab === "documents" && (
        <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Verificação de Documentos</h3>
            <button onClick={loadDocs} className="text-xs font-bold text-[#0084ff] flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Atualizar</button>
          </div>
          <p className="text-sm text-white/40 mb-6">Aprove documentos para liberar saque. Se não aparece, verifique RLS e bucket.</p>
          <div className="space-y-4">
            {docs.length === 0 ? (
              <p className="text-center text-xs text-white/40 py-10">Nenhum documento enviado ainda.</p>
            ) : docs.map((doc: any) => (
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
                  <button onClick={() => void reviewDocument(doc, true)} className="px-3 py-2 bg-[#00c950] text-white text-xs font-bold rounded-lg">Aprovar</button>
                  <button onClick={() => void reviewDocument(doc, false)} className="px-3 py-2 bg-destructive/10 text-destructive text-xs font-bold rounded-lg">Rejeitar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notices Tab */}
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

      {/* Admin Chat Tab */}
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

      {/* Webhooks Tab */}
      {tab === "webhooks" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Eventos de webhook</h3>
              <p className="text-xs text-muted-foreground">Últimos 100 eventos recebidos dos gateways configurados. Use para depurar pagamentos sem expor URLs ou segredos.</p>
            </div>
            <button onClick={() => loadWebhookLogs()} className="shrink-0 p-2.5 rounded-xl bg-card border border-border/40 text-muted-foreground hover:text-foreground transition">
              <RefreshCw className={`w-4 h-4 ${logsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {logsLoading ? (
            <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
              <p className="text-muted-foreground">Carregando eventos...</p>
            </div>
          ) : webhookLogs.length === 0 ? (
            <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
              <p className="text-muted-foreground">Nenhum evento recebido ainda.</p>
              <p className="text-xs text-muted-foreground mt-2">Os eventos aparecem aqui automaticamente quando alguém gera um PIX ou paga uma compra.</p>
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



      {tab === "apis" && <IntegrationsPanel />}

      {tab === "tags" && <AdminTagsPanel />}

      {tab === "roles" && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
            <h3 className="font-black text-white flex items-center gap-2"><Users className="w-5 h-5 text-[#0084ff]" /> Cargos e Permissões</h3>
            <p className="text-xs text-white/50 mt-2">Conceda somente cargos existentes; a autorização e a auditoria são executadas no banco.</p>
          </div>

          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6 space-y-4">
            <h4 className="font-bold text-white">Dar cargo por e-mail</h4>
            <div className="grid gap-3">
              <input id="role-email" placeholder="E-mail do usuário" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm focus:border-[#0084ff] outline-none" />
              <select id="role-select" className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white text-sm">
                <option value="admin">Admin (total)</option>
                <option value="support">Suporte (chat)</option>
                <option value="user">Usuário padrão</option>
              </select>
              <button
                onClick={async () => {
                  const emailInput = document.getElementById('role-email') as HTMLInputElement;
                  const roleSelect = document.getElementById('role-select') as HTMLSelectElement;
                  const email = emailInput?.value?.trim();
                  const role = roleSelect?.value;
                  if (!email) return toast.error("Digite e-mail");
                  if (role !== "admin" && role !== "support" && role !== "user") return toast.error("Cargo inválido");
                  const { error } = await (supabase as any).rpc("assign_user_role", { _email: email, _role: role });
                  if (error) return toast.error(error.message);
                  toast.success("Cargo atualizado com auditoria.");
                  emailInput.value = "";
                }}
                className="bg-[#0084ff] text-white px-6 py-3 rounded-xl font-bold text-sm"
              >
                Dar acesso
              </button>
            </div>
          </div>

          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
            <h4 className="font-bold text-white mb-3">Usuários com acesso</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.values(state.userDirectory || {}).slice(0, 20).map((u: any) => (
                <div key={u.userId} className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e28]">
                  <div><p className="text-sm font-bold text-white truncate">{u.name}</p><p className="text-[11px] text-white/40 font-mono">{u.email} • ID {u.publicId}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5">
              <p className="text-xs text-white/40 uppercase font-bold">Total Produtos</p>
              <p className="text-2xl font-black text-white mt-1">{state.products.length}</p>
              <p className="text-xs text-white/30">{pendingProducts.length} pendentes</p>
            </div>
            <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5">
              <p className="text-xs text-white/40 uppercase font-bold">Vendas</p>
              <p className="text-2xl font-black text-white mt-1">{state.purchases.length}</p>
              <p className="text-xs text-[#00c950]">{state.purchases.filter(p=>p.status==='paid').length} pagas</p>
            </div>
            <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5">
              <p className="text-xs text-white/40 uppercase font-bold">Saques</p>
              <p className="text-2xl font-black text-white mt-1">{state.withdrawals.length}</p>
              <p className="text-xs text-[#ffbd2e]">{pendingWithdrawals.length} pendentes</p>
            </div>
            <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-5">
              <p className="text-xs text-white/40 uppercase font-bold">Disputas</p>
              <p className="text-2xl font-black text-white mt-1">{disputes.length}</p>
              <p className="text-xs text-red-400">{disputes.length >0 ? 'Atenção!' : 'Tudo ok'}</p>
            </div>
          </div>

          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
            <h3 className="font-black text-white mb-4">Receita estimada (R$ 0,90 por pedido)</h3>
            <p className="text-3xl font-black text-[#ffbd2e]">R$ {(state.purchases.filter(p => p.status !== "pending" && p.status !== "cancelled").length * 0.9).toFixed(2)}</p>
            <p className="text-xs text-white/40 mt-1">Total cobrado dos clientes: R$ {state.purchases.reduce((a,p)=>a+Number(p.amount),0).toFixed(2)}</p>
          </div>

          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
            <h3 className="font-bold text-white mb-3">Ações rápidas - Fix visibilidade</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={async () => {
                const tid = toast.loading("Aprovando todos produtos pendentes...");
                try {
                  // Try via edge function (service_role)
                  const { data, error } = await supabase.functions.invoke("admin-verify", { body: { action: "approve_all_products" } });
                  if (!error && !data?.error) {
                    toast.success("Todos produtos aprovados via Edge Function! Agora aparecem para todos.", { id: tid });
                    setTimeout(() => window.location.reload(), 1000);
                    return;
                  }
                  throw new Error(data?.error || error?.message || "Edge Function falhou");
                } catch {
                  toast.error("Falha ao aprovar. Nenhuma alteração foi aplicada; tente novamente após verificar a sessão administrativa.", { id: tid });
                }
              }} className="bg-[#ffbd2e] text-black px-4 py-2 rounded-xl text-xs font-black">Aprovar TODOS produtos (fix 0 produtos)</button>
              <button onClick={()=>setTab('products' as any)} className="bg-[#0084ff] text-white px-4 py-2 rounded-xl text-xs font-bold">Aprovar Produtos individuais</button>
              <button onClick={()=>setTab('withdrawals' as any)} className="bg-[#00c950] text-white px-4 py-2 rounded-xl text-xs font-bold">Pagar Saques</button>
              <button onClick={()=>setTab('disputes' as any)} className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold">Resolver Disputas</button>
              <button onClick={()=>setTab('security' as any)} className="bg-[#1a1a20] border border-[#25252e] text-white px-4 py-2 rounded-xl text-xs font-bold">Configurar 2FA</button>
            </div>
            <p className="text-[11px] text-white/30 mt-3">Se produtos não aparecem para deslogados, clique em Aprovar TODOS. Isso aprova todos pendentes via service_role e faz aparecer na loja pública.</p>
          </div>
        </div>
      )}

      {tab === "stats" && <AdminStatsPanel />}
      {tab === "orders" && <AdminPurchasesPanel />}
      {tab === "moderation" && <AdminModerationPanel />}
      {tab === "tools" && <AdminToolsPanel />}

      {tab === "security" && (
        <div className="space-y-6 max-w-2xl">
          <div className="glass-card p-6 border border-white/10 bg-[#0a0a0f]">
            <h3 className="font-black text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-success" /> Segurança do Painel Admin</h3>
            <p className="text-xs text-white/50 mt-2 leading-relaxed">
              O 2FA é <strong className="text-white">só para admin</strong> — impede invasão mesmo se alguém descobrir sua senha. Ao ativar, o QR Code aparece uma vez para escanear no Google Authenticator e depois <strong className="text-white">some</strong>. No próximo login, só pede o código de 6 dígitos.
            </p>
          </div>
          <TwoFactorPanel />
          <AdminSessionPanel />
        </div>
      )}

      {/* Config Tab */}
      {tab === "config" && (
        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4 border border-[#168cff]/25 bg-[#168cff]/[0.045]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-black text-foreground flex items-center gap-2"><MaintenanceIcon className="w-5 h-5 text-[#168cff]" /> Operação da plataforma</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Quando ativado, visitantes veem a página de manutenção. Administradores autenticados continuam acessando o painel após validação de papel e 2FA.</p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-bold text-foreground"><input type="checkbox" checked={maintenance} onChange={(event) => setMaintenance(event.target.checked)} disabled={platformLoading} /> Modo manutenção</label>
            </div>
            <textarea value={maintenanceMessage} maxLength={300} onChange={(event) => setMaintenanceMessage(event.target.value)} placeholder="Mensagem curta para visitantes" className="w-full rounded-xl bg-muted p-3 text-sm text-foreground" rows={3} disabled={platformLoading} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-muted-foreground">Preço mínimo de anúncio
                <input value={minProductPrice} inputMode="decimal" onChange={(event) => setMinProductPrice(event.target.value)} placeholder="2,00" className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground" disabled={platformLoading} />
              </label>
              <label className="text-xs font-bold text-muted-foreground">Saque mínimo
                <input value={minWithdraw} inputMode="decimal" onChange={(event) => setMinWithdraw(event.target.value)} placeholder="5,00" className="mt-1 w-full rounded-xl bg-muted p-3 text-sm text-foreground" disabled={platformLoading} />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => void savePlatformSettings()} disabled={platformSaving || platformLoading} className="btn-gradient rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50">{platformSaving ? "Salvando..." : "Salvar operação"}</button>
              <button onClick={() => setTab("apis")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-foreground hover:bg-white/[0.08]"><ExternalLink className="w-4 h-4" /> Configurar integrações</button>
            </div>
          </div>
          {/* Taxas */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-foreground">Taxas da Plataforma</h3>
            <p className="text-xs text-muted-foreground">Valores oficiais aplicados no checkout e no saque. O cliente sempre paga R$ 0,90 a mais; o saque mínimo é R$ 10,00 com taxa de R$ 3,50.</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Taxa do comprador</p>
                <p className="text-lg font-black text-foreground">R$ 0,90</p>
              </div>
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Saque mínimo</p>
                <p className="text-lg font-black text-foreground">R$ 10,00</p>
              </div>
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Taxa de saque</p>
                <p className="text-lg font-black text-foreground">R$ 3,50</p>
              </div>
              <div className="p-3 rounded-xl bg-muted">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Exemplo</p>
                <p className="text-sm font-bold text-foreground">Anúncio R$ 5,00 → cliente paga R$ 5,90</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 hidden">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Comissão (%)</label>
                <input type="number" value={commission} onChange={(e) => setCommission(Number(e.target.value))} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Taxa Saque Instantâneo (%)</label>
                <input type="number" value={instantFee} onChange={(e) => setInstantFee(Number(e.target.value))} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground" />
              </div>
            </div>
          </div>

          {/* Auth */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-foreground">Autenticação</h3>
            <p className="text-xs leading-5 text-muted-foreground">Login por senha e provedores sociais são configurados no Supabase Auth. O painel não recebe Client Secret, nem armazena credenciais OAuth no navegador.</p>
          </div>

          {/* Discord */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-foreground">Discord OAuth</h3>
            <p className="text-xs leading-5 text-muted-foreground">O Client ID e o Client Secret devem ser cadastrados diretamente no provedor Discord e no Supabase Auth. A aba de integrações mostra o callback oficial e o status de ativação, sem revelar valores sensíveis.</p>
            <button onClick={() => setTab("apis")} className="btn-gradient rounded-xl px-5 py-3 text-sm font-bold">Abrir configuração segura</button>
          </div>

          {/* Regras */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-foreground">Regras da Plataforma</h3>
            <textarea
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-sm text-foreground font-mono"
              rows={10}
            />
          </div>

          <button onClick={handleSaveConfig} className="btn-gradient w-full py-3 rounded-xl font-bold sticky bottom-4">Salvar Todas as Configurações</button>
        </div>
      )}

      {/* Other tabs remain largely the same but with UI tweaks... */}
      {tab === "users" && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-bold text-foreground mb-4">Gerenciar Usuários</h3>
          <div className="grid gap-2">
            <input value={banIdentifier} onChange={(e) => setBanIdentifier(e.target.value)} placeholder="ID numérico do usuário" className="w-full p-3 rounded-xl bg-muted border-none text-sm text-foreground" />
            <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Motivo do banimento" rows={3} className="w-full p-3 rounded-xl bg-muted border-none text-sm text-foreground resize-none" />
            <button onClick={handleBan} className="bg-destructive text-white px-4 py-3 rounded-xl text-xs font-bold">Banir Usuário</button>
          </div>
          <div className="pt-4 border-t border-border/30">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Usuários conhecidos:</p>
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {Object.values(state.userDirectory || {}).map((u) => (
                <div key={u.userId} className="bg-muted/60 rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">ID: {u.publicId}</p>
                  </div>
                  <button onClick={() => { setBanIdentifier(u.publicId); setBanReason("Violação das regras da plataforma"); }} className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-lg">Preparar Ban</button>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4">
            <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Banidos:</p>
            <div className="flex flex-wrap gap-2">
              {state.bannedUsers.map(u => (
                <span key={u} className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-2">
                  {u} <button onClick={async () => { const ok = await unbanUser(u); ok ? toast.success("Desbanido.") : toast.error("Não foi possível desbanir."); }}><X className="w-3 h-3"/></button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Fila de moderação: pré-visualização completa, busca, motivo de reprovação e
 * confirmação para a ação destrutiva. Toda decisão fica em `admin_audit_log`. */
function AdminProductModeration() {
  const { state, approveProduct, rejectProduct } = useStore();
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Product | null>(null);
  const [rejecting, setRejecting] = useState<Product | null>(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const PAGE = 10;
  const [shown, setShown] = useState(PAGE);

  const pending = state.products.filter((p) => !p.approved);
  const filtered = pending.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q)
      || p.category.toLowerCase().includes(q)
      || (p.seller || "").toLowerCase().includes(q)
      || String(p.id) === q;
  });

  const sellerEmail = (p: Product) => state.userDirectory?.[p.sellerId]?.email || p.sellerEmail || "e-mail não disponível";

  const handleApprove = async (p: Product) => {
    setBusyId(p.id);
    const ok = await approveProduct(p.id);
    setBusyId(null);
    if (ok) toast.success(`"${p.name}" aprovado e publicado.`);
  };

  const handleReject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    const ok = await rejectProduct(rejecting.id, reason);
    setBusyId(null);
    if (ok) toast.success("Anúncio reprovado e removido.");
    setRejecting(null);
    setReason("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold text-foreground">Produtos pendentes ({pending.length})</h3>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
          placeholder="Buscar por nome, categoria, vendedor ou ID"
          aria-label="Buscar anúncios pendentes"
          className="w-full sm:w-80 p-2.5 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:border-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-3xl p-10 text-center border-2 border-dashed border-border">
          <p className="text-muted-foreground">
            {pending.length === 0 ? "Nenhum produto aguardando aprovação." : "Nenhum pendente para essa busca."}
          </p>
        </div>
      ) : (
        <>
          {filtered.slice(0, shown).map((p) => (
            <div key={p.id} className="glass-card p-5 flex flex-col sm:flex-row sm:items-center gap-5">
              <img src={p.image} className="w-16 h-16 rounded-xl object-cover bg-muted shrink-0" alt="" />
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-foreground truncate">{p.name}</h4>
                <p className="text-xs text-muted-foreground truncate">
                  #{p.id} · {p.category} · {p.seller} ({sellerEmail(p)})
                </p>
                <p className="text-sm font-black text-primary mt-1">
                  {formatBRL(p.price)}
                  {p.variations && p.variations.length > 0 && (
                    <span className="text-muted-foreground font-normal text-xs"> · {p.variations.length} variação(ões)</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setPreview(p)} aria-label={`Revisar ${p.name}`} className="p-3 bg-muted text-foreground rounded-xl hover:bg-muted/70 transition">
                  <Eye className="w-5 h-5" />
                </button>
                <button onClick={() => void handleApprove(p)} disabled={busyId === p.id} aria-label={`Aprovar ${p.name}`} className="p-3 bg-success/10 text-success rounded-xl hover:bg-success/20 transition disabled:opacity-40">
                  <Check className="w-5 h-5" />
                </button>
                <button onClick={() => { setRejecting(p); setReason(""); }} disabled={busyId === p.id} aria-label={`Reprovar ${p.name}`} className="p-3 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition disabled:opacity-40">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
          {shown < filtered.length && (
            <button onClick={() => setShown((v) => v + PAGE)} className="w-full py-3 rounded-xl bg-card border border-border text-sm font-bold text-foreground">
              Carregar mais ({filtered.length - shown})
            </button>
          )}
        </>
      )}

      {preview && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div role="dialog" aria-modal="true" aria-label="Revisar anúncio" className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black text-foreground">{preview.name}</h3>
              <button onClick={() => setPreview(null)} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <img src={preview.banner || preview.image} alt="" className="w-full rounded-xl object-cover max-h-56 bg-muted" />
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div><dt className="text-muted-foreground">Preço</dt><dd className="font-bold text-foreground">{formatBRL(preview.price)}</dd></div>
              <div><dt className="text-muted-foreground">Categoria</dt><dd className="font-bold text-foreground">{preview.category}</dd></div>
              <div><dt className="text-muted-foreground">Entrega</dt><dd className="font-bold text-foreground">{preview.deliveryType === "auto" ? "Automática" : "Manual"}</dd></div>
              <div><dt className="text-muted-foreground">Prazo</dt><dd className="font-bold text-foreground">{preview.deliveryTime || "não informado"}</dd></div>
              <div><dt className="text-muted-foreground">Estoque</dt><dd className="font-bold text-foreground">{preview.stock ?? "não informado"}</dd></div>
              <div><dt className="text-muted-foreground">Qtd. mínima</dt><dd className="font-bold text-foreground">{preview.minQuantity ?? "não informada"}</dd></div>
            </dl>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Descrição</p>
              <p className="text-sm text-foreground whitespace-pre-wrap break-words">{preview.description || "—"}</p>
            </div>
            {preview.variations && preview.variations.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground mb-1">Variações</p>
                <ul className="space-y-1">
                  {preview.variations.map((v, i) => (
                    <li key={i} className="flex justify-between text-sm text-foreground bg-muted/40 rounded-lg px-3 py-1.5">
                      <span className="truncate">{v.name}</span><span className="font-bold">{formatBRL(v.price)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => { const p = preview; setPreview(null); void handleApprove(p); }} className="flex-1 bg-success text-white py-3 rounded-xl font-bold text-sm">Aprovar</button>
              <button onClick={() => { setRejecting(preview); setReason(""); setPreview(null); }} className="flex-1 bg-destructive text-white py-3 rounded-xl font-bold text-sm">Reprovar</button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRejecting(null)}>
          <div role="alertdialog" aria-modal="true" aria-label="Confirmar reprovação" className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black text-foreground">Reprovar anúncio?</h3>
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{rejecting.name}</span> será removido definitivamente. Esta ação não pode ser desfeita e ficará registrada na auditoria.
            </p>
            <label htmlFor="reject-reason" className="block text-xs font-bold uppercase text-muted-foreground">Motivo (registrado na auditoria)</label>
            <textarea
              id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
              placeholder="Ex.: imagem imprópria, preço incoerente, produto proibido pelas regras"
              className="w-full p-3 rounded-xl bg-background border border-border text-foreground text-sm outline-none focus:border-primary resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setRejecting(null)} className="flex-1 bg-muted text-foreground py-3 rounded-xl font-bold text-sm">Cancelar</button>
              <button onClick={() => void handleReject()} disabled={!reason.trim() || busyId === rejecting.id} className="flex-1 bg-destructive text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40">
                Confirmar reprovação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
