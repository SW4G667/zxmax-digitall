import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Copy, Check, Loader2, Trash2, RefreshCw, Smartphone, KeyRound, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const ENROLL_STORAGE_KEY = "zxmax_mfa_enroll";

interface EnrollCache {
  factorId: string;
  qr: string;
  secret: string;
  createdAt: number;
}

export default function TwoFactorPanel() {
  const { mfaEnabled, enrollTotpStart, enrollTotpVerify, unenrollTotp, listFactors, isAdmin } = useAuth();

  if (!isAdmin) return null;
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
    // Restore pending enrollment from localStorage (persists across refresh)
    try {
      const raw = localStorage.getItem(ENROLL_STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as EnrollCache;
        // Expire after 10 minutes
        if (Date.now() - cached.createdAt < 10 * 60 * 1000 && cached.qr && cached.secret && cached.factorId) {
          setQr(cached.qr);
          setSecret(cached.secret);
          setFactorId(cached.factorId);
          setStage("verify");
        } else {
          localStorage.removeItem(ENROLL_STORAGE_KEY);
        }
      }
    } catch {}
  }, [mfaEnabled]);

  const saveEnrollCache = (data: EnrollCache) => {
    try {
      localStorage.setItem(ENROLL_STORAGE_KEY, JSON.stringify(data));
    } catch {}
  };

  const clearEnrollCache = () => {
    try {
      localStorage.removeItem(ENROLL_STORAGE_KEY);
    } catch {}
  };

  const startEnroll = async () => {
    setBusy(true);
    try {
      const { data, error } = await enrollTotpStart();
      if (error || !data) {
        if (error.includes("already exists")) {
          toast.error("Já existe um código pendente. Limpando e gerando novo...");
          const factors = await listFactors();
          for (const f of factors) {
            if (f.status !== "verified") {
              await unenrollTotp(f.id).catch(() => {});
            }
          }
          const retry = await enrollTotpStart();
          if (retry.error || !retry.data) {
            toast.error(retry.error || "Não foi possível gerar novo código. Remova o 2FA existente primeiro.");
            setBusy(false);
            return;
          }
          const cache: EnrollCache = { factorId: retry.data.id, qr: retry.data.qr, secret: retry.data.secret, createdAt: Date.now() };
          saveEnrollCache(cache);
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
      const cache: EnrollCache = { factorId: data.id, qr: data.qr, secret: data.secret, createdAt: Date.now() };
      saveEnrollCache(cache);
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
    toast.success("2FA ativado com sucesso! QR Code removido por segurança. 🔒");
    clearEnrollCache();
    setStage("idle");
    setCode("");
    setQr("");
    setSecret("");
    setFactorId("");
    void loadFactors();
  };

  const remove = async () => {
    const f = factors[0];
    if (!f) return;
    if (!confirm("Desativar o 2FA? Sua conta admin ficará vulnerável a hackers.")) return;
    setBusy(true);
    const { error } = await unenrollTotp(f.id);
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    clearEnrollCache();
    toast.success("2FA desativado.");
    setStage("idle");
    void loadFactors();
  };

  const regenerate = async () => {
    if (!confirm("Gerar novo código? O antigo deixará de funcionar. Você precisará escanear novamente no app.")) return;
    const f = factors.find((x) => x.status === "verified") || factors[0];
    if (f) {
      setBusy(true);
      const { error } = await unenrollTotp(f.id);
      setBusy(false);
      if (error) {
        toast.error("Erro ao remover código antigo: " + error);
        return;
      }
    }
    clearEnrollCache();
    await startEnroll();
  };

  const cancelEnroll = () => {
    clearEnrollCache();
    setStage("idle");
    setCode("");
    setQr("");
    setSecret("");
    setFactorId("");
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
    <div className="rounded-2xl p-6 border border-white/10 bg-[#111114]">
      <div className="flex items-start gap-4 mb-5">
        <div className={`p-3 rounded-xl shrink-0 ${mfaEnabled ? "bg-[#00c950]/15 text-[#00c950] border border-[#00c950]/20" : "bg-[#0084ff]/15 text-[#0084ff] border border-[#0084ff]/20"}`}>
          {mfaEnabled ? <ShieldCheck className="w-6 h-6" /> : <ShieldOff className="w-6 h-6" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-black text-white flex items-center gap-2 text-[15px]">
            Autenticação Admin (2FA)
            <span className="text-[9px] bg-[#0084ff] text-white px-2 py-0.5 rounded-full uppercase font-black">Só Admin</span>
          </h4>
          <p className="text-xs text-white/50 mt-1 leading-relaxed">
            {mfaEnabled
              ? "Authenticator extra ativo. O login admin principal confirma por e-mail do administrador ou biometria do celular, válido por 30 dias neste aparelho."
              : "Opcional. O login admin já confirma por biometria do celular ou link no e-mail do administrador (válido 30 dias). Este autenticador é um extra opcional."}
          </p>
        </div>
      </div>

      {stage === "idle" && (
        <div className="space-y-3">
          {mfaEnabled ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-[#00c950]/10 border border-[#00c950]/20 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#00c950]/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-[#00c950]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">2FA Ativo</p>
                  <p className="text-[11px] text-[#00c950]/70">Só pede código ao fazer login novamente</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#00c950] animate-pulse" />
              </div>
              <div className="flex gap-2">
                <button onClick={regenerate} disabled={busy} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-sm font-bold transition disabled:opacity-50">
                  <RefreshCw className="w-4 h-4" /> Gerar novo para outro app
                </button>
                <button onClick={remove} disabled={busy} className="px-4 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm font-bold transition disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                  <Smartphone className="w-5 h-5 mx-auto text-[#0084ff] mb-1" />
                  <p className="font-bold text-white">1. Instale</p>
                  <p className="text-white/40">Authenticator</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                  <KeyRound className="w-5 h-5 mx-auto text-[#0084ff] mb-1" />
                  <p className="font-bold text-white">2. Escaneie</p>
                  <p className="text-white/40">QR fixo</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                  <ShieldCheck className="w-5 h-5 mx-auto text-[#00c950] mb-1" />
                  <p className="font-bold text-white">3. Protegido</p>
                  <p className="text-white/40">Só no login</p>
                </div>
              </div>
              <button onClick={startEnroll} disabled={busy} className="w-full bg-[#0084ff] hover:bg-[#0066cc] text-white py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0084ff]/20 transition">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                Configurar Autenticador
              </button>
            </div>
          )}
        </div>
      )}

      {stage === "verify" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="rounded-xl border border-[#0084ff]/20 bg-[#0084ff]/5 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-[#0084ff] mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0084ff] text-white flex items-center justify-center text-[11px]">1</span> QR Code (fica salvo se atualizar)
            </p>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-2xl shadow-xl">
                <img src={qr} alt="QR Code 2FA" className="w-48 h-48" />
              </div>
            </div>
            <p className="text-[11px] text-white/50 mt-3 text-center">Não some ao atualizar. Só expira em 10 min ou quando você ativar. Depois some por segurança.</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-bold text-white mb-2 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[11px]">2</span> Chave manual
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-black/50 border border-white/10 rounded-xl p-3 font-mono break-all text-white">{secret}</code>
              <button onClick={copySecret} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition">
                {copied ? <Check className="w-4 h-4 text-[#00c950]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#00c950]/20 bg-[#00c950]/5 p-5">
            <label className="text-xs font-black uppercase tracking-wide text-[#00c950] mb-3 block flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00c950] text-white flex items-center justify-center text-[11px]">3</span> Código do app (6 dígitos)
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-4 rounded-xl bg-black/50 border border-white/10 text-white text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#00c950]/50 focus:border-[#00c950] transition placeholder:text-white/20"
            />
            <p className="text-[11px] text-white/40 mt-2 text-center">Ao confirmar, o QR some. Só pedirá código quando sair e voltar.</p>
          </div>

          <div className="flex gap-2">
            <button onClick={cancelEnroll} disabled={busy} className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={confirmEnroll} disabled={busy || code.length !== 6} className="flex-1 bg-[#0084ff] hover:bg-[#0066cc] text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0084ff]/20 transition">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Ativar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
