import React, { useState } from "react";
import { Wallet, ShieldCheck, Clock3, RotateCcw, AlertTriangle, ArrowDownToLine, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/StoreContext";
import { Button } from "@/components/ui/button";

export default function WithdrawView() {
  const { state, requestWithdraw } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("");
  const user = state.currentUser;

  const minWithdraw = state.config.minWithdraw || 5.00;
  const withdrawFee = state.config.withdrawFee || 1.20;

  const availableBalance = user?.balance || 0;
  const amountToWithdraw = customAmount ? parseFloat(customAmount) : availableBalance;
  const validAmount = !isNaN(amountToWithdraw) && amountToWithdraw >= minWithdraw && amountToWithdraw <= availableBalance;
  const netToReceive = validAmount ? Math.max(0, amountToWithdraw - withdrawFee) : 0;

  const myWithdrawals = state.withdrawals.filter((w) => w.userId === user?.id && w.method !== "admin_fee");
  const pending = myWithdrawals.filter((w) => w.status === "pending");
  const rejected = myWithdrawals.filter((w) => w.status === "rejected" && !myWithdrawals.some((r) => r.retryOf === w.id));
  const approved = myWithdrawals.filter((w) => w.status === "approved");

  const submit = async (retryOf?: number) => {
    if (!user?.isVerified) {
      return toast.error("Conclua a verificação de identidade no seu perfil antes de sacar.");
    }
    if (!user.pixKey) {
      return toast.error("Cadastre uma chave Pix no seu perfil antes de solicitar saque.");
    }
    if (availableBalance < minWithdraw) {
      return toast.error(`O saldo mínimo para saque é R$ ${minWithdraw.toFixed(2).replace(".", ",")}.`);
    }

    const finalAmount = retryOf ? undefined : (customAmount ? parseFloat(customAmount) : availableBalance);
    if (!retryOf && (!finalAmount || finalAmount < minWithdraw)) {
      return toast.error(`O valor mínimo para saque é R$ ${minWithdraw.toFixed(2).replace(".", ",")}.`);
    }
    if (!retryOf && finalAmount && finalAmount > availableBalance) {
      return toast.error("Valor solicitado é maior que seu saldo disponível.");
    }

    setSubmitting(true);
    try {
      await requestWithdraw("normal", { retryOf, amount: finalAmount });
      setCustomAmount("");
      toast.success(retryOf ? "Saque reenviado para análise." : "Solicitação de saque enviada com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível registrar o saque.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up pb-20 px-4">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-3">
          <Wallet className="w-7 h-7 text-primary" /> Sacar Dinheiro
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Receba seus lucros diretamente na sua conta bancária via Pix.
        </p>
      </div>

      {/* Saldo Disponível Card */}
      <div className="glass-card p-6 mb-4 border border-border/40 rounded-2xl">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Saldo Disponível</p>
            <p className="text-3xl sm:text-4xl font-black text-foreground mt-1">
              R$ {availableBalance.toFixed(2).replace(".", ",")}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              Saque Mínimo: R$ {minWithdraw.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-6 text-xs">
          <div className="bg-muted/70 p-3.5 rounded-xl flex items-center gap-3 border border-border/20">
            <ShieldCheck className="w-5 h-5 text-success shrink-0" />
            <span className="font-semibold text-foreground">
              Conta {user?.isVerified ? "verificada (aprovada)" : "não verificada (envie documento)"}
            </span>
          </div>
          <div className="bg-muted/70 p-3.5 rounded-xl flex items-center gap-3 border border-border/20">
            <Clock3 className="w-5 h-5 text-primary shrink-0" />
            <span className="font-semibold text-foreground">Prazo de 5 a 7 dias úteis</span>
          </div>
        </div>
      </div>

      {/* Formulário de Saque */}
      <div className="glass-card p-6 mb-6 border border-border/40 rounded-2xl space-y-4">
        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground block mb-1.5">
            Valor do Saque (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
              R$
            </span>
            <input
              type="number"
              step="0.01"
              min={minWithdraw}
              max={availableBalance}
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={availableBalance >= minWithdraw ? availableBalance.toFixed(2) : "0,00"}
              className="w-full pl-10 pr-20 py-3.5 rounded-xl bg-muted border border-border/40 text-foreground font-bold text-base focus:ring-2 focus:ring-primary outline-none"
            />
            {availableBalance >= minWithdraw && (
              <button
                type="button"
                onClick={() => setCustomAmount(availableBalance.toFixed(2))}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 text-xs font-black bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition"
              >
                Tudo
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Mínimo: R$ {minWithdraw.toFixed(2).replace(".", ",")}
          </p>
        </div>

        {/* Resumo do Saque & Taxa */}
        <div className="rounded-xl bg-muted/60 p-4 border border-border/30 space-y-2 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Valor Solicitado:</span>
            <span className="font-bold text-foreground">
              R$ {(validAmount ? amountToWithdraw : (availableBalance >= minWithdraw ? availableBalance : 0)).toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span className="flex items-center gap-1">
              Taxa de transferência Pix:
              <Info className="w-3 h-3 text-muted-foreground/60" />
            </span>
            <span className="font-bold text-destructive">
              - R$ {withdrawFee.toFixed(2).replace(".", ",")}
            </span>
          </div>
          <div className="pt-2 border-t border-border/30 flex justify-between text-sm font-black">
            <span className="text-foreground">Valor Líquido a Receber no Pix:</span>
            <span className="text-success text-base">
              R$ {(validAmount ? netToReceive : Math.max(0, (availableBalance >= minWithdraw ? availableBalance : 0) - withdrawFee)).toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
            Chave Pix de Destino
          </label>
          <div className="p-3.5 rounded-xl bg-muted border border-border/40 flex items-center justify-between">
            <span className="text-sm font-mono text-foreground break-all">
              {user?.pixKey || "Nenhuma chave Pix cadastrada"}
            </span>
          </div>
          {!user?.pixKey && (
            <p className="text-xs text-destructive mt-1 font-semibold">
              Cadastre sua chave Pix no seu perfil antes de sacar.
            </p>
          )}
        </div>

        <Button
          onClick={() => submit()}
          disabled={submitting || !user || availableBalance < minWithdraw || !user.pixKey || !user.isVerified}
          className="w-full btn-gradient py-4 text-sm font-black rounded-xl"
        >
          {submitting ? (
            "Enviando solicitação..."
          ) : (
            <>
              <ArrowDownToLine className="w-4 h-4 mr-2" /> Solicitar Saque via Pix
            </>
          )}
        </Button>
      </div>

      {/* Recusados */}
      {rejected.length > 0 && (
        <div className="glass-card p-6 mb-4 space-y-3 border border-destructive/30 rounded-2xl">
          <p className="text-xs font-bold uppercase text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Saques Recusados
          </p>
          {rejected.map((w) => (
            <div key={w.id} className="bg-muted p-4 rounded-xl">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-foreground">R$ {w.amount.toFixed(2).replace(".", ",")}</p>
                  <p className="text-xs text-destructive mt-1">Motivo: {w.rejectionReason || "Não informado"}</p>
                </div>
                <span className="text-[10px] uppercase font-bold bg-destructive/10 text-destructive px-2 py-1 rounded">
                  Recusado
                </span>
              </div>
              <Button
                variant="secondary"
                onClick={() => submit(w.id)}
                disabled={submitting}
                className="mt-3 h-9 text-xs font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reenviar Solicitação
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Em Análise (Pendentes) */}
      {pending.length > 0 && (
        <div className="glass-card p-6 mb-4 space-y-3 border border-border/40 rounded-2xl">
          <p className="text-xs font-bold uppercase text-[#ffbd2e] flex items-center gap-2">
            <Clock3 className="w-4 h-4" /> Em Análise ({pending.length})
          </p>
          {pending.map((w) => (
            <div key={w.id} className="bg-muted/60 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">
                  R$ {w.amount.toFixed(2).replace(".", ",")}
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    (Líquido: R$ {(w.netAmount || (w.amount - withdrawFee)).toFixed(2).replace(".", ",")})
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {new Date(w.createdAt).toLocaleString("pt-BR")} · Chave: {w.pixKey}
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase bg-[#ffbd2e]/10 text-[#ffbd2e] px-2.5 py-1 rounded-full">
                Pendente
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Histórico Concluídos */}
      {approved.length > 0 && (
        <div className="glass-card p-6 space-y-3 border border-border/40 rounded-2xl">
          <p className="text-xs font-bold uppercase text-success flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Saques Pagos ({approved.length})
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {approved.map((w) => (
              <div key={w.id} className="bg-muted/40 p-3 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-foreground">
                    R$ {w.amount.toFixed(2).replace(".", ",")}
                    <span className="text-muted-foreground font-normal ml-1">
                      (Recebido: R$ {(w.netAmount || (w.amount - withdrawFee)).toFixed(2).replace(".", ",")})
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(w.createdAt).toLocaleString("pt-BR")}
                    {w.providerTxId ? ` · TX: ${w.providerTxId}` : ""}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase bg-success/10 text-success px-2 py-0.5 rounded">
                  Pago via Pix
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
