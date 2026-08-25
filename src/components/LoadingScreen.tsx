import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  message?: string;
}

export default function LoadingScreen({ message = "Carregando..." }: Props) {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    // Show reload after 3 seconds max (user wants 2-3s)
    const t = setTimeout(() => setShowReload(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a0f]">
      {/* GGMAX style subtle gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f] to-[#111114]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#0084ff]/[0.06] blur-[80px] rounded-full" />

      <div className="relative z-10 text-center px-6">
        <h1 className="text-4xl font-black tracking-tighter text-white mb-6">
          ZX<span className="text-[#0084ff]">MAX</span>
        </h1>
        
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#0084ff]" />
          <p className="text-white/60 text-sm font-medium">{message}</p>
          {showReload && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-xs text-white/30 hover:text-white/60 underline"
            >
              Demorando? Clique para recarregar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
