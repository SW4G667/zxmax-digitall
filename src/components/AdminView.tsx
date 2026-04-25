import React, { useState } from "react";
import { useStore, Product, Withdrawal, Purchase } from "@/store/StoreContext";
import { MoneyEmoji, PackageEmoji, ChatEmoji, StarEmoji, ShieldEmoji } from "@/components/CustomEmojis";
import { X, Check, Send, User, Trash2, ShieldAlert, FileText, Settings, Users, Tag, ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import MyPurchasesView from "@/components/MyPurchasesView";
import { supabase } from "@/integrations/supabase/client";

export default function AdminView() {
  const { state, approveProduct, rejectProduct, approveWithdraw, rejectWithdraw, approvePurchase, revertPurchase, banUser, unbanUser, updateConfig, publishNotice, deleteNotice, createUserTag, deleteUserTag, assignUserTag, unassignUserTag, sendAdminChat, verifyUser, reviewSellerDocument } = useStore();
  const [tab, setTab] = useState<"products" | "withdrawals" | "notices" | "users" | "tags" | "adminchat" | "documents" | "disputes" | "config">("products");
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
  const [discordClientSecret, setDiscordClientSecret] = useState(state.config.discordClientSecret);
  const [discordRedirectUri, setDiscordRedirectUri] = useState(state.config.discordRedirectUri);
  const [discordScopes, setDiscordScopes] = useState(state.config.discordScopes);
  const [discordServerLink, setDiscordServerLink] = useState(state.config.discordServerLink);
  // AbacatePay config
  const [abacatepayMode, setAbacatepayMode] = useState(state.config.abacatepayMode);
  const [abacatepayApiKey, setAbacatepayApiKey] = useState(state.config.abacatepayApiKey);
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

  const handleSaveConfig = () => {
    updateConfig({
      rules, commission, instantFee,
      authMode,
      discordMode, discordClientId, discordClientSecret, discordRedirectUri, discordScopes, discordServerLink,
      discordLink: discordServerLink,
      abacatepayMode, abacatepayApiKey,
    });
    toast.success("Configurações salvas!");
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
          { id: "users", label: "Usuários", icon: Users },
          { id: "notices", label: "Avisos", icon: StarEmoji },
          { id: "adminchat", label: "Chat Equipe", icon: ChatEmoji },
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
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { approveWithdraw(w.id); toast.success("Saque aprovado!"); }} className="p-3 bg-success/10 text-success rounded-xl hover:bg-success/20 transition"><Check className="w-5 h-5" /></button>
                  <button onClick={() => { rejectWithdraw(w.id); toast.error("Saque rejeitado."); }} className="p-3 bg-destructive/10 text-destructive rounded-xl hover:bg-destructive/20 transition"><X className="w-5 h-5" /></button>
                </div>
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
                  <button onClick={() => { reviewSellerDocument(doc.id, "approved"); verifyUser(doc.userId); toast.success("Documento aprovado!"); }} className="px-3 py-2 bg-success text-white text-xs font-bold rounded-lg">Aprovar</button>
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
            <p className="text-xs text-muted-foreground">No modo automático, o sistema usa as credenciais padrão. No manual, usa as configurações abaixo (Discord/AbacatePay).</p>
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
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Client Secret</label>
                  <input type="password" value={discordClientSecret} onChange={(e) => setDiscordClientSecret(e.target.value)} placeholder="••••••••" className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-mono" />
                  <p className="text-[10px] text-muted-foreground mt-1">⚠️ Para uso real, configure também o secret DISCORD_CLIENT_SECRET no backend.</p>
                </div>
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

          {/* AbacatePay */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-foreground">Credenciais AbacatePay</h3>
              <div className="flex gap-1 bg-muted rounded-xl p-1">
                <button onClick={() => setAbacatepayMode("automatic")} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${abacatepayMode === "automatic" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Automático</button>
                <button onClick={() => setAbacatepayMode("manual")} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${abacatepayMode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Manual</button>
              </div>
            </div>
            {abacatepayMode === "manual" ? (
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">API Key</label>
                <input type="password" value={abacatepayApiKey} onChange={(e) => setAbacatepayApiKey(e.target.value)} placeholder="••••••••" className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-mono" />
                <p className="text-[10px] text-muted-foreground mt-1">⚠️ Para uso real, configure também o secret ABACATEPAY_API_KEY no backend.</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Usando a API Key configurada nos secrets do backend.</p>
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
