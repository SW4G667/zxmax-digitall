import React from "react";
import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-[#1e1e28] bg-[#0a0a0f]">
      <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm font-black text-white">ZX<span className="text-[#0084ff]">MAX</span>
          <span className="ml-2 text-[11px] font-medium text-white/35">© {new Date().getFullYear()}</span>
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
          <Link to="/faq" className="hover:text-white">Como funciona</Link>
          <Link to="/regras" className="hover:text-white">Regras</Link>
          <Link to="/termos" className="hover:text-white">Termos</Link>
          <Link to="/privacidade" className="hover:text-white">Privacidade</Link>
          <Link to="/robux" className="hover:text-white">Robux</Link>
          <Link to="/suporte" className="hover:text-white">Suporte</Link>
        </nav>
      </div>
    </footer>
  );
}
