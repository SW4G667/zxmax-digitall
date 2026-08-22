import React, { useEffect, useState, useCallback, useRef } from "react";
import { Fingerprint, Mail, Loader2, ShieldCheck, Smartphone, RefreshCw, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { webAuthnAvailable, webAuthnAssert, webAuthnEnroll } from "@/lib/adminGate";

const RESEND_COOLDOWN = 30; // seconds before the email can be re-sent

export default function AdminLoginGate() {
  const { sendAdminEmailLink, verifyAdminWebAuthn, enrollAdminWebAuthn, listAdminWebAuthn, refreshAdminGate } = useAuth();
  const [sending, setSending] = useState(false);
  const [busyBio, setBusyBio] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastError, setLastError] = useState("");
  const timerRef = useRef<number | null>(null);
  const canBio = webAuthnAvailable();

  useEffect(() => {
    void listAdminWebAuthn().then((ids) => setHasPasskey(ids.length > 0));
  }, [listAdminWebAuthn]);

  // Poll the backend so the gate closes itself as soon as the email is confirmed.
  useEffect(() => {
    const t = window.setInterval(() => {
      void refreshAdminGate();
    }, 3500);
    return () => window.clearInterval(t);
  }, [refreshAdminGate]);

  // Countdown for the "resend email" button.
  useEffect(() => {
    if (cooldown <= 0) return;
    timerRef.current = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [cooldown]);

  const handleEmail = useCallback(async () => {
    setLastError("");
    if (cooldown > 0) {
      toast.info(`Aguarde ${cooldown}s para reenviar.`);
      return;
    }
    setSending(true);
    const { error } = await sendAdminEmailLink();
    setSending(false);
    if (error) {
      setLastError(error);
      toast.error(error);
      return;
    }
    setSent(true);
    setCooldown(RESEND_COOLDOWN);
    toast.success(`Link enviado para o e-mail do administrador.`);
  }, [sendAdminEmailLink, cooldown]);

  const handleBio = useCallback(async () => {
    setBusyBio(true);
    setLastError("");
    try {
      if (hasPasskey) {
        const ids = await listAdminWebAuthn();
        const credId = await webAuthnAssert(ids);
        const { error } = await verifyAdminWebAuthn(credId);
        if (error) throw new Error(error);
        toast.success("Dispositivo confirmado por 30 dias.");
      } else {
        const credId = await webAuthnEnroll("zxmax-admin", "ZXMAX Admin");
        const { error } = await enrollAdminWebAuthn(credId);
        if (error) throw new Error(error);
        setHasPasskey(true);
        toast.success("Senha do celular cadastrada. Liberado por 30 dias.");
      }
    } catch (e: any) {
      setLastError(e?.message || "Não foi possível usar a senha do celular.");
      toast.error(e?.message || "Não foi possível usar a senha do celular.");
    }
    setBusyBio(false);
  }, [hasPasskey, listAdminWebAuthn, verifyAdminWebAuthn, enrollAdminWebAuthn]);

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-7">
        <div className="w-14 h-14 rounded-2xl bg-[#0084ff]/10 border border-[#0084ff]/20 flex items-center justify-center mb-4">
          <ShieldCheck className="w-7 h-7 text-[#0084ff]" />
        </div>
        <h2 className="text-xl font-black text-white">Confirme que é você</h2>
        <p className="text-sm text-white/50 mt-2 leading-relaxed">
          Para entrar no painel admin, use a <strong className="text-white">senha / biometria do celular</strong> ou confirme pelo{" "}
          <strong className="text-white">e-mail do administrador</strong>. Depois disso este aparelho fica liberado por{" "}
          <strong className="text-[#0084ff]">30 dias</strong> — ao expirar, pedimos a confirmação de novo.
        </p>

        <div className="mt-6 space-y-3">
          {canBio && (
            <button
              onClick={handleBio}
              disabled={busyBio}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-black font-black text-sm disabled:opacity-50"
            >
              {busyBio ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />}
              {hasPasskey ? "Confirmar com senha do celular" : "Cadastrar senha do celular"}
            </button>
          )}

          <button
            onClick={handleEmail}
            disabled={sending || cooldown > 0}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#0084ff] text-white font-black text-sm disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : cooldown > 0 ? <Clock className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            {cooldown > 0 ? `Reenviar em ${cooldown}s` : sent ? "Reenviar link por e-mail" : "Enviar link por e-mail"}
          </button>
        </div>

        {lastError && (
          <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-[11px] text-red-300 leading-relaxed">
            {lastError}
            <p className="mt-1 text-white/40">Se persistir, confirme com a senha do celular ou verifique se o servidor de e-mail (RESEND_API_KEY) está configurado no painel de integrações.</p>
          </div>
        )}

        {sent && (
          <div className="mt-5 rounded-xl bg-[#0084ff]/10 border border-[#0084ff]/20 p-4 text-xs text-white/70 leading-relaxed">
            <p className="font-bold text-white flex items-center gap-2 mb-1">
              <Smartphone className="w-3.5 h-3.5" /> Abra o e-mail e toque em Confirmar login
            </p>
            O link chega <strong className="text-white">somente no e-mail do administrador</strong>. Esta tela atualiza sozinha quando for confirmado. Depois de confirmado, este aparelho fica liberado por 30 dias.
          </div>
        )}

        <button
          onClick={() => void refreshAdminGate()}
          className="mt-4 w-full flex items-center justify-center gap-2 text-[11px] text-white/40 hover:text-white"
        >
          <RefreshCw className="w-3 h-3" /> Já confirmei — atualizar
        </button>
      </div>
    </div>
  );
}
