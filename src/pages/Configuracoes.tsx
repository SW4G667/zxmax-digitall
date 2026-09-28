import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, KeyRound, Loader2, LogOut, MonitorOff, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import LoadingScreen from "@/components/LoadingScreen";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DiscordWebhookSettings from "@/components/DiscordWebhookSettings";

const inputClass = "w-full rounded-lg border border-white/[0.09] bg-[#0d0d11] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#168cff]/60 focus:ring-2 focus:ring-[#168cff]/10";

type NotificationPrefs = {
  enabled: boolean;
  sales: boolean;
  questions: boolean;
  orders: boolean;
  notices: boolean;
  support: boolean;
};

const defaultNotificationPrefs: NotificationPrefs = {
  enabled: true,
  sales: true,
  questions: true,
  orders: true,
  notices: true,
  support: true,
};

export default function Configuracoes() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [endingOtherSessions, setEndingOtherSessions] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(defaultNotificationPrefs);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationSaving, setNotificationSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setNotificationsLoading(false);
      return;
    }
    let active = true;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("notification_preferences")
        .select("enabled,sales,questions,orders,notices,support")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (!error && data) setNotificationPrefs({ ...defaultNotificationPrefs, ...data });
      setNotificationsLoading(false);
    })();
    return () => { active = false; };
  }, [user?.id]);

  const setNotificationPreference = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!user) return;
    const next = { ...notificationPrefs, [key]: value };
    setNotificationPrefs(next);
    setNotificationSaving(key);
    const { error } = await (supabase as any).from("notification_preferences").upsert({
      user_id: user.id,
      ...next,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setNotificationSaving(null);
    if (error) {
      setNotificationPrefs(notificationPrefs);
      toast.error("Não foi possível salvar essa preferência.");
    }
  };

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
    return (
      <div className="grid min-h-screen place-items-center bg-[#090a0d] p-6 text-center">
        <div>
          <h1 className="text-2xl font-black text-white">Entre para acessar as configurações</h1>
          <Link className="mt-5 inline-flex rounded-lg bg-[#168cff] px-5 py-3 text-sm font-bold text-white" to="/?login=1">Entrar</Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl pb-8">
        <Link to="/loja" className="inline-flex items-center gap-2 text-xs font-semibold text-white/40 transition hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar à loja
        </Link>

        <header className="mt-5 border-b border-white/[0.07] pb-6">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#67b5ff]">Minha conta</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-white sm:text-3xl">Configurações</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/42">
            Segurança, sessões e integrações da sua conta em uma página direta, sem painéis decorativos desnecessários.
          </p>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-xl border border-white/[0.08] bg-[#101013] p-4 sm:p-5" aria-labelledby="password-title">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#168cff]/15 bg-[#168cff]/[0.07] text-[#70bbff]">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <h2 id="password-title" className="text-sm font-bold text-white">Senha da conta</h2>
                <p className="mt-1 text-[11px] leading-5 text-white/38">Use uma senha exclusiva. Ela não é salva nem exibida nesta página.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordUpdate} className="mt-5 grid gap-3">
              <label className="block text-[11px] font-semibold text-white/55">
                Nova senha
                <input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Mínimo de 12 caracteres" />
              </label>
              <label className="block text-[11px] font-semibold text-white/55">
                Confirmar nova senha
                <input className={`${inputClass} mt-1.5`} type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repita a nova senha" />
              </label>
              <button type="submit" disabled={savingPassword} className="mt-1 inline-flex w-fit items-center gap-2 rounded-lg bg-[#168cff] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#0f7fdf] disabled:opacity-55">
                {savingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Atualizar senha
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-[#101013] p-4 sm:p-5" aria-labelledby="sessions-title">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-emerald-300/10 bg-emerald-400/[0.06] text-emerald-300">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <h2 id="sessions-title" className="text-sm font-bold text-white">Sessões e proteção</h2>
                <p className="mt-1 text-[11px] leading-5 text-white/38">Encerre acessos antigos sem desconectar este aparelho.</p>
              </div>
            </div>
            <button type="button" onClick={() => void handleEndOtherSessions()} disabled={endingOtherSessions} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.09] bg-white/[0.025] px-4 py-2.5 text-xs font-bold text-white/72 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-55">
              {endingOtherSessions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MonitorOff className="h-3.5 w-3.5" />} Encerrar outras sessões
            </button>
            <p className="mt-4 text-[10px] leading-4 text-white/30">
              Códigos enviados ao mesmo e-mail ajudam na recuperação, mas não substituem um segundo fator independente.
            </p>
          </section>
        </div>

        <section className="mt-5 rounded-xl border border-white/[0.08] bg-[#101013] p-4 sm:p-5" aria-labelledby="notifications-title">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#168cff]/15 bg-[#168cff]/[0.07] text-[#70bbff]">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h2 id="notifications-title" className="text-sm font-bold text-white">Notificações do site</h2>
              <p className="mt-1 text-[11px] leading-5 text-white/38">Escolha quais avisos ficam salvos na sua central. Vendedores podem receber novas vendas e perguntas mesmo depois de trocar de página.</p>
            </div>
          </div>

          {notificationsLoading ? (
            <p className="mt-5 text-xs text-white/35">Carregando preferências…</p>
          ) : (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {([
                ["enabled", "Central de notificações", "Liga ou pausa todos os novos avisos."],
                ["sales", "Vendas e saldo", "Nova venda, conclusão e liberação de saldo."],
                ["questions", "Perguntas", "Perguntas no anúncio e respostas."],
                ["orders", "Pedidos e disputas", "Pagamento, entrega, reembolso e disputa."],
                ["notices", "Avisos da plataforma", "Comunicados publicados pela administração."],
                ["support", "Suporte", "Atualizações relacionadas ao atendimento."],
              ] as Array<[keyof NotificationPrefs, string, string]>).map(([key, label, description]) => (
                <label key={key} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/[0.07] bg-white/[0.018] p-3.5">
                  <span>
                    <span className="block text-xs font-bold text-white">{label}</span>
                    <span className="mt-1 block text-[10px] leading-4 text-white/34">{description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={notificationPrefs[key]}
                    disabled={Boolean(notificationSaving) || (key !== "enabled" && !notificationPrefs.enabled)}
                    onChange={(event) => void setNotificationPreference(key, event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#168cff]"
                  />
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-xl border border-white/[0.08] bg-[#101013] p-4 sm:p-5" aria-labelledby="shortcuts-title">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="shortcuts-title" className="text-sm font-bold text-white">Conta e operações</h2>
              <p className="mt-1 text-[11px] text-white/36">Atalhos para as áreas mais usadas.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link to="/perfil" className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-white/[0.14] hover:bg-white/[0.04]">
              <UserRound className="h-4 w-4 text-[#70bbff]" />
              <h3 className="mt-2.5 text-xs font-bold text-white">Perfil público</h3>
              <p className="mt-1 text-[10px] leading-4 text-white/34">Nome, foto e sinais de vendedor.</p>
            </Link>
            <Link to="/minhas-compras" className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-white/[0.14] hover:bg-white/[0.04]">
              <WalletCards className="h-4 w-4 text-[#70bbff]" />
              <h3 className="mt-2.5 text-xs font-bold text-white">Pedidos</h3>
              <p className="mt-1 text-[10px] leading-4 text-white/34">Compras, vendas, chat e status.</p>
            </Link>
            <Link to="/sacar" className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3.5 transition hover:border-white/[0.14] hover:bg-white/[0.04]">
              <LogOut className="h-4 w-4 text-[#70bbff]" />
              <h3 className="mt-2.5 text-xs font-bold text-white">Carteira e saque</h3>
              <p className="mt-1 text-[10px] leading-4 text-white/34">Saldo disponível e solicitações de saque.</p>
            </Link>
          </div>
        </section>

        <section className="mt-5">
          <DiscordWebhookSettings />
        </section>

        <button type="button" onClick={() => { void signOut(); navigate("/"); }} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-red-300/70 transition hover:text-red-200">
          <LogOut className="h-3.5 w-3.5" /> Sair desta conta
        </button>
      </main>
    </AppShell>
  );
}
