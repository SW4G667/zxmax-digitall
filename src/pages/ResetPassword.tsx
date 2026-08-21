import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyEmoji } from "@/components/CustomEmojis";

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (password !== confirm) return toast.error("As senhas não coincidem.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    setDone(true);
    toast.success("Senha alterada com sucesso!");
  };

  return (
    <div className="bg-gradient-page min-h-screen flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-md p-8 bg-card">
        <h1 className="text-3xl font-black tracking-tighter text-foreground text-center">
          ZX<span className="text-primary">MAX</span>
        </h1>
        <p className="text-center text-muted-foreground text-sm mt-2 mb-6">Definir nova senha</p>

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-foreground">Sua senha foi alterada. Já pode acessar sua conta normalmente.</p>
            <a href="/" className="btn-gradient inline-block w-full p-4 text-sm rounded-2xl font-bold">Voltar para o site</a>
          </div>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground text-center">
            Abra esta página pelo link enviado no seu e-mail de recuperação de senha.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha"
              className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm"
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirmar nova senha"
              className="w-full p-4 rounded-2xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm"
            />
            <button type="submit" disabled={loading} className="w-full btn-gradient p-4 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              <KeyEmoji className="w-5 h-5" />
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
