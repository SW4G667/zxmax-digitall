import React, { useState } from "react";
import { Wallet, ShieldCheck, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/StoreContext";
import { Button } from "@/components/ui/button";

export default function WithdrawView() {
  const { state, requestWithdraw } = useStore();
  const [submitting, setSubmitting] = useState(false);
  const user = state.currentUser;
  const submit = async () => {
    if (!user?.isVerified) return toast.error("Conclua a verificação de identidade antes de sacar.");
    if (!user.pixKey) return toast.error("Cadastre uma chave Pix no seu perfil.");
    if (user.balance < 5) return toast.error("O saque mínimo é R$ 5,00.");
    setSubmitting(true);
    try { await requestWithdraw("normal"); toast.success("Solicitação registrada para análise."); }
    finally { setSubmitting(false); }
  };
  return <div className="max-w-2xl mx-auto animate-fade-in-up pb-20">
    <div className="mb-8"><h1 className="text-3xl font-black text-foreground flex items-center gap-3"><Wallet className="w-7 h-7 text-primary" /> Sacar dinheiro</h1><p className="text-muted-foreground mt-2">Receba seu saldo por Pix após a análise de segurança.</p></div>
    <div className="glass-card p-6 mb-4"><p className="text-xs font-bold uppercase text-muted-foreground">Saldo disponível</p><p className="text-3xl font-black text-foreground mt-1">R$ {user?.balance.toFixed(2) || "0,00"}</p><div className="grid sm:grid-cols-2 gap-3 mt-6 text-sm"><div className="bg-muted p-4 rounded-xl flex gap-3"><ShieldCheck className="w-5 h-5 text-success shrink-0" /><span>Conta {user?.isVerified ? "verificada" : "ainda não verificada"}</span></div><div className="bg-muted p-4 rounded-xl flex gap-3"><Clock3 className="w-5 h-5 text-primary shrink-0" /><span>Prazo estimado de 5 a 7 dias úteis</span></div></div></div>
    <div className="glass-card p-6"><p className="text-xs font-bold uppercase text-muted-foreground">Chave Pix</p><p className="text-sm text-foreground mt-1 break-all">{user?.pixKey || "Nenhuma chave cadastrada"}</p><Button onClick={submit} disabled={submitting || !user} className="w-full btn-gradient mt-5">{submitting ? "Enviando solicitação..." : "Solicitar saque"}</Button></div>
  </div>;
}