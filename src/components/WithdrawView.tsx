import React, { useState } from "react";
import { Wallet, ShieldCheck, Clock3, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/StoreContext";
import { Button } from "@/components/ui/button";
import { formatBRL } from "@/lib/catalog";
import { WITHDRAW_FEE, WITHDRAW_MIN, withdrawTotals } from "@/lib/fees";

export default function WithdrawView() {
  const { state, requestWithdraw } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const user = state.currentUser;
  const totals = withdrawTotals(user?.balance ?? 0);

  const myWithdrawals = state.withdrawals.filter((w) => w.userId === user?.id);
  const pending = myWithdrawals.filter((w) => w.status === "pending");
  const rejected = myWithdrawals.filter((w) => w.status === "rejected" && !myWithdrawals.some((r) => r.retryOf === w.id));

  const submit = async (retryOf?: number) => {
    if (!user?.isVerified) return toast.error("Conclua a verificação de identidade antes de sacar.");
    if (!user.pixKey) return toast.error("Cadastre uma chave Pix no seu perfil.");
    if (!totals.canWithdraw) return toast.error(totals.reason || `O saque mínimo é ${formatBRL(WITHDRAW_MIN)}.`);
    setSubmitting(true);
    try {
      await requestWithdraw("normal", retryOf ? { retryOf } : undefined);
      toast.success(retryOf ? "Saque reenviado para análise." : "Solicitação registrada. Após aprovação o Pix sai pela ZennithPay.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível registrar o saque.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Wallet className="w-7 h-7 text-[#0084ff]" /> Sacar dinheiro
        </h1>
        <p className="text-white/40 mt-2">Receba seu saldo por Pix. Mínimo {formatBRL(WITHDRAW_MIN)}, taxa fixa de {formatBRL(WITHDRAW_FEE)}.</p>
      </div>

      <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6 mb-4">
        <p className="text-xs font-bold uppercase text-white/30">Saldo disponível</p>
        <p className="text-3xl font-black text-white mt-1">{formatBRL(user?.balance ?? 0)}</p>
        <div className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between text-white/60"><span>Taxa de saque</span><span className="text-[#ffbd2e] font-bold">− {formatBRL(WITHDRAW_FEE)}</span></div>
          <div className="flex justify-between text-white font-black"><span>Você recebe</span><span>{formatBRL(totals.net)}</span></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-6 text-sm">
          <div className="bg-[#0a0a0f] border border-[#25252e] p-4 rounded-xl flex gap-3 text-white/70">
            <ShieldCheck className="w-5 h-5 text-[#00c950] shrink-0" />
            <span>Conta {user?.isVerified ? "verificada" : "ainda não verificada"}</span>
          </div>
          <div className="bg-[#0a0a0f] border border-[#25252e] p-4 rounded-xl flex gap-3 text-white/70">
            <Clock3 className="w-5 h-5 text-[#0084ff] shrink-0" />
            <span>Pix via ZennithPay após aprovação</span>
          </div>
        </div>
      </div>

      <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6">
        <p className="text-xs font-bold uppercase text-white/30">Chave Pix</p>
        <p className="text-sm text-white mt-1 break-all">{user?.pixKey || "Nenhuma chave cadastrada"}</p>
        <Button onClick={() => submit()} disabled={submitting || !user || !totals.canWithdraw} className="w-full bg-[#ffbd2e] hover:bg-[#e6a829] text-black font-black mt-5">
          {submitting ? "Enviando solicitação..." : `Solicitar saque de ${formatBRL(totals.balance)}`}
        </Button>
        {!totals.canWithdraw && totals.reason && (
          <p className="text-xs text-[#ffbd2e] mt-3">{totals.reason}</p>
        )}
      </div>

      {rejected.length > 0 && (
        <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6 mt-4 space-y-3">
          <p className="text-xs font-bold uppercase text-white/30 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Saques recusados
          </p>
          {rejected.map((w) => (
            <div key={w.id} className="bg-[#0a0a0f] border border-[#25252e] p-4 rounded-xl">
              <p className="text-sm font-bold text-white">{formatBRL(w.amount)}</p>
              <p className="text-xs text-red-400 mt-1">Motivo: {w.rejectionReason || "Não informado"}</p>
              <Button variant="secondary" onClick={() => submit(w.id)} disabled={submitting} className="mt-3 h-9 text-xs">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reenviar saque
              </Button>
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="bg-[#15151a] border border-[#25252e] rounded-2xl p-6 mt-4 space-y-2">
          <p className="text-xs font-bold uppercase text-white/30">Em análise</p>
          {pending.map((w) => (
            <div key={w.id} className="flex items-center justify-between text-sm">
              <span className="text-white font-bold">{formatBRL(w.amount)}</span>
              <span className="text-[11px] text-white/40">{new Date(w.createdAt).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
