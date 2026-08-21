import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, ShieldCheck, Loader2, Lock, Smartphone, Eye, EyeOff, Shield, Zap, AlertTriangle } from "lucide-react";

export default function AuthScreen({ onClose }: { onClose?: () => void }) {
  const { signUp, signIn, verifyMfa, needsMfa } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [passStrength, setPassStrength] = useState(0);

  const [code, setCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (needsMfa) setTimeout(() => codeRefs.current[0]?.focus(), 100);
  }, [needsMfa]);

  useEffect(() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    setPassStrength(s);
  }, [password]);

  const handleDiscord = () => {
    let cfg: any = {};
    try {
      const saved = localStorage.getItem("zxmax_state");
      if (saved) cfg = JSON.parse(saved)?.config || {};
    } catch {}
    const clientId = cfg.discordClientId || "1485093454517371070";
    const redirectBase = cfg.discordRedirectUri || window.location.origin + "/";
    const scopesValue = cfg.discordScopes || "identify email";
    if (!clientId) {
      toast.error("Client ID do Discord não configurado.");
      return;
    }
    const redirectUri = encodeURIComponent(redirectBase);
    const scopes = encodeURIComponent(scopesValue);
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}`;
  };

  const handleForgot = async () => {
    if (!email) { setError("Digite seu e-mail para recuperar a senha."); return; }
    const { supabase } = await import("@/integrations/supabase/client");
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) { setError(err.message); return; }
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
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
          if (err.includes("Invalid login")) setError("Email ou senha incorretos.");
          else if (err.includes("Email not confirmed")) setError("Confirme seu e-mail antes.");
          else setError(err);
        }
      }
    } catch {
      setError("Erro inesperado. Tente novamente.");
    }
    setLoading(false);
  };

  const handleCodeChange = (idx: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    // If user pasted full code into single input
    if (digitsOnly.length > 1) {
      const arr = digitsOnly.slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      for (let i = 0; i < 6; i++) next[i] = arr[i] || "";
      setCode(next);
      if (arr.length === 6) {
        void handleVerifyMfa(arr.join(""));
      } else {
        codeRefs.current[Math.min(arr.length, 5)]?.focus();
      }
      return;
    }
    const v = digitsOnly.slice(-1);
    const next = [...code];
    next[idx] = v;
    setCode(next);
    if (v && idx < 5) codeRefs.current[idx + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === 6) void handleVerifyMfa(next.join(""));
  };

  const handleCodeKey = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) codeRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowLeft" && idx > 0) codeRefs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < 5) codeRefs.current[idx + 1]?.focus();
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length >= 2) {
      e.preventDefault();
      const next = pasted.split("");
      const full = ["", "", "", "", "", ""];
      for (let i = 0; i < 6; i++) full[i] = next[i] || "";
      setCode(full);
      if (pasted.length === 6) void handleVerifyMfa(pasted);
      else codeRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  const handleVerifyMfa = async (value?: string) => {
    const token = value || code.join("");
    if (token.length !== 6) { setError("Digite o código de 6 dígitos."); return; }
    setVerifying(true);
    setError("");
    const { error: err } = await verifyMfa(token);
    setVerifying(false);
    if (err) {
      setError(err);
      setCode(["", "", "", "", "", ""]);
      codeRefs.current[0]?.focus();
      return;
    }
    toast.success("Autenticação confirmada!");
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#050508]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0084ff]/10 via-transparent to-transparent" />
      </div>

      <div className="w-full max-w-md relative z-10 bg-[#0a0a0f] border border-white/10 rounded-2xl p-8 shadow-2xl animate-fade-in-up">
        {onClose && (
          <button onClick={onClose} className="absolute right-4 top-4 w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition text-white/60">
            <X className="w-4 h-4" />
          </button>
        )}

        {needsMfa ? (
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#0084ff]/10 border border-[#0084ff]/20 flex items-center justify-center mb-4">
              <Smartphone className="w-8 h-8 text-[#0084ff]" />
            </div>
            <h1 className="text-xl font-black text-white">Verificação admin</h1>
            <p className="text-xs text-white/50 mt-2 mb-1">Cole o código do seu Google Authenticator</p>
            <p className="text-[11px] text-[#0084ff] mb-6">Pode colar os 6 números de uma vez - não precisa digitar 1 por 1</p>

            <div className="flex justify-center gap-2 mb-5" onPaste={handleCodePaste}>
              {code.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => (codeRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleCodeChange(i, e.target.value)}
                  onKeyDown={(e) => handleCodeKey(i, e)}
                  onPaste={handleCodePaste}
                  className="w-12 h-14 text-center text-xl font-black rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#0084ff] focus:ring-2 focus:ring-[#0084ff]/20 outline-none text-white"
                  placeholder=""
                />
              ))}
            </div>

            {error && <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}

            <button onClick={() => handleVerifyMfa()} disabled={verifying || code.join("").length !== 6} className="w-full bg-[#0084ff] text-white py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0084ff]/20 hover:bg-[#0066cc] transition">
              {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              {verifying ? "Verificando..." : "Confirmar código"}
            </button>

            <p className="text-[11px] text-white/30 mt-4">Dica: copie no Authenticator e cole aqui (Ctrl+V) que preenche tudo automático.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="text-3xl font-black tracking-tighter text-white">ZX<span className="text-[#0084ff]">MAX</span></h1>
              <div className="flex items-center justify-center gap-2 mt-2 text-[11px] text-white/40">
                <Shield className="w-3 h-3 text-[#00c950]" /> Compra Protegida
              </div>
            </div>

            <div className="flex gap-1 mb-6 p-1 bg-white/[0.04] rounded-xl border border-white/5">
              <button onClick={() => { setMode("login"); setError(""); }} className={`flex-1 py-2.5 rounded-lg font-bold text-xs transition ${mode === "login" ? "bg-white text-black shadow" : "text-white/50 hover:text-white"}`}>Entrar</button>
              <button onClick={() => { setMode("register"); setError(""); }} className={`flex-1 py-2.5 rounded-lg font-bold text-xs transition ${mode === "register" ? "bg-white text-black shadow" : "text-white/50 hover:text-white"}`}>Criar Conta</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "register" && <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome Completo" className="w-full p-3.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#0084ff]/50 outline-none text-white placeholder:text-white/30 text-sm" />}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" required autoComplete="email" className="w-full p-3.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#0084ff]/50 outline-none text-white placeholder:text-white/30 text-sm" />
              <div className="relative">
                <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" required autoComplete={mode === "login" ? "current-password" : "new-password"} className="w-full p-3.5 pr-10 rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#0084ff]/50 outline-none text-white placeholder:text-white/30 text-sm" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">{showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
              {mode === "register" && password && (
                <div className="flex gap-1">
                  {[...Array(4)].map((_, i) => <div key={i} className={`h-1 flex-1 rounded-full transition ${i < passStrength ? (passStrength <= 2 ? "bg-red-500" : passStrength === 3 ? "bg-yellow-500" : "bg-[#00c950]") : "bg-white/10"}`} />)}
                </div>
              )}
              {mode === "register" && <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirmar Senha" className="w-full p-3.5 rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#0084ff]/50 outline-none text-white placeholder:text-white/30 text-sm" />}
              {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}
              <button type="submit" disabled={loading} className="w-full bg-[#0084ff] text-white py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0084ff]/20 hover:bg-[#0066cc] transition">
                <Lock className="w-4 h-4" />{loading ? "Aguarde..." : mode === "login" ? "Acessar" : "Criar Conta"}
              </button>
            </form>

            {mode === "login" && <button type="button" onClick={handleForgot} className="w-full text-center text-xs font-bold text-[#0084ff] mt-3 hover:underline">Esqueceu sua senha?</button>}

            <div className="mt-5">
              <button onClick={handleDiscord} className="w-full flex items-center justify-center gap-2 p-3 border border-white/10 rounded-xl hover:bg-white/[0.04] transition text-sm font-bold text-white/60 hover:text-white">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#5865F2" d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082 0.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/></svg>
                Entrar com Discord
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
