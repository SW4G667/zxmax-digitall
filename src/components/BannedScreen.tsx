import React from "react";
import { ShieldX, LogOut } from "lucide-react";

interface BannedScreenProps {
  reason: string;
  bannedAt: string;
  userId: string;
  onLogout: () => void;
}

export default function BannedScreen({ reason, bannedAt, userId, onLogout }: BannedScreenProps) {
  const formatDate = (dateStr: string) => {
    const parsedDate = new Date(dateStr);

    if (Number.isNaN(parsedDate.getTime())) {
      return "Data nao informada";
    }

    return parsedDate.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-gradient-page">
      <div className="glass-card w-full max-w-xl p-8 md:p-10 text-center animate-fade-in-up">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20">
          <ShieldX className="w-10 h-10 text-destructive" />
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">Conta Banida</h1>
          <p className="text-muted-foreground leading-relaxed max-w-lg mx-auto">
            Seu acesso a plataforma foi bloqueado. Abaixo estao os dados principais da restricao aplicada a esta conta.
          </p>
        </div>

        <div className="bg-muted/50 border border-border/50 rounded-3xl p-5 md:p-6 mb-6 text-left space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">
                Status da Conta
              </span>
              <span className="text-sm font-bold text-destructive flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
                Banida
              </span>
            </div>

            <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-1">
                Data da Restricao
              </span>
              <span className="text-sm font-bold text-foreground">{formatDate(bannedAt)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Identificador Unico (UUID)
            </span>
            <code className="text-xs font-mono text-primary bg-primary/5 p-3 rounded-xl break-all border border-primary/10 block">
              {userId}
            </code>
          </div>

          <div className="rounded-2xl border border-border/40 bg-background/40 p-4">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-2">
              Motivo da Decisao
            </span>
            <p className="text-sm text-foreground leading-relaxed italic">"{reason || "Motivo nao informado"}"</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Se voce acredita que isso aconteceu por engano, utilize os canais oficiais de suporte informando o UUID acima.
        </p>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-4 bg-destructive text-destructive-foreground rounded-2xl font-semibold hover:bg-destructive/90 transition"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </div>
  );
}
