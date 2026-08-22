import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Copy, Check, Loader2, Trash2, RefreshCw, Smartphone, KeyRound, Lock, AlertCircle } from "lucide-react";
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
    try {
      const f = await listFactors();
      setFactors(f || []);
    } catch {
      setFactors([]);
    }
  };

  useEffect(() => {
    void loadFactors();
    // Restore pending enrollment from localStorage (persists across refresh)
    try {
      const raw = localStorage.getItem(ENROLL_STORAGE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as EnrollCache;
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
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async () => {
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) {
      toast.error("Digite o código de 6 dígitos gerado pelo aplicativo.");
      return;
    }
    setBusy(true);
    const { error } = await enrollTotpVerify(factorId, cleanCode);
    setBusy(false);
    if (error) {
      toast.error("Código incorreto. Verifique o relógio do seu aparelho e tente novamente.");
      return;
    }
    toast.success("Google Authenticator ativado com sucesso! 🔒");
    clearEnrollCache();
    setStage("idle");
    setCode("");
    setQr("");
    setSecret("");
    setFactorId("");
    void loadFactors();
  };

  const remove = async () => {
    if (!confirm("Deseja realmente desativar o Google Authenticator? Você precisará reconfigurar se quiser reativar.")) return;
    setBusy(true);
    const { error } = await unenrollTotp();
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    clearEnrollCache();
    toast.success("Autenticador removido com sucesso.");
    setStage("idle");
    void loadFactors();
  };

  const regenerate = async () => {
    if (!confirm("Gerar novo QR Code? O código atual no seu app deixará de funcionar e você deverá escanear o novo.")) return;
    setBusy(true);
    clearEnrollCache();
    await unenrollTotp().catch(() => {});
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
      toast.success("Chave secreta copiada!");
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
            Google Authenticator (2FA)
            <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-black ${mfaEnabled ? "bg-[#00c950] text-black" : "bg-[#0084ff] text-white"}`}>
              {mfaEnabled ? "Ativo" : "Recomendado"}
            </span>
          </h4>
          <p className="text-xs text-white/50 mt-1 leading-relaxed">
            {mfaEnabled
              ? "Autenticação em 2 etapas configurada. O acesso ao painel admin requer o código gerado no seu aplicativo autenticador."
              : "Proteja seu painel administrativo exigindo o código de 6 dígitos gerado pelo Google Authenticator."}
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
                  <p className="text-sm font-bold text-white">Google Authenticator Ativo</p>
                  <p className="text-[11px] text-[#00c950]/80">Proteção 2FA ativada na sua conta de administrador.</p>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#00c950] animate-pulse" />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={regenerate}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-xs font-bold transition disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4" /> Gerar Novo QR Code / Trocar Celular
                </button>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="px-4 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-bold transition disabled:opacity-50 flex items-center gap-1.5"
                  title="Desativar 2FA"
                >
                  <Trash2 className="w-4 h-4" /> Desativar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                  <Smartphone className="w-5 h-5 mx-auto text-[#0084ff] mb-1" />
                  <p className="font-bold text-white">1. Baixe o App</p>
                  <p className="text-white/40">Authenticator</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                  <KeyRound className="w-5 h-5 mx-auto text-[#0084ff] mb-1" />
                  <p className="font-bold text-white">2. Escaneie</p>
                  <p className="text-white/40">QR Code</p>
                </div>
                <div className="bg-white/[0.03] border border-white/10 rounded-xl p-3 text-center">
                  <ShieldCheck className="w-5 h-5 mx-auto text-[#00c950] mb-1" />
                  <p className="font-bold text-white">3. Ative</p>
                  <p className="text-white/40">Com o código</p>
                </div>
              </div>
              <button
                onClick={startEnroll}
                disabled={busy}
                className="w-full bg-[#0084ff] hover:bg-[#0066cc] text-white py-3.5 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0084ff]/20 transition"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                Configurar Google Authenticator
              </button>
            </div>
          )}
        </div>
      )}

      {stage === "verify" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="rounded-xl border border-[#0084ff]/20 bg-[#0084ff]/5 p-5">
            <p className="text-xs font-black uppercase tracking-wide text-[#0084ff] mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0084ff] text-white flex items-center justify-center text-[11px]">1</span>
              Escaneie o QR Code no seu aplicativo
            </p>
            <div className="flex justify-center">
              <div className="bg-white p-3.5 rounded-2xl shadow-xl">
                <img src={qr} alt="QR Code 2FA" className="w-44 h-44" />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-bold text-white mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-[11px]">2</span>
                Chave manual
              </span>
              <span className="text-[10px] text-white/40">Copie e cole no app</span>
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-black/50 border border-white/10 rounded-xl p-3 font-mono break-all text-[#0084ff] font-bold">{secret}</code>
              <button onClick={copySecret} className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/60 hover:text-white transition">
                {copied ? <Check className="w-4 h-4 text-[#00c950]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#00c950]/20 bg-[#00c950]/5 p-5">
            <label className="text-xs font-black uppercase tracking-wide text-[#00c950] mb-3 block flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#00c950] text-white flex items-center justify-center text-[11px]">3</span>
              Digite o código de 6 dígitos gerado
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(val);
              }}
              placeholder="000 000"
              className="w-full px-4 py-3.5 rounded-xl bg-black/50 border border-white/10 text-white text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-[#00c950]/50 focus:border-[#00c950] transition placeholder:text-white/20"
            />
          </div>

          <div className="flex gap-2">
            <button onClick={cancelEnroll} disabled={busy} className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={confirmEnroll} disabled={busy || code.replace(/\D/g, "").length !== 6} className="flex-1 bg-[#00c950] hover:bg-[#00a843] text-black py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#00c950]/20 transition">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Ativar e Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
