import React, { useState } from "react";
import { useStore, Product, SupportTicket } from "@/store/StoreContext";
import { ShieldEmoji, StarEmoji, ChatEmoji } from "@/components/CustomEmojis";
import { X, Eye, Send, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type AdminTab = "config" | "categories" | "products" | "purchases" | "withdrawals" | "support" | "notices" | "users" | "adminchat";

export default function AdminView() {
  const {
    state, updateConfig, approveProduct, rejectProduct, approvePurchase, revertPurchase,
    approveWithdraw, rejectWithdraw, banUser, unbanUser, replyTicket, setGlobalNotice,
    deleteProduct, closeTicket, resolveTicket, publishNotice, sendAdminChat,
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
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "config", label: "Config" },
    { key: "categories", label: "Categorias" },
    { key: "products", label: "Produtos" },
    { key: "purchases", label: "Compras" },
    { key: "withdrawals", label: "Saques" },
    { key: "support", label: "Suporte" },
    { key: "notices", label: "Avisos" },
    { key: "users", label: "Usuários" },
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

          <div className="border-t border-border/40 pt-4 mt-4">
            <h4 className="font-bold text-foreground mb-3">API AbacatePay</h4>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">AbacatePay API Key</label>
                <input 
                  value={state.config.abacateApiKey || ""} 
                  onChange={(e) => updateConfig({ abacateApiKey: e.target.value })} 
                  placeholder="abc_dev_..." 
                  type="password"
                  className="w-full p-3 rounded-xl bg-muted text-foreground text-sm border-none outline-none focus:ring-2 ring-primary" 
                />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Esta chave e usada para processar pagamentos via PIX.</p>
          </div>

          <button onClick={() => toast.success("Configurações salvas!")} className="btn-gradient px-5 py-2.5 text-sm mt-2">Salvar</button>
        </div>
      )}

      {/* Users Tab with UUID */}
      {tab === "users" && (
        <div className="glass-card overflow-hidden">
          <div className="p-5 border-b border-border/30 flex justify-between items-center">
            <h3 className="font-bold text-foreground">Usuários da Plataforma</h3>
          </div>
          <div className="divide-y divide-border/20">
            {state.users.map((u) => (
              <div key={u.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-10 h-10 rounded-xl object-cover" alt="" />
                    <div>
                      <p className="font-bold text-foreground text-sm">{u.name || "Usuário"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {u.isBanned ? (
                      <button onClick={() => unbanUser(u.id)} className="text-success font-bold text-xs bg-success/10 px-3 py-1.5 rounded-lg">Desbanir</button>
                    ) : (
                      <button onClick={() => banUser(u.id)} className="text-destructive font-bold text-xs bg-destructive/10 px-3 py-1.5 rounded-lg">Banir</button>
                    )}
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded-xl flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-wider mb-1">UUID / ID do Usuário</p>
                    <code className="text-[10px] font-mono text-primary truncate block">{u.id}</code>
                  </div>
                  <button onClick={() => copyToClipboard(String(u.id))} className="p-2 hover:bg-card rounded-lg transition shrink-0">
                    {copiedId === String(u.id) ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outras abas (simplificadas para o build) */}
      {tab !== "config" && tab !== "users" && (
        <div className="p-10 text-center text-muted-foreground text-sm italic">
          Funcionalidade em desenvolvimento ou visualização limitada nesta aba ({tab}).
        </div>
      )}
    </div>
  );
}
