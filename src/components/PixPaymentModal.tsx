import React, { useEffect, useRef, useState } from "react";
import { X, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface PixCharge {
  evopayId: string;
  qrCodeText: string;
  amount: number;
  provider?: "evopay" | "vexopay";
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

  useEffect(() => {
    paidRef.current = false;
    setStatus("waiting");
    if (!charge) return;

    const interval = setInterval(async () => {
      if (paidRef.current) return;
      try {
        const { data } = await supabase.functions.invoke("check-evopay-status", {
          body: { id: charge.evopayId, provider: charge.provider, purchaseId: charge.purchaseId },
        });
        if (data?.status === "COMPLETED" && !paidRef.current) {
          paidRef.current = true;
          setStatus("paid");
          clearInterval(interval);
          onPaid();
        }
      } catch {
        /* keep polling */
      }
    }, 4000);

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

  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(charge.qrCodeText)}`;

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
              <img src={qrImg} alt="QR Code PIX" className="w-56 h-56 rounded-2xl bg-white p-2 shadow-md" />
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
