import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, BellRing, KeyRound, Loader2, LogOut, MonitorOff, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import LoadingScreen from "@/components/LoadingScreen";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DiscordWebhookSettings from "@/components/DiscordWebhookSettings";

const inputClass = "w-full rounded-xl border border-[#292c36] bg-[#0c0e14] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#1b96ff] focus:ring-2 focus:ring-[#168cff]/15";

export default function Configuracoes() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [endingOtherSessions, setEndingOtherSessions] = useState(false);

  const handlePasswordUpdate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (newPassword.length < 12) return toast.error("Use uma senha com pelo menos 12 caracteres.");
    if (newPassword !== confirmPassword) return toast.error("As duas senhas não coincidem.");
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      // Revoga sessões antigas sem encerrar o dispositivo que confirmou a troca.
      await signOut("others");
      toast.success("Senha atualizada. As outras sessões foram encerradas.");
    } catch {
      toast.error("Não foi possível atualizar a senha agora. Tente novamente.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleEndOtherSessions = async () => {
    if (!user || !window.confirm("Encerrar as outras sessões da sua conta? Este dispositivo continuará conectado.")) return;
    setEndingOtherSessions(true);
    try {
      await signOut("others");
      toast.success("Outras sessões encerradas.");
    } catch {
      toast.error("Não foi possível encerrar as outras sessões agora.");
    } finally {
      setEndingOtherSessions(false);
    }
  };

  if (loading) return <LoadingScreen message="Carregando configurações..." />;
  if (!user) {
    return <div className="min-h-screen bg-[#090a0f] grid place-items-center p-6 text-center"><div><h1 className="text-2xl font-black text-white">Entre para acessar as configurações</h1><Link className="mt-5 inline-flex rounded-xl bg-[#168cff] px-5 py-3 text-sm font-bold text-white" to="/?login=1">Entrar</Link></div></div>;
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl pb-10">
        <Link to="/loja" className="mb-6 inline-flex items-center gap-2 text-sm text-white/45 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar à loja</Link>
        <header className="rounded-3xl border border-white/[0.08] bg-[linear-gradient(125deg,#161b27,#0d111a_58%,#101b2d)] p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#75c5ff]">Minha conta</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.05em] text-white sm:text-3xl">Configurações e segurança</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/52">Atualize a senha, proteja as sessões e acesse seus dados e operações sem expor informações publicamente.</p>
          <nav className="mt-5 flex flex-wrap gap-2" aria-label="Seções das configurações"><a href="#seguranca" className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/72 transition hover:border-[#75c5ff]/40 hover:text-white">Segurança</a><a href="#atalhos" className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-white/72 transition hover:border-[#75c5ff]/40 hover:text-white">Conta</a><a href="#integracoes" className="inline-flex items-center gap-1.5 rounded-full border border-[#5865f2]/35 bg-[#5865f2]/10 px-3 py-1.5 text-xs font-bold text-[#c3c7ff] transition hover:bg-[#5865f2]/18"><BellRing className="h-3.5 w-3.5" />Integrações</a></nav>
        </header>

        <div id="seguranca" className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
          <section className="rounded-2xl border border-white/[0.08] bg-[#11131a] p-5 sm:p-6" aria-labelledby="password-title">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#168cff]/12 text-[#76c5ff]"><KeyRound className="h-5 w-5" /></span><div><h2 id="password-title" className="font-black text-white">Senha da conta</h2><p className="mt-1 text-xs leading-relaxed text-white/45">Escolha uma senha longa e exclusiva. A senha não é salva nem exibida nesta página.</p></div></div>
            <form onSubmit={handlePasswordUpdate} className="mt-6 space-y-4">
              <label className="block text-xs font-bold text-white/65">Nova senha<input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Mínimo de 12 caracteres" /></label>
              <label className="block text-xs font-bold text-white/65">Confirmar nova senha<input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova senha" /></label>
              <button type="submit" disabled={savingPassword} className="inline-flex items-center gap-2 rounded-xl bg-[#168cff] px-4 py-3 text-sm font-black text-white transition hover:bg-[#0e7fe5] disabled:opacity-55">{savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}Atualizar senha</button>
            </form>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#11131a] p-5 sm:p-6" aria-labelledby="sessions-title">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><ShieldCheck className="h-5 w-5" /></span><div><h2 id="sessions-title" className="font-black text-white">Sessões e proteção</h2><p className="mt-1 text-xs leading-relaxed text-white/45">Use esta opção se desconfiar que a conta foi acessada em outro aparelho.</p></div></div>
            <button type="button" onClick={() => void handleEndOtherSessions()} disabled={endingOtherSessions} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3 text-sm font-bold text-white transition hover:border-red-300/25 hover:bg-red-400/8 disabled:opacity-55">{endingOtherSessions ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorOff className="h-4 w-4" />}Encerrar outras sessões</button>
            <p className="mt-4 text-[11px] leading-relaxed text-white/36">Códigos enviados ao mesmo e-mail ajudam na recuperação, mas não substituem um segundo fator independente. O autenticador é a proteção adicional indicada para ações sensíveis.</p>
          </section>
        </div>

        <section id="atalhos" className="mt-5 rounded-2xl border border-white/[0.08] bg-[#11131a] p-5 sm:p-6" aria-labelledby="shortcuts-title">
          <h2 id="shortcuts-title" className="font-black text-white">Atalhos da conta</h2>
          <p className="mt-1 text-xs text-white/45">Cada área apresenta somente dados aos quais sua sessão já tem autorização.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link to="/perfil" className="group rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-[#168cff]/35 hover:bg-[#168cff]/7"><UserRound className="h-5 w-5 text-[#76c5ff]" /><h3 className="mt-3 text-sm font-black text-white">Perfil público</h3><p className="mt-1 text-xs leading-relaxed text-white/43">Nome, foto, ID público e status de vendedor.</p></Link>
            <Link to="/minhas-compras" className="group rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-[#168cff]/35 hover:bg-[#168cff]/7"><WalletCards className="h-5 w-5 text-[#76c5ff]" /><h3 className="mt-3 text-sm font-black text-white">Pedidos e transações</h3><p className="mt-1 text-xs leading-relaxed text-white/43">Compras, vendas, chat e estados reais de pedido.</p></Link>
            <Link to="/meus-produtos" className="group rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-[#168cff]/35 hover:bg-[#168cff]/7"><ShieldCheck className="h-5 w-5 text-[#76c5ff]" /><h3 className="mt-3 text-sm font-black text-white">Meus anúncios</h3><p className="mt-1 text-xs leading-relaxed text-white/43">Crie, edite, pause e acompanhe suas vendas.</p></Link>
            <Link to="/sacar" className="group rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-[#168cff]/35 hover:bg-[#168cff]/7"><LogOut className="h-5 w-5 text-[#76c5ff]" /><h3 className="mt-3 text-sm font-black text-white">Saldo e saques</h3><p className="mt-1 text-xs leading-relaxed text-white/43">Solicitações de saque seguem validação e processamento no servidor.</p></Link>
          </div>
        </section>
        <DiscordWebhookSettings />
        <button type="button" onClick={() => { void signOut(); navigate("/"); }} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-red-300 transition hover:text-red-200"><LogOut className="h-4 w-4" /> Sair desta conta</button>
      </main>
    </AppShell>
  );
}
