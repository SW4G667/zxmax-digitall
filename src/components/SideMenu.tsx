import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  X, Store, Package, ShoppingBag, Headset, Shield, User, Wallet, FileText,
  HelpCircle, Lock, ScrollText, Heart, ShieldCheck, TrendingUp, LogOut, LogIn,
  LayoutGrid, BadgeCheck, ClipboardCheck, Users, MessageSquare, Receipt,
  BarChart3, KeyRound, Loader2, Flag, Settings,
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
  const { isAdmin, user, profile, mfaEnabled, loading, signOut } = useAuth();
  const { state } = useStore();
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
        { key: "cats", icon: LayoutGrid, label: "Categorias", hint: "Navegar por tipo de produto", to: "/loja?cat=" },
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

    if (!user) {
      return [
        marketplace,
        help,
        {
          id: "guest",
          title: "Sua conta",
          icon: User,
          entries: [{ key: "login", icon: LogIn, label: "Entrar ou criar conta", hint: "Comprar e anunciar na ZXMAX", action: () => { onOpenProfile(); onClose(); } }],
        },
      ];
    }

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
              { key: "sales", icon: Receipt, label: "Pedidos e entregas", hint: "Vendas aguardando entrega", view: "purchases" as View, to: "/minhas-compras", badge: sellerOrders },
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
    if (isAdmin) {
      sections.splice(3, 0, {
        id: "admin",
        title: "Administração",
        icon: Shield,
        entries: [
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
          { key: "admin-config", icon: Settings, label: "Taxas e configurações", to: "/admin?tab=config" },
          { key: "admin-security", icon: ShieldCheck, label: "Segurança do painel", hint: mfaEnabled ? "2FA ativo" : "Ative o 2FA", to: "/admin?tab=security" },
        ],
      });
    }

    sections.push({
      id: "session",
      title: "Sessão",
      entries: [{ key: "logout", icon: LogOut, label: "Sair da conta", action: () => { void signOut(); onClose(); }, danger: true }],
    });

    return sections;
  }, [user, isAdmin, isSeller, count, openOrders, myPendingListings, sellerOrders, pendingModeration, mfaEnabled, profile?.is_verified_seller, onOpenProfile, onClose, signOut]);

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
      "w-full flex items-center gap-3 p-3 rounded-2xl transition text-left group",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      active ? "bg-primary/15 border border-primary/30" : "hover:bg-white/[0.06] border border-transparent",
      entry.danger ? "hover:bg-red-500/10" : "",
    ].join(" ");

    const body = (
      <>
        <span className={`p-2.5 rounded-xl transition ${entry.danger ? "bg-red-500/10 text-red-400" : active ? "bg-primary/25 text-primary" : "bg-white/[0.06] text-primary group-hover:bg-primary/15"}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-[13px] font-bold leading-tight ${entry.danger ? "text-red-300" : "text-white"}`}>{entry.label}</span>
          {entry.hint && <span className="block text-[11px] leading-tight mt-0.5 text-white/40">{entry.hint}</span>}
        </span>
        {entry.badge !== undefined && entry.badge !== 0 && entry.badge !== "" && (
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-primary text-white">{entry.badge}</span>
        )}
        {active && <span className="sr-only">(página atual)</span>}
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
    <div className="fixed inset-0 z-[80] flex">
      <div className="absolute inset-0 bg-[#050508]/80 backdrop-blur-xl" onClick={onClose} aria-hidden />

      <nav
        ref={panelRef as React.RefObject<HTMLElement>}
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        className="relative w-[88%] max-w-[360px] h-full bg-[#0a0a0f] border-r border-white/10 flex flex-col overflow-hidden animate-slide-in-bottom shadow-[20px_0_60px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent pointer-events-none" aria-hidden />

        <div className="relative z-10 p-6 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white">ZX<span className="text-primary">MAX</span></h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success" aria-hidden /> Marketplace Seguro
              </p>
            </div>
            <button ref={closeRef} onClick={onClose} aria-label="Fechar menu" className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {loading && (
            <p className="mt-6 flex items-center gap-2 text-[12px] text-white/40" role="status">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando sua conta…
            </p>
          )}

          {!loading && user && (
            <button onClick={() => { onOpenProfile(); onClose(); }} className="w-full mt-6 flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition text-left group">
              <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(profile?.display_name || "zxmax")}`} alt="" className="w-12 h-12 rounded-xl object-cover bg-primary/10 border border-white/10" />
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-bold text-white truncate">{profile?.display_name || "Minha conta"}</span>
                <span className="block text-[11px] text-white/40 truncate">
                  {profile?.is_verified_seller ? "Vendedor verificado" : mfaEnabled ? "Protegida com 2FA" : "Toque para gerenciar"}
                </span>
              </span>
            </button>
          )}
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-3 pb-6 space-y-6 scrollbar-hide">
          {sections.map((section) => (
            <section key={section.id} aria-labelledby={`menu-${section.id}`}>
              <h3 id={`menu-${section.id}`} className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 px-3 mb-3 flex items-center gap-2">
                {section.icon && <section.icon className="w-3 h-3" />} {section.title}
              </h3>
              <ul className="space-y-1">{section.entries.map(renderEntry)}</ul>
            </section>
          ))}

          <div className="pt-2 px-3">
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-4">
              <p className="text-xs font-bold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Compra Protegida</p>
              <p className="text-[11px] text-white/50 mt-1 leading-relaxed">Seu dinheiro fica retido até você confirmar a entrega.</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 shrink-0">
          <p className="text-[10px] text-white/20 text-center font-mono">ZXMAX · Marketplace de produtos digitais</p>
        </div>
      </nav>
    </div>
  );
}
