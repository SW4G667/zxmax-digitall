import React, { useEffect, useState } from "react";
import { Heart, Menu, Search, Settings, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useStore } from "@/store/StoreContext";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";
import DiscordIcon from "@/components/DiscordIcon";
import useFavorites from "@/hooks/useFavorites";
import { useSiteBranding } from "@/context/SiteBrandingContext";

interface Props {
  onProfileClick?: () => void;
  onAuthClick?: () => void;
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

export default function Header({ onProfileClick, onAuthClick, onMenuClick, menuOpen = false }: Props) {
  const { state } = useStore();
  const { profile, user, isAdmin } = useAuth();
  const { branding } = useSiteBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const { count } = useFavorites();
  const [favCount, setFavCount] = useState(count);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setQuery(params.get("q") || "");
  }, [location.search]);

  useEffect(() => {
    setFavCount(count);
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail === "number") setFavCount(detail);
    };
    window.addEventListener("zxmax:favorites-updated", handler as EventListener);
    return () => window.removeEventListener("zxmax:favorites-updated", handler as EventListener);
  }, [count]);

  useEffect(() => {
    const handler = () => setQuery("");
    window.addEventListener("zxmax:clear-search", handler);
    return () => window.removeEventListener("zxmax:clear-search", handler);
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    navigate(value ? `/loja?q=${encodeURIComponent(value)}` : "/loja");
    window.dispatchEvent(new CustomEvent("zxmax:search", { detail: value }));
  };

  const openListing = () => {
    if (!user) {
      onAuthClick?.();
      return;
    }
    navigate("/meus-produtos");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0b0b0e]/95 backdrop-blur-lg">
      <div className="mx-auto max-w-[1240px] px-3 sm:px-4">
        <div className="flex h-16 items-center gap-2 sm:gap-3">
          <button onClick={() => navigate("/")} className="shrink-0" aria-label="Ir para a página inicial">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.siteName} className="h-8 max-w-[140px] object-contain object-left" />
            ) : (
              <span className="text-xl font-extrabold tracking-[-0.05em] text-white">{branding.siteName || "ZXMAX"}</span>
            )}
          </button>

          <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 md:flex">
            <div className="flex h-10 w-full max-w-xl items-center rounded-lg border border-white/[0.1] bg-[#151519] px-3 focus-within:border-[#168cff]/60">
              <Search className="h-4 w-4 shrink-0 text-white/30" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar anúncios..."
                aria-label="Buscar no marketplace"
                className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={openListing}
              aria-label={user ? "Abrir meus anúncios" : "Anunciar"}
              className="hidden h-9 items-center rounded-md bg-[#168cff] px-4 text-xs font-bold text-white transition hover:bg-[#0878dc] sm:flex"
            >
              Anunciar
            </button>

            <button onClick={() => navigate("/favoritos")} className="zx-icon-action relative hidden sm:flex" aria-label="Favoritos" title="Favoritos">
              <Heart className={`h-4 w-4 ${favCount ? "fill-[#57aaff] text-[#57aaff]" : ""}`} />
              {favCount > 0 ? <span className="absolute -right-1 -top-1 rounded-full bg-[#168cff] px-1 text-[8px] font-bold text-white">{favCount > 99 ? "99+" : favCount}</span> : null}
            </button>

            <NotificationBell />

            <a
              href={branding.supportUrl || state.config.discordLink || "https://discord.gg/zxmax"}
              target="_blank"
              rel="noopener noreferrer"
              className="zx-icon-action hidden sm:flex border-[#5865F2]/25"
              title="Comunidade"
              aria-label="Abrir comunidade no Discord"
            >
              <DiscordIcon className="h-4 w-4" />
            </a>

            {isAdmin ? (
              <button onClick={() => navigate("/admin/branding")} className="zx-icon-action hidden sm:flex" aria-label="Personalizar site" title="Personalizar site">
                <Settings className="h-4 w-4" />
              </button>
            ) : null}

            {user ? (
              <button onClick={onProfileClick} className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.09] bg-[#151519] px-2 transition hover:border-white/[0.16]">
                {profile?.avatar_url || state.currentUser?.avatar ? (
                  <img src={profile?.avatar_url || state.currentUser?.avatar} alt="Avatar" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[#222228] text-[10px] font-bold text-white">{(profile?.display_name || user.email || "U").slice(0, 1).toUpperCase()}</span>
                )}
                <span className="hidden text-left lg:block">
                  <span className="block max-w-[90px] truncate text-[11px] font-semibold text-white">{profile?.display_name || user.email?.split("@")[0]}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[9px] text-white/35"><Wallet className="h-3 w-3" /> R$ {Number(state.currentUser?.balance ?? 0).toFixed(2)}</span>
                </span>
              </button>
            ) : (
              <button onClick={onAuthClick} aria-label="Entrar para anunciar" className="rounded-md border border-white/[0.12] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.05] hover:text-white">
                Entrar
              </button>
            )}

            <button
              onClick={onMenuClick}
              className="zx-icon-action"
              aria-label="Abrir menu principal"
              aria-expanded={menuOpen}
              aria-controls="zxmax-main-menu"
              title="Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={submitSearch} className="pb-3 md:hidden">
          <div className="flex h-10 items-center rounded-lg border border-white/[0.09] bg-[#151519] px-3 focus-within:border-[#168cff]/60">
            <Search className="h-4 w-4 shrink-0 text-white/30" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar anúncios..."
              aria-label="Buscar no marketplace"
              className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
            />
          </div>
        </form>
      </div>
    </header>
  );
}
