import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Copy, Check, Loader2, Trash2, RefreshCw, Smartphone, KeyRound, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function TwoFactorPanel() {
  const { mfaEnabled, enrollTotpStart, enrollTotpVerify, unenrollTotp, listFactors, isAdmin } = useAuth();
  const [stage, setStage] = useState<"idle" | "verify">("idle");
  const [qr, setQr] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState<any[]>([]);

  const loadFactors = async () => {
    const f = await listFactors();
    setFactors(f);
  };

  useEffect(() => {
    void loadFactors();
  }, [mfaEnabled]);

  const startEnroll = async () => {
    setBusy(true);
    try {
      const { data, error } = await enrollTotpStart();
      if (error || !data) {
        // If already exists, try to clean and inform user
        if (error.includes("already exists")) {
          toast.error("Já existe um código pendente. Limpando e gerando novo...");
          // Force clean all unverified
          const factors = await listFactors();
          for (const f of factors) {
            if (f.status !== "verified") {
              await unenrollTotp(f.id).catch(() => {});
            }
          }
          const retry = await enrollTotpStart();
          if (retry.error || !retry.data) {
            toast.error(retry.error || "Não foi possível gerar novo código. Tente remover o 2FA existente primeiro.");
            setBusy(false);
            return;
          }
          setQr(retry.data.qr);
          setSecret(retry.data.secret);
          setFactorId(retry.data.id);
          setStage("verify");
          setBusy(false);
          return;
        }
        toast.error(error || "Não foi possível iniciar a configuração.");
        setBusy(false);
        return;
      }
      setQr(data.qr);
      setSecret(data.secret);
      setFactorId(data.id);
      setStage("verify");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao configurar 2FA");
    }
    setBusy(false);
  };

  const confirmEnroll = async () => {
    if (code.replace(/\s/g, "").length !== 6) {
      toast.error("Digite o código de 6 dígitos.");
      return;
    }
    setBusy(true);
    const { error } = await enrollTotpVerify(factorId, code.replace(/\s/g, ""));
    setBusy(false);
    if (error) {
      toast.error("Código inválido. Tente novamente.");
      return;
    }
    toast.success("Dois fatores ativado com sucesso! 🔒");
    setStage("idle");
    setCode("");
    setQr("");
    setSecret("");
    void loadFactors();
  };

  const remove = async () => {
    const f = factors[0];
    if (!f) return;
    if (!confirm("Desativar o dois fatores? Sua conta ficará menos protegida.")) return;
    setBusy(true);
    const { error } = await unenrollTotp(f.id);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Dois fatores desativado.");
    setStage("idle");
    void loadFactors();
  };

  const regenerate = async () => {
    if (!confirm("Gerar novo código? Você precisará configurar novamente no seu app autenticador. O código antigo deixará de funcionar.")) return;
    const f = factors[0];
    if (f) {
      setBusy(true);
      const { error } = await unenrollTotp(f.id);
      setBusy(false);
      if (error) {
        toast.error("Erro ao remover código antigo: " + error);
        return;
      }
    }
    await startEnroll();
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("Chave copiada!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="glass-card p-6 border border-white/10 bg-[#0a0a0f]">
      <div className="flex items-start gap-4 mb-5">
        <div className={`p-3 rounded-xl shrink-0 ${mfaEnabled ? "bg-success/15 text-success border border-success/20" : "bg-primary/15 text-primary border border-primary/20"}`}>
          {mfaEnabled ? <ShieldCheck className="w-6 h-6" /> : <ShieldOff className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-white flex items-center gap-2">
            Autenticação de dois fatores (2FA)
            {isAdmin && <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full uppercase font-black">Admin Recomendado</span>}
          </h4>
          <p className="text-xs text-white/50 mt-1 leading-relaxed">
            {mfaEnabled
              ? "Sua conta está protegida com app autenticador (TOTP). Ao fazer login, será solicitado o código de 6 dígitos."
              : "Adicione camada extra de segurança. Use Google Authenticator, Authy ou similar. Essencial para admin."}
          </p>
        </div>
      </div>

      {stage === "idle" && (
        <div className="space-y-3">
          {mfaEnabled ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-success/10 border border-success/20 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-success" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">2FA Ativo e Protegido</p>
                  <p className="text-[11px] text-success/70">Seu login agora exige código do autenticador</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={regenerate}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-sm font-bold transition disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" /> Gerar novo código
                </button>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="px-4 py-3 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-sm font-bold transition disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-white/30 text-center">
                O QR Code e a chave secreta só aparecem durante a configuração e depois somem por segurança. Só o código de 6 dígitos será solicitado no login.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-2 text-[11px]">
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                  <Smartphone className="w-5 h-5 mx-auto text-primary mb-1" />
                  <p className="font-bold text-white">1. Instale</p>
                  <p className="text-white/40">Google Authenticator</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                  <KeyRound className="w-5 h-5 mx-auto text-primary mb-1" />
                  <p className="font-bold text-white">2. Escaneie</p>
                  <p className="text-white/40">QR Code</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                  <ShieldCheck className="w-5 h-5 mx-auto text-success mb-1" />
                  <p className="font-bold text-white">3. Protegido</p>
                  <p className="text-white/40">Login seguro</p>
                </div>
              </div>
              <button
                onClick={startEnroll}
                disabled={busy}
                className="w-full btn-gradient py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                Configurar Autenticador
              </button>
            </div>
          )}
        </div>
      )}

      {stage === "verify" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px]">1</span> Escaneie no seu app autenticador
            </p>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-2xl shadow-xl">
                <img src={qr} alt="QR Code 2FA" className="w-48 h-48" />
              </div>
            </div>
            <p className="text-[11px] text-white/50 mt-3 text-center">Use Google Authenticator, Authy, Microsoft Authenticator. O QR sumirá após ativação.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-bold text-white mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[11px]">2</span> Ou copie a chave manualmente
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-black/50 border border-white/10 rounded-xl p-3 font-mono break-all text-white">{secret}</code>
              <button onClick={copySecret} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition">
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-success/20 bg-success/5 p-5">
            <label className="text-xs font-black uppercase tracking-wide text-success mb-3 block flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-success text-white flex items-center justify-center text-[11px]">3</span> Digite o código de 6 dígitos
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-4 rounded-xl bg-black/50 border border-white/10 text-white text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-success/50 focus:border-success transition placeholder:text-white/20"
            />
            <p className="text-[11px] text-white/40 mt-2 text-center">Código muda a cada 30 segundos no seu app</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setStage("idle"); setCode(""); setQr(""); setSecret(""); }}
              disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmEnroll}
              disabled={busy || code.length !== 6}
              className="flex-1 btn-gradient py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Ativar Proteção
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
