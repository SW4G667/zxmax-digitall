import React, { useState } from "react";
import { useStore, Product, SupportTicket } from "@/store/StoreContext";
import { ShieldEmoji, StarEmoji, ChatEmoji } from "@/components/CustomEmojis";
import { X, Eye, Send } from "lucide-react";
import { toast } from "sonner";

type AdminTab = "config" | "categories" | "products" | "purchases" | "withdrawals" | "support" | "notices" | "users" | "adminchat" | "tags";

export default function AdminView() {
  const {
    state, updateConfig, approveProduct, rejectProduct, approvePurchase, revertPurchase,
    approveWithdraw, rejectWithdraw, banUser, unbanUser, replyTicket, setGlobalNotice,
    deleteProduct, closeTicket, resolveTicket, publishNotice, sendAdminChat,
    deleteNotice, createUserTag, deleteUserTag, assignUserTag, unassignUserTag,
  } = useStore();
  const [tab, setTab] = useState<AdminTab>("config");
  const [newCat, setNewCat] = useState("");
  const [notice, setNotice] = useState("");
  const [adminReply, setAdminReply] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<number | null>(null);
  const [ticketFilter, setTicketFilter] = useState<"open" | "closed">("open");
  const [chatMsg, setChatMsg] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#8b5cf6");
  const [tagAssignEmail, setTagAssignEmail] = useState("");
  const [tagAssignTagId, setTagAssignTagId] = useState<number | "">("");

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "config", label: "Config" },
    { key: "categories", label: "Categorias" },
    { key: "products", label: "Produtos" },
    { key: "purchases", label: "Compras" },
    { key: "withdrawals", label: "Saques" },
    { key: "support", label: "Suporte" },
    { key: "notices", label: "Avisos" },
    { key: "users", label: "Usuários" },
    { key: "tags", label: "Tags" },
    { key: "adminchat", label: "Chat Equipe" },
  ];

  const adminMessages = state.adminChat || [];

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-foreground">Painel Admin</h1>
        <ShieldEmoji className="w-8 h-8" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.key ? "btn-gradient" : "bg-card border border-border/40 text-muted-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Config */}
      {tab === "config" && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-bold text-foreground mb-2">Configurações Gerais</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Taxa Comissão (%)</label>
              <input type="number" value={state.config.commission} onChange={(e) => updateConfig({ commission: +e.target.value })} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Taxa Saque Instantâneo (%)</label>
              <input type="number" value={state.config.instantFee} onChange={(e) => updateConfig({ instantFee: +e.target.value })} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Link Discord</label>
              <input value={state.config.discordLink} onChange={(e) => updateConfig({ discordLink: e.target.value })} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
            </div>
          </div>

          {/* Stripe / Pagamentos */}
          <div className="border-t border-border/40 pt-4 mt-4">
            <h4 className="font-bold text-foreground mb-3">Pagamentos (Stripe)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Stripe Publishable Key</label>
                <input value={state.config.stripePublishableKey} onChange={(e) => updateConfig({ stripePublishableKey: e.target.value })} placeholder="pk_..." className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Stripe Secret Key</label>
                <input value={state.config.stripeSecretKey} onChange={(e) => updateConfig({ stripeSecretKey: e.target.value })} placeholder="sk_..." type="password" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Configure ambas as chaves para ativar pagamentos automáticos via Stripe Checkout.</p>
          </div>

          {/* Asaas */}
          <div className="border-t border-border/40 pt-4 mt-4">
            <h4 className="font-bold text-foreground mb-3">Pagamentos (Asaas)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Chave API Asaas</label>
                <input value={state.config.asaasApiKey} onChange={(e) => updateConfig({ asaasApiKey: e.target.value })} placeholder="$aact_..." type="password" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Ambiente</label>
                <select value={state.config.asaasEnv} onChange={(e) => updateConfig({ asaasEnv: e.target.value as "sandbox" | "production" })} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary">
                  <option value="sandbox">Sandbox (Testes)</option>
                  <option value="production">Produção</option>
                </select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Chave armazenada localmente. Para a integração funcionar de verdade será necessário criar a edge function que chama a API do Asaas.</p>
          </div>

          {/* Google OAuth */}
          <div className="border-t border-border/40 pt-4 mt-4">
            <h4 className="font-bold text-foreground mb-3">Login com Google</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Google Client ID</label>
                <input value={state.config.googleClientId} onChange={(e) => updateConfig({ googleClientId: e.target.value })} placeholder="xxxxx.apps.googleusercontent.com" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Google Client Secret</label>
                <input value={state.config.googleClientSecret} onChange={(e) => updateConfig({ googleClientSecret: e.target.value })} placeholder="GOCSPX-..." type="password" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
            </div>
          </div>

          {/* Discord OAuth */}
          <div className="border-t border-border/40 pt-4 mt-4">
            <h4 className="font-bold text-foreground mb-3">Login com Discord</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Discord Client ID</label>
                <input value={state.config.discordClientId} onChange={(e) => updateConfig({ discordClientId: e.target.value })} placeholder="ID da aplicação Discord" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Discord Client Secret</label>
                <input value={state.config.discordClientSecret} onChange={(e) => updateConfig({ discordClientSecret: e.target.value })} placeholder="Secret da aplicação Discord" type="password" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Discord Redirect URI</label>
                <input value={state.config.discordRedirectUri} onChange={(e) => updateConfig({ discordRedirectUri: e.target.value })} placeholder="https://seusite.com/" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Discord Scopes</label>
                <input value={state.config.discordScopes} onChange={(e) => updateConfig({ discordScopes: e.target.value })} placeholder="identify email" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">URL gerada: <code className="text-foreground/70 break-all">https://discord.com/oauth2/authorize?client_id=...&response_type=code&redirect_uri=...&scope=...</code></p>
          </div>

          {/* Google Redirect/Scopes extras */}
          <div className="border-t border-border/40 pt-4 mt-4">
            <h4 className="font-bold text-foreground mb-3">Google OAuth — Avançado</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Google Redirect URI</label>
                <input value={state.config.googleRedirectUri} onChange={(e) => updateConfig({ googleRedirectUri: e.target.value })} placeholder="https://seusite.com/" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Google Scopes</label>
                <input value={state.config.googleScopes} onChange={(e) => updateConfig({ googleScopes: e.target.value })} placeholder="openid email profile" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
            </div>
          </div>

          <button onClick={() => toast.success("Configurações salvas!")} className="btn-gradient px-5 py-2.5 text-sm mt-2">Salvar</button>
        </div>
      )}

      {/* Categories */}
      {tab === "categories" && (
        <div className="glass-card p-6">
          <h3 className="font-bold text-foreground mb-4">Categorias</h3>
          <div className="flex gap-2 mb-4">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nova categoria" className="flex-1 p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
            <button onClick={() => { if (newCat) { updateConfig({ categories: [...state.config.categories, newCat] }); setNewCat(""); toast.success("Categoria adicionada!"); } }} className="btn-gradient px-4 py-2 text-sm">Adicionar</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {state.config.categories.map((c) => (
              <span key={c} className="px-3 py-1.5 bg-muted rounded-full text-xs font-semibold text-foreground flex items-center gap-2">
                {c}
                <button onClick={() => updateConfig({ categories: state.config.categories.filter((x) => x !== c) })} className="text-destructive font-bold">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Products with preview modal */}
      {tab === "products" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30 flex justify-between items-center">
            <h3 className="font-bold text-foreground">Todos os Produtos</h3>
            <span className="admin-badge">{state.products.filter((p) => !p.approved).length} pendentes</span>
          </div>
          {state.products.length === 0 ? (
            <p className="p-6 text-muted-foreground text-center text-sm">Nenhum produto cadastrado.</p>
          ) : (
            <div className="divide-y divide-border/20">
              {state.products.map((p) => (
                <div key={p.id} className="p-4 flex items-center gap-4">
                  <img src={p.image} className="w-12 h-12 rounded-xl object-cover" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.seller} · {p.category}</p>
                  </div>
                  <p className="font-bold text-foreground text-sm">R$ {p.price.toFixed(2)}</p>
                  <button onClick={() => setPreviewProduct(p)} className="p-1.5 rounded-lg hover:bg-muted transition" title="Visualizar">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {!p.approved ? (
                    <div className="flex gap-2">
                      <button onClick={() => { approveProduct(p.id); toast.success("Aprovado!"); }} className="text-success font-bold text-xs">Aprovar</button>
                      <button onClick={() => setShowRejectModal(p.id)} className="text-destructive font-bold text-xs">Rejeitar</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">Ativo</span>
                      <button onClick={() => { deleteProduct(p.id); toast.success("Produto removido!"); }} className="text-destructive text-xs font-bold hover:underline">Excluir</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product Preview Modal */}
      {previewProduct && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={() => setPreviewProduct(null)}>
          <div className="glass-card w-full max-w-2xl p-0 bg-card animate-fade-in-up overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="relative h-56 sm:h-72">
              <img src={previewProduct.banner || previewProduct.image} className="w-full h-full object-cover" alt={previewProduct.name} />
              <button onClick={() => setPreviewProduct(null)} className="absolute top-3 right-3 bg-card/90 backdrop-blur p-2 rounded-xl">
                <X className="w-5 h-5 text-foreground" />
              </button>
              {!previewProduct.approved && <div className="absolute top-3 left-3 admin-badge">Pendente</div>}
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h2 className="text-xl font-black text-foreground">{previewProduct.name}</h2>
                  <p className="text-sm text-muted-foreground">{previewProduct.category} · por <span className="text-primary font-semibold">{previewProduct.seller}</span></p>
                </div>
                <p className="text-2xl font-black text-foreground">R$ {previewProduct.price.toFixed(2)}</p>
              </div>
              <p className="text-sm text-foreground mb-4 leading-relaxed">{previewProduct.description}</p>
              {previewProduct.variations && previewProduct.variations.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Variações</h4>
                  <div className="flex flex-wrap gap-2">
                    {previewProduct.variations.map((v, i) => (
                      <span key={i} className="px-3 py-1.5 bg-muted rounded-full text-xs font-semibold text-foreground">{v.name} — R$ {v.price.toFixed(2)}</span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div className="bg-muted p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Vendas</p>
                  <p className="font-black text-foreground">{previewProduct.sales}</p>
                </div>
                <div className="bg-muted p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Entrega</p>
                  <p className="font-black text-foreground">{previewProduct.deliveryType === "auto" ? "Automática" : "Manual"}</p>
                </div>
              </div>
              <div className="flex gap-3">
                {!previewProduct.approved && (
                  <>
                    <button onClick={() => { approveProduct(previewProduct.id); toast.success("Produto aprovado!"); setPreviewProduct(null); }} className="flex-1 btn-gradient py-3 text-sm">Aprovar</button>
                    <button onClick={() => { setShowRejectModal(previewProduct.id); setPreviewProduct(null); }} className="flex-1 bg-destructive text-destructive-foreground py-3 rounded-2xl font-bold text-sm">Rejeitar</button>
                  </>
                )}
                <button onClick={() => { deleteProduct(previewProduct.id); toast.success("Produto excluído!"); setPreviewProduct(null); }} className="px-4 py-3 border border-destructive text-destructive rounded-2xl font-bold text-sm">Excluir</button>
                <button onClick={() => setPreviewProduct(null)} className="px-4 py-3 border border-border rounded-2xl font-bold text-sm text-muted-foreground">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showRejectModal !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowRejectModal(null)}>
          <div className="glass-card w-full max-w-sm p-6 bg-card animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-foreground mb-3">Motivo da Rejeição</h3>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Explique o motivo..." rows={3} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary resize-none mb-3" />
            <div className="flex gap-2">
              <button onClick={() => { rejectProduct(showRejectModal); toast.error("Produto rejeitado! Motivo: " + (rejectReason || "Sem motivo")); setShowRejectModal(null); setRejectReason(""); }} className="flex-1 bg-destructive text-destructive-foreground py-2.5 rounded-xl font-bold text-sm">Rejeitar</button>
              <button onClick={() => { setShowRejectModal(null); setRejectReason(""); }} className="flex-1 border border-border py-2.5 rounded-xl font-bold text-sm text-muted-foreground">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Purchases */}
      {tab === "purchases" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30">
            <h3 className="font-bold text-foreground">Compras</h3>
          </div>
          {state.purchases.length === 0 ? (
            <p className="p-6 text-muted-foreground text-center text-sm">Nenhuma compra registrada.</p>
          ) : (
            <div className="divide-y divide-border/20">
              {state.purchases.map((p) => {
                const product = state.products.find((pr) => pr.id === p.productId);
                return (
                  <div key={p.id} className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-foreground text-sm">{product?.name || "Produto"}</p>
                      <p className="text-xs text-muted-foreground">Comprador: {p.buyerEmail}</p>
                    </div>
                    <p className="font-bold text-foreground text-sm">R$ {p.amount.toFixed(2)}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.status === "paid" ? "bg-success/10 text-success" : p.status === "delivered" ? "bg-primary/10 text-primary" : p.status === "dispute" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {p.status === "paid" ? "Pago" : p.status === "delivered" ? "Entregue" : p.status === "dispute" ? "Disputa" : "Pendente"}
                    </span>
                    {p.status === "paid" && (
                      <div className="flex gap-2">
                        <button onClick={() => { approvePurchase(p.id); toast.success("Entrega aprovada!"); }} className="text-success font-bold text-xs">Aprovar</button>
                        <button onClick={() => { revertPurchase(p.id); toast.error("Pagamento revertido!"); }} className="text-destructive font-bold text-xs">Reverter</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Withdrawals */}
      {tab === "withdrawals" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30">
            <h3 className="font-bold text-foreground">Solicitações de Saque</h3>
          </div>
          {state.withdrawals.length === 0 ? (
            <p className="p-6 text-muted-foreground text-center text-sm">Nenhuma solicitação.</p>
          ) : (
            <div className="divide-y divide-border/20">
              {state.withdrawals.map((w) => (
                <div key={w.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">{w.userEmail}</p>
                    <p className="text-xs text-muted-foreground">{w.method === "instant" ? "Instantâneo" : "Normal"} · {new Date(w.createdAt).toLocaleDateString("pt-BR")}</p>
                  </div>
                  <p className="font-bold text-foreground text-sm">R$ {w.amount.toFixed(2)}</p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${w.status === "pending" ? "bg-primary/10 text-primary" : w.status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{w.status}</span>
                  {w.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => { approveWithdraw(w.id); toast.success("Saque aprovado!"); }} className="text-success font-bold text-xs">Aprovar</button>
                      <button onClick={() => { rejectWithdraw(w.id); toast.error("Saque rejeitado!"); }} className="text-destructive font-bold text-xs">Rejeitar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Support with open/closed filter */}
      {tab === "support" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30 flex justify-between items-center">
            <h3 className="font-bold text-foreground">Tickets de Suporte</h3>
            <div className="flex gap-1.5">
              <button onClick={() => setTicketFilter("open")} className={`px-3 py-1 rounded-lg text-xs font-bold transition ${ticketFilter === "open" ? "bg-success/10 text-success" : "text-muted-foreground"}`}>Abertos</button>
              <button onClick={() => setTicketFilter("closed")} className={`px-3 py-1 rounded-lg text-xs font-bold transition ${ticketFilter === "closed" ? "bg-muted text-foreground" : "text-muted-foreground"}`}>Fechados</button>
            </div>
          </div>
          {(() => {
            const filtered = state.tickets.filter((t) => ticketFilter === "open" ? t.status === "open" : t.status === "closed");
            return filtered.length === 0 ? (
              <p className="p-6 text-muted-foreground text-center text-sm">Nenhum ticket {ticketFilter === "open" ? "aberto" : "fechado"}.</p>
            ) : (
              <div className="divide-y divide-border/20">
                {filtered.map((t) => (
                  <div key={t.id} className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-medium text-foreground text-sm">{t.subject}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                          {t.status === "open" ? "Aberto" : "Fechado"}
                        </span>
                        <p className="text-xs text-muted-foreground">{t.userEmail}</p>
                      </div>
                    </div>
                    <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                      {t.messages.map((m, i) => (
                        <div key={i} className={`p-2 rounded-xl text-xs ${m.from === "admin@keybot.com" ? "bg-primary/10 ml-6" : "bg-muted mr-6"} text-foreground`}>
                          <span className="font-bold">{m.from === "admin@keybot.com" ? "Admin" : m.from}:</span> {m.text}
                        </div>
                      ))}
                    </div>
                    {t.status === "open" && (
                      <>
                        <div className="flex gap-2 mb-2">
                          <input value={adminReply} onChange={(e) => setAdminReply(e.target.value)} placeholder="Responder..." className="flex-1 p-2 rounded-xl bg-muted text-foreground text-xs border-none outline-none focus:ring-2 ring-primary" />
                          <button onClick={() => { if (adminReply) { replyTicket(t.id, adminReply); setAdminReply(""); toast.success("Resposta enviada!"); } }} className="btn-gradient px-3 py-1 text-xs">Enviar</button>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { closeTicket(t.id); toast.success("Ticket fechado!"); }} className="text-xs font-bold text-muted-foreground hover:text-foreground">Fechar Ticket</button>
                          <button onClick={() => { resolveTicket(t.id); toast.success("Ticket resolvido!"); }} className="text-xs font-bold text-success">Marcar Resolvido</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Notices - textarea starts empty */}
      {tab === "notices" && (
        <div className="glass-card p-6">
          <h3 className="font-bold text-foreground mb-4">Aviso Global</h3>
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={4}
            placeholder="Escreva um aviso para todos os usuários..."
            className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary resize-none mb-3"
          />
          <div className="flex gap-2">
            <button onClick={() => {
              if (!notice.trim()) { toast.error("Escreva algo antes de publicar."); return; }
              publishNotice(notice.trim());
              toast.success("Aviso publicado nas Mensagens Globais!");
              setNotice("");
            }} className="btn-gradient px-5 py-2 text-sm">Publicar</button>
            <button onClick={() => { updateConfig({ globalNotice: "" }); setNotice(""); toast.success("Aviso removido!"); }} className="px-5 py-2 text-sm text-destructive font-bold">Limpar</button>
          </div>

          {/* Published notices history */}
          {(state.globalNotices || []).length > 0 && (
            <div className="mt-6">
              <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">Avisos Publicados</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(state.globalNotices || []).map((n) => (
                  <div key={n.id} className="bg-muted rounded-xl p-3 flex justify-between items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground break-words">{n.text}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(n.date).toLocaleString("pt-BR")}</p>
                    </div>
                    <button
                      onClick={() => { deleteNotice(n.id); toast.success("Aviso excluído!"); }}
                      className="shrink-0 p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition"
                      title="Excluir aviso"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin Team Chat */}
      {tab === "adminchat" && (
        <div className="glass-card p-6">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <ChatEmoji className="w-5 h-5" /> Chat da Equipe
          </h3>
          <div className="bg-muted rounded-2xl p-4 mb-4 min-h-[250px] max-h-[400px] overflow-y-auto flex flex-col gap-2">
            {adminMessages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem. Inicie a conversa!</p>
            )}
            {adminMessages.map((m, i) => {
              const isMe = m.from === state.currentUser?.email;
              return (
                <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card text-foreground rounded-bl-md"}`}>
                    <p className={`text-[10px] font-bold mb-0.5 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{m.from}</p>
                    <p>{m.text}</p>
                    <p className={`text-[9px] mt-0.5 ${isMe ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
                      {new Date(m.date).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              value={chatMsg}
              onChange={(e) => setChatMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && chatMsg.trim()) { sendAdminChat(state.currentUser!.email, chatMsg.trim()); setChatMsg(""); } }}
              placeholder="Mensagem para a equipe..."
              className="flex-1 p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary"
            />
            <button onClick={() => { if (chatMsg.trim()) { sendAdminChat(state.currentUser!.email, chatMsg.trim()); setChatMsg(""); } }} className="btn-gradient p-3 rounded-xl">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="glass-card p-6">
          <h3 className="font-bold text-foreground mb-4">Usuários</h3>
          <p className="text-sm text-muted-foreground mb-4">Usuários banidos: {state.bannedUsers.length > 0 ? state.bannedUsers.join(", ") : "Nenhum"}</p>
          <div className="flex gap-2">
            <input id="ban-email" placeholder="Email para banir" className="flex-1 p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
            <button onClick={() => { const el = document.getElementById("ban-email") as HTMLInputElement; if (el.value) { banUser(el.value); el.value = ""; toast.success("Usuário banido!"); } }} className="btn-gradient px-4 py-2 text-xs">Banir</button>
          </div>
          {state.bannedUsers.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {state.bannedUsers.map((e) => (
                <span key={e} className="px-3 py-1.5 bg-destructive/10 rounded-full text-xs font-semibold text-destructive flex items-center gap-2">
                  {e}
                  <button onClick={() => { unbanUser(e); toast.success("Desbanido!"); }} className="font-bold">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {tab === "tags" && (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold text-foreground mb-4">Criar Tag</h3>
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Nome</label>
                <input value={newTagName} onChange={(e) => setNewTagName(e.target.value.slice(0, 20))} placeholder="VIP, Verificado..." className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Cor</label>
                <input type="color" value={newTagColor} onChange={(e) => setNewTagColor(e.target.value)} className="w-14 h-12 rounded-xl bg-muted border-none cursor-pointer" />
              </div>
              <button
                onClick={() => {
                  if (!newTagName.trim()) { toast.error("Digite um nome para a tag."); return; }
                  createUserTag(newTagName, newTagColor);
                  setNewTagName("");
                  toast.success("Tag criada!");
                }}
                className="btn-gradient px-5 py-3 text-sm"
              >
                Criar Tag
              </button>
            </div>

            {(state.userTags || []).length > 0 && (
              <div className="mt-5">
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Tags existentes</h4>
                <div className="flex flex-wrap gap-2">
                  {state.userTags.map((t) => (
                    <span key={t.id} className="px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 text-white" style={{ backgroundColor: t.color }}>
                      {t.name}
                      <button onClick={() => { deleteUserTag(t.id); toast.success("Tag removida!"); }} className="font-black hover:opacity-70" title="Excluir tag">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold text-foreground mb-4">Atribuir Tag a Usuário</h3>
            {(state.userTags || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Crie uma tag primeiro.</p>
            ) : (
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Email do usuário</label>
                  <input value={tagAssignEmail} onChange={(e) => setTagAssignEmail(e.target.value)} placeholder="usuario@email.com" className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
                </div>
                <div className="min-w-[140px]">
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Tag</label>
                  <select value={tagAssignTagId} onChange={(e) => setTagAssignTagId(e.target.value ? +e.target.value : "")} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary">
                    <option value="">Selecione...</option>
                    {state.userTags.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (!tagAssignEmail.trim() || !tagAssignTagId) { toast.error("Preencha email e selecione tag."); return; }
                    assignUserTag(tagAssignEmail.trim(), Number(tagAssignTagId));
                    toast.success("Tag atribuída!");
                    setTagAssignEmail("");
                    setTagAssignTagId("");
                  }}
                  className="btn-gradient px-5 py-3 text-sm"
                >
                  Atribuir
                </button>
              </div>
            )}

            {Object.keys(state.userTagAssignments || {}).length > 0 && (
              <div className="mt-5">
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">Atribuições atuais</h4>
                <div className="space-y-2">
                  {Object.entries(state.userTagAssignments).map(([email, tagIds]) => (
                    <div key={email} className="bg-muted rounded-xl p-3">
                      <p className="text-sm font-bold text-foreground mb-2">{email}</p>
                      <div className="flex flex-wrap gap-2">
                        {tagIds.map((tid) => {
                          const tag = state.userTags.find((t) => t.id === tid);
                          if (!tag) return null;
                          return (
                            <span key={tid} className="px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 text-white" style={{ backgroundColor: tag.color }}>
                              {tag.name}
                              <button onClick={() => { unassignUserTag(email, tid); toast.success("Tag removida do usuário!"); }} className="hover:opacity-70">×</button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        <div className="bg-card p-5 rounded-3xl border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Taxa Plataforma</p>
          <p className="text-2xl font-black text-foreground">{state.config.commission}%</p>
        </div>
        <div className="bg-card p-5 rounded-3xl border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Produtos</p>
          <p className="text-2xl font-black text-foreground">{state.products.length}</p>
        </div>
        <div className="bg-card p-5 rounded-3xl border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Compras</p>
          <p className="text-2xl font-black text-foreground">{state.purchases.length}</p>
        </div>
        <div className="bg-card p-5 rounded-3xl border border-border/40">
          <p className="text-[10px] font-bold text-muted-foreground uppercase">Disputas</p>
          <p className="text-2xl font-black text-destructive">{state.purchases.filter((p) => p.status === "dispute").length}</p>
        </div>
      </div>
    </div>
  );
}
