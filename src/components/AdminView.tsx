import React, { useState, useEffect } from "react";
import { useStore, Product, Withdrawal, Purchase } from "@/store/StoreContext";
import { MoneyEmoji, PackageEmoji, ChatEmoji, StarEmoji, ShieldEmoji } from "@/components/CustomEmojis";
import { X, Check, Send, User, Trash2, ShieldAlert, FileText, Settings, Users, Tag, ArrowLeft, ExternalLink, Webhook, RefreshCw, KeyRound } from "lucide-react";
import { toast } from "sonner";
import MyPurchasesView from "@/components/MyPurchasesView";
import IntegrationsPanel from "@/components/IntegrationsPanel";
import { supabase } from "@/integrations/supabase/client";

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
  const { state, approveProduct, rejectProduct, approveWithdraw, rejectWithdraw, approvePurchase, revertPurchase, banUser, unbanUser, updateConfig, publishNotice, deleteNotice, createUserTag, deleteUserTag, assignUserTag, unassignUserTag, sendAdminChat, verifyUser, reviewSellerDocument, saveGatewaySettings } = useStore();
  const [tab, setTab] = useState<"products" | "withdrawals" | "notices" | "users" | "tags" | "adminchat" | "documents" | "verifications" | "disputes" | "config" | "webhooks" | "apis">("products");
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [kyc, setKyc] = useState<any[]>([]);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycNotes, setKycNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [chatMsg, setChatMsg] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#8B5CF6");
  const [tagAssignEmail, setTagAssignEmail] = useState("");
  const [tagAssignTagId, setTagAssignTagId] = useState<number | "">("");
  const [rules, setRules] = useState(state.config.rules);
  const [commission, setCommission] = useState(state.config.commission);
  const [instantFee, setInstantFee] = useState(state.config.instantFee);
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
  const pendingWithdrawals = state.withdrawals.filter((w) => w.status === "pending");
  const adminMessages = state.adminChat || [];
  const globalNotices = state.globalNotices || [];
  const disputes = state.purchases.filter(p => p.status === "dispute");
  const pendingDocuments = (state.sellerDocuments || []).filter(d => d.status === "pending");

  const handleSaveConfig = async () => {
    updateConfig({
      rules, commission, instantFee,
      authMode,
      discordMode, discordClientId, discordRedirectUri, discordScopes, discordServerLink,
      discordLink: discordServerLink,
      evopayMode,
    });
    const tid = toast.loading("Salvando configurações...");
    const ok = await saveGatewaySettings({ evopayMode, evopayApiKey: evopayApiKey.trim() || undefined });
    if (ok) {
      setEvopayApiKey("");
      toast.success("Configurações salvas!", { id: tid });
    } else {
      toast.error("Configurações locais salvas, mas falha ao salvar as credenciais do gateway.", { id: tid });
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
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 5);
    if (error || !data?.signedUrl) return toast.error("Não foi possível abrir o documento.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
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
    const { data, error } = await (supabase as any)
      .from("profiles")
      .select("user_id, public_id, email, display_name, full_name, cpf, birth_date, phone, city, state, verification_selfie_path, verification_status, verification_notes, verification_submitted_at, is_verified_seller")
      .not("verification_status", "is", null)
      .neq("verification_status", "none")
      .order("verification_submitted_at", { ascending: false });
    setKycLoading(false);
    if (error) return toast.error("Não foi possível carregar as verificações.");
    setKyc(data || []);
  };

  const reviewKyc = async (userId: string, approved: boolean) => {
    const tid = toast.loading(approved ? "Aprovando..." : "Recusando...");
    if (approved) {
      const ok = await verifyUser(userId);
      ok ? toast.success("Usuário verificado!", { id: tid }) : toast.error("Falha ao verificar.", { id: tid });
    } else {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          verification_status: "rejected",
          is_verified_seller: false,
          verification_notes: kycNotes[userId]?.trim() || "Documentos ilegíveis ou dados divergentes.",
        })
        .eq("user_id", userId);
      error ? toast.error("Falha ao recusar.", { id: tid }) : toast.error("Verificação recusada.", { id: tid });
    }
    await loadKyc();
  };

  useEffect(() => {
    if (tab === "webhooks") void loadWebhookLogs();
    if (tab === "verifications") void loadKyc();
  }, [tab]);

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
        <h1 className="text-3xl font-black text-foreground mb-2">Painel Admin</h1>
        <p className="text-muted-foreground">Gerenciamento global da plataforma.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {[
          { id: "products", label: "Produtos", icon: PackageEmoji, count: pendingProducts.length },
          { id: "withdrawals", label: "Saques", icon: MoneyEmoji, count: pendingWithdrawals.length },
          { id: "disputes", label: "Disputas", icon: ShieldAlert, count: disputes.length },
          { id: "documents", label: "Documentos", icon: FileText, count: pendingDocuments.length },
          { id: "verifications", label: "Verificações", icon: ShieldEmoji },
          { id: "users", label: "Usuários", icon: Users },
          { id: "notices", label: "Avisos", icon: StarEmoji },
          { id: "adminchat", label: "Chat Equipe", icon: ChatEmoji },
          { id: "webhooks", label: "Webhooks EvoPay", icon: Webhook },
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
                  <button onClick={() => { approveProduct(p.id); toast.success("Produto aprovado!"); }} className="p-3 bg-success/10 text-success rounded-xl hover:bg-success/20 transition"><Check className="w-5 h-5" /></button>
                  <button onClick={() => { rejectProduct(p.id); toast.error("Produto rejeitado."); }} className="p-3 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition"><X className="w-5 h-5" /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

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
        <div className="glass-card p-6">
          <h3 className="font-bold text-foreground mb-4">Verificação de Documentos</h3>
          <p className="text-sm text-muted-foreground mb-6">Aprove documentos para liberar a função de saque para os usuários.</p>
          <div className="space-y-4">
            {(state.sellerDocuments || []).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-10">Nenhum documento enviado ainda.</p>
            ) : (state.sellerDocuments || []).map((doc) => (
              <div key={doc.id} className="p-4 bg-muted rounded-xl border border-border/40">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{doc.userEmail || "Usuário"}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">ID: {doc.userPublicId}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{doc.fileName}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${doc.status === "approved" ? "bg-success/10 text-success" : doc.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{doc.status}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openDocument(doc.filePath)} className="px-3 py-2 bg-card text-foreground text-xs font-bold rounded-lg flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Abrir</button>
                  <button onClick={async () => { const tid = toast.loading("Aprovando..."); reviewSellerDocument(doc.id, "approved"); const ok = await verifyUser(doc.userId); ok ? toast.success("Documento aprovado e vendedor verificado!", { id: tid }) : toast.error("Documento marcado, mas não foi possível verificar o vendedor.", { id: tid }); }} className="px-3 py-2 bg-success text-white text-xs font-bold rounded-lg">Aprovar</button>
                  <button onClick={() => { reviewSellerDocument(doc.id, "rejected"); toast.error("Documento rejeitado."); }} className="px-3 py-2 bg-destructive/10 text-destructive text-xs font-bold rounded-lg">Rejeitar</button>
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
              <h3 className="font-bold text-foreground">Eventos do Webhook EvoPay</h3>
              <p className="text-xs text-muted-foreground">Últimos 100 eventos recebidos e cobranças geradas. Use para depurar pagamentos.</p>
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

      {/* Config Tab */}
      {tab === "config" && (
        <div className="space-y-6">
          {/* Taxas */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-bold text-foreground">Taxas da Plataforma</h3>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-foreground">Autenticação</h3>
              <div className="flex gap-1 bg-muted rounded-xl p-1">
                <button onClick={() => setAuthMode("automatic")} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${authMode === "automatic" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Automático</button>
                <button onClick={() => setAuthMode("manual")} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${authMode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Manual</button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">No modo automático, o sistema usa as credenciais padrão. No manual, usa as configurações abaixo (Discord).</p>
          </div>

          {/* Discord */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-foreground">Credenciais Discord</h3>
              <div className="flex gap-1 bg-muted rounded-xl p-1">
                <button onClick={() => setDiscordMode("automatic")} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${discordMode === "automatic" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Automático</button>
                <button onClick={() => setDiscordMode("manual")} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${discordMode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Manual</button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Link do Servidor Discord</label>
              <input value={discordServerLink} onChange={(e) => setDiscordServerLink(e.target.value)} placeholder="https://discord.gg/..." className="w-full p-3 rounded-xl bg-muted text-sm text-foreground" />
            </div>
            {discordMode === "manual" && (
              <>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Client ID</label>
                  <input value={discordClientId} onChange={(e) => setDiscordClientId(e.target.value)} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-mono" />
                </div>
                <p className="text-[10px] text-muted-foreground">O Client Secret do Discord fica na aba "APIs & Credenciais" e é guardado apenas no servidor.</p>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Redirect URI</label>
                  <input value={discordRedirectUri} onChange={(e) => setDiscordRedirectUri(e.target.value)} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Scopes</label>
                  <input value={discordScopes} onChange={(e) => setDiscordScopes(e.target.value)} className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-mono" />
                </div>
              </>
            )}
          </div>

          {/* Credenciais sensíveis foram movidas para a aba "APIs & Credenciais" (armazenadas apenas no servidor) */}

          {/* EvoPay (gateway de pagamento ativo) */}
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
                <p className="text-[10px] text-muted-foreground mt-1">A chave é guardada com segurança no servidor e usada para gerar cobranças e saques. Deixe em branco para manter a atual.</p>
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
