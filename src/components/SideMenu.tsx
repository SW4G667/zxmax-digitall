import React, { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BadgeCheck, BarChart3, ClipboardCheck, FileText, Flag, Headset, Heart, HelpCircle,
  Home, KeyRound, LayoutGrid, Lock, LogIn, LogOut, MessageSquare, Moon, Package,
  Receipt, ScrollText, Settings, Shield, ShieldCheck, ShoppingBag, Sparkles, Store,
  Sun, Tag, TrendingUp, User, Users, Wallet, X, Zap,
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

type IconType = React.ComponentType<{ className?: string }>;

interface MenuItem {
  key: string;
  label: string;
  to: string;
  icon: IconType;
  hint?: string;
  badge?: number | string;
}

interface MenuSection {
  id: string;
  title: string;
  entries: MenuItem[];
}

function MenuLink({ item, active, onClose }: { item: MenuItem; active: boolean; onClose: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#168cff] ${active ? "bg-white/[0.06] text-white" : "text-white/58 hover:bg-white/[0.035] hover:text-white"}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#62b0ff]" : "text-white/30"}`} />
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{item.label}</span>
      {item.badge !== undefined && item.badge !== 0 && item.badge !== "" ? <span className="rounded-full bg-[#168cff] px-1.5 py-0.5 text-[9px] font-bold text-white">{item.badge}</span> : null}
    </Link>
  );
}

export default function SideMenu({ open, onClose, onNavigate: _onNavigate, onOpenProfile }: Props) {
  const { user, profile, isAdmin, isSupport, mfaEnabled, signOut } = useAuth();
  const { state, isDark, toggleDark } = useStore();
  const { count } = useFavorites();
  const location = useLocation();

  const products = state.products ?? [];
  const purchases = state.purchases ?? [];

  const isSeller = useMemo(
    () => Boolean(profile?.is_verified_seller || products.some((product) => product.sellerId === user?.id)),
    [profile?.is_verified_seller, products, user?.id],
  );

  const openOrders = useMemo(
    () => purchases.filter((purchase) => purchase.buyerId === user?.id && purchase.status !== "delivered" && purchase.status !== "cancelled").length,
    [purchases, user?.id],
  );

  const sellerOrders = useMemo(
    () => purchases.filter((purchase) => purchase.sellerId === user?.id && purchase.status === "paid").length,
    [purchases, user?.id],
  );

  const pendingModeration = useMemo(
    () => (isAdmin ? products.filter((product) => !product.approved).length : 0),
    [isAdmin, products],
  );

  const sections = useMemo<MenuSection[]>(() => {
    const marketplace: MenuSection = {
      id: "marketplace",
      title: "Marketplace",
      entries: [
        { key: "home", label: "Início", to: "/", icon: Home },
        { key: "store", label: "Todos os anúncios", to: "/loja", icon: Store },
        { key: "categories", label: "Categorias", to: "/categorias", icon: LayoutGrid },
        { key: "robux", label: "Robux", to: "/robux", icon: Sparkles },
        { key: "new", label: "Novidades", to: "/loja?sort=recentes", icon: Sparkles },
        { key: "popular", label: "Mais vendidos", to: "/loja?sort=vendidos", icon: TrendingUp },
        { key: "auto", label: "Entrega automática", to: "/loja?delivery=auto", icon: Zap },
        { key: "verified", label: "Vendedores verificados", to: "/loja?verified=1", icon: BadgeCheck },
        { key: "favorites", label: "Favoritos", to: "/favoritos", icon: Heart, badge: count || undefined },
      ],
    };

    const help: MenuSection = {
      id: "help",
      title: "Ajuda",
      entries: [
        { key: "how", label: "Como funciona", to: "/como-funciona", icon: HelpCircle },
        { key: "support-center", label: "Central de ajuda", to: "/central-de-ajuda", icon: Headset },
        { key: "rules", label: "Regras", to: "/regras", icon: ScrollText },
        { key: "terms", label: "Termos de uso", to: "/termos", icon: FileText },
        { key: "privacy", label: "Privacidade", to: "/privacidade", icon: Lock },
      ],
    };

    if (!user) return [marketplace, help];

    const account: MenuSection = {
      id: "account",
      title: "Minha conta",
      entries: [
        { key: "profile", label: "Meu perfil", to: "/perfil", icon: User },
        { key: "settings", label: "Configurações", to: "/configuracoes", icon: Settings },
        { key: "orders", label: "Meus pedidos", to: "/minhas-compras", icon: ShoppingBag, badge: openOrders || undefined },
        { key: "transactions", label: "Transações", to: "/minhas-compras", icon: Receipt },
        { key: "listings", label: "Meus anúncios", to: "/meus-produtos", icon: Package },
        { key: "wallet", label: "Carteira e saque", to: "/sacar", icon: Wallet },
        { key: "support", label: "Suporte", to: "/suporte", icon: Headset },
      ],
    };

    const seller: MenuSection = {
      id: "seller",
      title: isSeller ? "Vendedor" : "Começar a vender",
      entries: [
        { key: "seller-listings", label: "Gerenciar anúncios", to: "/meus-produtos", icon: Package },
        ...(isSeller ? [
          { key: "sales", label: "Pedidos e entregas", to: "/minhas-compras?scope=sales", icon: Receipt, badge: sellerOrders || undefined },
          { key: "sales-history", label: "Histórico de vendas", to: "/minhas-compras?scope=sales", icon: BarChart3 },
          { key: "seller-verified", label: "Verificação de vendedor", to: "/perfil", icon: BadgeCheck },
        ] : [
          { key: "seller-start", label: "Verificar minha conta", to: "/perfil", icon: BadgeCheck },
        ]),
      ],
    };

    const result: MenuSection[] = [marketplace, account, seller, help];

    if (isAdmin || isSupport) {
      result.splice(3, 0, {
        id: "admin",
        title: isAdmin ? "Administração" : "Operações de suporte",
        entries: isAdmin ? [
          { key: "admin-home", label: "Painel administrativo", to: "/admin", icon: Shield },
          { key: "admin-products", label: "Moderação de anúncios", to: "/admin?tab=products", icon: ClipboardCheck, badge: pendingModeration || undefined },
          { key: "admin-orders", label: "Pedidos", to: "/admin?tab=orders", icon: Receipt },
          { key: "admin-disputes", label: "Disputas e denúncias", to: "/admin?tab=disputes", icon: Flag },
          { key: "admin-users", label: "Usuários e verificações", to: "/admin?tab=verifications", icon: Users },
          { key: "admin-notices", label: "Avisos e conteúdo", to: "/admin?tab=notices", icon: MessageSquare },
          { key: "admin-tags", label: "Tags de usuários", to: "/admin?tab=tags", icon: Tag },
          { key: "admin-roles", label: "Cargos e permissões", to: "/admin?tab=roles", icon: Users },
          { key: "admin-apis", label: "APIs e credenciais", to: "/admin?tab=apis", icon: KeyRound },
          { key: "admin-config", label: "Operação e manutenção", to: "/admin?tab=config", icon: Settings },
          { key: "admin-security", label: "Segurança do painel", to: "/admin?tab=security", icon: ShieldCheck, hint: mfaEnabled ? "2FA ativo" : "Ative o 2FA" },
        ] : [
          { key: "support-console", label: "Console de operações", to: "/admin", icon: Shield },
        ],
      });
    }

    return result;
  }, [user, isAdmin, isSupport, isSeller, count, openOrders, sellerOrders, pendingModeration, mfaEnabled]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const currentPath = `${location.pathname}${location.search}`;
  const isActive = (to: string) => to.includes("?") ? currentPath === to : location.pathname === to;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Menu principal">
      <button className="absolute inset-0 bg-black/55" onClick={onClose} aria-label="Fechar menu" />
      <aside id="zxmax-main-menu" className="zx-menu-panel absolute right-3 top-[4.35rem] flex max-h-[calc(100dvh-5rem)] w-[calc(100%-1.5rem)] max-w-[360px] flex-col overflow-hidden sm:right-4">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Menu</h2>
          <button onClick={onClose} className="zx-icon-action h-8 w-8" aria-label="Fechar menu"><X className="h-4 w-4" /></button>
        </div>

        {user ? (
          <button onClick={() => { onOpenProfile(); onClose(); }} className="mx-3 mt-3 flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3 text-left hover:bg-white/[0.04]">
            {profile?.avatar_url || state.currentUser?.avatar ? (
              <img src={profile?.avatar_url || state.currentUser?.avatar} alt="Avatar" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#1e1e24] text-xs font-semibold text-white">{(profile?.display_name || user.email || "U").slice(0, 1).toUpperCase()}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-white">{profile?.display_name || user.email?.split("@")[0]}</span>
              <span className="mt-0.5 block text-[10px] text-white/32">ID #{profile?.public_id || state.currentUser?.publicId || "—"} · {openOrders} em aberto</span>
            </span>
          </button>
        ) : (
          <Link to="/loja?login=1" onClick={onClose} className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-white/[0.07] px-3 py-2.5 text-xs font-medium text-white/70 hover:bg-white/[0.04] hover:text-white">
            <LogIn className="h-3.5 w-3.5" /> Entrar na conta
          </Link>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-4">
            {sections.map((section) => (
              <section key={section.id}>
                <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/25">{section.title}</p>
                <div className="space-y-0.5">
                  {section.entries.map((item) => <MenuLink key={item.key} item={item} active={isActive(item.to)} onClose={onClose} />)}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.07] p-3">
          <p className="mb-2 px-1 text-[9px] font-semibold uppercase tracking-[0.13em] text-white/25">Preferência visual</p>
          <div className="flex gap-2">
            <button onClick={() => toggleDark?.()} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] px-3 py-2 text-[10px] font-medium text-white/55 hover:bg-white/[0.035] hover:text-white">
              {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} Tema
            </button>
            {user ? (
              <button onClick={async () => { await signOut(); onClose(); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-400/[0.12] px-3 py-2 text-[10px] font-medium text-red-200/65 hover:bg-red-500/[0.06]">
                <LogOut className="h-3.5 w-3.5" /> Sair
              </button>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
