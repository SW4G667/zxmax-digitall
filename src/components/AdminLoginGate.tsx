import React, { useEffect, useState, useCallback, useRef } from "react";
import { Fingerprint, Mail, Loader2, ShieldCheck, Smartphone, RefreshCw, Clock, KeyRound, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { webAuthnAvailable, webAuthnAssert, webAuthnEnroll, saveTrustedDevice } from "@/lib/adminGate";

const RESEND_COOLDOWN = 30; // seconds before the email can be re-sent
const TRUST_DAYS = 30;

interface TotpEnrollCache {
  factorId: string;
  qr: string;
  secret: string;
  createdAt: number;
}

export default function AdminLoginGate() {
  const {
    sendAdminEmailLink,
    verifyAdminWebAuthn,
    enrollAdminWebAuthn,
    listAdminWebAuthn,
    refreshAdminGate,
    enrollTotpStart,
    enrollTotpVerify,
    listFactors,
    verifyMfa,
  } = useAuth();

  // email + biometric
  const [sending, setSending] = useState(false);
  const [busyBio, setBusyBio] = useState(false);
  const [sent, setSent] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [lastError, setLastError] = useState("");
  const timerRef = useRef<number | null>(null);
  const canBio = webAuthnAvailable();

  // authenticator (TOTP) — works without any Edge Function
  const [totpStage, setTotpStage] = useState<"idle" | "enroll" | "code">("idle");
  const [totpQr, setTotpQr] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpFactorId, setTotpFactorId] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpCopied, setTotpCopied] = useState(false);
  const [hasTotp, setHasTotp] = useState(false);

  useEffect(() => {
    void listAdminWebAuthn().then((ids) => setHasPasskey(ids.length > 0));
  }, [listAdminWebAuthn]);

  // Check whether the admin already has a verified authenticator factor.
  useEffect(() => {
    void listFactors().then((f: any[]) => {
      setHasTotp((f || []).some((x) => x.status === "verified"));
    });
  }, [listFactors]);

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

  // Restore a pending authenticator enrollment (survives a refresh).
  useEffect(() => {
    try {
      const raw = localStorage.getItem("zxmax_mfa_enroll");
      if (raw) {
        const c = JSON.parse(raw) as TotpEnrollCache;
        if (Date.now() - c.createdAt < 10 * 60 * 1000 && c.qr && c.secret && c.factorId) {
          setTotpQr(c.qr);
          setTotpSecret(c.secret);
          setTotpFactorId(c.factorId);
          setTotpStage("enroll");
        } else {
          localStorage.removeItem("zxmax_mfa_enroll");
        }
      }
    } catch {}
  }, []);

  const unlockLocal = useCallback(() => {
    const token = (crypto as any).randomUUID ? crypto.randomUUID() : String(Math.random().toString(36).slice(2) + Date.now());
    const expiresAt = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000).toISOString();
    saveTrustedDevice(token, expiresAt);
    void refreshAdminGate();
  }, [refreshAdminGate]);

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
        unlockLocal();
        toast.success("Dispositivo confirmado por 30 dias.");
      } else {
        const credId = await webAuthnEnroll("zxmax-admin", "ZXMAX Admin");
        const { error } = await enrollAdminWebAuthn(credId);
        if (error) throw new Error(error);
        setHasPasskey(true);
        unlockLocal();
        toast.success("Senha do celular cadastrada. Liberado por 30 dias.");
      }
    } catch (e: any) {
      setLastError(e?.message || "Não foi possível usar a senha do celular.");
      toast.error(e?.message || "Não foi possível usar a senha do celular.");
    }
    setBusyBio(false);
  }, [hasPasskey, listAdminWebAuthn, verifyAdminWebAuthn, enrollAdminWebAuthn, unlockLocal]);

  const startTotp = useCallback(async () => {
    setLastError("");
    setTotpBusy(true);
    try {
      const factors = (await listFactors()) as any[];
      if (factors.some((f) => f.status === "verified")) {
        setHasTotp(true);
        setTotpStage("code");
        setTotpCode("");
        setTotpBusy(false);
        return;
      }
      const { data, error } = await enrollTotpStart();
      if (error || !data) throw new Error(error || "Não foi possível iniciar o autenticador.");
      const cache: TotpEnrollCache = { factorId: data.id, qr: data.qr, secret: data.secret, createdAt: Date.now() };
      try { localStorage.setItem("zxmax_mfa_enroll", JSON.stringify(cache)); } catch {}
      setTotpQr(data.qr);
      setTotpSecret(data.secret);
      setTotpFactorId(data.id);
      setTotpStage("enroll");
    } catch (e: any) {
      setLastError(e?.message || "Falha ao iniciar o autenticador.");
      toast.error(e?.message || "Falha ao iniciar o autenticador.");
    }
    setTotpBusy(false);
  }, [listFactors, enrollTotpStart]);

  const confirmTotp = useCallback(async () => {
    const code = totpCode.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      toast.error("Digite o código de 6 dígitos.");
      return;
    }
    setTotpBusy(true);
    setLastError("");
    try {
      if (totpStage === "enroll" && totpFactorId) {
        const { error } = await enrollTotpVerify(totpFactorId, code);
        if (error) throw new Error(error);
        try { localStorage.removeItem("zxmax_mfa_enroll"); } catch {}
      } else {
        const { error } = await verifyMfa(code);
        if (error) throw new Error(error);
      }
      unlockLocal();
      setTotpStage("idle");
      setTotpCode("");
      setHasTotp(true);
      toast.success("Confirmado pelo autenticador. Aparelho liberado por 30 dias.");
    } catch (e: any) {
      setLastError(e?.message || "Código inválido. Tente novamente.");
      toast.error(e?.message || "Código inválido. Tente novamente.");
    }
    setTotpBusy(false);
  }, [totpStage, totpFactorId, totpCode, enrollTotpVerify, verifyMfa, unlockLocal]);

  const cancelTotp = useCallback(() => {
    try { localStorage.removeItem("zxmax_mfa_enroll"); } catch {}
    setTotpStage("idle");
    setTotpCode("");
  }, []);

  const copySecret = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(totpSecret);
      setTotpCopied(true);
      toast.success("Chave copiada!");
      setTimeout(() => setTotpCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }, [totpSecret]);

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-7">
        <div className="w-14 h-14 rounded-2xl bg-[#0084ff]/10 border border-[#0084ff]/20 flex items-center justify-center mb-4">
          <ShieldCheck className="w-7 h-7 text-[#0084ff]" />
        </div>
        <h2 className="text-xl font-black text-white">Confirme que é você</h2>
        <p className="text-sm text-white/50 mt-2 leading-relaxed">
          Para entrar no painel admin, confirme com o <strong className="text-white">Google Authenticator</strong> do seu
          celular, com a <strong className="text-white">senha / biometria do celular</strong> ou pelo{" "}
          <strong className="text-white">e-mail do administrador</strong>. Depois disso este aparelho fica liberado por{" "}
          <strong className="text-[#0084ff]">30 dias</strong>.
        </p>

        {/* PRIMARY: Authenticator (works without Edge Function) */}
        <div className="mt-6 space-y-3">
          {totpStage === "idle" && (
            <button
              onClick={startTotp}
              disabled={totpBusy}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white text-black font-black text-sm disabled:opacity-50"
            >
              {totpBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              {hasTotp ? "Confirmar com Google Authenticator" : "Cadastrar Google Authenticator"}
            </button>
          )}

          {totpStage === "enroll" && (
            <div className="space-y-4 border border-[#0084ff]/20 bg-[#0084ff]/5 rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wide text-[#0084ff] flex items-center gap-2">
                1 · Escaneie no Google Authenticator
              </p>
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-2xl">
                  <img src={totpQr} alt="QR Code 2FA" className="w-44 h-44" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-black/40 border border-white/10 rounded-xl p-2.5 font-mono break-all text-white">{totpSecret}</code>
                <button onClick={copySecret} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white">
                  {totpCopied ? <Check className="w-4 h-4 text-[#00c950]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs font-black uppercase tracking-wide text-[#00c950] flex items-center gap-2 mt-1">
                2 · Digite o código de 6 dígitos
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#00c950]/50 placeholder:text-white/20"
              />
              <div className="flex gap-2">
                <button onClick={cancelTotp} disabled={totpBusy} className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={confirmTotp} disabled={totpBusy || totpCode.length !== 6} className="flex-1 bg-[#00c950] text-black py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50">
                  {totpBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Ativar
                </button>
              </div>
            </div>
          )}

          {totpStage === "code" && (
            <div className="space-y-3 border border-[#00c950]/20 bg-[#00c950]/5 rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wide text-[#00c950]">Código do Google Authenticator</p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full px-4 py-3.5 rounded-xl bg-black/40 border border-white/10 text-white text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#00c950]/50 placeholder:text-white/20"
              />
              <div className="flex gap-2">
                <button onClick={cancelTotp} disabled={totpBusy} className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:opacity-50">
                  Voltar
                </button>
                <button onClick={confirmTotp} disabled={totpBusy || totpCode.length !== 6} className="flex-1 bg-[#00c950] text-black py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50">
                  {totpBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Confirmar
                </button>
              </div>
            </div>
          )}

          {canBio && (
            <button
              onClick={handleBio}
              disabled={busyBio}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/10 border border-white/10 text-white font-black text-sm disabled:opacity-50"
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
          </div>
        )}

        {sent && (
          <div className="mt-5 rounded-xl bg-[#0084ff]/10 border border-[#0084ff]/20 p-4 text-xs text-white/70 leading-relaxed">
            <p className="font-bold text-white flex items-center gap-2 mb-1">
              <Smartphone className="w-3.5 h-3.5" /> Abra o e-mail e toque em Confirmar login
            </p>
            O link chega <strong className="text-white">somente no e-mail do administrador</strong>. Esta tela atualiza sozinha quando for confirmado. Após confirmado, este aparelho fica liberado por 30 dias.
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
