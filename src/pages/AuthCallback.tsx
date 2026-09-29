import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LoadingScreen from "@/components/LoadingScreen";
import { recordSecurityEvent } from "@/lib/securityEvents";

/**
 * Callback único do Supabase Auth. Ele atende confirmação de e-mail, recuperação
 * concluída e OAuth do Discord sem tratar todos os logins como se fossem Discord.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState("Concluindo autenticação segura...");
  const [failed, setFailed] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    let active = true;
    finishedRef.current = false;
    const params = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.replace(/^#/, ""));
    const oauthError = params.get("error") || params.get("error_code") || hashParams.get("error") || hashParams.get("error_code");
    if (oauthError) {
      finishedRef.current = true;
      void recordSecurityEvent(supabase, "auth.discord", "failure");
      setFailed(true);
      setMessage("O login com Discord foi cancelado ou não pôde ser concluído. Tente novamente.");
      window.history.replaceState({}, document.title, "/auth/callback");
      return () => { active = false; };
    }

    const intent = params.get("intent");
    const requestedNext = params.get("next");
    const isDiscordFlow = intent === "listing" || Boolean(window.sessionStorage.getItem("zxmax_discord_verify_user"));
    const nextPath = requestedNext?.startsWith("/") ? requestedNext : "/meus-produtos?new=1";

    const cleanAndContinue = async (session: any) => {
      if (!active || finishedRef.current) return;
      finishedRef.current = true;
      setMessage(intent === "listing" ? "Verificando e-mail e servidor do Discord..." : "Confirmando sua conta...");

      const expectedUserId = window.sessionStorage.getItem("zxmax_discord_verify_user");
      if (intent === "listing" && expectedUserId && session?.user?.id !== expectedUserId) {
        window.sessionStorage.removeItem("zxmax_discord_verify_user");
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        if (!active) return;
        setFailed(true);
        setMessage("O Discord autorizado pertence a outra conta. Entre novamente na ZXMAX e use o Discord vinculado ao mesmo e-mail.");
        return;
      }

      if (!isDiscordFlow) {
        void recordSecurityEvent(supabase, "auth.login", "success");
        window.history.replaceState({}, document.title, "/auth/callback");
        navigate("/loja?email=confirmed", { replace: true });
        return;
      }

      let membership: any = null;
      if (session?.provider_token) {
        try {
          const result = await supabase.functions.invoke("discord-membership", {
            body: { action: "verify", providerToken: session.provider_token },
          });
          membership = result.data;
        } catch {
          membership = null;
        }
      }

      if (intent === "listing") {
        window.sessionStorage.removeItem("zxmax_discord_verify_user");
        if (membership?.verified === true) {
          void recordSecurityEvent(supabase, "auth.discord", "success");
          const separator = nextPath.includes("?") ? "&" : "?";
          window.location.replace(`${nextPath}${separator}discord=verified`);
          return;
        }
        if (membership?.code === "not_member") {
          const separator = nextPath.includes("?") ? "&" : "?";
          window.location.replace(`${nextPath}${separator}discord=join`);
          return;
        }
        const separator = nextPath.includes("?") ? "&" : "?";
        window.location.replace(`${nextPath}${separator}discord=retry`);
        return;
      }

      void recordSecurityEvent(supabase, "auth.discord", "success");
      window.history.replaceState({}, document.title, "/auth/callback");
      navigate("/loja", { replace: true });
    };

    const timeout = window.setTimeout(() => {
      if (active) {
        if (finishedRef.current) return;
        finishedRef.current = true;
        void recordSecurityEvent(supabase, isDiscordFlow ? "auth.discord" : "auth.login", "failure");
        setFailed(true);
        setMessage(isDiscordFlow
          ? "A autenticação demorou mais que o esperado. Verifique o Discord ou tente novamente."
          : "A confirmação demorou mais que o esperado. Abra novamente o link recebido ou solicite outro e-mail.");
      }
    }, 10_000);

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void cleanAndContinue(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) void cleanAndContinue(session);
    });

    return () => {
      active = false;
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, [location.hash, location.search, navigate]);

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
