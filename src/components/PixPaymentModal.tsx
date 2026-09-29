import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, Copy, Check, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface PixCharge {
  evopayId: string;
  provider?: string;
  qrCodeText: string;
  amount: number;
  baseAmount?: number;
  providerFee?: number | null;
  qrCodeUrl?: string | null;
  purchaseId?: number;
}

interface Props {
  charge: PixCharge | null;
  onClose: () => void;
  onPaid: () => void | Promise<void>;
}

const PAID_STATUSES = new Set(["COMPLETED", "PAID", "CONFIRMED", "APPROVED", "SUCCESS", "SUCCEEDED", "SETTLED"]);

export default function PixPaymentModal({ charge, onClose, onPaid }: Props) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"waiting" | "paid" | "expired">("waiting");
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState("Verificando automaticamente…");
  const paidRef = useRef(false);
  const checkingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;
  const chargeKey = charge ? `${charge.provider || "pix"}:${charge.purchaseId || 0}:${charge.evopayId}` : "";
  const settledStorageKey = chargeKey ? `zxmax:settled-pix:${chargeKey}` : "";
  const wasSettledInThisTab = Boolean(
    settledStorageKey &&
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(settledStorageKey) === "1"
  );

  const stopPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const verifyPayment = useCallback(async (manual = false) => {
    if (!charge || paidRef.current || checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    if (manual) setCheckMessage("Consultando o pagamento agora…");

    try {
      const checker = charge.provider === "magnuspay_pix" ? "check-magnuspay-status" : "check-evopay-status";
      const { data, error } = await supabase.functions.invoke(checker, {
        body: charge.provider === "magnuspay_pix" && charge.purchaseId
          ? { purchaseId: charge.purchaseId }
          : { id: charge.evopayId },
      });

      const gatewayStatus = String(data?.status || "").toUpperCase();
      const gatewayPaid = !error && (data?.paid === true || PAID_STATUSES.has(gatewayStatus));

      let localPaid = false;
      try {
        let query = (supabase as any)
          .from("purchases")
          .select("id,status,payment_status,provider_payment_id");
        query = charge.purchaseId
          ? query.eq("id", charge.purchaseId)
          : query.eq("evopay_charge_id", charge.evopayId);
        const { data: latest } = await query.maybeSingle();
        if (latest) {
          localPaid = ["paid", "delivered_pending_confirmation", "delivered"].includes(String(latest.status));
        }
      } catch {
        // Provider verification remains authoritative if the local read is unavailable.
      }

      if (gatewayPaid || localPaid) {
        paidRef.current = true;
        stopPolling();
        if (settledStorageKey && typeof window !== "undefined") {
          window.sessionStorage.setItem(settledStorageKey, "1");
        }
        setStatus("paid");
        setCheckMessage("Pagamento confirmado.");
        await onPaidRef.current();
        return;
      }

      if (["EXPIRED", "CANCELED", "CANCELLED", "FAILED"].includes(gatewayStatus)) {
        stopPolling();
        setStatus("expired");
        setCheckMessage("Esta cobrança expirou ou falhou. Gere um novo PIX.");
        return;
      }

      if (error) {
        const message = String((error as any)?.message || "");
        setCheckMessage(
          /429|rate/i.test(message)
            ? "O provedor do PIX limitou a consulta por alguns segundos. Vou tentar novamente."
            : "Ainda não consegui confirmar. Vou continuar verificando automaticamente.",
        );
      } else {
        setCheckMessage("Pagamento ainda não confirmado pela instituição.");
      }
    } catch {
      setCheckMessage("Falha temporária na consulta. Vou tentar novamente.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [charge, settledStorageKey]);

  useEffect(() => {
    if (!charge) return;
    const recheckWhenVisible = () => {
      if (document.visibilityState === "visible") void verifyPayment(false);
    };
    const recheckOnFocus = () => void verifyPayment(false);
    document.addEventListener("visibilitychange", recheckWhenVisible);
    window.addEventListener("focus", recheckOnFocus);
    return () => {
      document.removeEventListener("visibilitychange", recheckWhenVisible);
      window.removeEventListener("focus", recheckOnFocus);
    };
  }, [charge, verifyPayment]);

  useEffect(() => {
    paidRef.current = false;
    checkingRef.current = false;
    attemptsRef.current = 0;
    stopPolling();
    if (!charge) {
      setStatus("waiting");
      setCheckMessage("Verificando automaticamente…");
      return;
    }
    if (
      settledStorageKey &&
      typeof window !== "undefined" &&
      window.sessionStorage.getItem(settledStorageKey) === "1"
    ) {
      paidRef.current = true;
      setStatus("paid");
      setCheckMessage("Pagamento confirmado.");
      void onPaidRef.current();
      return;
    }
    setStatus("waiting");
    setCheckMessage("Verificando automaticamente…");

    const tick = async () => {
      attemptsRef.current += 1;
      await verifyPayment(false);
      if (attemptsRef.current >= 90 && !paidRef.current) {
        stopPolling();
        setCheckMessage("A verificação automática pausou. Toque em “Verificar agora” ou confira em Compras.");
      }
    };

    void tick();
    intervalRef.current = setInterval(() => void tick(), 4000);
    return stopPolling;
  // Reset only for a genuinely different charge. Parent rerenders and
  // callback identity changes must never resurrect a paid QR code.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeKey]);

  if (!charge || wasSettledInThisTab) return null;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(charge.qrCodeText);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  const gatewayExtra = charge.baseAmount != null
    ? Math.max(0, Math.round((Number(charge.amount) - Number(charge.baseAmount)) * 100) / 100)
    : Number(charge.providerFee || 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-6 sm:p-7 bg-card animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary/80">Checkout protegido</p>
            <h3 className="text-xl font-bold text-foreground mt-1">Pagamento via PIX</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl" aria-label="Fechar"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {status === "paid" ? (
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <p className="text-lg font-bold text-foreground">Pagamento confirmado!</p>
            <p className="text-sm text-muted-foreground mt-1">O pedido foi atualizado e a entrega já pode continuar.</p>
            <button onClick={onClose} className="btn-gradient px-6 py-3 mt-6 rounded-xl font-bold">Continuar</button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 mb-5 text-center">
              <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Total do PIX</p>
              <p className="text-3xl font-black text-primary mt-1">R$ {Number(charge.amount).toFixed(2)}</p>
              {charge.baseAmount != null && gatewayExtra > 0 && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-left">
                  <div className="rounded-xl bg-background/40 px-3 py-2">
                    <p className="text-[9px] uppercase text-muted-foreground">Pedido ZXMAX</p>
                    <p className="text-xs font-bold text-foreground">R$ {Number(charge.baseAmount).toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl bg-background/40 px-3 py-2">
                    <p className="text-[9px] uppercase text-muted-foreground">Taxa de processamento</p>
                    <p className="text-xs font-bold text-foreground">R$ {gatewayExtra.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center mb-5">
              <div className="rounded-2xl bg-white p-3 shadow-md" role="img" aria-label="QR Code PIX gerado a partir do código de pagamento">
                <QRCodeSVG value={charge.qrCodeText} size={224} level="M" includeMargin />
              </div>
            </div>

            <div className="bg-muted rounded-xl p-3 mb-3">
              <p className="text-[11px] text-foreground break-all font-mono leading-relaxed">{charge.qrCodeText}</p>
            </div>

            <button onClick={copyCode} className="w-full btn-gradient flex items-center justify-center gap-2 p-3 rounded-xl font-bold mb-3">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado!" : "Copiar código PIX"}
            </button>

            <div className={`rounded-xl border p-3 ${status === "expired" ? "border-destructive/25 bg-destructive/5" : "border-border/60 bg-muted/40"}`}>
              <div className="flex items-start gap-2">
                {status === "expired"
                  ? <AlertCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
                  : <Loader2 className="w-4 h-4 mt-0.5 text-primary shrink-0 animate-spin" style={{ animation: "spin .7s linear infinite" }} />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">{status === "expired" ? "Cobrança encerrada" : "Confirmação automática"}</p>
                  <p className="text-[11px] leading-4 text-muted-foreground mt-0.5">{checkMessage}</p>
                </div>
              </div>
              {status !== "expired" && (
                <button
                  type="button"
                  onClick={() => void verifyPayment(true)}
                  disabled={checking}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-background/50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`} style={checking ? { animation: "spin .7s linear infinite" } : undefined} />
                  Verificar agora
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
