import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Zap, MessageCircle } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--gg-border)] bg-[var(--gg-surface)]">
      <div className="max-w-7xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
        <div>
          <BrandLogo size="sm" />
          <p className="text-xs text-[var(--gg-muted)] mt-2 leading-relaxed">
            Marketplace de produtos digitais com compra protegida, Pix instantâneo e cripto.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-[var(--gg-faint)] mb-3">Institucional</p>
          <div className="space-y-2 text-sm">
            <Link to="/faq" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Como funciona</Link>
            <Link to="/faq" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Perguntas frequentes</Link>
            <Link to="/regras" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Regras</Link>
            <Link to="/termos" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Termos de uso</Link>
            <Link to="/privacidade" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Privacidade</Link>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-[var(--gg-faint)] mb-3">Comprar</p>
          <div className="space-y-2 text-sm">
            <Link to="/robux" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Robux</Link>
            <Link to="/loja" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Todos os anúncios</Link>
            <Link to="/favoritos" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Favoritos</Link>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-[var(--gg-faint)] mb-3">Vender</p>
          <div className="space-y-2 text-sm">
            <Link to="/meus-produtos" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Criar anúncio</Link>
            <Link to="/sacar" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Sacar saldo</Link>
            <Link to="/suporte" className="block text-[var(--gg-muted)] hover:text-[var(--gg-blue)]">Suporte</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[var(--gg-border)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[var(--gg-faint)]">
          <div className="flex flex-wrap gap-4">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-[#00c950]" /> Compra protegida</span>
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> Pix + Crypto</span>
            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-[var(--gg-blue)]" /> Chat do pedido</span>
          </div>
          <p>© {new Date().getFullYear()} ZXMAX</p>
        </div>
      </div>
    </footer>
  );
}
