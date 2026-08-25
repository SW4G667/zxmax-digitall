import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Zap, MessageCircle } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[#1e1e28] bg-[#0a0a0f]">
      <div className="max-w-7xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-4">
        <div>
          <p className="text-xl font-black text-white">ZX<span className="text-[#0084ff]">MAX</span></p>
          <p className="text-xs text-white/40 mt-2 leading-relaxed">
            Marketplace de produtos digitais com compra protegida, Pix instantâneo e cripto.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-white/30 mb-3">Institucional</p>
          <div className="space-y-2 text-sm">
            <Link to="/faq" className="block text-white/60 hover:text-white">Como funciona</Link>
            <Link to="/faq" className="block text-white/60 hover:text-white">Perguntas frequentes</Link>
            <Link to="/regras" className="block text-white/60 hover:text-white">Regras</Link>
            <Link to="/termos" className="block text-white/60 hover:text-white">Termos de uso</Link>
            <Link to="/privacidade" className="block text-white/60 hover:text-white">Privacidade</Link>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-white/30 mb-3">Comprar</p>
          <div className="space-y-2 text-sm">
            <Link to="/robux" className="block text-white/60 hover:text-white">Robux</Link>
            <Link to="/loja" className="block text-white/60 hover:text-white">Todos os anúncios</Link>
            <Link to="/favoritos" className="block text-white/60 hover:text-white">Favoritos</Link>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-white/30 mb-3">Vender</p>
          <div className="space-y-2 text-sm">
            <Link to="/meus-produtos" className="block text-white/60 hover:text-white">Criar anúncio</Link>
            <Link to="/sacar" className="block text-white/60 hover:text-white">Sacar saldo</Link>
            <Link to="/suporte" className="block text-white/60 hover:text-white">Suporte</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-[#1e1e28]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/35">
          <div className="flex flex-wrap gap-4">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-[#00c950]" /> Compra protegida</span>
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-[#ffbd2e]" /> Pix + Crypto</span>
            <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-[#0084ff]" /> Chat do pedido</span>
          </div>
          <p>© {new Date().getFullYear()} ZXMAX</p>
        </div>
      </div>
    </footer>
  );
}
