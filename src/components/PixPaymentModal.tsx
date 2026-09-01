import React, { useEffect, useRef, useState } from "react";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface PixCharge {
  evopayId: string;
  qrCodeText: string;
  amount: number;
  qrCodeUrl?: string | null;
  purchaseId?: number;
}

interface Props {
  charge: PixCharge | null;
  onClose: () => void;
  onPaid: () => void;
}

export default function PixPaymentModal({ charge, onClose, onPaid }: Props) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"waiting" | "paid">("waiting");
  const paidRef = useRef(false);

  const PAID_STATUSES = ["COMPLETED", "PAID", "CONFIRMED", "paid", "completed"];

  useEffect(() => {
    paidRef.current = false;
    setStatus("waiting");
    if (!charge) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 90;

    const tick = async () => {
      if (paidRef.current) return;
      attempts += 1;
      try {
        const { data, error } = await supabase.functions.invoke("check-evopay-status", {
          body: { id: charge.evopayId },
        });
        const gatewayPaid = !error && (
          PAID_STATUSES.includes(data?.status) ||
          String(data?.status || "").toUpperCase() === "COMPLETED" ||
          String(data?.status || "").toUpperCase() === "PAID"
        );

        let localPaid = false;
        let purchaseId: number | null = charge.purchaseId || null;
        try {
          const { data: latest } = await (supabase as any)
            .from("purchases")
            .select("id, status")
            .eq("evopay_charge_id", charge.evopayId)
            .maybeSingle();
          if (latest) {
            if (["paid", "delivered"].includes(latest.status)) localPaid = true;
            purchaseId = latest.id;
          }
        } catch {}

        if (gatewayPaid || localPaid) {
          if (paidRef.current) return;
          paidRef.current = true;
          setStatus("paid");
          clearInterval(interval);
          onPaid();

        } else if (data?.status === "EXPIRED" || data?.status === "CANCELED" || data?.status === "FAILED") {
          clearInterval(interval);
          toast.error("O pagamento expirou ou foi cancelado. Gere um novo PIX.");
        }
      } catch {
        /* keep polling */
      }
      if (attempts >= MAX_ATTEMPTS) clearInterval(interval);
    };

    const interval = setInterval(tick, 4000);
    void tick();

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charge?.evopayId]);

  if (!charge) return null;

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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card w-full max-w-md p-7 bg-card animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-xl font-bold text-foreground">Pagamento via PIX</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl"><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>

        {status === "paid" ? (
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <p className="text-lg font-bold text-foreground">Pagamento confirmado!</p>
            <p className="text-sm text-muted-foreground mt-1">Sua compra foi liberada.</p>
            <button onClick={onClose} className="btn-gradient px-6 py-3 mt-6 rounded-xl font-bold">Continuar</button>
          </div>
        ) : (
          <>
            <p className="text-center text-2xl font-black text-primary mb-1">R$ {Number(charge.amount).toFixed(2)}</p>
            <p className="text-center text-xs text-muted-foreground mb-5">Escaneie o QR Code ou copie o código abaixo</p>

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

            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Aguardando confirmação do pagamento...</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
