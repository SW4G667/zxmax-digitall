import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, Loader2, Lock, Eye, EyeOff, Shield, AlertTriangle } from "lucide-react";
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
      toast.error("Erro ao iniciar login com Discord: " + (e?.message || "tente novamente."));
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#05070d] p-4 sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_7%_10%,rgba(0,132,255,0.34),transparent_25%),radial-gradient(circle_at_91%_84%,rgba(0,77,175,0.26),transparent_28%),linear-gradient(145deg,#07101c_0%,#05070d_46%,#070910_100%)]" />
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[#0084ff]/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 bottom-8 h-80 w-80 rounded-full bg-[#005bb5]/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-[1.7rem] border border-white/10 bg-[#0c0e16]/95 p-6 shadow-[0_34px_110px_rgba(0,0,0,0.62)] backdrop-blur-xl animate-fade-in-up sm:p-8">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#3da0ff]/75 to-transparent" />
        {onClose && (
          <button aria-label="Fechar autenticação" onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition hover:bg-white/10 hover:text-white active:scale-95">
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#168cff]/25 bg-[#168cff]/10 text-[#51a9ff] shadow-[0_0_38px_rgba(0,132,255,0.18)]">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-black tracking-[-0.07em] text-white">ZX<span className="text-[#168cff]">MAX</span></h1>
          <p className="mt-2 text-sm font-medium text-white/50">Acesse sua conta e acompanhe seus pedidos.</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300/80">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" /> Compra Protegida
          </div>
        </div>

        <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.035] p-1">
          <button onClick={() => { setMode("login"); setError(""); }} className={`flex-1 rounded-lg py-2.5 text-xs font-black transition duration-150 active:scale-[0.98] ${mode === "login" ? "bg-white text-[#0b0d13] shadow-[0_5px_20px_rgba(255,255,255,0.12)]" : "text-white/45 hover:text-white"}`}>Entrar</button>
          <button onClick={() => { setMode("register"); setError(""); }} className={`flex-1 rounded-lg py-2.5 text-xs font-black transition duration-150 active:scale-[0.98] ${mode === "register" ? "bg-white text-[#0b0d13] shadow-[0_5px_20px_rgba(255,255,255,0.12)]" : "text-white/45 hover:text-white"}`}>Criar Conta</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#168cff]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#168cff]/10" />}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required autoComplete="email" className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#168cff]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#168cff]/10" />
          <div className="relative">
            <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required autoComplete={mode === "login" ? "current-password" : "new-password"} className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-3.5 pr-11 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#168cff]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#168cff]/10" />
            <button aria-label={showPass ? "Ocultar senha" : "Mostrar senha"} type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 transition hover:text-white">{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
          </div>
          {mode === "register" && password && (
            <div className="flex gap-1">
              {[...Array(4)].map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full transition ${i < passStrength ? (passStrength <= 2 ? "bg-red-500" : passStrength === 3 ? "bg-yellow-500" : "bg-[#00c950]") : "bg-white/10"}`} />)}
            </div>
          )}
          {mode === "register" && <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar senha" className="w-full rounded-xl border border-white/10 bg-white/[0.05] p-3.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-[#168cff]/70 focus:bg-white/[0.07] focus:ring-4 focus:ring-[#168cff]/10" />}
          {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300"><AlertTriangle className="h-4 w-4 shrink-0" /> {error}</div>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#168cff] py-3.5 text-sm font-black text-white shadow-[0_12px_30px_rgba(0,132,255,0.28)] transition duration-150 hover:bg-[#0877eb] active:scale-[0.98] disabled:opacity-50">
            <Lock className="w-4 h-4" />{loading ? "Aguarde..." : mode === "login" ? "Acessar" : "Criar Conta"}
          </button>
        </form>

        {mode === "login" && <button type="button" onClick={handleForgot} disabled={loading} className="mt-3 w-full text-center text-[11px] font-bold text-white/35 transition hover:text-[#72b7ff] disabled:opacity-50">Esqueceu sua senha?</button>}

        <div className="mt-5 border-t border-white/[0.07] pt-5">
          <button onClick={handleDiscord} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 p-3 text-sm font-bold text-white/65 transition hover:bg-white/[0.055] hover:text-white active:scale-[0.98]">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#5865F2" d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/></svg>
            Entrar com Discord
          </button>
        </div>
      </div>
    </div>
  );
}
