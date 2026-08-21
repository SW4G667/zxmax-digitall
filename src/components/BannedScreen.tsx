import { useAuth } from "@/hooks/useAuth";

export default function BannedScreen() {
  const { user, profile, banned, signOut } = useAuth();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gradient-page">
      <div className="glass-card w-full max-w-md p-8 bg-card text-center animate-fade-in-up">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
          <span className="text-3xl">🚫</span>
        </div>
        <h1 className="text-2xl font-black text-destructive mb-2">Conta Banida</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Sua conta foi suspensa e você não pode acessar a plataforma.
        </p>

        <div className="bg-muted rounded-2xl p-4 mb-6 text-left space-y-2">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase">Seu ID</p>
            <p className="text-xs text-foreground font-mono break-all">{profile?.public_id || user?.id}</p>
          </div>
          {banned?.reason && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Motivo</p>
              <p className="text-sm text-foreground">{banned.reason}</p>
            </div>
          )}
          {banned?.created_at && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Data do Banimento</p>
              <p className="text-sm text-foreground">
                {new Date(banned.created_at).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          className="w-full bg-destructive text-destructive-foreground py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
