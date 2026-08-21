import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  message?: string;
}

export default function LoadingScreen({ message = "Carregando..." }: Props) {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowReload(true), 10000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-page">
      <div className="text-center px-6">
        <h1 className="text-4xl font-black tracking-tighter text-foreground mb-4">
          ZX<span className="text-primary">MAX</span>
        </h1>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">{message}</p>
          {showReload && (
            <div className="mt-6 animate-fade-in-up flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground max-w-xs">
                Está demorando mais que o esperado. Tente recarregar a página.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border text-sm font-bold text-foreground hover:border-primary/50 transition"
              >
                <RefreshCw className="w-4 h-4" /> Recarregar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
