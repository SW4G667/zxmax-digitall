import React, { useState } from "react";
import { Wallet, ShieldCheck, Clock3, RotateCcw, AlertTriangle, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/StoreContext";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/catalog";
import { withdrawTotals } from "@/lib/fees";

export default function WithdrawView() {
  const { state, requestWithdraw } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const user = state.currentUser;
  const minWithdraw = Number(state.config.withdrawMin ?? 5);
  const withdrawFee = Number(state.config.withdrawFee ?? 3.5);
  const totals = withdrawTotals(user?.balance ?? 0, { min: minWithdraw, fee: withdrawFee });

  const myWithdrawals = state.withdrawals.filter((w) => w.userId === user?.id);
  const pending = myWithdrawals.filter((w) => w.status === "pending");
  const rejected = myWithdrawals.filter((w) => w.status === "rejected" && !myWithdrawals.some((r) => r.retryOf === w.id));

  const submit = async (retry?: { id: number; amount: number }) => {
    if (!user?.isVerified) return toast.error("Conclua a verificação de identidade antes de sacar.");
    if (!user.pixKey) return toast.error("Cadastre uma chave Pix no seu perfil.");
    const amount = retry?.amount ?? totals.balance;
    const check = withdrawTotals(amount, { min: minWithdraw, fee: withdrawFee });
    if (!check.canWithdraw) return toast.error(check.reason || `O saque mínimo é ${formatBRL(minWithdraw)}.`);

    setSubmitting(true);
    try {
      await requestWithdraw("normal", retry ? { retryOf: retry.id, amount: retry.amount } : undefined);
      toast.success(retry ? "Saque reenviado para análise." : "Solicitação registrada. O valor líquido fica congelado com a taxa vigente deste pedido.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível registrar o saque.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in-up pb-20">
      <header className="mb-6 border-b border-white/[0.07] pb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#67b4ff]">Carteira</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-[-0.03em] text-white">
          <Wallet className="h-5 w-5 text-[#67b4ff]" /> Sacar por Pix
        </h1>
        <p className="mt-2 text-sm text-white/40">Saque mínimo {formatBRL(minWithdraw)} · taxa atual {formatBRL(withdrawFee)}.</p>
      </header>

      <section className="rounded-xl border border-white/[0.08] bg-[#111114] p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/30">Saldo liberado</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-white">{formatBRL(user?.balance ?? 0)}</p>

        <div className="mt-5 divide-y divide-white/[0.06] rounded-lg border border-white/[0.07] bg-[#0c0c0f] px-4">
          <div className="flex items-center justify-between py-3 text-sm text-white/50"><span>Valor solicitado</span><strong className="text-white">{formatBRL(totals.balance)}</strong></div>
          <div className="flex items-center justify-between py-3 text-sm text-white/50"><span>Taxa de saque</span><strong className="text-white">− {formatBRL(totals.fee)}</strong></div>
          <div className="flex items-center justify-between py-3 text-sm"><span className="font-semibold text-white">Você recebe</span><strong className="text-base text-[#6bd59a]">{formatBRL(totals.net)}</strong></div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2 rounded-lg border border-white/[0.07] p-3 text-xs leading-5 text-white/48">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#66d295]" />
            <span>{user?.isVerified ? "Identidade verificada para saque." : "Verifique sua identidade antes de solicitar saque."}</span>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-white/[0.07] p-3 text-xs leading-5 text-white/48">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#67b4ff]" />
            <span>Após aprovação administrativa, o Pix é processado pelo gateway de saque configurado.</span>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-white/[0.08] bg-[#111114] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CircleDollarSign className="mt-0.5 h-4 w-4 text-[#67b4ff]" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white">Chave Pix cadastrada</p>
            <p className="mt-1 break-all text-xs text-white/42">{user?.pixKey || "Nenhuma chave cadastrada"}</p>
          </div>
        </div>

        <Button onClick={() => submit()} disabled={submitting || !user || !totals.canWithdraw} className="mt-5 w-full bg-[#168cff] font-semibold text-white hover:bg-[#0878dc]">
          {submitting ? "Registrando..." : `Solicitar saque de ${formatBRL(totals.balance)}`}
        </Button>
        {!totals.canWithdraw && totals.reason ? <p className="mt-3 text-xs text-amber-300/75">{totals.reason}</p> : null}
      </section>

      {rejected.length > 0 ? (
        <section className="mt-3 rounded-xl border border-white/[0.08] bg-[#111114] p-5">
          <p className="flex items-center gap-2 text-xs font-semibold text-white"><AlertTriangle className="h-4 w-4 text-red-400" /> Saques recusados</p>
          <div className="mt-3 space-y-2">
            {rejected.map((w) => (
              <div key={w.id} className="rounded-lg border border-white/[0.07] bg-[#0c0c0f] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{formatBRL(w.amount)}</p>
                    <p className="mt-0.5 text-[11px] text-red-300/70">Motivo: {w.rejectionReason || "Não informado"}</p>
                  </div>
                  <Button variant="secondary" onClick={() => submit({ id: w.id, amount: w.amount })} disabled={submitting} className="h-8 text-[11px]">
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reenviar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {pending.length > 0 ? (
        <section className="mt-3 rounded-xl border border-white/[0.08] bg-[#111114] p-5">
          <p className="text-xs font-semibold text-white">Em análise</p>
          <div className="mt-3 divide-y divide-white/[0.06]">
            {pending.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-semibold text-white">{formatBRL(w.netAmount ?? Math.max(0, w.amount - (w.fee ?? withdrawFee)))} líquido</p>
                  <p className="text-[10px] text-white/30">Solicitado: {formatBRL(w.amount)} · taxa: {formatBRL(w.fee ?? withdrawFee)}</p>
                </div>
                <span className="text-[10px] text-white/30">{new Date(w.createdAt).toLocaleString("pt-BR")}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
