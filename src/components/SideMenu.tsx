import React from "react";
import { Link } from "react-router-dom";
import { X, Store, Package, ShoppingBag, Headset, Shield, User, Wallet, FileText, HelpCircle, Lock, ScrollText, Heart, Gamepad2, Bot, Key, File, Palette, Briefcase, GraduationCap, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "withdraw";

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (v: View) => void;
  onOpenProfile: () => void;
}

export default function SideMenu({ open, onClose, onNavigate, onOpenProfile }: Props) {
  const { isAdmin, user, profile } = useAuth();
  if (!open) return null;

  const go = (v: View) => {
    onNavigate(v);
    onClose();
  };

  const Item = ({ icon: Icon, label, hint, onClick }: { icon: any; label: string; hint?: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition text-left"
    >
      <span className="p-2 rounded-xl bg-primary/10 text-primary"><Icon className="w-4 h-4" /></span>
      <span className="flex-1">
        <span className="block text-sm font-bold text-foreground">{label}</span>
        {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[80] bg-foreground/40 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="absolute left-0 top-0 h-full w-[88%] max-w-sm bg-card border-r border-border/40 p-5 overflow-y-auto animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black tracking-tighter text-foreground">
            ZX<span className="text-primary">MAX</span>
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {user && (
          <button onClick={() => { onOpenProfile(); onClose(); }} className="w-full flex items-center gap-3 p-3 mb-4 rounded-2xl bg-muted hover:opacity-90 transition text-left">
            <img src={profile?.avatar_url || ""} alt="Avatar" className="w-11 h-11 rounded-xl object-cover bg-primary/10" />
            <span>
              <span className="block text-sm font-bold text-foreground">{profile?.display_name || "Minha conta"}</span>
              <span className="block text-[11px] text-muted-foreground">Editar nome, foto e dados</span>
            </span>
          </button>
        )}

        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-1">Marketplace</p>
        <div className="space-y-1 mb-4">
          <Item icon={Store} label="Loja" hint="Ver todos os anúncios" onClick={() => go("store")} />
          <Link to="/favoritos" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition">
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><Heart className="w-4 h-4" /></span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-foreground">Favoritos</span>
              <span className="block text-[11px] text-muted-foreground">Seus produtos salvos</span>
            </span>
          </Link>
          <Item icon={Package} label="Anunciar / Meus produtos" hint="Criar, editar e gerenciar anúncios" onClick={() => go("inventory")} />
          <Item icon={ShoppingBag} label="Minhas compras" hint="Pedidos, entregas e chat" onClick={() => go("purchases")} />
          <Item icon={Headset} label="Suporte" hint="Falar com a equipe" onClick={() => go("support")} />
          {isAdmin && <Item icon={Shield} label="Painel admin" hint="Moderação, saques e APIs" onClick={() => go("admin")} />}
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-1">Conta</p>
        <div className="space-y-1 mb-4">
          <Link to="/perfil" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition">
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><User className="w-4 h-4" /></span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-foreground">Meu perfil</span>
              <span className="block text-[11px] text-muted-foreground">Dados pessoais e verificação</span>
            </span>
          </Link>
          <Item icon={Wallet} label="Sacar dinheiro" hint="Pix em 5 a 7 dias úteis" onClick={() => go("withdraw")} />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-1">Institucional</p>
        <div className="space-y-1">
          <Link to="/regras" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition">
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><ScrollText className="w-4 h-4" /></span>
            <span className="text-sm font-bold text-foreground">Regras da plataforma</span>
          </Link>
          <Link to="/faq" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition">
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><HelpCircle className="w-4 h-4" /></span>
            <span className="text-sm font-bold text-foreground">Perguntas frequentes</span>
          </Link>
          <Link to="/termos" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition">
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><FileText className="w-4 h-4" /></span>
            <span className="text-sm font-bold text-foreground">Termos de uso</span>
          </Link>
          <Link to="/privacidade" onClick={onClose} className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-muted transition">
            <span className="p-2 rounded-xl bg-primary/10 text-primary"><Lock className="w-4 h-4" /></span>
            <span className="text-sm font-bold text-foreground">Política de privacidade</span>
          </Link>
        </div>
      </aside>
    </div>
  );
}
