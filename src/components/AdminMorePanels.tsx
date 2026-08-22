import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/StoreContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Pause, Search, Trash2, Plus, RefreshCw, Tag, ShoppingBag, Headset, Megaphone } from "lucide-react";

export function AdminCategoriesPanel() {
  const { state, updateConfig } = useStore();
  const [cats, setCats] = useState(state.config.categories.join("\n"));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const list = cats.split("\n").map((c) => c.trim()).filter(Boolean);
    if (!list.length) return toast.error("Inclua ao menos uma categoria.");
    setSaving(true);
    updateConfig({ categories: list });
    const { data: existing } = await (supabase as any).from("app_settings").select("value").eq("key", "platform").maybeSingle();
    const value = { ...(existing?.value || {}), categories: list };
    const { error } = await (supabase as any).from("app_settings").upsert({ key: "platform", value }, { onConflict: "key" });
    setSaving(false);
    error ? toast.error(error.message) : toast.success("Categorias salvas. Aparecem na loja e no formulário de anúncio.");
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="font-bold text-foreground">Categorias da loja</h3>
      <p className="text-xs text-muted-foreground">Uma por linha. Essas categorias aparecem nos filtros e ao criar produto.</p>
      <textarea value={cats} onChange={(e) => setCats(e.target.value)} rows={12} className="w-full p-4 rounded-2xl bg-muted text-sm text-foreground font-mono" />
      <button onClick={save} disabled={saving} className="btn-gradient px-6 py-3 rounded-xl font-bold text-sm">{saving ? "Salvando..." : "Salvar categorias"}</button>
    </div>
  );
}

export function AdminAllProductsPanel() {
  const { state, approveProduct, rejectProduct, refreshProducts } = useStore();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "live">("all");

  const list = useMemo(() => {
    return state.products.filter((p) => {
      const matchQ = !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.seller.toLowerCase().includes(q.toLowerCase());
      const matchF = filter === "all" || (filter === "pending" ? !p.approved : p.approved);
      return matchQ && matchF;
    });
  }, [state.products, q, filter]);

  const pause = async (id: number) => {
    const { error } = await supabase.functions.invoke("admin-verify", { body: { action: "pause_product", productId: id } });
    if (error) return toast.error("Não foi possível pausar.");
    toast.success("Produto pausado (some da loja pública).");
    void refreshProducts();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-muted rounded-xl px-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto ou vendedor" className="flex-1 bg-transparent py-3 text-sm outline-none" />
        </div>
        {(["all", "pending", "live"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl text-xs font-bold ${filter === f ? "btn-gradient" : "bg-card border border-border/40"}`}>
            {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : "No ar"}
          </button>
        ))}
        <button onClick={() => void refreshProducts()} className="p-2.5 rounded-xl bg-card border border-border/40"><RefreshCw className="w-4 h-4" /></button>
      </div>
      {list.map((p) => (
        <div key={p.id} className="glass-card p-4 flex items-center gap-4">
          <img src={p.image} className="w-14 h-14 rounded-xl object-cover" alt="" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate">{p.name}</p>
            <p className="text-[11px] text-muted-foreground">{p.category} · {p.seller} · R$ {p.price.toFixed(2)}</p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${p.approved ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>{p.approved ? "No ar" : "Pendente"}</span>
          <div className="flex gap-1">
            {!p.approved && <button onClick={() => { void approveProduct(p.id); toast.success("Aprovado"); }} className="p-2 bg-success/10 text-success rounded-lg"><Check className="w-4 h-4" /></button>}
            {p.approved && <button onClick={() => void pause(p.id)} className="p-2 bg-muted rounded-lg" title="Pausar"><Pause className="w-4 h-4" /></button>}
            <button onClick={() => { if (confirm("Remover este anúncio?")) void rejectProduct(p.id); }} className="p-2 bg-destructive/10 text-destructive rounded-lg"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">Nenhum produto neste filtro.</p>}
    </div>
  );
}

export function AdminPurchasesPanel() {
  const { state, approvePurchase, revertPurchase } = useStore();
  const [status, setStatus] = useState("all");
  const list = state.purchases.filter((p) => status === "all" || p.status === status);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto">
        {["all", "pending", "paid", "delivered", "dispute", "cancelled"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`px-3 py-2 rounded-xl text-xs font-bold ${status === s ? "btn-gradient" : "bg-card border border-border/40"}`}>{s}</button>
        ))}
      </div>
      {list.map((p) => (
        <div key={p.id} className="glass-card p-4 flex flex-wrap items-center gap-3">
          <ShoppingBag className="w-4 h-4 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Pedido #{p.id} · R$ {Number(p.amount).toFixed(2)}</p>
            <p className="text-[11px] text-muted-foreground truncate">{p.buyerEmail} → {p.sellerEmail} · {p.status}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => approvePurchase(p.id)} className="px-3 py-1.5 text-[11px] font-bold bg-success/10 text-success rounded-lg">Aprovar</button>
            <button onClick={() => revertPurchase(p.id)} className="px-3 py-1.5 text-[11px] font-bold bg-destructive/10 text-destructive rounded-lg">Reverter</button>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">Nenhuma compra.</p>}
    </div>
  );
}

export function AdminTicketsPanel() {
  const { state, replyTicket, closeTicket } = useStore();
  const [selected, setSelected] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const active = state.tickets.find((t) => t.id === selected);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-2">
        {state.tickets.length === 0 && <p className="text-sm text-muted-foreground py-10 text-center">Nenhum ticket ainda.</p>}
        {state.tickets.map((t) => (
          <button key={t.id} onClick={() => setSelected(t.id)} className={`w-full text-left glass-card p-4 ${selected === t.id ? "border-primary" : ""}`}>
            <p className="text-sm font-bold truncate">{t.subject}</p>
            <p className="text-[11px] text-muted-foreground">{t.userEmail} · {t.status}</p>
          </button>
        ))}
      </div>
      <div className="glass-card p-4 min-h-[280px]">
        {!active ? (
          <p className="text-sm text-muted-foreground text-center py-16 flex flex-col items-center gap-2"><Headset className="w-6 h-6" /> Selecione um ticket</p>
        ) : (
          <>
            <div className="flex justify-between mb-3">
              <h4 className="font-bold text-sm">{active.subject}</h4>
              <button onClick={() => closeTicket(active.id)} className="text-[11px] font-bold text-destructive">Fechar</button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
              {active.messages.map((m, i) => (
                <div key={i} className="bg-muted rounded-xl p-2 text-xs">
                  <p className="font-bold">{m.from}</p>
                  <p>{m.text}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={reply} onChange={(e) => setReply(e.target.value)} className="flex-1 p-2 rounded-xl bg-muted text-sm" placeholder="Responder..." />
              <button onClick={() => { if (reply.trim()) { replyTicket(active.id, reply.trim()); setReply(""); } }} className="btn-gradient px-3 rounded-xl text-xs font-bold">Enviar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AdminTagsPanel() {
  const { state, createUserTag, deleteUserTag, assignUserTag } = useStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [email, setEmail] = useState("");
  const [tagId, setTagId] = useState<number | "">("");

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Tag className="w-4 h-4" /> Nova tag</h3>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="flex-1 p-3 rounded-xl bg-muted text-sm" />
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-12 rounded-xl" />
          <button onClick={() => { createUserTag(name, color); setName(""); toast.success("Tag criada"); }} className="btn-gradient px-4 rounded-xl"><Plus className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(state.userTags || []).map((t) => (
          <span key={t.id} className="px-3 py-1.5 rounded-full text-xs font-bold text-white flex items-center gap-2" style={{ background: t.color }}>
            {t.name}
            <button onClick={() => deleteUserTag(t.id)}><Trash2 className="w-3 h-3" /></button>
          </span>
        ))}
      </div>
      <div className="glass-card p-6 space-y-3">
        <h3 className="font-bold">Atribuir tag</h3>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail do usuário" className="w-full p-3 rounded-xl bg-muted text-sm" />
        <select value={tagId} onChange={(e) => setTagId(e.target.value ? Number(e.target.value) : "")} className="w-full p-3 rounded-xl bg-muted text-sm">
          <option value="">Selecione</option>
          {(state.userTags || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <button onClick={() => { if (email && tagId) { assignUserTag(email, Number(tagId)); toast.success("Tag atribuída"); } }} className="btn-gradient px-4 py-2 rounded-xl text-sm font-bold">Atribuir</button>
      </div>
    </div>
  );
}

export function AdminPlatformPanel() {
  const [maintenance, setMaintenance] = useState(false);
  const [message, setMessage] = useState("");
  const [minPrice, setMinPrice] = useState(2);
  const [minWithdraw, setMinWithdraw] = useState(5.0);

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as any).from("app_settings").select("value").eq("key", "platform").maybeSingle();
      if (data?.value) {
        setMaintenance(!!data.value.maintenance);
        setMessage(data.value.maintenance_message || "");
        setMinPrice(Number(data.value.min_product_price || 2));
        setMinWithdraw(Number(data.value.min_withdraw || 5.0));
      }
    })();
  }, []);

  const save = async () => {
    const { data: existing } = await (supabase as any).from("app_settings").select("value").eq("key", "platform").maybeSingle();
    const value = {
      ...(existing?.value || {}),
      maintenance,
      maintenance_message: message,
      min_product_price: minPrice,
      min_withdraw: minWithdraw,
    };
    const { error } = await (supabase as any).from("app_settings").upsert({ key: "platform", value }, { onConflict: "key" });
    error ? toast.error(error.message) : toast.success("Plataforma atualizada.");
  };

  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="font-bold flex items-center gap-2"><Megaphone className="w-4 h-4" /> Plataforma</h3>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} /> Modo manutenção</label>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Mensagem de manutenção" className="w-full p-3 rounded-xl bg-muted text-sm" rows={3} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold">Preço mínimo (R$)
          <input type="number" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} className="w-full mt-1 p-3 rounded-xl bg-muted text-sm" />
        </label>
        <label className="text-xs font-bold">Saque mínimo (R$)
          <input type="number" value={minWithdraw} onChange={(e) => setMinWithdraw(Number(e.target.value))} className="w-full mt-1 p-3 rounded-xl bg-muted text-sm" />
        </label>
      </div>
      <button onClick={save} className="btn-gradient px-6 py-3 rounded-xl font-bold text-sm">Salvar</button>
    </div>
  );
}
