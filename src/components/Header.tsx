import React, { useEffect, useState } from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Search, Menu, Wallet } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import DiscordIcon from "@/components/DiscordIcon";

interface Props {
  onProfileClick?: () => void;
  onAuthClick?: () => void;
  onMenuClick?: () => void;
}

export default function Header({ onProfileClick, onAuthClick, onMenuClick }: Props) {
  const { state, isDark, toggleDark } = useStore();
  const { profile, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  // Persist search in a tiny custom event so StoreView can react.
  useEffect(() => {
    const handler = () => setQ("");
    window.addEventListener("zxmax:clear-search", handler);
    return () => window.removeEventListener("zxmax:clear-search", handler);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    window.dispatchEvent(new CustomEvent("zxmax:search", { detail: q.trim() }));
    navigate("/loja");
  };

  return (
    <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-xl border-b border-border/60">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-4">
        <button
          onClick={onMenuClick}
          className="p-2 rounded-lg hover:bg-muted transition shrink-0 group"
          title="Menu"
          aria-label="Abrir menu"
        >
          {/* Três barrinhas estilo GGMAX */}
          <div className="flex flex-col gap-[5px] w-5">
            <span className="block h-[2px] w-5 bg-foreground group-hover:bg-primary transition rounded-full" />
            <span className="block h-[2px] w-4 bg-foreground group-hover:bg-primary transition rounded-full" />
            <span className="block h-[2px] w-5 bg-foreground group-hover:bg-primary transition rounded-full" />
          </div>
        </button>

        <button onClick={() => navigate("/loja")} className="shrink-0 flex items-center" aria-label="Ir para a loja">
          <h2 className="text-xl sm:text-2xl font-black tracking-tighter text-foreground">
            ZX<span className="text-primary">MAX</span>
          </h2>
        </button>

        <form onSubmit={submitSearch} className="hidden md:flex items-center bg-muted rounded-lg px-3 py-2 flex-1 max-w-xl border border-border/50 focus-within:border-primary transition">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar Robux, bots, contas, scripts..."
            className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-foreground placeholder:text-muted-foreground"
          />
        </form>

        <div className="flex items-center gap-1 sm:gap-2 ml-auto">
          {state.config.discordLink && (
            <a href={state.config.discordLink} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-muted transition hidden sm:inline-flex" title="Discord">
              <DiscordIcon className="w-5 h-5 text-muted-foreground" />
            </a>
          )}
          <NotificationBell />
          <button onClick={toggleDark} className="p-2 rounded-lg hover:bg-muted transition" title="Mudar tema">
            {isDark ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
          </button>
          {user ? (
            <button onClick={onProfileClick} className="flex items-center gap-2.5 hover:bg-muted p-1 pr-2 rounded-lg transition">
              <div className="text-right hidden sm:block leading-tight">
                <p className="text-xs font-bold text-foreground flex items-center gap-1.5 justify-end">
                  {profile?.display_name || user.email?.split("@")[0]}
                  {isAdmin && <span className="admin-badge !text-[9px] !px-1.5 !py-[1px]">ADM</span>}
                </p>
                <p className="text-[11px] font-semibold text-primary flex items-center gap-1 justify-end">
                  <Wallet className="w-3 h-3" /> R$ {Number(state.currentUser?.balance ?? 0).toFixed(2)}
                </p>
              </div>
              <img src={profile?.avatar_url || state.currentUser?.avatar} alt="Avatar" className="w-9 h-9 rounded-lg bg-primary/10 border-2 border-card shadow-sm object-cover" />
            </button>
          ) : (
            <button onClick={onAuthClick} className="btn-gradient px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5">
              Entrar
            </button>
          )}
        </div>
      </div>

      {/* Mobile search */}
      <form onSubmit={submitSearch} className="md:hidden px-3 pb-3">
        <div className="flex items-center bg-muted rounded-lg px-3 py-2 border border-border/50">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar produtos..."
            className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </form>
    </header>
  );
}
