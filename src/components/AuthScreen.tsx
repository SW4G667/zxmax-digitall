import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, Lock, Eye, EyeOff, AlertTriangle, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getDiscordRedirectTo } from "@/lib/discordAuth";
import { recordSecurityEvent } from "@/lib/securityEvents";

export default function AuthScreen({ onClose }: { onClose?: () => void }) {
  const { signUp, signIn } = useAuth();
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
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    setPassStrength(s);
  }, [password]);

  const handleDiscord = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: getDiscordRedirectTo() },
      });
      if (error) {
        void recordSecurityEvent(supabase, "auth.discord", "failure");
        toast.error("Login com Discord indisponível. Verifique se o provedor foi configurado no Supabase Auth e se a URL de callback está autorizada.");
      }
    } catch (e: any) {
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
      // Resposta neutra para não permitir enumeração de contas.
      void recordSecurityEvent(supabase, "auth.recovery", "failure");
      toast.success("Se existir uma conta com este e-mail, enviaremos um link de recuperação.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Preencha todos os campos.");
    setLoading(true);
    try {
      if (mode === "register") {
        if (password !== confirmPassword) { setError("As senhas não coincidem."); setLoading(false); return; }
        if (password.length < 8) { setError("A senha deve ter pelo menos 8 caracteres."); setLoading(false); return; }
        if (passStrength < 2) { setError("Senha muito fraca. Use maiúsculas, números e símbolos."); setLoading(false); return; }
        if (!name.trim()) { setError("Digite seu nome."); setLoading(false); return; }
        const { error: err } = await signUp(email, password, name.trim());
        if (err) setError(err);
        else {
          toast.success("Conta criada! Verifique seu e-mail.");
          setMode("login");
        }
      } else {
        const { error: err } = await signIn(email, password);
        if (err) {
          void recordSecurityEvent(supabase, "auth.login", "failure");
          if (err.includes("Invalid login")) setError("Email ou senha incorretos.");
          else if (err.includes("Email not confirmed")) setError("Confirme seu e-mail antes.");
          else setError(err);
        } else {
          // Login confirmed: close the modal right away. The admin 2FA code,
          // when needed, is asked only inside the admin panel.
          void recordSecurityEvent(supabase, "auth.login", "success");
          toast.success("Login realizado!");
          onClose?.();
        }
      }
    } catch {
      setError("Erro inesperado. Tente novamente.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#04060a]/[0.76] p-4 backdrop-blur-sm sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_12%,rgba(20,120,255,0.13),transparent_30%),linear-gradient(180deg,rgba(3,7,13,0.26),rgba(3,5,9,0.7))]" />

      <div className="zx-auth-panel relative z-10 my-auto w-full max-w-[25rem] animate-fade-in-up">
        {onClose && (
          <button aria-label="Fechar autenticação" onClick={onClose} className="zx-auth-close absolute right-4 top-4">
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="mb-6 border-b border-white/[0.08] pb-5 pr-10">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#65bbff]">Área da conta</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.055em] text-white">{mode === "login" ? "Entre na sua conta" : "Crie sua conta"}</h1>
          <p className="mt-1.5 text-[13px] leading-5 text-white/48">{mode === "login" ? "Acompanhe pedidos, anúncios e conversas em um só lugar." : "Seu perfil público usa nome, avatar e ID — sem exibir seus contatos."}</p>
        </div>

        <div className="mb-5 flex gap-5 border-b border-white/[0.08]" aria-label="Modo de acesso">
          <button onClick={() => { setMode("login"); setError(""); }} className={`-mb-px border-b-2 px-0.5 pb-3 text-xs font-black transition ${mode === "login" ? "border-[#168cff] text-white" : "border-transparent text-white/42 hover:text-white/75"}`}>Entrar</button>
          <button onClick={() => { setMode("register"); setError(""); }} className={`-mb-px border-b-2 px-0.5 pb-3 text-xs font-black transition ${mode === "register" ? "border-[#168cff] text-white" : "border-transparent text-white/42 hover:text-white/75"}`}>Criar conta</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && <label className="zx-auth-field"><span>Nome público</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como você quer ser chamado" autoComplete="name" /></label>}
          <label className="zx-auth-field"><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" required autoComplete="email" /></label>
          <div className="relative">
            <label className="zx-auth-field"><span>Senha</span><input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
            <button aria-label={showPass ? "Ocultar senha" : "Mostrar senha"} type="button" onClick={() => setShowPass(!showPass)} className="absolute bottom-2.5 right-3 text-white/35 transition hover:text-white">{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          </div>
          {mode === "register" && password && (
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full transition ${i < passStrength ? (passStrength <= 2 ? "bg-red-500" : passStrength === 3 ? "bg-yellow-500" : "bg-[#00c950]") : "bg-white/10"}`} />)}
            </div>
          )}
          {mode === "register" && <label className="zx-auth-field"><span>Confirmar senha</span><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita sua senha" autoComplete="new-password" /></label>}
          {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</div>}
          <button type="submit" disabled={loading} className="zx-auth-submit">
            <Lock className="w-4 h-4" />{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar minha conta"}<ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {mode === "login" && <button type="button" onClick={handleForgot} disabled={loading} className="mt-3 text-left text-[11px] font-bold text-[#83c9ff] transition hover:text-white disabled:opacity-50">Esqueceu sua senha?</button>}

        <div className="mt-5 border-t border-white/[0.08] pt-5">
          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-white/30">Ou continue com</p>
          <button onClick={handleDiscord} className="zx-auth-discord">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#5865F2" d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/></svg>
            Continuar com Discord
          </button>
        </div>
      </div>
    </div>
  );
}
