import React, { useState, useEffect } from "react";
import { X, Shield, Cookie } from "lucide-react";
import { Link } from "react-router-dom";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("zxmax_cookie_consent");
    if (!consent) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("zxmax_cookie_consent", "accepted");
    localStorage.setItem("zxmax_cookie_consent_time", String(Date.now()));
    setVisible(false);
    // Enable analytics, etc.
  };

  const deny = () => {
    localStorage.setItem("zxmax_cookie_consent", "denied");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[90] p-4 md:p-6 animate-fade-in-up">
      <div className="max-w-4xl mx-auto bg-[#15151a] border border-[#25252e] rounded-2xl p-5 shadow-2xl">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#0084ff]/10 border border-[#0084ff]/20 flex items-center justify-center shrink-0">
            <Cookie className="w-5 h-5 text-[#0084ff]" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              Cookies e Privacidade
              <Shield className="w-3.5 h-3.5 text-[#00c950]" />
            </h4>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Usamos cookies para facilitar login, prevenir golpes, lembrar favoritos e melhorar sua experiência. Ao aceitar, você concorda com nossos{" "}
              <Link to="/termos" className="text-[#0084ff] hover:underline">Termos</Link> e{" "}
              <Link to="/privacidade" className="text-[#0084ff] hover:underline">Regras</Link>.
            </p>
            <div className="flex gap-2 mt-4">
              <button onClick={deny} className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs font-bold transition">
                Negar
              </button>
              <button onClick={accept} className="px-6 py-2.5 rounded-xl bg-[#0084ff] hover:bg-[#0066cc] text-white text-xs font-black transition">
                Aceitar cookies
              </button>
            </div>
          </div>
          <button onClick={deny} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/40 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
