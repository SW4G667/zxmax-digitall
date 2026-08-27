import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  X, Store, Package, ShoppingBag, Headset, Shield, User, Wallet, FileText,
  HelpCircle, Lock, ScrollText, Heart, ShieldCheck, TrendingUp, LogOut, LogIn,
  LayoutGrid, BadgeCheck, ClipboardCheck, Users, MessageSquare, Receipt,
  BarChart3, KeyRound, Loader2, Flag, Settings, Tag, Sparkles, Zap, ChevronRight, Moon, Sun,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/store/StoreContext";
import useFavorites from "@/hooks/useFavorites";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "withdraw";

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (v: View) => void;
  onOpenProfile: () => void;
}

interface MenuEntry {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  /** Router path — used for the active-route indicator. */
  to?: string;
  /** In-app view, routed by AppShell. */
  view?: View;
  action?: () => void;
  badge?: number | string;
  danger?: boolean;
}

interface MenuSection {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  entries: MenuEntry[];
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function SideMenu({ open, onClose, onNavigate, onOpenProfile }: Props) {
  const { isAdmin, isSupport, user, profile, mfaEnabled, loading, signOut } = useAuth();
  const { state, isDark, toggleDark } = useStore();
  const { count } = useFavorites();
  const location = useLocation();
  const panelRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const isSeller = useMemo(
    () => !!profile?.is_verified_seller || state.products.some((p) => p.sellerId === user?.id),
    [profile?.is_verified_seller, state.products, user?.id],
  );

  const pendingModeration = useMemo(
    () => (isAdmin ? state.products.filter((p) => !p.approved).length : 0),
    [isAdmin, state.products],
  );
  const myPendingListings = useMemo(
    () => state.products.filter((p) => p.sellerId === user?.id && !p.approved).length,
    [state.products, user?.id],
  );
  const openOrders = useMemo(
    () => state.purchases.filter((p) => p.buyerId === user?.id && p.status !== "delivered" && p.status !== "cancelled").length,
    [state.purchases, user?.id],
  );
  const sellerOrders = useMemo(
    () => state.purchases.filter((p) => p.sellerId === user?.id && p.status === "paid").length,
    [state.purchases, user?.id],
  );

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Focus management + keyboard navigation (Esc to close, Tab trapped inside,
  // arrows to walk the list) so the menu is usable without a mouse.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.key === "Tab") {
        event.preventDefault();
        const next = event.shiftKey
          ? items[(index <= 0 ? items.length : index) - 1]
          : items[(index + 1) % items.length];
        next?.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault(); items[(index + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault(); items[(index <= 0 ? items.length : index) - 1]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault(); items[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault(); items[items.length - 1]?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const go = useCallback((v: View) => { onNavigate(v); onClose(); }, [onNavigate, onClose]);

  const sections = useMemo<MenuSection[]>(() => {
    const marketplace: MenuSection = {
      id: "marketplace",
      title: "Marketplace",
      icon: TrendingUp,
      entries: [
        { key: "store", icon: Store, label: "Início / Loja", hint: "Todos os anúncios", to: "/loja", view: "store" },
        { key: "robux", icon: Sparkles, label: "Robux e Gift Cards", hint: "Loja de moedas e créditos", to: "/robux" },
        { key: "cats", icon: LayoutGrid, label: "Categorias", hint: "Navegar por tipo de produto", to: "/categorias" },
        { key: "new", icon: Sparkles, label: "Novidades", hint: "Anúncios mais recentes", to: "/loja?sort=recentes" },
        { key: "popular", icon: TrendingUp, label: "Mais vendidos", hint: "Ofertas com mais vendas", to: "/loja?sort=vendidos" },
        { key: "verified", icon: BadgeCheck, label: "Vendedores verificados", hint: "Filtrar contas verificadas", to: "/loja?verified=1" },
        { key: "auto", icon: Zap, label: "Entrega automática", hint: "Filtrar produtos imediatos", to: "/loja?delivery=auto" },
        { key: "favs", icon: Heart, label: "Favoritos", hint: "Seus produtos salvos", to: "/favoritos", badge: count },
      ],
    };

    const help: MenuSection = {
      id: "help",
      title: "Ajuda e confiança",
      icon: ShieldCheck,
      entries: [
        { key: "faq", icon: HelpCircle, label: "Perguntas frequentes", hint: "Como funciona a ZXMAX", to: "/faq" },
        { key: "rules", icon: ScrollText, label: "Regras da plataforma", to: "/regras" },
        { key: "terms", icon: FileText, label: "Termos de uso", to: "/termos" },
        { key: "privacy", icon: Lock, label: "Política de privacidade", to: "/privacidade" },
      ],
    };

    if (!user) return [marketplace, help];

    const account: MenuSection = {
      id: "account",
      title: "Minha conta",
      icon: User,
      entries: [
        { key: "profile", icon: User, label: "Meu perfil", hint: "Dados, verificação e segurança", to: "/perfil" },
        { key: "orders", icon: ShoppingBag, label: "Meus pedidos", hint: "Compras, entregas e chat", view: "purchases", to: "/minhas-compras", badge: openOrders },
        { key: "support", icon: Headset, label: "Suporte", hint: "Falar com a equipe", view: "support", to: "/suporte" },
        { key: "wallet", icon: Wallet, label: "Saldo e saques", hint: "Receber por Pix", view: "withdraw", to: "/sacar" },
      ],
    };

    const seller: MenuSection = {
      id: "seller",
      title: isSeller ? "Painel do vendedor" : "Começar a vender",
      icon: Package,
      entries: [
        { key: "listings", icon: Package, label: "Meus anúncios", hint: "Criar, editar e pausar", view: "inventory", to: "/meus-produtos", badge: myPendingListings },
        ...(isSeller
          ? [
              { key: "sales", icon: Receipt, label: "Pedidos e entregas", hint: "Vendas aguardando entrega", to: "/minhas-compras?scope=sales", badge: sellerOrders },
              { key: "verify", icon: BadgeCheck, label: "Verificação de vendedor", hint: profile?.is_verified_seller ? "Conta verificada" : "Envie seus documentos", to: "/perfil" },
            ]
          : [
              { key: "verify", icon: BadgeCheck, label: "Verificar minha conta", hint: "Necessário para publicar anúncios", to: "/perfil" },
            ]),
      ],
    };

    const sections: MenuSection[] = [marketplace, account, seller, help];

    // Admin links are only built when the backend confirmed the role. They are
    // never rendered — not even hidden — for anyone else.
    if (isAdmin || isSupport) {
      sections.splice(3, 0, {
        id: "admin",
        title: isAdmin ? "Administração" : "Operações de suporte",
        icon: Shield,
        entries: isAdmin ? [
          { key: "admin-dash", icon: BarChart3, label: "Painel administrativo", hint: "Métricas e visão geral", to: "/admin" },
          { key: "admin-products", icon: ClipboardCheck, label: "Moderação de anúncios", hint: "Aprovar ou reprovar", to: "/admin?tab=products", badge: pendingModeration },
          { key: "admin-orders", icon: Receipt, label: "Pedidos", to: "/admin?tab=orders" },
          { key: "admin-disputes", icon: Flag, label: "Disputas e denúncias", to: "/admin?tab=disputes" },
          { key: "admin-withdrawals", icon: Wallet, label: "Saques", to: "/admin?tab=withdrawals" },
          { key: "admin-users", icon: Users, label: "Usuários e verificações", to: "/admin?tab=verifications" },
          { key: "admin-docs", icon: FileText, label: "Documentos de vendedor", to: "/admin?tab=documents" },
          { key: "admin-notices", icon: MessageSquare, label: "Avisos e conteúdo", to: "/admin?tab=notices" },
          { key: "admin-tags", icon: Tag, label: "Tags de usuários", hint: "Selos persistentes por ID público", to: "/admin?tab=tags" },
          { key: "admin-roles", icon: Users, label: "Cargos e permissões", hint: "Acesso auditado no banco", to: "/admin?tab=roles" },
          { key: "admin-apis", icon: KeyRound, label: "APIs e credenciais", to: "/admin?tab=apis" },
          { key: "admin-config", icon: Settings, label: "Operação e manutenção", hint: "Taxas, limites e modo de manutenção", to: "/admin?tab=config" },
          { key: "admin-security", icon: ShieldCheck, label: "Segurança do painel", hint: mfaEnabled ? "2FA ativo" : "Ative o 2FA", to: "/admin?tab=security" },
        ] : [
          { key: "support-operations", icon: Shield, label: "Console de operações", hint: "Ações permitidas à sua conta", to: "/admin" },
        ],
      });
    }

    sections.push({
      id: "session",
      title: "Sessão",
      entries: [{ key: "logout", icon: LogOut, label: "Sair da conta", action: () => { void signOut(); onClose(); }, danger: true }],
    });

    return sections;
  }, [user, isAdmin, isSupport, isSeller, count, openOrders, myPendingListings, sellerOrders, pendingModeration, mfaEnabled, profile?.is_verified_seller, onOpenProfile, onClose, signOut]);

  if (!open) return null;

  const currentPath = `${location.pathname}${location.search}`;
  const isActive = (to?: string) => {
    if (!to) return false;
    if (to.includes("?")) return currentPath === to;
    return location.pathname === to;
  };

  const renderEntry = (entry: MenuEntry) => {
    const active = isActive(entry.to);
    const Icon = entry.icon;
    const className = [
      "zx-menu-entry group",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#168cff]",
      active ? "zx-menu-entry-active" : "",
      entry.danger ? "hover:bg-red-500/10 hover:border-red-400/20" : "",
    ].join(" ");

    const body = (
      <>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${entry.danger ? "bg-red-500/10 text-red-400" : active ? "bg-[#168cff]/20 text-[#75c5ff]" : "bg-white/[0.055] text-white/60 group-hover:bg-[#168cff]/13 group-hover:text-[#7bc6ff]"}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-[13px] font-semibold leading-tight ${entry.danger ? "text-red-300" : "text-white/90"}`}>{entry.label}</span>
          {entry.hint && <span className="mt-0.5 block text-[10px] leading-tight text-white/38">{entry.hint}</span>}
        </span>
        {entry.badge !== undefined && entry.badge !== 0 && entry.badge !== "" && (
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-primary text-white">{entry.badge}</span>
        )}
        {active ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#6dbdff]" aria-label="Página atual" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20 transition group-hover:text-white/55" aria-hidden />}
      </>
    );

    // Prefer the in-app view handler (keeps AppShell's auth gate) and fall back
    // to a plain router link for pages that live outside the shell.
    if (entry.view) {
      return (
        <li key={entry.key}>
          <button type="button" onClick={() => go(entry.view!)} className={className} aria-current={active ? "page" : undefined}>
            {body}
          </button>
        </li>
      );
    }
    if (entry.to) {
      return (
        <li key={entry.key}>
          <Link to={entry.to} onClick={onClose} className={className} aria-current={active ? "page" : undefined}>
            {body}
          </Link>
        </li>
      );
    }
    return (
      <li key={entry.key}>
        <button type="button" onClick={entry.action} className={className}>{body}</button>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-[#03050a]/65 backdrop-blur-[3px]" onClick={onClose} aria-hidden />

      <nav
        id="zxmax-main-menu"
        ref={panelRef as React.RefObject<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        className="zx-menu-panel absolute right-3 top-[4.15rem] flex w-[calc(100%-1.5rem)] max-w-[380px] flex-col overflow-hidden sm:right-5 sm:top-[4.45rem]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 border-b border-white/[0.07] bg-[#11131a] px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#70bcff]">Navegação</p>
              <h2 className="mt-0.5 text-base font-black tracking-[-0.045em] text-white">ZX<span className="text-[#58b5ff]">MAX</span></h2>
            </div>
            <button ref={closeRef} onClick={onClose} aria-label="Fechar menu" className="zx-icon-action h-9 w-9">
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading && (
            <p className="mt-4 flex items-center gap-2 text-[12px] text-white/40" role="status">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando sua conta…
            </p>
          )}

          {!loading && user && (
            <button onClick={() => { onOpenProfile(); onClose(); }} className="mt-4 flex w-full items-center gap-3 rounded-xl border border-white/[0.09] bg-white/[0.035] p-3 text-left transition hover:border-[#168cff]/35 hover:bg-white/[0.055] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#168cff]">
              <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile?.display_name || "zxmax")}`} alt="" className="h-11 w-11 rounded-full border border-white/10 bg-[#168cff]/10 object-cover" />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold text-white truncate">Olá, {profile?.display_name || "sua conta"}</span>
                <span className="mt-0.5 block text-[10px] text-white/42 truncate">
                  {profile?.is_verified_seller ? "Vendedor verificado" : mfaEnabled ? "Conta protegida com 2FA" : "Gerenciar perfil e segurança"}
                </span>
                <span className="mt-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wide text-white/32">
                  <span>ID #{profile?.public_id || state.currentUser?.publicId || "—"}</span><span className="h-1 w-1 rounded-full bg-white/25" aria-hidden /><span>{openOrders} em aberto</span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
            </button>
          )}

          {!loading && !user && (
            <button onClick={() => { onOpenProfile(); onClose(); }} className="mt-4 flex w-full items-center justify-between rounded-xl bg-[#168cff] px-4 py-3 text-left text-sm font-black text-white shadow-[0_9px_22px_rgba(0,132,255,0.2)] transition hover:bg-[#0877eb] active:scale-[0.98]">
              <span className="flex items-center gap-2"><LogIn className="h-4 w-4" /> Entrar ou criar conta</span><ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-hide">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`menu-${section.id}`}>
              <h3 id={`menu-${section.id}`} className="mb-2 flex items-center gap-2 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                {section.icon && (() => { const SectionIcon = section.icon; return <SectionIcon className="h-3 w-3 text-[#5eb8ff]/75" />; })()} {section.title}
              </h3>
              <ul className="space-y-1">{section.entries.map(renderEntry)}</ul>
            </section>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-white/[0.07] bg-[#0d0f15] px-4 py-3">
          <span className="text-[10px] font-semibold text-white/35">Preferência visual</span>
          <button type="button" onClick={toggleDark} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-white/60 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#168cff]">
            {isDark ? <Moon className="h-3.5 w-3.5 text-[#7bc6ff]" /> : <Sun className="h-3.5 w-3.5 text-[#ffcd70]" />}{isDark ? "Tema escuro" : "Tema claro"}
          </button>
        </div>
      </nav>
    </div>
  );
}
