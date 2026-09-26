import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Heart, Menu, Moon, Search, Settings, ShieldCheck, Sun, Wallet } from "lucide-react";
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

const NAV_ITEMS = [
  { label: "Comprar", to: "/loja" },
  { label: "Categorias", to: "/categorias" },
  { label: "Robux", to: "/robux" },
  { label: "Como funciona", to: "/como-funciona" },
  { label: "Vender", to: "/vender" },
  { label: "Segurança", to: "/seguranca" },
];

export default function Header({ onProfileClick, onAuthClick, onMenuClick, menuOpen = false }: Props) {
  const { state, isDark, toggleDark } = useStore();
  const { profile, user, isAdmin } = useAuth();
  const { branding } = useSiteBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const { count } = useFavorites();
  const [favCount, setFavCount] = useState(count);

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
    const params = new URLSearchParams(location.search);
    setQuery(params.get("q") || "");
  }, [location.search]);

  useEffect(() => {
    const handler = () => setQuery("");
    window.addEventListener("zxmax:clear-search", handler);
    return () => window.removeEventListener("zxmax:clear-search", handler);
  }, []);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/loja?q=${encodeURIComponent(trimmed)}` : "/loja");
    window.dispatchEvent(new CustomEvent("zxmax:search", { detail: trimmed }));
  };

  const openListing = () => {
    if (!user) {
      onAuthClick?.();
      return;
    }
    navigate("/meus-produtos");
  };

  const isActive = (to: string) => {
    if (to === "/loja") return location.pathname === "/" || location.pathname === "/loja";
    return location.pathname.startsWith(to);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#080a0f]/95 backdrop-blur-xl">
      <div className="hidden border-b border-white/[0.055] bg-[#0b0e14] md:block">
        <div className="mx-auto flex h-8 max-w-[1440px] items-center justify-between px-5 text-[10px] font-bold text-white/40">
          <div className="flex items-center gap-4">
            <Link to="/seguranca" className="inline-flex items-center gap-1.5 transition hover:text-white"><ShieldCheck className="h-3.5 w-3.5 text-[#63b5ff]" /> Compra protegida</Link>
            <Link to="/formas-de-pagamento" className="transition hover:text-white">Pagamentos</Link>
            <Link to="/tarifas-e-prazos" className="transition hover:text-white">Tarifas e prazos</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/central-de-ajuda" className="transition hover:text-white">Central de ajuda</Link>
            <a href={branding.supportUrl || state.config.discordLink || "https://discord.gg/zxmax"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 transition hover:text-white"><DiscordIcon className="h-3.5 w-3.5 text-[#7b86ff]" /> Comunidade</a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-3 sm:px-5">
        <div className="flex h-16 items-center gap-2 sm:gap-4">
          <button onClick={() => navigate("/")} className="flex shrink-0 items-center" aria-label="Ir para a página inicial">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt={branding.siteName} className="h-8 max-w-[145px] object-contain object-left sm:h-9" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#168cff]/20 bg-[#168cff]/12 text-sm font-black text-[#79c3ff]">Z</span>
                <span className="hidden text-xl font-black tracking-[-0.055em] text-white min-[420px]:inline">{branding.siteName || "ZXMAX"}</span>
              </div>
            )}
          </button>

          <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 lg:flex lg:max-w-2xl">
            <div className="flex w-full items-center rounded-xl border border-white/[0.09] bg-[#11151c] px-3.5 py-2.5 transition focus-within:border-[#168cff]/55 focus-within:bg-[#131922]">
              <Search className="h-4 w-4 shrink-0 text-white/30" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar produtos, categorias ou vendedores..."
                className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
                aria-label="Buscar no marketplace"
              />
              <span className="rounded-md border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[9px] font-bold text-white/25">ENTER</span>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => navigate("/favoritos")} className="zx-header-action relative hidden sm:flex" title="Favoritos" aria-label="Favoritos">
              <Heart className={`h-4 w-4 ${favCount > 0 ? "fill-[#5fb7ff] text-[#5fb7ff]" : ""}`} />
              {favCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#168cff] px-1 text-[8px] font-black text-white">{favCount > 99 ? "99+" : favCount}</span>}
            </button>

            <NotificationBell />

            {isAdmin && (
              <button onClick={() => navigate("/admin/branding")} className="zx-header-action hidden sm:flex" title="Personalizar site" aria-label="Personalizar site">
                <Settings className="h-4 w-4" />
              </button>
            )}

            <button onClick={toggleDark} className="zx-header-action hidden sm:flex" title="Mudar tema" aria-label="Mudar tema">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user ? (
              <>
                <button onClick={openListing} className="hidden rounded-xl bg-[#168cff] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#0876e4] md:inline-flex">
                  + Anunciar
                </button>
                <button onClick={onProfileClick} className="group flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 pr-2 transition hover:border-white/[0.14] hover:bg-white/[0.05]">
                  {profile?.avatar_url || state.currentUser?.avatar ? (
                    <img src={profile?.avatar_url || state.currentUser?.avatar} alt="Avatar" className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#168cff]/12 text-xs font-black text-[#7bc5ff]">
                      {(profile?.display_name || user.email || "U").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[115px] truncate text-[11px] font-black text-white">{profile?.display_name || user.email?.split("@")[0]}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-[#68b9ff]"><Wallet className="h-3 w-3" /> R$ {Number(state.currentUser?.balance ?? 0).toFixed(2)}</span>
                  </span>
                </button>
              </>
            ) : (
              <button onClick={onAuthClick} className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black transition hover:bg-white/90">
                Entrar
              </button>
            )}

            <button
              onClick={onMenuClick}
              className={`group inline-flex h-10 items-center gap-2 rounded-xl border px-3 transition ${menuOpen ? "border-[#168cff]/55 bg-[#168cff]/12 text-white" : "border-white/[0.09] bg-[#11151c] text-white/70 hover:border-white/[0.16] hover:text-white"}`}
              title="Abrir menu"
              aria-label="Abrir menu principal"
              aria-expanded={menuOpen}
              aria-controls="zxmax-main-menu"
            >
              <Menu className="h-[18px] w-[18px]" />
              <span className="hidden text-[11px] font-black uppercase tracking-[0.08em] xl:inline">Menu</span>
            </button>
          </div>
        </div>

        <form onSubmit={submitSearch} className="pb-3 lg:hidden">
          <div className="flex items-center rounded-xl border border-white/[0.085] bg-[#11151c] px-3 py-2.5 focus-within:border-[#168cff]/50">
            <Search className="h-4 w-4 shrink-0 text-white/30" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar no marketplace..."
              className="ml-2 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28"
              aria-label="Buscar no marketplace"
            />
          </div>
        </form>
      </div>

      <nav className="hidden border-t border-white/[0.05] bg-[#0b0e14] lg:block" aria-label="Navegação principal">
        <div className="mx-auto flex h-11 max-w-[1440px] items-center gap-1 px-5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-lg px-3 py-2 text-[11px] font-black transition ${isActive(item.to) ? "bg-[#168cff]/12 text-[#75c2ff]" : "text-white/48 hover:bg-white/[0.04] hover:text-white"}`}
            >
              {item.label}
            </Link>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <Link to="/entrega-automatica" className="rounded-lg px-3 py-2 text-[11px] font-black text-[#74d89a] transition hover:bg-[#22c55e]/[0.08]">Entrega automática</Link>
            <Link to="/vendedores-verificados" className="rounded-lg px-3 py-2 text-[11px] font-black text-[#8ccaff] transition hover:bg-[#168cff]/[0.08]">Verificados</Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
