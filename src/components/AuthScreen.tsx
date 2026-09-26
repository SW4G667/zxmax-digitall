import React, { useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getDiscordRedirectTo } from "@/lib/discordAuth";
import { recordSecurityEvent } from "@/lib/securityEvents";
import { useSiteBranding } from "@/context/SiteBrandingContext";

export default function AuthScreen({ onClose }: { onClose?: () => void }) {
  const { signUp, signIn } = useAuth();
  const { branding } = useSiteBranding();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [passStrength, setPassStrength] = useState(0);

  useEffect(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    setPassStrength(score);
  }, [password]);

  const handleDiscord = async () => {
    try {
      const { error: discordError } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: getDiscordRedirectTo() },
      });
      if (discordError) {
        void recordSecurityEvent(supabase, "auth.discord", "failure");
        toast.error("Login com Discord indisponível. Verifique a configuração e tente novamente.");
      }
    } catch {
      void recordSecurityEvent(supabase, "auth.discord", "failure");
      toast.error("Não foi possível iniciar o login com Discord agora. Tente novamente em instantes.");
    }
  };

  const handleForgot = async () => {
    if (!email.trim()) {
      setError("Informe seu e-mail para receber o link de recuperação.");
      return;
    }
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: new URL("/reset-password", window.location.origin).toString(),
      });
      if (resetError) throw resetError;
      void recordSecurityEvent(supabase, "auth.recovery", "success");
      toast.success("Se existir uma conta com este e-mail, enviaremos um link de recuperação.");
    } catch {
      void recordSecurityEvent(supabase, "auth.recovery", "failure");
      toast.success("Se existir uma conta com este e-mail, enviaremos um link de recuperação.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Preencha todos os campos.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          setError("As senhas não coincidem.");
          return;
        }
        if (password.length < 8) {
          setError("A senha deve ter pelo menos 8 caracteres.");
          return;
        }
        if (passStrength < 2) {
          setError("Senha muito fraca. Use maiúsculas, números e símbolos.");
          return;
        }
        if (!name.trim()) {
          setError("Digite seu nome.");
          return;
        }

        const { error: signUpError } = await signUp(email, password, name.trim());
        if (signUpError) setError(signUpError);
        else {
          toast.success("Conta criada! Verifique seu e-mail.");
          setMode("login");
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          void recordSecurityEvent(supabase, "auth.login", "failure");
          if (signInError.includes("Invalid login")) setError("Email ou senha incorretos.");
          else if (signInError.includes("Email not confirmed")) setError("Confirme seu e-mail antes.");
          else setError(signInError);
        } else {
          void recordSecurityEvent(supabase, "auth.login", "success");
          toast.success("Login realizado!");
          onClose?.();
        }
      }
    } catch {
      setError("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4">
      <div className="zx-auth-panel relative w-full max-w-[390px]">
        {onClose ? (
          <button onClick={onClose} aria-label="Fechar autenticação" className="zx-auth-close absolute right-3 top-3">
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <div className="pr-9">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.siteName} className="h-7 max-w-[135px] object-contain object-left" />
          ) : (
            <span className="text-lg font-extrabold tracking-[-0.04em] text-white">{branding.siteName || "ZXMAX"}</span>
          )}
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">Área da conta</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
          <p className="mt-1 text-xs leading-5 text-white/40">
            {mode === "login" ? "Acompanhe pedidos, anúncios e conversas em um só lugar." : "Crie seu perfil para comprar e vender dentro da plataforma."}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 rounded-lg bg-[#0b0b0e] p-1">
          <button onClick={() => { setMode("login"); setError(""); }} className={`rounded-md py-2 text-xs font-semibold transition ${mode === "login" ? "bg-[#1b1b20] text-white" : "text-white/40 hover:text-white"}`}>Entrar</button>
          <button onClick={() => { setMode("register"); setError(""); }} className={`rounded-md py-2 text-xs font-semibold transition ${mode === "register" ? "bg-[#1b1b20] text-white" : "text-white/40 hover:text-white"}`}>Criar conta</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          {mode === "register" ? <label className="zx-auth-field"><span>Nome público</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome no marketplace" autoComplete="name" /></label> : null}
          <label className="zx-auth-field"><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" autoComplete="email" required /></label>
          <div className="relative">
            <label className="zx-auth-field"><span>Senha</span><input type={showPass ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" autoComplete={mode === "login" ? "current-password" : "new-password"} required /></label>
            <button type="button" onClick={() => setShowPass((value) => !value)} aria-label={showPass ? "Ocultar senha" : "Mostrar senha"} className="absolute bottom-2.5 right-3 text-white/30 hover:text-white">
              {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {mode === "register" && password ? (
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((index) => <span key={index} className={`h-1 flex-1 rounded-full ${index < passStrength ? "bg-[#168cff]" : "bg-white/[0.08]"}`} />)}
            </div>
          ) : null}

          {mode === "register" ? <label className="zx-auth-field"><span>Confirmar senha</span><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a senha" autoComplete="new-password" /></label> : null}

          {error ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-500/[0.08] p-3 text-xs text-red-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div> : null}

          <button type="submit" disabled={loading} className="zx-auth-submit">{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar minha conta"}</button>
        </form>

        {mode === "login" ? (
          <button type="button" onClick={handleForgot} disabled={loading} className="mt-3 text-xs font-medium text-[#6ab6ff] hover:text-white disabled:opacity-50">Esqueceu sua senha?</button>
        ) : null}

        <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-white/[0.07]" /><span className="text-[10px] uppercase tracking-wide text-white/25">ou</span><span className="h-px flex-1 bg-white/[0.07]" /></div>

        <button onClick={handleDiscord} className="zx-auth-discord">
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" /></svg>
          Continuar com Discord
        </button>
      </div>
    </div>
  );
}
