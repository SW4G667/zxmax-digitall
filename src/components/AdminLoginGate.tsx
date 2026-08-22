import React, { useEffect, useState, useCallback, useRef } from "react";
import { ShieldCheck, Loader2, KeyRound, Copy, Check, RefreshCw, Clipboard, ArrowRight, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const ENROLL_STORAGE_KEY = "zxmax_mfa_enroll";

interface TotpEnrollCache {
  factorId: string;
  qr: string;
  secret: string;
  createdAt: number;
}

export default function AdminLoginGate() {
  const {
    verifyMfa,
    enrollTotpStart,
    enrollTotpVerify,
    listFactors,
    resetMfa,
    unlockAdminGate,
    refreshAdminGate,
  } = useAuth();

  const [hasTotp, setHasTotp] = useState(false);
  const [totpStage, setTotpStage] = useState<"code" | "enroll">("code");
  const [totpQr, setTotpQr] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpFactorId, setTotpFactorId] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpCopied, setTotpCopied] = useState(false);
  const [checkingFactors, setCheckingFactors] = useState(true);
  const [lastError, setLastError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Check whether the admin already has a verified authenticator factor.
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const factors = (await listFactors()) as any[];
        const verified = (factors || []).some((x) => x.status === "verified");
        if (mounted) {
          setHasTotp(verified);
          if (!verified) {
            // If no factor is configured, check if we have an in-progress enrollment cache
            try {
              const raw = localStorage.getItem(ENROLL_STORAGE_KEY);
              if (raw) {
                const c = JSON.parse(raw) as TotpEnrollCache;
                if (Date.now() - c.createdAt < 10 * 60 * 1000 && c.qr && c.secret && c.factorId) {
                  setTotpQr(c.qr);
                  setTotpSecret(c.secret);
                  setTotpFactorId(c.factorId);
                  setTotpStage("enroll");
                }
              }
            } catch {}
          } else {
            setTotpStage("code");
          }
        }
      } catch {
        if (mounted) setHasTotp(false);
      } finally {
        if (mounted) setCheckingFactors(false);
      }
    };

    void check();
    return () => {
      mounted = false;
    };
  }, [listFactors]);

  // Autofocus input
  useEffect(() => {
    if (!checkingFactors) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [checkingFactors, totpStage]);

  // Wipes the old (lost) authenticator server-side and starts a fresh
  // enrollment. Without this the admin was stuck on the same error forever.
  const handleRecover = useCallback(async () => {
    setTotpBusy(true);
    setLastError("");
    try {
      const { error } = await resetMfa();
      if (error) throw new Error(error);
      const { data, error: enrollError } = await enrollTotpStart();
      if (enrollError || !data) throw new Error(enrollError || "Não foi possível gerar novo autenticador.");
      try {
        localStorage.setItem(
          ENROLL_STORAGE_KEY,
          JSON.stringify({ factorId: data.id, qr: data.qr, secret: data.secret, createdAt: Date.now() } as TotpEnrollCache),
        );
      } catch {
        /* storage may be unavailable */
      }
      setTotpQr(data.qr);
      setTotpSecret(data.secret);
      setTotpFactorId(data.id);
      setTotpStage("enroll");
      setTotpCode("");
      setHasTotp(false);
      toast.success("Autenticador antigo apagado. Escaneie o novo QR Code.");
    } catch (e: any) {
      setLastError(e?.message || "Falha ao resetar autenticador.");
      toast.error(e?.message || "Falha ao resetar autenticador.");
    } finally {
      setTotpBusy(false);
    }
  }, [resetMfa, enrollTotpStart]);

  const handleStartEnroll = useCallback(async () => {
    setTotpBusy(true);
    setLastError("");
    try {
      const { data, error } = await enrollTotpStart();
      if (error || !data) throw new Error(error || "Não foi possível gerar novo autenticador.");
      
      const cache: TotpEnrollCache = { factorId: data.id, qr: data.qr, secret: data.secret, createdAt: Date.now() };
      try {
        localStorage.setItem(ENROLL_STORAGE_KEY, JSON.stringify(cache));
      } catch {}

      setTotpQr(data.qr);
      setTotpSecret(data.secret);
      setTotpFactorId(data.id);
      setTotpStage("enroll");
      setTotpCode("");
    } catch (e: any) {
      setLastError(e?.message || "Falha ao iniciar autenticador.");
      toast.error(e?.message || "Falha ao iniciar autenticador.");
    } finally {
      setTotpBusy(false);
    }
  }, [enrollTotpStart]);

  const confirmCode = useCallback(async (codeToVerify?: string) => {
    const code = (codeToVerify || totpCode).replace(/\D/g, "").slice(0, 6);
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
        try {
          localStorage.removeItem(ENROLL_STORAGE_KEY);
        } catch {}
      } else {
        const { error } = await verifyMfa(code);
        if (error) throw new Error(error);
      }

      unlockAdminGate();
      setTotpCode("");
      toast.success("Código confirmado com sucesso! Painel admin liberado.");
      void refreshAdminGate();
    } catch (e: any) {
      const msg = e?.message || "Código incorreto. Verifique o horário do celular e tente novamente.";
      setLastError(msg);
      toast.error(msg);
    } finally {
      setTotpBusy(false);
    }
  }, [totpCode, totpStage, totpFactorId, enrollTotpVerify, verifyMfa, unlockAdminGate, refreshAdminGate]);

  const handleInputChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    setTotpCode(digits);
    if (digits.length === 6 && !totpBusy) {
      void confirmCode(digits);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, "").slice(0, 6);
      if (digits.length > 0) {
        setTotpCode(digits);
        if (digits.length === 6) {
          void confirmCode(digits);
        }
      }
    } catch {
      toast.error("Não foi possível colar da área de transferência.");
    }
  };

  const copySecret = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(totpSecret);
      setTotpCopied(true);
      toast.success("Chave copiada para a área de transferência!");
      setTimeout(() => setTotpCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }, [totpSecret]);

  if (checkingFactors) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <div className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-8 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#0084ff] animate-spin mb-4" />
          <p className="text-sm font-bold text-white">Carregando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-10 px-4">
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0f] p-6 sm:p-8 shadow-2xl shadow-black/80">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#0084ff]/10 border border-[#0084ff]/20 flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6 text-[#0084ff]" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">Google Authenticator</h2>
            <p className="text-xs text-[#0084ff] font-bold">Autenticação em 2 Etapas (2FA)</p>
          </div>
        </div>

        {totpStage === "code" ? (
          <div className="space-y-5">
            <p className="text-sm text-white/70 leading-relaxed">
              Abra o aplicativo <strong className="text-white">Google Authenticator</strong> no seu celular e digite o código de 6 dígitos gerado.
            </p>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="000 000"
                disabled={totpBusy}
                className="w-full px-4 py-4 rounded-xl bg-black/60 border border-white/15 text-white text-center text-3xl font-black tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-[#0084ff] focus:border-[#0084ff] transition placeholder:text-white/20"
              />
              <button
                type="button"
                onClick={handlePaste}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/10 text-white/70 hover:text-white hover:bg-white/15 transition text-xs font-bold flex items-center gap-1"
                title="Colar código copiado"
              >
                <Clipboard className="w-4 h-4" />
                <span className="hidden sm:inline text-[10px]">Colar</span>
              </button>
            </div>

            <button
              onClick={() => confirmCode()}
              disabled={totpBusy || totpCode.length !== 6}
              className="w-full py-4 rounded-xl bg-[#0084ff] hover:bg-[#0066cc] text-white font-black text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-[#0084ff]/25"
            >
              {totpBusy ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verificando código...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" /> Entrar no Painel Admin
                </>
              )}
            </button>

            <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
              <button
                onClick={handleStartEnroll}
                disabled={totpBusy}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs text-white/50 hover:text-white transition"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reconfigurar / Gerar novo QR Code
              </button>
              <button
                onClick={handleRecover}
                disabled={totpBusy}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#0084ff]/25 text-[11px] font-bold text-[#0084ff] hover:bg-[#0084ff]/10 transition disabled:opacity-50"
              >
                <KeyRound className="w-3.5 h-3.5" /> Perdi o celular / o app não gera mais o código
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#0084ff]/30 bg-[#0084ff]/5 p-4 text-center">
              <p className="text-xs font-black uppercase tracking-wide text-[#0084ff] mb-3">
                1. Escaneie no Google Authenticator
              </p>
              {totpQr ? (
                <div className="inline-block bg-white p-3 rounded-2xl shadow-xl">
                  <img src={totpQr} alt="QR Code Google Authenticator" className="w-44 h-44 mx-auto" />
                </div>
              ) : (
                <div className="w-44 h-44 mx-auto flex items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-[#0084ff]" />
                </div>
              )}
              <p className="text-[11px] text-white/50 mt-2">
                Abra o Google Authenticator, toque em "+" e escaneie o código acima.
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <p className="text-xs font-bold text-white mb-2 flex items-center justify-between">
                <span>Chave manual (se não puder escanear)</span>
                <span className="text-[10px] text-white/40 font-normal">Toque para copiar</span>
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-black/60 border border-white/10 rounded-xl p-2.5 font-mono break-all text-[#0084ff] font-bold">
                  {totpSecret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  className="p-2.5 rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15 transition shrink-0"
                  title="Copiar chave secreta"
                >
                  {totpCopied ? <Check className="w-4 h-4 text-[#00c950]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#00c950]/30 bg-[#00c950]/5 p-4">
              <label className="text-xs font-black uppercase tracking-wide text-[#00c950] mb-2 block">
                2. Digite o código de 6 dígitos gerado
              </label>
              <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={totpCode}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="000 000"
                disabled={totpBusy}
                className="w-full px-4 py-3.5 rounded-xl bg-black/60 border border-white/15 text-white text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-[#00c950] focus:border-[#00c950] transition placeholder:text-white/20"
              />
            </div>

            <div className="flex gap-2 pt-1">
              {hasTotp && (
                <button
                  onClick={() => {
                    setTotpStage("code");
                    setTotpCode("");
                  }}
                  disabled={totpBusy}
                  className="flex-1 py-3.5 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition disabled:opacity-50"
                >
                  Voltar
                </button>
              )}
              <button
                onClick={() => confirmCode()}
                disabled={totpBusy || totpCode.length !== 6}
                className="flex-1 py-3.5 rounded-xl bg-[#00c950] hover:bg-[#00a843] text-black font-black text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-[#00c950]/20"
              >
                {totpBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Ativando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" /> Ativar e Entrar
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {lastError && (
          <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-300 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span className="leading-relaxed">{lastError}</span>
          </div>
        )}

        <div className="mt-5 text-center">
          <p className="text-[11px] text-white/40 leading-relaxed">
            Uma vez autenticado, você não precisará digitar o código novamente durante esta sessão do navegador.
          </p>
        </div>
      </div>
    </div>
  );
}
