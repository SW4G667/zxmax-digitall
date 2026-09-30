import React, { useEffect, useState } from "react";
import { Heart, Menu, Search, Shield, UserRound, Wallet } from "lucide-react";
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
  const navigate = useNavigate();
  const location = useLocation();
  const { branding } = useSiteBranding();
  const appMode = location.pathname.startsWith("/app");
  const routeOwnsMobileSearch = ["/", "/loja", "/robux", "/categorias"].includes(location.pathname);
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
    // A tela de anúncios valida e-mail confirmado + presença no Discord.
    navigate("/meus-produtos?new=1");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0b0b0e]/95 backdrop-blur-lg">
      <div className="mx-auto max-w-[1240px] px-3 sm:px-4">
        <div className="flex h-14 items-center gap-2 sm:h-16 sm:gap-3">
          <button onClick={() => navigate("/")} className="shrink-0 rounded-md px-1 py-1" aria-label="Ir para a página inicial">
            <span className="inline-flex max-w-[150px] truncate text-[15px] font-extrabold tracking-[-0.045em] text-white">
              {branding.siteName || "ZXMAX"}
            </span>
          </button>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
            <button onClick={() => navigate("/loja")} className="rounded-md px-2.5 py-2 text-xs font-medium text-white/52 transition hover:bg-white/[0.04] hover:text-white">Loja</button>
            <button onClick={() => navigate("/categorias")} className="rounded-md px-2.5 py-2 text-xs font-medium text-white/52 transition hover:bg-white/[0.04] hover:text-white">Categorias</button>
                      </nav>

          <form onSubmit={submitSearch} className={appMode ? "hidden" : "hidden min-w-0 flex-1 md:flex"}>
            <div className="flex h-10 w-full max-w-xl items-center rounded-lg border border-white/[0.1] bg-[#151519] px-3 focus-within:border-[var(--zx-accent)]">
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
              className="flex h-9 items-center rounded-lg bg-[var(--zx-accent)] px-3 text-[11px] font-bold text-white transition hover:brightness-110 sm:px-4 sm:text-xs"
            >
              Anunciar
            </button>

            <button onClick={() => navigate("/favoritos")} className="zx-icon-action relative hidden sm:flex" aria-label="Favoritos" title="Favoritos">
              <Heart className={`h-4 w-4 ${favCount ? "fill-[#57aaff] text-[#57aaff]" : ""}`} />
              {favCount > 0 ? <span className="absolute -right-1 -top-1 rounded-full bg-[var(--zx-accent)] px-1 text-[8px] font-bold text-white">{favCount > 99 ? "99+" : favCount}</span> : null}
            </button>

            <NotificationBell />

            {branding.discordInviteUrl || state.config.discordLink ? (
              <a
                href={branding.discordInviteUrl || state.config.discordLink}
                target="_blank"
                rel="noopener noreferrer"
                className="zx-icon-action hidden sm:flex border-[#5865F2]/25"
                title="Comunidade"
                aria-label="Abrir comunidade no Discord"
              >
                <DiscordIcon className="h-4 w-4" />
              </a>
            ) : null}

            {isAdmin ? (
              <button onClick={() => navigate("/admin")} className="zx-icon-action flex" aria-label="Abrir painel administrativo" title="Admin">
                <Shield className="h-4 w-4" />
              </button>
            ) : null}

            {user ? (
              <button onClick={onProfileClick} className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.085] bg-white/[0.02] px-2.5 transition hover:border-white/[0.16] hover:bg-white/[0.04]" aria-label="Abrir minha conta">
                <UserRound className="h-4 w-4 text-white/62" />
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

        {!appMode && !routeOwnsMobileSearch ? (
          <form onSubmit={submitSearch} className="pb-3 md:hidden">
            <div className="flex h-9 items-center rounded-lg border border-white/[0.09] bg-[#131317] px-3 focus-within:border-[#168cff]/60">
              <Search className="h-3.5 w-3.5 shrink-0 text-white/28" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar no marketplace"
                aria-label="Buscar no marketplace"
                className="ml-2 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/26"
              />
            </div>
          </form>
        ) : null}
      </div>
    </header>
  );
}
