import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { X, Store, Package, ShoppingBag, Headset, Shield, User, Wallet, FileText, HelpCircle, Lock, ScrollText, Heart, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import useFavorites from "@/hooks/useFavorites";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "withdraw";

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (v: View) => void;
  onOpenProfile: () => void;
}

export default function SideMenu({ open, onClose, onNavigate, onOpenProfile }: Props) {
  const { isAdmin, user, profile, mfaEnabled } = useAuth();
  const { count } = useFavorites();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const go = (v: View) => {
    onNavigate(v);
    onClose();
  };

  const Item = ({ icon: Icon, label, hint, onClick, badge, highlight }: { icon: any; label: string; hint?: string; onClick: () => void; badge?: string | number; highlight?: boolean }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all text-left group relative overflow-hidden ${
        highlight ? "bg-primary text-white shadow-lg shadow-primary/20" : "hover:bg-white/[0.06] bg-transparent"
      }`}
    >
      {highlight && <div className="absolute inset-0 bg-gradient-to-r from-primary to-[#339dff] opacity-100" />}
      <span className={`relative z-10 p-2.5 rounded-xl transition-all ${highlight ? "bg-white/20 text-white" : "bg-white/[0.06] text-primary group-hover:bg-primary/15 group-hover:scale-110"}`}>
        <Icon className="w-[18px] h-[18px]" />
      </span>
      <span className="relative z-10 flex-1 min-w-0">
        <span className={`block text-[13px] font-bold leading-tight ${highlight ? "text-white" : "text-white group-hover:text-white"}`}>{label}</span>
        {hint && <span className={`block text-[11px] leading-tight mt-0.5 ${highlight ? "text-white/70" : "text-white/40 group-hover:text-white/60"}`}>{hint}</span>}
      </span>
      {badge !== undefined && badge !== 0 && (
        <span className={`relative z-10 text-[11px] font-black px-2.5 py-1 rounded-full ${highlight ? "bg-white text-primary" : "bg-primary text-white"}`}>{badge}</span>
      )}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[80] flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#050508]/80 backdrop-blur-xl" onClick={onClose} />

      {/* Sidebar */}
      <aside
        className="relative w-[88%] max-w-[360px] h-full bg-[#0a0a0f] border-r border-white/10 flex flex-col overflow-hidden animate-slide-in-bottom shadow-[20px_0_60px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow */}
        <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-primary/10 via-primary/[0.03] to-transparent pointer-events-none" />
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 p-6 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tighter text-white">
                ZX<span className="text-primary">MAX</span>
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" /> Marketplace Seguro
              </p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {user && (
            <button onClick={() => { onOpenProfile(); onClose(); }} className="w-full mt-6 flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 transition text-left group">
              <div className="relative">
                <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.display_name}`} alt="Avatar" className="w-12 h-12 rounded-xl object-cover bg-primary/10 border border-white/10" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#0a0a0f] border border-white/10 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white truncate group-hover:text-primary transition">{profile?.display_name || "Minha conta"}</p>
                <p className="text-[11px] text-white/40 truncate flex items-center gap-1">
                  {mfaEnabled ? <ShieldCheck className="w-3 h-3 text-success" /> : <Lock className="w-3 h-3 text-white/20" />}
                  {mfaEnabled ? "Protegida com 2FA" : "Toque para proteger"}
                </p>
              </div>
              <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition">
                <User className="w-4 h-4 text-white/40 group-hover:text-primary" />
              </div>
            </button>
          )}
        </div>

        {/* Scrollable */}
        <div className="relative z-10 flex-1 overflow-y-auto px-3 pb-6 space-y-6 scrollbar-hide">
          {/* Marketplace */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 px-3 mb-3 flex items-center gap-2">
              <TrendingUp className="w-3 h-3" /> Marketplace
            </p>
            <div className="space-y-1">
              <Item icon={Store} label="Loja" hint="Ver todos os anúncios" onClick={() => go("store")} highlight />
              <Link to="/favoritos" onClick={onClose} className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-white/[0.06] transition group text-left">
                <span className="p-2.5 rounded-xl bg-white/[0.06] text-primary group-hover:bg-primary/15 group-hover:scale-110 transition">
                  <Heart className="w-[18px] h-[18px]" />
                </span>
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-white">Favoritos</span>
                  <span className="block text-[11px] text-white/40">Seus produtos salvos</span>
                </span>
                {count > 0 && <span className="bg-primary text-white text-[11px] font-black px-2.5 py-1 rounded-full">{count}</span>}
              </Link>
              <Item icon={Package} label="Anunciar / Meus produtos" hint="Criar, editar e gerenciar anúncios" onClick={() => go("inventory")} />
              <Item icon={ShoppingBag} label="Minhas compras" hint="Pedidos, entregas e chat" onClick={() => go("purchases")} />
              <Item icon={Headset} label="Suporte" hint="Falar com a equipe 24h" onClick={() => go("support")} />
              {isAdmin && <Item icon={Shield} label="Painel admin" hint={mfaEnabled ? "Protegido com 2FA" : "Ative o 2FA!"} onClick={() => go("admin")} badge={mfaEnabled ? "✓" : "!"} />}
            </div>
          </div>

          {/* Conta */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 px-3 mb-3 flex items-center gap-2">
              <User className="w-3 h-3" /> Conta
            </p>
            <div className="space-y-1">
              <Link to="/perfil" onClick={onClose} className="w-full flex items-center gap-3 p-3.5 rounded-2xl hover:bg-white/[0.06] transition group">
                <span className="p-2.5 rounded-xl bg-white/[0.06] text-primary group-hover:bg-primary/15 transition">
                  <User className="w-[18px] h-[18px]" />
                </span>
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-white">Meu perfil</span>
                  <span className="block text-[11px] text-white/40">Dados e verificação</span>
                </span>
              </Link>
              <Item icon={Wallet} label="Sacar dinheiro" hint="Pix em 5 a 7 dias úteis" onClick={() => go("withdraw")} />
              <Link to="/perfil" onClick={onClose} className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-success/10 border border-success/20 hover:bg-success/15 transition group">
                <span className="p-2.5 rounded-xl bg-success/20 text-success">
                  <ShieldCheck className="w-[18px] h-[18px]" />
                </span>
                <span className="flex-1">
                  <span className="block text-[13px] font-bold text-white">Segurança 2FA</span>
                  <span className="block text-[11px] text-success/70">{mfaEnabled ? "Ativo e protegido" : "Ativar autenticador"}</span>
                </span>
                <Sparkles className="w-4 h-4 text-success" />
              </Link>
            </div>
          </div>

          {/* Institucional */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/20 px-3 mb-3">Institucional</p>
            <div className="space-y-1">
              <Link to="/regras" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition text-white/60 hover:text-white">
                <ScrollText className="w-4 h-4 text-white/30" />
                <span className="text-[13px] font-semibold">Regras da plataforma</span>
              </Link>
              <Link to="/faq" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition text-white/60 hover:text-white">
                <HelpCircle className="w-4 h-4 text-white/30" />
                <span className="text-[13px] font-semibold">Perguntas frequentes</span>
              </Link>
              <Link to="/termos" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition text-white/60 hover:text-white">
                <FileText className="w-4 h-4 text-white/30" />
                <span className="text-[13px] font-semibold">Termos de uso</span>
              </Link>
              <Link to="/privacidade" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition text-white/60 hover:text-white">
                <Lock className="w-4 h-4 text-white/30" />
                <span className="text-[13px] font-semibold">Política de privacidade</span>
              </Link>
            </div>
          </div>

          <div className="pt-4 px-3">
            <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 p-4">
              <p className="text-xs font-bold text-white flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> Compra Protegida</p>
              <p className="text-[11px] text-white/50 mt-1 leading-relaxed">Seu dinheiro protegido até confirmar a entrega. Reembolso garantido.</p>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 shrink-0">
          <p className="text-[10px] text-white/20 text-center font-mono">ZXMAX v2 • GGMAX Edition • Seguro</p>
        </div>
      </aside>
    </div>
  );
}
