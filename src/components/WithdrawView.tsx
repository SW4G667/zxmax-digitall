import React, { useState } from "react";
import { Wallet, ShieldCheck, Clock3, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/StoreContext";
import { Button } from "@/components/ui/button";

export default function WithdrawView() {
  const { state, requestWithdraw } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const user = state.currentUser;

  const myWithdrawals = state.withdrawals.filter((w) => w.userId === user?.id);
  const pending = myWithdrawals.filter((w) => w.status === "pending");
  const rejected = myWithdrawals.filter((w) => w.status === "rejected" && !myWithdrawals.some((r) => r.retryOf === w.id));

  const submit = async (retryOf?: number) => {
    if (!user?.isVerified) return toast.error("Conclua a verificação de identidade antes de sacar.");
    if (!user.pixKey) return toast.error("Cadastre uma chave Pix no seu perfil.");
    if (user.balance < 2) return toast.error("O saque mínimo é R$ 2,00.");
    setSubmitting(true);
    try {
      await requestWithdraw("normal", retryOf ? { retryOf } : undefined);
      toast.success(retryOf ? "Saque reenviado para análise." : "Solicitação registrada para análise.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível registrar o saque.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-foreground flex items-center gap-3">
          <Wallet className="w-7 h-7 text-primary" /> Sacar dinheiro
        </h1>
        <p className="text-muted-foreground mt-2">Receba seu saldo por Pix após a análise de segurança.</p>
      </div>

      <div className="glass-card p-6 mb-4">
        <p className="text-xs font-bold uppercase text-muted-foreground">Saldo disponível</p>
        <p className="text-3xl font-black text-foreground mt-1">R$ {user?.balance.toFixed(2) || "0,00"}</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-6 text-sm">
          <div className="bg-muted p-4 rounded-xl flex gap-3">
            <ShieldCheck className="w-5 h-5 text-success shrink-0" />
            <span>Conta {user?.isVerified ? "verificada" : "ainda não verificada"}</span>
          </div>
          <div className="bg-muted p-4 rounded-xl flex gap-3">
            <Clock3 className="w-5 h-5 text-primary shrink-0" />
            <span>Prazo estimado de 5 a 7 dias úteis</span>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <p className="text-xs font-bold uppercase text-muted-foreground">Chave Pix</p>
        <p className="text-sm text-foreground mt-1 break-all">{user?.pixKey || "Nenhuma chave cadastrada"}</p>
        <Button onClick={() => submit()} disabled={submitting || !user} className="w-full btn-gradient mt-5">
          {submitting ? "Enviando solicitação..." : "Solicitar saque"}
        </Button>
      </div>

      {rejected.length > 0 && (
        <div className="glass-card p-6 mt-4 space-y-3">
          <p className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" /> Saques recusados
          </p>
          {rejected.map((w) => (
            <div key={w.id} className="bg-muted p-4 rounded-xl">
              <p className="text-sm font-bold text-foreground">R$ {w.amount.toFixed(2)}</p>
              <p className="text-xs text-destructive mt-1">Motivo: {w.rejectionReason || "Não informado"}</p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Corrija os dados (chave Pix e documentos no seu perfil) e reenvie a solicitação.
              </p>
              <Button
                variant="secondary"
                onClick={() => submit(w.id)}
                disabled={submitting}
                className="mt-3 h-9 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reenviar saque
              </Button>
            </div>
          ))}
        </div>
      )}

      {pending.length > 0 && (
        <div className="glass-card p-6 mt-4 space-y-2">
          <p className="text-xs font-bold uppercase text-muted-foreground">Em análise</p>
          {pending.map((w) => (
            <div key={w.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground font-bold">R$ {w.amount.toFixed(2)}</span>
              <span className="text-[11px] text-muted-foreground">{new Date(w.createdAt).toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
