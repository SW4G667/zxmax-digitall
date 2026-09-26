import React, { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BadgeCheck, Boxes, ChevronRight, Clock3, CreditCard, FileText, Heart, HelpCircle,
  Home, LayoutGrid, Lock, LogIn, LogOut, Moon, Package, ReceiptText, RefreshCcw,
  ScrollText, Settings, ShieldCheck, ShoppingBag, Sparkles, Store, Sun, User,
  Wallet, X, Zap,
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
  label: string;
  to: string;
  icon: IconType;
  hint?: string;
  badge?: number | string;
}

function DrawerLink({ item, active, onClose }: { item: MenuItem; active: boolean; onClose: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onClose}
      className={`group flex items-center gap-3 rounded-xl border px-3 py-3 transition ${active ? "border-[#168cff]/30 bg-[#168cff]/10" : "border-transparent hover:border-white/[0.07] hover:bg-white/[0.035]"}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "bg-[#168cff]/16 text-[#7bc5ff]" : "bg-white/[0.035] text-white/45 group-hover:text-white/75"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[12px] font-black ${active ? "text-white" : "text-white/72"}`}>{item.label}</span>
        {item.hint && <span className="mt-0.5 block truncate text-[10px] font-medium text-white/28">{item.hint}</span>}
      </span>
      {item.badge ? <span className="rounded-full bg-[#168cff] px-2 py-0.5 text-[9px] font-black text-white">{item.badge}</span> : <ChevronRight className="h-3.5 w-3.5 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/45" />}
    </Link>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 px-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/24">{children}</p>;
}

export default function SideMenu({ open, onClose, onNavigate, onOpenProfile }: Props) {
  const { user, profile, isAdmin, isSupport, signOut } = useAuth();
  const { state, isDark, toggleDark } = useStore();
  const { count } = useFavorites();
  const location = useLocation();

  const isSeller = useMemo(
    () => Boolean(profile?.is_verified_seller || state.products.some((product) => product.sellerId === user?.id)),
    [profile?.is_verified_seller, state.products, user?.id],
  );

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

  const marketplace: MenuItem[] = [
    { label: "Página inicial", to: "/", icon: Home, hint: "Destaques e acesso rápido" },
    { label: "Marketplace", to: "/loja", icon: Store, hint: "Todos os anúncios disponíveis" },
    { label: "Categorias", to: "/categorias", icon: LayoutGrid, hint: "Navegue por tipo de produto" },
    { label: "Mercado de Robux", to: "/robux", icon: Sparkles, hint: "Compare ofertas de Robux" },
    { label: "Mais vendidos", to: "/loja?sort=vendidos", icon: ShoppingBag, hint: "Produtos com maior volume de vendas" },
    { label: "Entrega automática", to: "/entrega-automatica", icon: Zap, hint: "Entenda e filtre entregas imediatas" },
    { label: "Vendedores verificados", to: "/vendedores-verificados", icon: BadgeCheck, hint: "Como funciona a verificação" },
    { label: "Favoritos", to: "/favoritos", icon: Heart, hint: "Anúncios que você salvou", badge: count || undefined },
  ];

  const learn: MenuItem[] = [
    { label: "Como funciona", to: "/como-funciona", icon: Boxes, hint: "Do anúncio até a confirmação da entrega" },
    { label: "Como comprar", to: "/comprar", icon: ShoppingBag, hint: "Guia para compradores" },
    { label: "Como vender", to: "/vender", icon: Store, hint: "Guia para vendedores" },
    { label: "Segurança", to: "/seguranca", icon: ShieldCheck, hint: "Proteções e boas práticas" },
    { label: "Formas de pagamento", to: "/formas-de-pagamento", icon: CreditCard, hint: "Métodos disponíveis no checkout" },
    { label: "Tarifas e prazos", to: "/tarifas-e-prazos", icon: Clock3, hint: "Transparência antes de concluir" },
    { label: "Reembolsos", to: "/reembolsos", icon: RefreshCcw, hint: "Problemas, análise e resolução" },
  ];

  const account: MenuItem[] = user ? [
    { label: "Meu perfil", to: "/perfil", icon: User, hint: "Identidade pública e dados da conta" },
    { label: "Configurações", to: "/configuracoes", icon: Settings, hint: "Senha, sessões e preferências" },
    { label: "Meus pedidos", to: "/minhas-compras", icon: ReceiptText, hint: "Compras e acompanhamento" },
    { label: "Meus anúncios", to: "/meus-produtos", icon: Package, hint: "Produtos publicados e estoque" },
    { label: "Carteira e saque", to: "/sacar", icon: Wallet, hint: "Saldo e retiradas" },
    { label: "Suporte", to: "/suporte", icon: HelpCircle, hint: "Atendimento ligado à sua conta" },
  ] : [];

  const legal: MenuItem[] = [
    { label: "Central de ajuda", to: "/central-de-ajuda", icon: HelpCircle },
    { label: "FAQ", to: "/faq", icon: Boxes },
    { label: "Regras", to: "/regras", icon: ScrollText },
    { label: "Termos de uso", to: "/termos", icon: FileText },
    { label: "Privacidade", to: "/privacidade", icon: Lock },
  ];

  const active = (to: string) => {
    const clean = to.split("?")[0];
    if (clean === "/") return location.pathname === "/";
    return location.pathname === clean || location.pathname.startsWith(`${clean}/`);
  };

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
                <span className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-white/35"><Wallet className="h-3 w-3" /> R$ {Number(state.currentUser?.balance ?? 0).toFixed(2)} {isSeller ? "· vendedor" : ""}</span>
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
            <section>
              <SectionTitle>Marketplace</SectionTitle>
              <div className="space-y-1">{marketplace.map((item) => <DrawerLink key={item.to} item={item} active={active(item.to)} onClose={onClose} />)}</div>
            </section>

            {account.length > 0 && (
              <section>
                <SectionTitle>Minha conta</SectionTitle>
                <div className="space-y-1">{account.map((item) => <DrawerLink key={item.to} item={item} active={active(item.to)} onClose={onClose} />)}</div>
              </section>
            )}

            {(isAdmin || isSupport) && (
              <section>
                <SectionTitle>Equipe</SectionTitle>
                <button onClick={() => { onNavigate("admin"); onClose(); }} className="group flex w-full items-center gap-3 rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/[0.05] px-3 py-3 text-left transition hover:border-[#f59e0b]/30">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f59e0b]/10 text-[#ffc45f]"><ShieldCheck className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-[12px] font-black text-white">Painel administrativo</span><span className="mt-0.5 block text-[10px] text-white/28">Moderação, integrações e operação</span></span>
                  <ChevronRight className="h-3.5 w-3.5 text-white/20" />
                </button>
              </section>
            )}

            <section>
              <SectionTitle>Comprar e vender</SectionTitle>
              <div className="space-y-1">{learn.map((item) => <DrawerLink key={item.to} item={item} active={active(item.to)} onClose={onClose} />)}</div>
            </section>

            <section>
              <SectionTitle>Ajuda e legal</SectionTitle>
              <div className="space-y-1">{legal.map((item) => <DrawerLink key={item.to} item={item} active={active(item.to)} onClose={onClose} />)}</div>
            </section>
          </div>
        </div>

        <div className="border-t border-white/[0.07] bg-[#090c11] p-4">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={toggleDark} className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-[11px] font-black text-white/55 transition hover:bg-white/[0.06] hover:text-white">
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
