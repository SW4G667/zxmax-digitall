import React, { useEffect, useState } from "react";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { Sun, Moon, Search, Wallet, Heart, ChevronDown, Menu } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import DiscordIcon from "@/components/DiscordIcon";
import BrandLogo from "@/components/BrandLogo";
import useFavorites from "@/hooks/useFavorites";
import { ROBUX_CATEGORY } from "@/lib/catalog";

interface Props {
  onProfileClick?: () => void;
  onAuthClick?: () => void;
  onMenuClick?: () => void;
}

export default function Header({ onProfileClick, onAuthClick, onMenuClick }: Props) {
  const { state, isDark, toggleDark } = useStore();
  const { profile, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const { count } = useFavorites();
  const [favCount, setFavCount] = useState(count);
  const [catsOpen, setCatsOpen] = useState(false);

  const categories = state.config.categories.filter((c) => c !== ROBUX_CATEGORY);

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

  const goCategory = (cat: string) => {
    setCatsOpen(false);
    if (cat === ROBUX_CATEGORY) navigate("/robux");
    else navigate(`/loja?cat=${encodeURIComponent(cat)}`);
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-[#0a0a0f] border-b border-[#e6e8ec] dark:border-[#1e1e28]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-4">
        <button onClick={() => navigate("/loja")} className="shrink-0 flex items-center" aria-label="Ir para a loja">
          <BrandLogo />
        </button>

        <form onSubmit={submitSearch} className="hidden md:flex items-center gg-search flex-1 max-w-xl">
          <Search className="w-4 h-4 text-[#9ca3af]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="O que você está procurando?"
            className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-foreground placeholder:text-[#9ca3af]"
          />
        </form>

        <div className="flex items-center gap-1 ml-auto">
          <div className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setCatsOpen((v) => !v)}
              className="flex items-center gap-1 px-3 py-2 text-sm font-semibold text-foreground/80 hover:text-[#2B7FFF]"
            >
              Categorias <ChevronDown className="w-4 h-4" />
            </button>
            {catsOpen && (
              <div className="absolute right-0 top-11 w-64 bg-card border border-border rounded-xl shadow-xl p-2 z-50">
                <button onClick={() => goCategory(ROBUX_CATEGORY)} className="w-full text-left px-3 py-2 rounded-lg text-sm font-bold hover:bg-muted text-[#2B7FFF]">
                  Robux
                </button>
                {categories.map((cat) => (
                  <button key={cat} onClick={() => goCategory(cat)} className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted text-foreground">
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => navigate("/faq")} className="hidden lg:block px-3 py-2 text-sm font-semibold text-foreground/80 hover:text-[#2B7FFF]">
            Como funciona
          </button>

          <a href={state.config.discordLink || "https://discord.gg/zxmax"} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center" title="Entrar no Discord">
            <DiscordIcon className="w-4 h-4 text-[#5865F2]" />
          </a>

          <button onClick={() => navigate("/favoritos")} className="relative w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center" title="Favoritos">
            <Heart className={`w-4 h-4 ${favCount > 0 ? "text-[#2B7FFF] fill-[#2B7FFF]" : "text-muted-foreground"}`} />
            {favCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-[#2B7FFF] text-white text-[9px] font-black min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center">{favCount > 99 ? "99+" : favCount}</span>}
          </button>

          <NotificationBell />

          <button onClick={toggleDark} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center" title="Mudar tema">
            {isDark ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
          </button>

          {user ? (
            <>
              <button
                onClick={() => navigate("/meus-produtos")}
                className="hidden sm:flex items-center btn-anunciar"
                title="Criar um anúncio"
              >
                Anunciar
              </button>
              <button onClick={onProfileClick} className="flex items-center gap-2 hover:bg-muted p-1 pr-2 rounded-full transition">
                <div className="text-right hidden sm:block leading-tight">
                  <p className="text-xs font-bold text-foreground flex items-center gap-1 justify-end">{profile?.display_name || user.email?.split("@")[0]} {isAdmin && <span className="admin-badge">ADM</span>}</p>
                  <p className="text-[11px] font-bold text-[#2B7FFF] flex items-center gap-1 justify-end"><Wallet className="w-3 h-3" /> R$ {Number(state.currentUser?.balance ?? 0).toFixed(2)}</p>
                </div>
                <img src={profile?.avatar_url || state.currentUser?.avatar} alt="Avatar" className="w-8 h-8 rounded-full bg-[#2B7FFF]/10 border border-border object-cover" />
              </button>
            </>
          ) : (
            <>
              <button onClick={onAuthClick} className="hidden sm:flex items-center btn-anunciar" title="Criar um anúncio">
                Anunciar
              </button>
              <button onClick={onAuthClick} className="px-3 py-2 text-sm font-bold text-[#2B7FFF] hover:bg-muted rounded-full">
                Entrar
              </button>
            </>
          )}

          <button onClick={onMenuClick} className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center" title="Menu" aria-label="Abrir menu">
            <Menu className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      <form onSubmit={submitSearch} className="md:hidden px-3 pb-3">
        <div className="gg-search">
          <Search className="w-4 h-4 text-[#9ca3af]" />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produtos..." className="bg-transparent border-none focus:ring-0 focus:outline-none text-sm w-full ml-2 text-foreground placeholder:text-[#9ca3af]" />
        </div>
      </form>
    </header>
  );
}
