import React, { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { RocketEmoji, KeyEmoji } from "@/components/CustomEmojis";

export default function AuthScreen() {
  const { login, state } = useStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleDiscord = () => {
    const { discordClientId, discordRedirectUri, discordScopes } = state.config;
    if (!discordClientId) return setError("Discord não configurado pelo admin.");
    const url = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(discordClientId)}&response_type=code&redirect_uri=${encodeURIComponent(discordRedirectUri || window.location.origin + "/")}&scope=${encodeURIComponent(discordScopes || "identify")}`;
    window.location.href = url;
  };

  const handleGoogle = () => {
    const { googleClientId, googleRedirectUri, googleScopes } = state.config;
    if (!googleClientId) return setError("Google não configurado pelo admin.");
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId)}&response_type=code&redirect_uri=${encodeURIComponent(googleRedirectUri || window.location.origin + "/")}&scope=${encodeURIComponent(googleScopes || "openid email profile")}`;
    window.location.href = url;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError("Preencha todos os campos.");
    if (mode === "register" && password !== confirmPassword) return setError("As senhas não coincidem.");
    if (mode === "register" && password.length < 4) return setError("Senha muito curta.");
    login(email, name || email.split("@")[0]);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Blurred background */}
      <div className="absolute inset-0 bg-gradient-page">
        <div className="absolute inset-0 grid grid-cols-3 gap-4 p-8 opacity-20 blur-lg">
          {[
            "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=300",
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300",
            "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?w=300",
            "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=300",
            "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=300",
            "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=300",
          ].map((src, i) => (
            <img key={i} src={src} className="w-full h-48 object-cover rounded-3xl" alt="" />
          ))}
        </div>
        <div className="absolute inset-0 bg-foreground/60 dark:bg-foreground/80" />
      </div>

      <div className="glass-card w-full max-w-md p-8 relative z-10 bg-card animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tighter text-foreground">
            ZX<span className="text-primary">MAX</span>
          </h1>
          <div className="flex items-center justify-center gap-2 mt-2">
            <RocketEmoji className="w-5 h-5" />
            <p className="text-muted-foreground text-sm">O futuro do comércio digital</p>
          </div>
        </div>

        <div className="flex gap-1 mb-6 p-1 bg-muted rounded-2xl">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${mode === "login" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${mode === "register" ? "bg-card shadow-sm text-primary" : "text-muted-foreground"}`}
          >
            Criar Conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome Completo"
              className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground placeholder:text-muted-foreground text-sm"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            required
            className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground placeholder:text-muted-foreground text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            required
            className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground placeholder:text-muted-foreground text-sm"
          />
          {mode === "register" && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar Senha"
              className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground placeholder:text-muted-foreground text-sm"
            />
          )}
          {error && <p className="text-destructive text-sm font-medium">{error}</p>}
          <button type="submit" className="w-full btn-gradient p-4 text-sm flex items-center justify-center gap-2">
            <KeyEmoji className="w-5 h-5" />
            {mode === "login" ? "Acessar Plataforma" : "Criar Conta"}
          </button>
        </form>

        <div className="mt-5 space-y-2">
          <button className="w-full flex items-center justify-center gap-3 p-3 border border-border rounded-2xl hover:bg-muted transition text-sm font-semibold text-muted-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#5865F2" d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.086 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z"/></svg>
            Entrar com Discord
          </button>
          <button className="w-full flex items-center justify-center gap-3 p-3 border border-border rounded-2xl hover:bg-muted transition text-sm font-semibold text-muted-foreground">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Entrar com Google
          </button>
        </div>
      </div>
    </div>
  );
}
