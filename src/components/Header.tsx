import React, { useEffect, useState } from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Sun, Moon, Search, Wallet, Heart } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import DiscordIcon from "@/components/DiscordIcon";
import useFavorites from "@/hooks/useFavorites";

interface Props {
  onProfileClick?: () => void;
  onAuthClick?: () => void;
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

export default function Header({ onProfileClick, onAuthClick, onMenuClick, menuOpen = false }: Props) {
  const { state, isDark, toggleDark } = useStore();
  const { profile, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const { count } = useFavorites();
  const [favCount, setFavCount] = useState(count);

  useEffect(() => {
    setFavCount(count);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "number") setFavCount(detail);
    };
    window.addEventListener("zxmax:favorites-updated", handler as EventListener);
    return () => window.removeEventListener("zxmax:favorites-updated", handler as EventListener);
  }, [count]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlQ = params.get("q") || "";
    if (urlQ) setQ(urlQ);
  }, [location.search]);

  useEffect(() => {
    const handler = () => setQ("");
    window.addEventListener("zxmax:clear-search", handler);
    return () => window.removeEventListener("zxmax:clear-search", handler);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) {
      navigate("/loja");
      window.dispatchEvent(new CustomEvent("zxmax:search", { detail: "" }));
      return;
    }
    navigate(`/loja?q=${encodeURIComponent(trimmed)}`);
    window.dispatchEvent(new CustomEvent("zxmax:search", { detail: trimmed }));
  };

  const openListing = () => {
    if (!user) {
      onAuthClick?.();
      return;
    }
    navigate("/meus-produtos");
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0f] border-b border-[#1e1e28]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-4">
        <button onClick={() => navigate("/loja")} className="shrink-0 flex items-center" aria-label="Ir para a loja">
          <h2 className="text-lg sm:text-2xl font-black tracking-[-0.06em] text-white">ZX<span className="text-[#168cff]">MAX</span></h2>
        </button>

        <button
          onClick={openListing}
          className="sm:hidden shrink-0 rounded-full bg-[#168cff] px-3 py-2 text-[10px] font-black text-white shadow-[0_8px_18px_rgba(0,132,255,0.18)] transition hover:bg-[#0877eb] active:scale-[0.97]"
          aria-label={user ? "Abrir meus anúncios" : "Entrar para anunciar"}
        >
          + Anunciar
        </button>

        <form onSubmit={submitSearch} className="hidden md:flex items-center bg-[#15151a] border border-[#25252e] rounded-xl px-3 py-2 flex-1 max-w-xl focus-within:border-[#0084ff]/50 transition">
          <Search className="w-4 h-4 text-white/30" />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar Robux, bots, contas, scripts..." className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-white placeholder:text-white/30" />
        </form>

        <div className="flex items-center gap-1 ml-auto">
          <a href={state.config.discordLink || "https://discord.gg/zxmax"} target="_blank" rel="noopener noreferrer" className="zx-icon-action hidden xs:flex border-[#5865F2]/25 bg-[#5865F2]/10 hover:bg-[#5865F2]/20" title="Entrar no Discord">
            <DiscordIcon className="w-4 h-4 text-[#5865F2]" />
          </a>

          <button onClick={() => navigate("/favoritos")} className="zx-icon-action relative hidden sm:flex" title="Favoritos" aria-label="Favoritos">
            <Heart className={`w-4 h-4 ${favCount > 0 ? "text-[#0084ff] fill-[#0084ff]" : "text-white/40"}`} />
            {favCount > 0 && <span className="absolute -top-1 -right-1 bg-[#0084ff] text-white text-[9px] font-black min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center">{favCount > 99 ? "99+" : favCount}</span>}
          </button>

          <NotificationBell />

          <button onClick={toggleDark} className="zx-icon-action hidden sm:flex" title="Mudar tema" aria-label="Mudar tema">
            {isDark ? <Sun className="w-4 h-4 text-white/40" /> : <Moon className="w-4 h-4 text-white/40" />}
          </button>

          {user ? (
            <>
              <button
                onClick={openListing}
                className="hidden sm:flex items-center gap-1.5 rounded-full bg-[#168cff] px-4 py-2 text-xs font-black text-white shadow-[0_8px_18px_rgba(0,132,255,0.18)] transition hover:bg-[#0877eb] active:scale-[0.97]"
                title="Criar um anúncio"
              >
                + Anunciar
              </button>
              <button onClick={onProfileClick} className="flex items-center gap-2 hover:bg-white/5 p-1 pr-2 rounded-xl transition border border-transparent hover:border-white/10">
                <div className="text-right hidden sm:block leading-tight">
                  <p className="text-xs font-bold text-white flex items-center gap-1 justify-end">{profile?.display_name || user.email?.split("@")[0]} {isAdmin && <span className="bg-[#ff8c00] text-white text-[8px] px-1.5 py-0.5 rounded-full uppercase font-black">ADM</span>}</p>
                  <p className="text-[11px] font-bold text-[#0084ff] flex items-center gap-1 justify-end"><Wallet className="w-3 h-3" /> R$ {Number(state.currentUser?.balance ?? 0).toFixed(2)}</p>
                </div>
                <img src={profile?.avatar_url || state.currentUser?.avatar} alt="Avatar" className="w-8 h-8 rounded-lg bg-[#0084ff]/10 border border-white/10 object-cover" />
              </button>
            </>
          ) : (
            <button onClick={onAuthClick} className="bg-[#0084ff] hover:bg-[#0066cc] text-white px-4 py-2 text-xs font-black rounded-xl transition">Entrar</button>
          )}
          <button
            onClick={onMenuClick}
            className={`zx-icon-action group ${menuOpen ? "border-[#168cff]/60 bg-[#168cff]/15" : ""}`}
            title="Abrir menu"
            aria-label="Abrir menu principal"
            aria-expanded={menuOpen}
            aria-controls="zxmax-main-menu"
          >
            <span className="flex w-[17px] flex-col gap-[3px]" aria-hidden>
              <span className="h-[1.5px] w-full rounded-full bg-white transition group-hover:bg-[#6dbdff]" />
              <span className="h-[1.5px] w-full rounded-full bg-white transition group-hover:bg-[#6dbdff]" />
              <span className="h-[1.5px] w-full rounded-full bg-white transition group-hover:bg-[#6dbdff]" />
            </span>
          </button>
        </div>
      </div>

      <form onSubmit={submitSearch} className="md:hidden px-3 pb-3">
        <div className="flex items-center bg-[#15151a] border border-[#25252e] rounded-xl px-3 py-2.5">
          <Search className="w-4 h-4 text-white/30" />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos..." className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-white placeholder:text-white/30" />
        </div>
      </form>
    </header>
  );
}
