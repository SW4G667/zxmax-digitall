import React, { useEffect, useRef, useState } from "react";
import { X, Copy, Check, Loader2, Bitcoin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/catalog";

export interface CryptoCharge {
  id: string;
  address: string;
  amount: number;
  cryptoAmount?: number | string;
  qrCode?: string | null;
  network: string;
  asset?: string;
  expiresAt?: string;
  purchaseId?: number;
}

interface Props {
  charge: CryptoCharge | null;
  onClose: () => void;
  onPaid: () => void;
}

export default function CryptoPaymentModal({ charge, onClose, onPaid }: Props) {
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [status, setStatus] = useState<"waiting" | "paid" | "expired">("waiting");
  const paidRef = useRef(false);

  useEffect(() => {
    paidRef.current = false;
    setStatus("waiting");
    if (!charge) return;

    let attempts = 0;
    const tick = async () => {
      if (paidRef.current) return;
      attempts += 1;
      try {
        const { data, error } = await supabase.functions.invoke("check-evopay-status", {
          body: { id: charge.id },
        });
        const raw = String(data?.status || "").toUpperCase();
        if (!error && ["COMPLETED", "PAID", "CONFIRMED"].includes(raw)) {
          paidRef.current = true;
          setStatus("paid");
          clearInterval(interval);
          onPaid();
          return;
        }
        if (["EXPIRED", "FAILED", "CANCELED", "CANCELLED"].includes(raw)) {
          setStatus("expired");
          clearInterval(interval);
          toast.error("A cobrança em cripto expirou. Gere uma nova.");
        }
      } catch { /* keep polling */ }
      if (attempts >= 90) clearInterval(interval);
    };

    const interval = setInterval(tick, 5000);
    void tick();
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charge?.id]);

  if (!charge) return null;

  const copy = async (value: string, kind: "address" | "amount") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      toast.success(kind === "address" ? "Endereço copiado!" : "Valor copiado!");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const qrImg = charge.qrCode && charge.qrCode.startsWith("data:")
    ? charge.qrCode
    : `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(charge.qrCode || charge.address)}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#15151a] border border-[#25252e] w-full max-w-md p-6 rounded-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-white flex items-center gap-2"><Bitcoin className="w-5 h-5 text-[#ffbd2e]" /> Pagar com Crypto</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl" aria-label="Fechar"><X className="w-5 h-5 text-white/50" /></button>
        </div>

        {status === "paid" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-[#00c950]/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-[#00c950]" />
            </div>
            <p className="text-lg font-black text-white">Pagamento confirmado!</p>
            <button onClick={onClose} className="mt-6 w-full bg-[#ffbd2e] text-black py-3 rounded-xl font-black">Continuar</button>
          </div>
        ) : (
          <>
            <p className="text-center text-2xl font-black text-white">{formatBRL(charge.amount)}</p>
            <p className="text-center text-xs text-white/40 mb-4">
              Rede {charge.network}{charge.asset ? ` · ${charge.asset}` : ""} · envie o valor exato
            </p>
            <div className="flex justify-center mb-4">
              <img src={qrImg} alt="QR Code crypto" className="w-52 h-52 rounded-2xl bg-white p-2" />
            </div>
            {charge.cryptoAmount != null && (
              <button onClick={() => copy(String(charge.cryptoAmount), "amount")} className="w-full mb-2 p-3 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-left">
                <p className="text-[10px] uppercase font-bold text-white/30">Valor exato a enviar</p>
                <p className="text-sm font-mono text-[#ffbd2e] break-all">{charge.cryptoAmount}</p>
              </button>
            )}
            <button onClick={() => copy(charge.address, "address")} className="w-full p-3 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-left">
              <p className="text-[10px] uppercase font-bold text-white/30">Carteira</p>
              <p className="text-xs font-mono text-white break-all">{charge.address}</p>
            </button>
            <button onClick={() => copy(charge.address, "address")} className="w-full mt-3 bg-[#ffbd2e] text-black py-3 rounded-xl font-black flex items-center justify-center gap-2">
              {copied === "address" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied === "address" ? "Copiado!" : "Copiar endereço"}
            </button>
            <div className="flex items-center justify-center gap-2 text-white/40 text-sm mt-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Aguardando confirmação na blockchain…
            </div>
          </>
        )}
      </div>
    </div>
  );
}
