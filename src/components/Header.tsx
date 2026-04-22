import React from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/hooks/useAuth";
import { Sun, Moon, Search } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import DiscordIcon from "@/components/DiscordIcon";

interface Props {
  onProfileClick?: () => void;
}

export default function Header({ onProfileClick }: Props) {
  const { state, isDark, toggleDark } = useStore();
  const { profile } = useAuth();
  const user = state.currentUser;

  return (
    <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-black tracking-tighter text-foreground shrink-0">
          ZX<span className="text-primary">MAX</span>
        </h2>

        <div className="hidden md:flex items-center bg-muted rounded-full px-4 py-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar bots, contas, scripts..."
            className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {state.config.discordLink && (
            <a href={state.config.discordLink} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl hover:bg-muted transition" title="Discord">
              <DiscordIcon className="w-5 h-5 text-muted-foreground" />
            </a>
          )}
          <NotificationBell />
          <button onClick={toggleDark} className="p-2 rounded-xl hover:bg-muted transition" title="Mudar tema">
            {isDark ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
          </button>
          {user && (
            <button onClick={onProfileClick} className="flex items-center gap-2.5 hover:bg-muted p-1.5 rounded-2xl transition">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-foreground leading-tight">{profile?.display_name || user.name}</p>
                <p className="text-xs font-medium text-success">R$ {user.balance.toFixed(2)}</p>
              </div>
              <img src={profile?.avatar_url || user.avatar} alt="Avatar" className="w-9 h-9 rounded-full bg-primary/10 border-2 border-card shadow-sm" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
