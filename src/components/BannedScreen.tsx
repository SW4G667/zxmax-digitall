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

        <div className="bg-muted rounded-2xl p-4 mb-6 text-left space-y-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">ID do Usuario</p>
            <p className="text-sm font-mono text-foreground break-all">{userId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Data do Banimento</p>
            <p className="text-sm text-foreground">{formatDate(bannedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Motivo</p>
            <p className="text-sm text-foreground">{reason}</p>
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
