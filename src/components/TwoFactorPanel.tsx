import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, ShieldOff, Copy, Check, Loader2, Trash2, RefreshCw, Smartphone, KeyRound, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ENROLL_STORAGE_KEY = "zxmax_mfa_enroll";

interface EnrollCache {
  factorId: string;
  qr: string;
  secret: string;
  createdAt: number;
}

type Stage = "idle" | "verify" | "confirm-current";

export default function TwoFactorPanel() {
  const { mfaEnabled, enrollTotpStart, enrollTotpVerify, unenrollTotp, listFactors, verifyMfa, needsCodeToManageMfa, unlockAdminGate } = useAuth();
  const [stage, setStage] = useState<Stage>("idle");
  const [qr, setQr] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState<any[]>([]);
  const [pendingAction, setPendingAction] = useState<"remove" | "regenerate" | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

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
    } catch { /* noop */ }
  }, [mfaEnabled]);

  useEffect(() => {
    if (stage === "confirm-current") {
      setTimeout(() => codeRef.current?.focus(), 100);
    }
  }, [stage]);

  const saveEnrollCache = (data: EnrollCache) => {
    try {
      localStorage.setItem(ENROLL_STORAGE_KEY, JSON.stringify(data));
    } catch { /* noop */ }
  };

  const clearEnrollCache = () => {
    try {
      localStorage.removeItem(ENROLL_STORAGE_KEY);
    } catch { /* noop */ }
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
      saveEnrollCache({ factorId: data.id, qr: data.qr, secret: data.secret, createdAt: Date.now() });
      setQr(data.qr);
      setSecret(data.secret);
      setFactorId(data.id);
      setCode("");
      setStage("verify");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao configurar 2FA");
    }
    setBusy(false);
  };

  const confirmEnroll = async (value?: string) => {
    const typed = (value ?? code).replace(/\s/g, "");
    if (typed.length !== 6) {
      toast.error("Digite o código de 6 dígitos.");
      return;
    }
    setBusy(true);
    const { error } = await enrollTotpVerify(factorId, typed);
    setBusy(false);
    if (error) {
      toast.error(error || "Código inválido. Tente novamente.");
      setCode("");
      return;
    }
    toast.success("2FA ativado com sucesso! QR Code removido por segurança. 🔒");
    clearEnrollCache();
    setStage("idle");
    setCode("");
    setQr("");
    setSecret("");
    setFactorId("");
    unlockAdminGate();
    void loadFactors();
  };

  const doRemove = async () => {
    const f = factors.find((x) => x.status === "verified") || factors[0];
    if (!f) return;
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
    setCode("");
    setPendingAction(null);
    void loadFactors();
  };

  const doRegenerate = async () => {
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
    setCode("");
    setPendingAction(null);
    await startEnroll();
  };

  // "Desativar" / "Gerar novo QR Code": Supabase exige sessão AAL2 para mexer
  // num fator já verificado. Se a sessão ainda for AAL1, pedimos o código atual
  // do app (o verify eleva a sessão para AAL2) e aí sim seguimos sozinhos.
  const requestManage = async (action: "remove" | "regenerate") => {
    if (action === "remove") {
      if (!confirm("Desativar o 2FA? Sua conta admin ficará vulnerável a hackers.")) return;
    } else {
      if (!confirm("Gerar novo código? O antigo deixará de funcionar. Você precisará escanear novamente no app.")) return;
    }
    if (await needsCodeToManageMfa()) {
      setPendingAction(action);
      setCode("");
      setStage("confirm-current");
      return;
    }
    if (action === "remove") await doRemove();
    else await doRegenerate();
  };

  const confirmCurrentCode = async (value?: string) => {
    const typed = (value ?? code).replace(/\D/g, "").slice(0, 6);
    if (typed.length !== 6 || !pendingAction) return;
    setBusy(true);
    const { error } = await verifyMfa(typed);
    if (error) {
      setBusy(false);
      setCode("");
      toast.error(error);
      setTimeout(() => codeRef.current?.focus(), 50);
      return;
    }
    setBusy(false);
    unlockAdminGate();
    toast.success("Código confirmado!");
    if (pendingAction === "remove") await doRemove();
    else await doRegenerate();
  };

  // Último recurso para quem perdeu o aplicativo: remove o fator via servidor
  // (service role) já que sem o código não dá para elevar a sessão a AAL2.
  const resetViaServer = async () => {
    if (!confirm("Remover o autenticador SEM digitar o código? Use só se perdeu o acesso ao aplicativo.")) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-login", { body: { action: "reset_mfa" } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Falha no servidor");
      clearEnrollCache();
      toast.success("Autenticador removido pelo servidor.");
      const action = pendingAction;
      setPendingAction(null);
      setCode("");
      setStage("idle");
      await loadFactors();
      if (action === "regenerate") await startEnroll();
    } catch (e: any) {
      toast.error("Não foi possível remover pelo servidor (a função admin-login precisa estar deployada). " + (e?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  const cancelEnroll = () => {
    clearEnrollCache();
    setStage("idle");
    setCode("");
    setQr("");
    setSecret("");
    setFactorId("");
    setPendingAction(null);
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

  const handleCodeInput = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6 && !busy) {
      // Segue sozinho quando os 6 dígitos são preenchidos
      if (stage === "confirm-current") void confirmCurrentCode(digits);
      else if (stage === "verify") void confirmEnroll(digits);
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
              ? "Protegido. Só pede código quando sai da conta e volta. QR Code já sumiu por segurança."
              : "Proteja o painel admin contra hackers. Use Google Authenticator. QR fica salvo mesmo se atualizar a página, só some depois que ativar."}
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
                <button onClick={() => void requestManage("regenerate")} disabled={busy} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 text-sm font-bold transition disabled:opacity-50">
                  <RefreshCw className="w-4 h-4" /> Gerar Novo QR Code
                </button>
                <button onClick={() => void requestManage("remove")} disabled={busy} title="Desativar 2FA" className="px-4 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-sm font-bold transition disabled:opacity-50">
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

      {stage === "confirm-current" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="rounded-xl border border-[#0084ff]/30 bg-[#0084ff]/5 p-4 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[#0084ff] shrink-0 mt-0.5" />
            <p className="text-xs text-white/70 leading-relaxed">
              Para {pendingAction === "remove" ? "desativar o 2FA" : "gerar um novo QR Code"}, confirme a identidade digitando o <strong className="text-white">código que o aplicativo mostra agora</strong>.
            </p>
          </div>
          <input
            ref={codeRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => handleCodeInput(e.target.value)}
            placeholder="000000"
            disabled={busy}
            className="w-full px-4 py-4 rounded-xl bg-black/50 border border-white/10 text-white text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#0084ff]/50 focus:border-[#0084ff] transition placeholder:text-white/20"
          />
          <div className="flex gap-2">
            <button onClick={cancelEnroll} disabled={busy} className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={() => void confirmCurrentCode()} disabled={busy || code.length !== 6} className="flex-1 bg-[#0084ff] hover:bg-[#0066cc] text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0084ff]/20 transition">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Confirmar
            </button>
          </div>
          <button onClick={resetViaServer} disabled={busy} className="w-full text-center text-[11px] text-white/30 hover:text-white/60 transition py-1">
            Perdi o acesso ao aplicativo
          </button>
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
              onChange={(e) => handleCodeInput(e.target.value)}
              placeholder="000000"
              disabled={busy}
              className="w-full px-4 py-4 rounded-xl bg-black/50 border border-white/10 text-white text-center text-2xl font-black tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-[#00c950]/50 focus:border-[#00c950] transition placeholder:text-white/20"
            />
            <p className="text-[11px] text-white/40 mt-2 text-center">Ao confirmar, o QR some. Só pedirá código quando sair e voltar.</p>
          </div>

          <div className="flex gap-2">
            <button onClick={cancelEnroll} disabled={busy} className="flex-1 py-3 rounded-xl text-sm font-bold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={() => void confirmEnroll()} disabled={busy || code.length !== 6} className="flex-1 bg-[#0084ff] hover:bg-[#0066cc] text-white py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0084ff]/20 transition">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Ativar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
