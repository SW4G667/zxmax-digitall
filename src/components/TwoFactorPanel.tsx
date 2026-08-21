import React, { useEffect, useState } from "react";
import { ShieldCheck, ShieldOff, Copy, Check, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function TwoFactorPanel() {
  const { mfaEnabled, enrollTotpStart, enrollTotpVerify, unenrollTotp, listFactors } = useAuth();
  const [stage, setStage] = useState<"idle" | "enrolling" | "verify" | "removing">("idle");
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
    const { data, error } = await enrollTotpStart();
    setBusy(false);
    if (error || !data) {
      toast.error(error || "Não foi possível iniciar a configuração.");
      return;
    }
    setQr(data.qr);
    setSecret(data.secret);
    setFactorId(data.id);
    setStage("verify");
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
    toast.success("Dois fatores ativado com sucesso!");
    setStage("idle");
    setCode("");
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

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${mfaEnabled ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
            {mfaEnabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="font-bold text-foreground">Autenticação de dois fatores (2FA)</h4>
            <p className="text-xs text-muted-foreground">
              {mfaEnabled
                ? "Protegida com aplicativo autenticador (TOTP)."
                : "Adicione uma camada extra de segurança na sua conta."}
            </p>
          </div>
        </div>
      </div>

      {stage === "idle" && (
        <div>
          {mfaEnabled ? (
            <button
              onClick={remove}
              disabled={busy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 text-sm font-bold transition disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Desativar 2FA
            </button>
          ) : (
            <button
              onClick={startEnroll}
              disabled={busy}
              className="btn-gradient px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Configurar 2FA
            </button>
          )}
        </div>
      )}

      {stage === "verify" && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-bold text-foreground mb-3">1. Escaneie o QR Code no seu app autenticador</p>
            <div className="flex justify-center bg-white p-3 rounded-lg w-fit mx-auto">
              <img src={qr} alt="QR Code 2FA" className="w-44 h-44" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 text-center">
              Use Google Authenticator, Authy, Microsoft Authenticator ou similar.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-xs font-bold text-foreground mb-2">2. Ou copie a chave manualmente</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border border-border rounded p-2 font-mono break-all">{secret}</code>
              <button onClick={copySecret} className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition">
                {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground mb-2 block">3. Digite o código de 6 dígitos gerado</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="input-gg text-center text-2xl font-black tracking-[0.5em]"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => { setStage("idle"); setCode(""); }}
              disabled={busy}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-muted text-foreground hover:bg-muted/70 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmEnroll}
              disabled={busy || code.length !== 6}
              className="flex-1 btn-gradient py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Ativar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
