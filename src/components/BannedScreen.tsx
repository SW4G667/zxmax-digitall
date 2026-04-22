import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldX, LogOut } from "lucide-react";

interface BannedScreenProps {
  reason: string;
  bannedAt: string;
  userId: string;
  onLogout: () => void;
}

export default function BannedScreen({ reason, bannedAt, userId, onLogout }: BannedScreenProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-gradient-page">
      <div className="glass-card w-full max-w-md p-8 text-center animate-fade-in-up">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="w-10 h-10 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">Conta Banida</h1>
        <p className="text-muted-foreground mb-6">
          Sua conta foi banida da plataforma.
        </p>

        <div className="bg-muted/50 border border-border/50 rounded-2xl p-5 mb-6 text-left space-y-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Identificador Único (UUID)</span>
            <code className="text-xs font-mono text-primary bg-primary/5 p-2 rounded-lg break-all border border-primary/10">{userId}</code>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Data da Restrição</span>
              <span className="text-sm font-bold text-foreground">{formatDate(bannedAt)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status da Conta</span>
              <span className="text-sm font-bold text-destructive flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span>
                Banida
              </span>
            </div>
          </div>
          <div className="flex flex-col pt-2 border-t border-border/30">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Motivo da Decisão</span>
            <p className="text-sm text-foreground leading-relaxed italic">"{reason}"</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Se voce acredita que isso foi um erro, entre em contato com o suporte.
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
