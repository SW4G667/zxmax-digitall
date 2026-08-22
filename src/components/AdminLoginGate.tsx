import React, { useEffect, useState } from "react";
import { Fingerprint, Mail, Loader2, ShieldCheck, Smartphone, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { webAuthnAvailable, webAuthnAssert, webAuthnEnroll } from "@/lib/adminGate";

export default function AdminLoginGate() {
  const { sendAdminEmailLink, verifyAdminWebAuthn, enrollAdminWebAuthn, listAdminWebAuthn, refreshAdminGate } = useAuth();
  const [sending, setSending] = useState(false);
  const [busyBio, setBusyBio] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const canBio = webAuthnAvailable();

  useEffect(() => {
    void listAdminWebAuthn().then((ids) => setHasPasskey(ids.length > 0));
  }, [listAdminWebAuthn]);

  useEffect(() => {
    const t = window.setInterval(() => {
      void refreshAdminGate();
    }, 4000);
    return () => window.clearInterval(t);
  }, [refreshAdminGate]);

  const handleEmail = async () => {
    setSending(true);
    const { error } = await sendAdminEmailLink();
    setSending(false);
    if (error) {
      toast.error(error);
      return;
    }
    setSent(true);
    toast.success(`Link enviado para o e-mail do administrador`);
  };

  const handleBio = async () => {
    setBusyBio(true);
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
      toast.error(e?.message || "Não foi possível usar a senha do celular.");
    }
    setBusyBio(false);
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-7">
        <div className="w-14 h-14 rounded-2xl bg-[#0084ff]/10 border border-[#0084ff]/20 flex items-center justify-center mb-4">
          <ShieldCheck className="w-7 h-7 text-[#0084ff]" />
        </div>
        <h2 className="text-xl font-black text-white">Confirme que é você</h2>
        <p className="text-sm text-white/50 mt-2 leading-relaxed">
          Para entrar no painel admin, use a biometria / senha do celular ou o link que chega no e-mail cadastrado como administrador. Depois disso este aparelho fica liberado por 30 dias.
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
            disabled={sending}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#0084ff] text-white font-black text-sm disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {sent ? "Reenviar link por e-mail" : "Enviar link por e-mail"}
          </button>
        </div>

        {sent && (
          <div className="mt-5 rounded-xl bg-[#0084ff]/10 border border-[#0084ff]/20 p-4 text-xs text-white/70 leading-relaxed">
            <p className="font-bold text-white flex items-center gap-2 mb-1">
              <Smartphone className="w-3.5 h-3.5" /> Abra o e-mail e toque em Confirmar login
            </p>
            Esta tela atualiza sozinha quando o link for confirmado. O código antigo de 6 dígitos não é mais necessário.
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
