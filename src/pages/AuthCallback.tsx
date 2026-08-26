import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from "@/components/LoadingScreen";

/**
 * Callback exclusivo de OAuth. A troca PKCE é feita pelo SDK Supabase quando
 * ele processa a URL; esta tela apenas aguarda uma sessão autenticada e remove
 * parâmetros transitórios antes de encaminhar o usuário à loja.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState("Concluindo autenticação segura...");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(location.search);
    const oauthError = params.get("error") || params.get("error_code");
    if (oauthError) {
      setFailed(true);
      setMessage("O login com Discord foi cancelado ou não pôde ser concluído. Tente novamente.");
      window.history.replaceState({}, document.title, "/auth/callback");
      return () => { active = false; };
    }

    const cleanAndContinue = () => {
      if (!active) return;
      window.history.replaceState({}, document.title, "/auth/callback");
      navigate("/loja", { replace: true });
    };

    const timeout = window.setTimeout(() => {
      if (active) {
        setFailed(true);
        setMessage("A autenticação demorou mais que o esperado. Verifique a configuração do Discord ou tente novamente.");
      }
    }, 10_000);

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) cleanAndContinue();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) cleanAndContinue();
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, [location.search, navigate]);

  if (failed) {
    return (
      <main className="min-h-screen bg-[#050508] text-white flex items-center justify-center p-5">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101017] p-7 text-center shadow-2xl">
          <p className="text-sm text-white/70">{message}</p>
          <button
            type="button"
            onClick={() => navigate("/loja?login=1", { replace: true })}
            className="mt-5 rounded-xl bg-[#0084ff] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#006ed8]"
          >
            Voltar para o login
          </button>
        </section>
      </main>
    );
  }

  return <LoadingScreen message={message} />;
}
