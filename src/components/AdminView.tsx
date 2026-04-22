import React, { useState } from "react";
import { useStore, Product, Purchase, Withdrawal, SupportTicket } from "@/store/StoreContext";
import { ShieldEmoji, StarEmoji, ChatEmoji, BagCheckEmoji, MoneyEmoji } from "@/components/CustomEmojis";
import { X, Eye, Send, Copy, Check, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type AdminTab = "config" | "categories" | "products" | "purchases" | "withdrawals" | "support" | "notices" | "adminchat";

const purchaseStatusMap: Record<Purchase["status"], { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  paid: { label: "Pago", cls: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  delivered: { label: "Entregue", cls: "bg-primary/20 text-primary border-primary/30" },
  dispute: { label: "Disputa", cls: "bg-destructive/20 text-destructive border-destructive/30" },
};

const withdrawalStatusMap: Record<Withdrawal["status"], { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  approved: { label: "Aprovado", cls: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  rejected: { label: "Rejeitado", cls: "bg-destructive/20 text-destructive border-destructive/30" },
};

export default function AdminView() {
  const {
    state, updateConfig, approveProduct, rejectProduct, 
    banUser, unbanUser, setGlobalNotice, publishNotice,
    approvePurchase, rejectWithdraw, approveWithdraw, replyTicket, closeTicket,
  } = useStore();
  const [tab, setTab] = useState<AdminTab>("config");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<number | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [ticketReply, setTicketReply] = useState("");
  const [noticeText, setNoticeText] = useState("");

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "config", label: "Config" },
    { key: "categories", label: "Categorias" },
    { key: "products", label: "Produtos" },
    { key: "purchases", label: "Compras" },
    { key: "withdrawals", label: "Saques" },
    { key: "support", label: "Suporte" },
    { key: "notices", label: "Avisos" },
    { key: "adminchat", label: "Chat Equipe" },
  ];

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success("ID copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

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

          <button onClick={() => toast.success("Configurações salvas!")} className="btn-gradient px-5 py-2.5 text-sm mt-2">Salvar</button>
        </div>
      )}

      {/* Categories */}
      {tab === "categories" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30">
            <h3 className="font-bold text-foreground mb-3">Categorias</h3>
            <div className="flex flex-wrap gap-2">
              {state.config.categories.map((cat, i) => (
                <Badge key={i} className="bg-primary/20 text-primary border border-primary/30 text-xs">
                  {cat}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      {tab === "products" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30 flex justify-between items-center">
            <h3 className="font-bold text-foreground">Produtos Pendentes</h3>
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">
              {state.products.filter(p => !p.approved).length}
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {state.products.filter(p => !p.approved).length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Nenhum produto pendente.</div>
            ) : (
              state.products.filter(p => !p.approved).map((p) => (
                <div key={p.id} className="p-4 flex gap-4 items-start hover:bg-muted/30 transition">
                  <img src={p.image} className="w-12 h-12 rounded-lg object-cover shrink-0" alt="" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">Vendedor: {p.seller}</p>
                    <p className="text-xs text-primary font-bold mt-1">R$ {p.price.toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { approveProduct(p.id); toast.success("Produto aprovado!"); }} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition">
                      ✓ Aprovar
                    </button>
                    <button onClick={() => { rejectProduct(p.id); toast.info("Produto rejeitado."); }} className="px-3 py-1.5 bg-destructive/20 text-destructive rounded-lg text-xs font-bold hover:bg-destructive/30 transition">
                      ✕ Rejeitar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Purchases */}
      {tab === "purchases" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30 flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <BagCheckEmoji className="w-5 h-5" /> Compras
            </h3>
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">
              {state.purchases.length}
            </span>
          </div>
          <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
            {state.purchases.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma compra registrada.</div>
            ) : (
              state.purchases.map((p) => {
                const product = state.products.find(pr => pr.id === p.productId);
                return (
                  <div key={p.id} className="p-4 hover:bg-muted/30 transition cursor-pointer" onClick={() => setSelectedPurchase(p.id)}>
                    <div className="flex gap-3 items-start">
                      {product && <img src={product.image} className="w-10 h-10 rounded-lg object-cover shrink-0" alt="" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{product?.name || "Produto desconhecido"}</p>
                        <p className="text-xs text-muted-foreground">Comprador: {p.buyerEmail}</p>
                        <div className="flex gap-2 items-center mt-1">
                          <Badge className={purchaseStatusMap[p.status].cls}>{purchaseStatusMap[p.status].label}</Badge>
                          <p className="text-xs text-primary font-bold">R$ {p.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Withdrawals */}
      {tab === "withdrawals" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30 flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <MoneyEmoji className="w-5 h-5" /> Saques
            </h3>
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">
              {state.withdrawals.filter(w => w.status === "pending").length}
            </span>
          </div>
          <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
            {state.withdrawals.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">Nenhum saque registrado.</div>
            ) : (
              state.withdrawals.map((w) => (
                <div key={w.id} className="p-4 hover:bg-muted/30 transition">
                  <div className="flex gap-3 items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{w.userEmail}</p>
                      <p className="text-xs text-muted-foreground">Método: {w.method === "instant" ? "Instantâneo" : "Normal"}</p>
                      <p className="text-xs text-primary font-bold mt-1">R$ {w.amount.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Badge className={withdrawalStatusMap[w.status].cls}>{withdrawalStatusMap[w.status].label}</Badge>
                      {w.status === "pending" && (
                        <div className="flex gap-1">
                          <button onClick={() => { approveWithdraw(w.id); toast.success("Saque aprovado!"); }} className="px-2 py-1 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded text-xs font-bold hover:bg-emerald-500/30 transition">
                            Aprovar
                          </button>
                          <button onClick={() => { rejectWithdraw(w.id); toast.info("Saque rejeitado."); }} className="px-2 py-1 bg-destructive/20 text-destructive rounded text-xs font-bold hover:bg-destructive/30 transition">
                            Rejeitar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Support */}
      {tab === "support" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30 flex justify-between items-center">
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <ChatEmoji className="w-5 h-5" /> Suporte
            </h3>
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">
              {state.tickets.filter(t => t.status === "open").length}
            </span>
          </div>
          {selectedTicket ? (
            <div className="p-5">
              <button onClick={() => { setSelectedTicket(null); setTicketReply(""); }} className="text-primary font-semibold text-sm mb-4">← Voltar</button>
              {state.tickets.find(t => t.id === selectedTicket) && (
                <div>
                  <h4 className="font-bold text-foreground mb-3">{state.tickets.find(t => t.id === selectedTicket)?.subject}</h4>
                  <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                    {state.tickets.find(t => t.id === selectedTicket)?.messages.map((m, i) => (
                      <div key={i} className={`p-3 rounded-lg text-sm ${m.from === "admin" ? "bg-primary/10 text-foreground" : "bg-muted text-foreground"}`}>
                        <p className="text-[10px] text-muted-foreground mb-1 font-semibold">{m.from === "admin" ? "Admin" : m.from}</p>
                        <p>{m.text}</p>
                        <p className="text-[9px] text-muted-foreground mt-1">{new Date(m.date).toLocaleString("pt-BR")}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={ticketReply} onChange={(e) => setTicketReply(e.target.value)} placeholder="Sua resposta..." className="flex-1 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" />
                    <button onClick={() => { if (ticketReply.trim()) { replyTicket(selectedTicket, ticketReply); setTicketReply(""); toast.success("Resposta enviada!"); } }} className="btn-gradient p-3"><Send className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => { closeTicket(selectedTicket); setSelectedTicket(null); toast.success("Ticket fechado!"); }} className="mt-3 px-4 py-2 bg-muted text-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition w-full">
                    Fechar Ticket
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/30 max-h-96 overflow-y-auto">
              {state.tickets.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Nenhum ticket registrado.</div>
              ) : (
                state.tickets.map((t) => (
                  <div key={t.id} onClick={() => setSelectedTicket(t.id)} className="p-4 hover:bg-muted/30 transition cursor-pointer flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm truncate">{t.subject}</p>
                      <p className="text-xs text-muted-foreground">De: {t.userEmail}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.messages.length} mensagens</p>
                    </div>
                    <Badge className={t.status === "open" ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground"}>
                      {t.status === "open" ? "Aberto" : "Fechado"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Notices */}
      {tab === "notices" && (
        <div className="glass-card p-6 space-y-4">
          <h3 className="font-bold text-foreground mb-4">Avisos Globais</h3>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">Novo Aviso</label>
            <textarea value={noticeText} onChange={(e) => setNoticeText(e.target.value)} placeholder="Digite um aviso para todos os usuários..." rows={3} className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm resize-none mb-3" />
            <button onClick={() => { if (noticeText.trim()) { publishNotice(noticeText); setNoticeText(""); toast.success("Aviso publicado!"); } }} className="btn-gradient px-5 py-2.5 text-sm">Publicar</button>
          </div>

          <div className="border-t border-border/30 pt-4 mt-4">
            <h4 className="font-bold text-foreground mb-3">Avisos Recentes</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {state.globalNotices.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum aviso publicado.</p>
              ) : (
                state.globalNotices.map((n) => (
                  <div key={n.id} className="p-3 bg-muted/50 rounded-lg border border-border/30">
                    <p className="text-sm text-foreground">{n.text}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.date).toLocaleString("pt-BR")}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Chat */}
      {tab === "adminchat" && (
        <div className="glass-card p-6">
          <h3 className="font-bold text-foreground mb-4">Chat da Equipe Admin</h3>
          <div className="bg-muted/50 rounded-lg p-4 h-64 overflow-y-auto mb-4 space-y-2">
            {state.adminChat.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem no chat.</p>
            ) : (
              state.adminChat.map((m, i) => (
                <div key={i} className="p-2 bg-card rounded text-sm">
                  <p className="text-[10px] text-muted-foreground font-semibold">{m.from}</p>
                  <p className="text-foreground">{m.text}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{new Date(m.date).toLocaleString("pt-BR")}</p>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground italic">Chat da equipe admin — sincronizado em tempo real.</p>
        </div>
      )}
    </div>
  );
}
