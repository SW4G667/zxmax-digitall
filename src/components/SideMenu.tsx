import React, { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BadgeCheck, BarChart3, Boxes, ChevronRight, ClipboardCheck, Clock3, CreditCard,
  FileText, Flag, Headset, Heart, HelpCircle, Home, KeyRound, LayoutGrid, Lock,
  LogIn, LogOut, MessageSquare, Moon, Package, Receipt, RefreshCcw, ScrollText,
  Settings, Shield, ShieldCheck, ShoppingBag, Sparkles, Store, Sun, Tag,
  TrendingUp, User, Users, Wallet, X, Zap,
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

function DrawerLink({ item, active, onClose }: { item: MenuItem; active: boolean; onClose: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-xl border px-3 py-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#168cff] ${active ? "border-[#168cff]/30 bg-[#168cff]/10" : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.035]"}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "bg-[#168cff]/16 text-[#7bc5ff]" : "bg-white/[0.035] text-white/45 group-hover:text-white/75"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[12px] font-black ${active ? "text-white" : "text-white/72"}`}>{item.label}</span>
        {item.hint && <span className="mt-0.5 block text-[10px] font-medium leading-4 text-white/28">{item.hint}</span>}
      </span>
      {item.badge !== undefined && item.badge !== 0 && item.badge !== "" ? (
        <span className="rounded-full bg-[#168cff] px-2 py-0.5 text-[9px] font-black text-white">{item.badge}</span>
      ) : (
        <ChevronRight className="h-3.5 w-3.5 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/45" />
      )}
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
        { key: "home", label: "Página inicial", to: "/", icon: Home, hint: "Destaques e acesso rápido" },
        { key: "store", label: "Marketplace", to: "/loja", icon: Store, hint: "Todos os anúncios disponíveis" },
        { key: "categories", label: "Categorias", to: "/categorias", icon: LayoutGrid, hint: "Navegue por tipo de produto" },
        { key: "robux", label: "Mercado de Robux", to: "/robux", icon: Sparkles, hint: "Compare ofertas de Robux" },
        { key: "new", label: "Novidades", to: "/loja?sort=recentes", icon: Sparkles, hint: "Anúncios publicados recentemente" },
        { key: "popular", label: "Mais vendidos", to: "/loja?sort=vendidos", icon: TrendingUp, hint: "Produtos com maior volume de vendas" },
        { key: "auto", label: "Entrega automática", to: "/loja?delivery=auto", icon: Zap, hint: "Filtrar produtos com entrega automática" },
        { key: "verified", label: "Vendedores verificados", to: "/loja?verified=1", icon: BadgeCheck, hint: "Filtrar anúncios de contas verificadas" },
        { key: "favorites", label: "Favoritos", to: "/favoritos", icon: Heart, hint: "Anúncios que você salvou", badge: count || undefined },
      ],
    };

    const help: MenuSection = {
      id: "help",
      title: "Ajuda e confiança",
      entries: [
        { key: "how", label: "Como funciona", to: "/como-funciona", icon: Boxes, hint: "Do anúncio até a confirmação" },
        { key: "buy", label: "Como comprar", to: "/comprar", icon: ShoppingBag, hint: "Guia para compradores" },
        { key: "sell-guide", label: "Como vender", to: "/vender", icon: Store, hint: "Guia para vendedores" },
        { key: "security", label: "Segurança", to: "/seguranca", icon: ShieldCheck, hint: "Proteções e boas práticas" },
        { key: "payments", label: "Formas de pagamento", to: "/formas-de-pagamento", icon: CreditCard },
        { key: "fees", label: "Tarifas e prazos", to: "/tarifas-e-prazos", icon: Clock3 },
        { key: "refunds", label: "Reembolsos", to: "/reembolsos", icon: RefreshCcw },
        { key: "help-center", label: "Central de ajuda", to: "/central-de-ajuda", icon: HelpCircle },
        { key: "faq", label: "FAQ", to: "/faq", icon: HelpCircle },
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
        { key: "profile", label: "Meu perfil", to: "/perfil", icon: User, hint: "Identidade pública e segurança" },
        { key: "settings", label: "Configurações", to: "/configuracoes", icon: Settings, hint: "Senha, sessões e preferências" },
        { key: "orders", label: "Meus pedidos", to: "/minhas-compras", icon: ShoppingBag, hint: "Compras e acompanhamento", badge: openOrders || undefined },
        { key: "transactions", label: "Transações", to: "/minhas-compras", icon: Receipt, hint: "Histórico de compras e vendas" },
        { key: "listings", label: "Meus anúncios", to: "/meus-produtos", icon: Package, hint: "Produtos publicados e estoque" },
        { key: "wallet", label: "Carteira e saque", to: "/sacar", icon: Wallet, hint: "Saldo e retiradas" },
        { key: "support", label: "Suporte", to: "/suporte", icon: Headset, hint: "Atendimento ligado à sua conta" },
      ],
    };

    const seller: MenuSection = {
      id: "seller",
      title: isSeller ? "Painel do vendedor" : "Começar a vender",
      entries: [
        { key: "seller-listings", label: "Gerenciar anúncios", to: "/meus-produtos", icon: Package, hint: "Criar, editar e pausar" },
        ...(isSeller ? [
          { key: "sales", label: "Pedidos e entregas", to: "/minhas-compras?scope=sales", icon: Receipt, hint: "Vendas aguardando ação", badge: sellerOrders || undefined },
          { key: "sales-history", label: "Histórico de vendas", to: "/minhas-compras?scope=sales", icon: BarChart3, hint: "Transações como vendedor" },
          { key: "seller-verified", label: "Verificação de vendedor", to: "/perfil", icon: BadgeCheck, hint: profile?.is_verified_seller ? "Conta verificada" : "Envie seus documentos" },
        ] : [
          { key: "seller-start", label: "Verificar minha conta", to: "/perfil", icon: BadgeCheck, hint: "Prepare sua conta para vender" },
        ]),
      ],
    };

    const result: MenuSection[] = [marketplace, account, seller, help];

    if (isAdmin || isSupport) {
      result.splice(3, 0, {
        id: "admin",
        title: isAdmin ? "Administração" : "Operações de suporte",
        entries: isAdmin ? [
          { key: "admin-home", label: "Painel administrativo", to: "/admin", icon: Shield, hint: "Visão geral da operação" },
          { key: "admin-products", label: "Moderação de anúncios", to: "/admin?tab=products", icon: ClipboardCheck, badge: pendingModeration || undefined },
          { key: "admin-orders", label: "Pedidos", to: "/admin?tab=orders", icon: Receipt },
          { key: "admin-disputes", label: "Disputas e denúncias", to: "/admin?tab=disputes", icon: Flag },
          { key: "admin-users", label: "Usuários e verificações", to: "/admin?tab=verifications", icon: Users },
          { key: "admin-notices", label: "Avisos e conteúdo", to: "/admin?tab=notices", icon: MessageSquare },
          { key: "admin-tags", label: "Tags de usuários", to: "/admin?tab=tags", icon: Tag, hint: "Selos persistentes por ID público" },
          { key: "admin-roles", label: "Cargos e permissões", to: "/admin?tab=roles", icon: Users, hint: "Acesso auditado no banco" },
          { key: "admin-apis", label: "APIs e credenciais", to: "/admin?tab=apis", icon: KeyRound },
          { key: "admin-config", label: "Operação e manutenção", to: "/admin?tab=config", icon: Settings, hint: "Taxas, limites e manutenção" },
          { key: "admin-security", label: "Segurança do painel", to: "/admin?tab=security", icon: ShieldCheck, hint: mfaEnabled ? "2FA ativo" : "Ative o 2FA" },
        ] : [
          { key: "support-console", label: "Console de operações", to: "/admin", icon: Shield, hint: "Ações permitidas à sua conta" },
        ],
      });
    }

    return result;
  }, [user, isAdmin, isSupport, isSeller, count, openOrders, sellerOrders, pendingModeration, mfaEnabled, profile?.is_verified_seller]);

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
      <button className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar menu" />
      <aside id="zxmax-main-menu" className="absolute right-0 top-0 flex h-[100dvh] w-full max-w-[430px] flex-col border-l border-white/[0.08] bg-[#0a0d13] shadow-[-28px_0_80px_rgba(0,0,0,.45)]">
        <div className="border-b border-white/[0.07] px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#67b8ff]">Navegação</p>
              <h2 className="mt-1 text-lg font-black tracking-tight text-white">Menu da ZXMAX</h2>
            </div>
            <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.09] bg-white/[0.035] text-white/60 transition hover:bg-white/[0.07] hover:text-white" aria-label="Fechar menu">
              <X className="h-4 w-4" />
            </button>
          </div>

          {user ? (
            <button onClick={() => { onOpenProfile(); onClose(); }} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#11161f] p-3.5 text-left transition hover:border-[#168cff]/25">
              {profile?.avatar_url || state.currentUser?.avatar ? (
                <img src={profile?.avatar_url || state.currentUser?.avatar} alt="Avatar" className="h-11 w-11 rounded-xl object-cover" />
              ) : (
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#168cff]/12 text-sm font-black text-[#79c3ff]">{(profile?.display_name || user.email || "U").slice(0, 1).toUpperCase()}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-black text-white">{profile?.display_name || user.email?.split("@")[0]}{profile?.is_verified_seller && <BadgeCheck className="h-4 w-4 shrink-0 text-[#68b9ff]" />}</span>
                <span className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-white/35"><Wallet className="h-3 w-3" /> R$ {Number(state.currentUser?.balance ?? 0).toFixed(2)}</span>
                <span className="mt-1.5 flex items-center gap-2 text-[9px] font-bold uppercase tracking-wide text-white/28">
                  <span>ID #{profile?.public_id || state.currentUser?.publicId || "—"}</span>
                  <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden />
                  <span>{openOrders} em aberto</span>
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-white/25" />
            </button>
          ) : (
            <Link to="/loja?login=1" onClick={onClose} className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-[#168cff]/20 bg-[#168cff]/[0.08] p-3.5 text-left">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#168cff]/15 text-[#7dc7ff]"><LogIn className="h-4 w-4" /></span>
              <span><span className="block text-xs font-black text-white">Entre para acessar sua conta</span><span className="mt-0.5 block text-[10px] text-white/35">Pedidos, anúncios, favoritos e suporte</span></span>
            </Link>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.id}>
                <p className="mb-2 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/24">{section.title}</p>
                <div className="space-y-1">
                  {section.entries.map((item) => <DrawerLink key={item.key} item={item} active={isActive(item.to)} onClose={onClose} />)}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-white/[0.07] bg-[#090c11] p-4">
          <p className="mb-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/24">Preferência visual</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => toggleDark?.()} className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[11px] font-black text-white/55 transition hover:bg-white/[0.06] hover:text-white">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {isDark ? "Tema claro" : "Tema escuro"}
            </button>
            {user ? (
              <button onClick={async () => { await signOut(); onClose(); }} className="flex items-center justify-center gap-2 rounded-xl border border-red-400/[0.12] bg-red-500/[0.05] px-3 py-3 text-[11px] font-black text-red-200/70 transition hover:bg-red-500/[0.1] hover:text-red-100">
                <LogOut className="h-4 w-4" /> Sair
              </button>
            ) : (
              <Link to="/loja?login=1" onClick={onClose} className="flex items-center justify-center gap-2 rounded-xl bg-[#168cff] px-3 py-3 text-[11px] font-black text-white">
                <LogIn className="h-4 w-4" /> Entrar
              </Link>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
