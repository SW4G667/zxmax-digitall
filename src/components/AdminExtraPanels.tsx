import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Ban,
  BarChart3,
  Check,
  Download,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Undo2,
  Users,
} from "lucide-react";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dayKey = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const inLastDays = (iso: string, days: number) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * 24 * 60 * 60 * 1000;
};

const COUNTED = new Set(["paid", "delivered"]);

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(";"));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminStatsPanel() {
  const { state } = useStore();
  const commissionRate = Number(state.config.commission || 0) / 100;

  const stats = useMemo(() => {
    const sales = state.purchases.filter((p) => COUNTED.has(p.status));
    const sales7 = sales.filter((p) => inLastDays(p.createdAt, 7));
    const sales30 = sales.filter((p) => inLastDays(p.createdAt, 30));
    const sum = (list: typeof sales) => list.reduce((a, p) => a + Number(p.amount || 0), 0);
    const rev7 = sum(sales7);
    const rev30 = sum(sales30);
    const ticket = sales.length ? sum(sales) / sales.length : 0;
    const commission = sum(sales) * commissionRate;

    const days: { key: string; label: string; total: number; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      days.push({ key, label, total: 0, count: 0 });
    }
    const byDay = new Map(days.map((d) => [d.key, d]));
    for (const p of sales) {
      const bucket = byDay.get(dayKey(p.createdAt));
      if (!bucket) continue;
      bucket.total += Number(p.amount || 0);
      bucket.count += 1;
    }
    const maxBar = Math.max(1, ...days.map((d) => d.total));

    const funnel = ["pending", "paid", "delivered", "dispute", "cancelled"].map((status) => ({
      status,
      count: state.purchases.filter((p) => p.status === status).length,
    }));

    const productRev = new Map<number, { name: string; count: number; total: number }>();
    for (const p of sales) {
      const prod = state.products.find((x) => x.id === p.productId);
      const name = prod?.name || `Produto #${p.productId}`;
      const cur = productRev.get(p.productId) || { name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(p.amount || 0);
      productRev.set(p.productId, cur);
    }
    const topProducts = [...productRev.values()].sort((a, b) => b.total - a.total).slice(0, 8);

    const sellerRev = new Map<string, { name: string; count: number; total: number }>();
    for (const p of sales) {
      const dir = state.userDirectory?.[p.sellerId];
      const name = dir?.name || p.sellerEmail || p.sellerId;
      const cur = sellerRev.get(p.sellerId) || { name, count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(p.amount || 0);
      sellerRev.set(p.sellerId, cur);
    }
    const topSellers = [...sellerRev.values()].sort((a, b) => b.total - a.total).slice(0, 8);

    return { sales7, sales30, rev7, rev30, ticket, commission, days, maxBar, funnel, topProducts, topSellers };
  }, [state.purchases, state.products, state.userDirectory, commissionRate]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Vendas 7 dias", value: String(stats.sales7.length), hint: brl(stats.rev7) },
          { label: "Vendas 30 dias", value: String(stats.sales30.length), hint: brl(stats.rev30) },
          { label: "Ticket médio", value: brl(stats.ticket), hint: `${state.purchases.filter((p) => COUNTED.has(p.status)).length} pagas` },
          { label: "Receita comissão", value: brl(stats.commission), hint: `${state.config.commission}% da plataforma` },
        ].map((c) => (
          <div key={c.label} className="glass-card p-4">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">{c.label}</p>
            <p className="text-xl font-black text-foreground mt-1">{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-5">
        <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" /> Vendas diárias (14 dias)
        </h3>
        <div className="flex items-end gap-1.5 h-40">
          {stats.days.map((d) => (
            <div key={d.key} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div
                className="w-full rounded-t-md bg-primary/80 min-h-[3px]"
                style={{ height: `${Math.max(4, (d.total / stats.maxBar) * 100)}%` }}
                title={`${d.label}: ${brl(d.total)} (${d.count})`}
              />
              <span className="text-[9px] text-muted-foreground">{d.label.slice(0, 5)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <h3 className="font-bold text-foreground mb-3">Funil de pedidos</h3>
          <div className="space-y-2">
            {stats.funnel.map((f) => {
              const max = Math.max(1, ...stats.funnel.map((x) => x.count));
              return (
                <div key={f.status}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="uppercase font-bold text-muted-foreground">{f.status}</span>
                    <span className="font-black">{f.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(f.count / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-bold text-foreground mb-3">Top produtos</h3>
          {stats.topProducts.length === 0 && <p className="text-xs text-muted-foreground">Sem vendas ainda.</p>}
          <div className="space-y-2">
            {stats.topProducts.map((p) => (
              <div key={p.name} className="flex justify-between gap-2 text-sm">
                <span className="truncate font-semibold">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{p.count} · {brl(p.total)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="font-bold text-foreground mb-3">Top vendedores</h3>
          {stats.topSellers.length === 0 && <p className="text-xs text-muted-foreground">Sem vendas ainda.</p>}
          <div className="space-y-2">
            {stats.topSellers.map((s) => (
              <div key={s.name} className="flex justify-between gap-2 text-sm">
                <span className="truncate font-semibold">{s.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.count} · {brl(s.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminPurchasesPanel() {
  const { state, approvePurchase, revertPurchase } = useStore();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const list = useMemo(() => {
    const query = q.trim().toLowerCase();
    return state.purchases.filter((p) => {
      const matchStatus = status === "all" || p.status === status;
      if (!matchStatus) return false;
      if (!query) return true;
      return (
        String(p.id).includes(query) ||
        (p.buyerEmail || "").toLowerCase().includes(query) ||
        (p.sellerEmail || "").toLowerCase().includes(query) ||
        (p.buyerPublicId || "").includes(query) ||
        (p.sellerPublicId || "").includes(query)
      );
    });
  }, [state.purchases, q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] bg-muted rounded-xl px-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por ID, e-mail ou ID público"
            className="flex-1 bg-transparent py-3 text-sm outline-none"
          />
        </div>
        {["all", "pending", "paid", "delivered", "dispute", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-2 rounded-xl text-xs font-bold ${status === s ? "btn-gradient" : "bg-card border border-border/40"}`}
          >
            {s}
          </button>
        ))}
      </div>
      {list.map((p) => (
        <div key={p.id} className="glass-card p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[180px]">
            <p className="text-sm font-bold">Pedido #{p.id} · {brl(Number(p.amount))}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {p.buyerEmail} → {p.sellerEmail} · {p.status}
            </p>
            <p className="text-[10px] text-muted-foreground">{new Date(p.createdAt).toLocaleString("pt-BR")}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                approvePurchase(p.id);
                toast.success(`Pedido #${p.id} aprovado.`);
              }}
              className="px-3 py-1.5 text-[11px] font-bold bg-success/10 text-success rounded-lg inline-flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> Aprovar
            </button>
            <button
              onClick={() => {
                revertPurchase(p.id);
                toast.success(`Pedido #${p.id} revertido.`);
              }}
              className="px-3 py-1.5 text-[11px] font-bold bg-destructive/10 text-destructive rounded-lg inline-flex items-center gap-1"
            >
              <Undo2 className="w-3.5 h-3.5" /> Reverter
            </button>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">Nenhuma compra neste filtro.</p>}
    </div>
  );
}

interface BanRow {
  id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
  active: boolean;
}

export function AdminModerationPanel() {
  const { banUser, unbanUser } = useStore();
  const [identifier, setIdentifier] = useState("");
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const [bans, setBans] = useState<BanRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBans = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bans")
      .select("id, user_id, reason, created_at, active")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error("Não foi possível carregar os bans.");
      return;
    }
    setBans((data || []) as BanRow[]);
  };

  useEffect(() => {
    void loadBans();
  }, []);

  const filtered = bans.filter((b) => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return (
      b.user_id.toLowerCase().includes(query) ||
      (b.reason || "").toLowerCase().includes(query)
    );
  });

  const handleBan = async () => {
    if (!identifier.trim()) return toast.error("Informe o ID público, e-mail ou UUID.");
    const ok = await banUser(identifier.trim(), reason.trim() || "Violação das regras da plataforma");
    if (!ok) return toast.error("Não foi possível banir. Confira o identificador.");
    toast.success("Usuário banido.");
    setIdentifier("");
    setReason("");
    void loadBans();
  };

  const handleUnban = async (id: string) => {
    const ok = await unbanUser(id);
    if (!ok) return toast.error("Não foi possível desbanir.");
    toast.success("Usuário desbanido.");
    void loadBans();
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-6 space-y-3">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Ban className="w-4 h-4 text-destructive" /> Banir usuário
        </h3>
        <p className="text-xs text-muted-foreground">Aceita ID público numérico, e-mail ou UUID do Auth.</p>
        <input
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="ID público, e-mail ou UUID"
          className="w-full p-3 rounded-xl bg-muted text-sm outline-none"
        />
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo do banimento"
          rows={3}
          className="w-full p-3 rounded-xl bg-muted text-sm outline-none resize-none"
        />
        <button onClick={() => void handleBan()} className="bg-destructive text-white px-5 py-3 rounded-xl text-xs font-bold">
          Banir
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold flex-1">Bans ativos ({filtered.length})</h3>
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ban" className="flex-1 bg-transparent py-2.5 text-sm outline-none" />
          </div>
          <button onClick={() => void loadBans()} className="p-2.5 rounded-xl bg-card border border-border/40">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {filtered.map((b) => (
          <div key={b.id} className="glass-card p-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono break-all">{b.user_id}</p>
              <p className="text-sm">{b.reason || "Sem motivo"}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(b.created_at).toLocaleString("pt-BR")}</p>
            </div>
            <button
              onClick={() => void handleUnban(b.user_id)}
              className="px-3 py-2 text-[11px] font-bold bg-success/10 text-success rounded-lg"
            >
              Desbanir
            </button>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-10">Nenhum ban ativo.</p>
        )}
      </div>
    </div>
  );
}

export function AdminToolsPanel() {
  const { state, refreshProducts, refreshPurchases } = useStore();

  const exportSales = () => {
    downloadCsv(
      "zxmax-vendas.csv",
      ["id", "produto", "comprador", "vendedor", "status", "valor", "criado_em"],
      state.purchases.map((p) => [p.id, p.productId, p.buyerEmail, p.sellerEmail, p.status, Number(p.amount).toFixed(2).replace(".", ","), p.createdAt]),
    );
    toast.success("CSV de vendas baixado.");
  };

  const exportProducts = () => {
    downloadCsv(
      "zxmax-produtos.csv",
      ["id", "nome", "categoria", "vendedor", "preco", "aprovado", "vendas"],
      state.products.map((p) => [p.id, p.name, p.category, p.seller, p.price.toFixed(2).replace(".", ","), p.approved ? "sim" : "nao", p.sales]),
    );
    toast.success("CSV de produtos baixado.");
  };

  const exportUsers = () => {
    downloadCsv(
      "zxmax-usuarios.csv",
      ["uuid", "id_publico", "nome", "email", "verificado"],
      Object.values(state.userDirectory || {}).map((u) => [u.userId, u.publicId, u.name, u.email, u.isVerified ? "sim" : "nao"]),
    );
    toast.success("CSV de usuários baixado.");
  };

  const reload = async () => {
    const tid = toast.loading("Recarregando dados do site...");
    try {
      await Promise.all([refreshProducts(), refreshPurchases()]);
      toast.success("Dados recarregados.", { id: tid });
    } catch {
      toast.error("Falha ao recarregar.", { id: tid });
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="glass-card p-6 space-y-3">
        <h3 className="font-bold flex items-center gap-2"><Download className="w-4 h-4" /> Exportar CSV (Excel BR)</h3>
        <p className="text-xs text-muted-foreground">Separador ponto-e-vírgula e BOM UTF-8 para abrir certo no Excel.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportSales} className="btn-gradient px-4 py-2.5 rounded-xl text-xs font-bold">Vendas</button>
          <button onClick={exportProducts} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-card border border-border/40">Produtos</button>
          <button onClick={exportUsers} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-card border border-border/40 inline-flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> Usuários
          </button>
        </div>
      </div>
      <div className="glass-card p-6">
        <button onClick={() => void reload()} className="w-full py-3 rounded-xl font-bold text-sm bg-card border border-border/40 inline-flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4" /> Recarregar dados do site
        </button>
      </div>
    </div>
  );
}

export function AdminSessionPanel() {
  const { lockAdminGate, signOut } = useAuth();
  const [aal, setAal] = useState<{ current?: string; next?: string }>({});
  const [busy, setBusy] = useState(false);

  const loadAal = async () => {
    try {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setAal({ current: data?.currentLevel || "aal1", next: data?.nextLevel || undefined });
    } catch {
      setAal({ current: "desconhecido" });
    }
  };

  useEffect(() => {
    void loadAal();
  }, []);

  const endOthers = async () => {
    setBusy(true);
    await signOut("others");
    setBusy(false);
    toast.success("Outras sessões encerradas.");
  };

  const endAll = async () => {
    setBusy(true);
    await signOut("global");
    setBusy(false);
    toast.success("Todas as sessões foram encerradas.");
  };

  const lockPanel = () => {
    lockAdminGate();
    toast.success("Painel admin trancado. Será pedido o código 2FA de novo.");
  };

  const level = (aal.current || "aal1").toUpperCase();
  const strong = level === "AAL2";

  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="font-bold text-foreground flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-primary" /> Sessão e dispositivos
      </h3>
      <div className={`inline-flex items-center gap-2 text-xs font-black px-3 py-1.5 rounded-full ${strong ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
        {strong ? <ShieldCheck className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
        Nível desta sessão: {level}
      </div>
      <p className="text-xs text-muted-foreground">
        AAL1 = senha apenas. AAL2 = senha + autenticador. O painel admin deve operar em AAL2.
      </p>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => void endOthers()} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-card border border-border/40">
          Encerrar outras sessões
        </button>
        <button disabled={busy} onClick={() => void endAll()} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-destructive/10 text-destructive inline-flex items-center gap-1">
          <LogOut className="w-3.5 h-3.5" /> Encerrar TODAS as sessões
        </button>
        <button onClick={lockPanel} className="px-4 py-2.5 rounded-xl text-xs font-bold bg-muted inline-flex items-center gap-1">
          <Lock className="w-3.5 h-3.5" /> Trancar painel admin
        </button>
      </div>
    </div>
  );
}
