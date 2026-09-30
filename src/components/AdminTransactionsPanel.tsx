import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/catalog";

type Row = {
  type: string;
  id: string;
  publicId?: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  status?: string;
  description?: string;
  occurredAt: string;
};

export default function AdminTransactionsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [publicId, setPublicId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("get_admin_financial_activity", { _limit: 200 });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível carregar as transações.");
      return;
    }
    setRows(Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => [row.type, row.id, row.publicId, row.userName, row.userEmail, row.status, row.description]
      .some((value) => String(value || "").toLowerCase().includes(needle)));
  }, [query, rows]);

  const adjust = async (direction: "debit" | "credit") => {
    const id = Number(publicId);
    const parsed = Number(String(amount).replace(",", "."));
    const cleanReason = reason.trim();
    if (!Number.isSafeInteger(id) || id <= 0) return toast.error("Informe um ID público válido.");
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) return toast.error("Informe um valor válido.");
    if (cleanReason.length < 8 || cleanReason.length > 300) return toast.error("O motivo deve ter de 8 a 300 caracteres.");
    const signed = direction === "debit" ? -Math.abs(parsed) : Math.abs(parsed);
    if (direction === "debit" && !window.confirm(`Debitar ${formatBRL(parsed)} da carteira do ID ${id}? O ajuste ficará registrado na auditoria.`)) return;

    setBusy(true);
    const { data, error } = await (supabase as any).rpc("admin_adjust_wallet_balance", {
      _public_id: id,
      _amount: signed,
      _reason: cleanReason,
    });
    setBusy(false);
    if (error || data?.success !== true) {
      toast.error(error?.message || data?.error || "Não foi possível aplicar o ajuste.");
      return;
    }
    toast.success(`Ajuste registrado. Novo saldo: ${formatBRL(Number(data.newBalance || 0))}.`);
    setAmount("");
    setReason("");
    await load();
  };

  return (
    <div className="space-y-5">
      <section className="glass-card border border-white/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-black text-foreground"><Wallet className="h-5 w-5 text-[#168cff]" /> Transações e saldos</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Compras, cobranças, carteira e saques. Ajustes manuais exigem motivo e entram no log administrativo.</p>
          </div>
          <button onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-foreground disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</button>
        </div>

        <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.045] p-4">
          <div className="flex gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
            <div>
              <p className="text-xs font-bold text-amber-100">Ajuste financeiro auditado</p>
              <p className="mt-1 text-[11px] leading-5 text-amber-100/55">Use débito apenas após revisão documentada, por exemplo para tarifa evadida ou prejuízo comprovado. O saldo nunca pode ficar negativo e o usuário pode contestar pelo suporte.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-[150px_150px_1fr_auto_auto]">
            <input value={publicId} onChange={(e) => setPublicId(e.target.value.replace(/\D/g, ""))} placeholder="ID público" className="rounded-xl bg-muted p-3 text-xs text-foreground outline-none" />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Valor R$" className="rounded-xl bg-muted p-3 text-xs text-foreground outline-none" />
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Motivo obrigatório e específico" className="rounded-xl bg-muted p-3 text-xs text-foreground outline-none" />
            <button disabled={busy} onClick={() => void adjust("debit")} className="rounded-xl bg-red-500/15 px-4 py-3 text-xs font-black text-red-200 disabled:opacity-40">Debitar</button>
            <button disabled={busy} onClick={() => void adjust("credit")} className="rounded-xl bg-emerald-500/15 px-4 py-3 text-xs font-black text-emerald-200 disabled:opacity-40">Creditar</button>
          </div>
        </div>
      </section>

      <section className="glass-card overflow-hidden border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div>
            <h3 className="text-sm font-black text-foreground">Histórico financeiro</h3>
            <p className="mt-1 text-[10px] text-muted-foreground">{filtered.length} registro(s) carregado(s)</p>
          </div>
          <label className="flex h-10 min-w-[220px] items-center rounded-xl border border-white/10 bg-muted px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar ID, usuário ou tipo" className="ml-2 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none" />
          </label>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Carregando transações...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Nenhuma transação encontrada.</div>
        ) : (
          <div className="divide-y divide-white/[0.07]">
            {filtered.map((row, index) => (
              <article key={`${row.type}:${row.id}:${index}`} className="grid gap-3 p-4 sm:grid-cols-[1.1fr_1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-foreground">{row.description || row.type}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{row.type} · #{row.id} · {new Date(row.occurredAt).toLocaleString("pt-BR")}</p>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-foreground">{row.userName || "Usuário"} {row.publicId ? `· ID ${row.publicId}` : ""}</p>
                  <p className="mt-1 truncate text-[9px] text-muted-foreground">{row.userEmail || "—"} {row.status ? `· ${row.status}` : ""}</p>
                </div>
                <p className={`text-right text-sm font-black ${Number(row.amount) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{Number(row.amount) >= 0 ? "+" : ""}{formatBRL(Number(row.amount || 0))}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
