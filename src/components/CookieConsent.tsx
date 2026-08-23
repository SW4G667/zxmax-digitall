import React, { useState, useEffect } from "react";
import { Shield, Cookie } from "lucide-react";
import { Link } from "react-router-dom";

const CONSENT_KEY = "zxmax_cookie_consent";
const CONSENT_TIME_KEY = "zxmax_cookie_consent_time";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CONSENT_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setVisible(true), 400);
    return () => clearTimeout(t);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
      localStorage.setItem(CONSENT_TIME_KEY, String(Date.now()));
    } catch { /* noop */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90] p-4 md:p-6 animate-fade-in-up">
      <div className="max-w-4xl mx-auto bg-[#15151a] border border-[#25252e] rounded-2xl p-5 shadow-2xl">
        <div className="flex gap-4 items-start">
          <div className="w-10 h-10 rounded-xl bg-[#0084ff]/10 border border-[#0084ff]/20 flex items-center justify-center shrink-0">
            <Cookie className="w-5 h-5 text-[#0084ff]" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              Cookies e privacidade
              <Shield className="w-3.5 h-3.5 text-[#00c950]" />
            </h4>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Usamos cookies essenciais para login, segurança e lembrar suas preferências.
              Ao continuar, você concorda com os documentos abaixo.
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs">
              <Link to="/termos" className="text-[#0084ff] hover:underline font-semibold">Termos de uso</Link>
              <Link to="/privacidade" className="text-[#0084ff] hover:underline font-semibold">Privacidade</Link>
              <Link to="/regras" className="text-[#0084ff] hover:underline font-semibold">Regras</Link>
              <Link to="/faq" className="text-[#0084ff] hover:underline font-semibold">FAQ</Link>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={accept}
                className="px-6 py-2.5 rounded-xl bg-[#0084ff] hover:bg-[#0066cc] text-white text-xs font-black transition"
              >
                Aceitar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
