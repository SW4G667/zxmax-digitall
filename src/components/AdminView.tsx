import React, { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { ShieldEmoji } from "@/components/CustomEmojis";
import { toast } from "sonner";

type AdminTab = "config" | "categories" | "products" | "purchases" | "withdrawals" | "support" | "notices" | "users";

export default function AdminView() {
  const { state, updateConfig, approveProduct, rejectProduct, approvePurchase, revertPurchase, approveWithdraw, rejectWithdraw, banUser, unbanUser, replyTicket, setGlobalNotice } = useStore();
  const [tab, setTab] = useState<AdminTab>("config");
  const [newCat, setNewCat] = useState("");
  const [notice, setNotice] = useState(state.config.globalNotice);
  const [adminReply, setAdminReply] = useState("");

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "config", label: "Config" },
    { key: "categories", label: "Categorias" },
    { key: "products", label: "Produtos" },
    { key: "purchases", label: "Compras" },
    { key: "withdrawals", label: "Saques" },
    { key: "support", label: "Suporte" },
    { key: "notices", label: "Avisos" },
    { key: "users", label: "Usuários" },
  ];

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
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Stripe Publishable Key</label>
              <input value={state.config.stripePublishableKey} onChange={(e) => updateConfig({ stripePublishableKey: e.target.value })} className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" />
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

      {/* Products */}
      {tab === "products" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30 flex justify-between items-center">
            <h3 className="font-bold text-foreground">Todos os Produtos</h3>
            <span className="admin-badge">{state.products.filter((p) => !p.approved).length} pendentes</span>
          </div>
          <div className="divide-y divide-border/20">
            {state.products.map((p) => (
              <div key={p.id} className="p-4 flex items-center gap-4">
                <img src={p.image} className="w-12 h-12 rounded-xl object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.seller} · {p.category}</p>
                </div>
                <p className="font-bold text-foreground text-sm">R$ {p.price.toFixed(2)}</p>
                {!p.approved ? (
                  <div className="flex gap-2">
                    <button onClick={() => { approveProduct(p.id); toast.success("Aprovado!"); }} className="text-success font-bold text-xs">Aprovar</button>
                    <button onClick={() => { rejectProduct(p.id); toast.error("Rejeitado!"); }} className="text-destructive font-bold text-xs">Rejeitar</button>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full">Ativo</span>
                )}
              </div>
            ))}
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
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${p.status === "paid" ? "bg-primary/10 text-primary" : p.status === "delivered" ? "bg-success/10 text-success" : p.status === "dispute" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>{p.status}</span>
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

      {/* Support */}
      {tab === "support" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30">
            <h3 className="font-bold text-foreground">Tickets de Suporte</h3>
          </div>
          {state.tickets.length === 0 ? (
            <p className="p-6 text-muted-foreground text-center text-sm">Nenhum ticket.</p>
          ) : (
            <div className="divide-y divide-border/20">
              {state.tickets.map((t) => (
                <div key={t.id} className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-foreground text-sm">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{t.userEmail}</p>
                  </div>
                  <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                    {t.messages.map((m, i) => (
                      <div key={i} className={`p-2 rounded-xl text-xs ${m.from === "admin@keybot.com" ? "bg-primary/10 ml-6" : "bg-muted mr-6"} text-foreground`}>
                        <span className="font-bold">{m.from === "admin@keybot.com" ? "Admin" : m.from}:</span> {m.text}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={adminReply} onChange={(e) => setAdminReply(e.target.value)} placeholder="Responder..." className="flex-1 p-2 rounded-xl bg-muted text-foreground text-xs border-none outline-none focus:ring-2 ring-primary" />
                    <button onClick={() => { if (adminReply) { replyTicket(t.id, adminReply); setAdminReply(""); toast.success("Resposta enviada!"); } }} className="btn-gradient px-3 py-1 text-xs">Enviar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Notices */}
      {tab === "notices" && (
        <div className="glass-card p-6">
          <h3 className="font-bold text-foreground mb-4">Aviso Global</h3>
          <textarea value={notice} onChange={(e) => setNotice(e.target.value)} rows={4} placeholder="Escreva um aviso para todos os usuários..." className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary resize-none mb-3" />
          <div className="flex gap-2">
            <button onClick={() => { setGlobalNotice(notice); toast.success("Aviso publicado!"); }} className="btn-gradient px-5 py-2 text-sm">Publicar</button>
            <button onClick={() => { setGlobalNotice(""); setNotice(""); toast.success("Aviso removido!"); }} className="px-5 py-2 text-sm text-destructive font-bold">Limpar</button>
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
