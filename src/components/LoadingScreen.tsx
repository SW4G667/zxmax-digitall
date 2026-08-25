import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

interface Props {
  message?: string;
}

export default function LoadingScreen({ message = "Carregando..." }: Props) {
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowReload(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--gg-page)]">
      <div className="relative z-10 text-center px-6">
        <BrandLogo size="lg" />
        <div className="flex flex-col items-center gap-3 mt-6">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--gg-blue)]" />
          <p className="text-[var(--gg-muted)] text-sm font-medium">{message}</p>
          {showReload && (
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-xs text-[var(--gg-faint)] hover:text-[var(--gg-muted)] underline"
            >
              Demorando? Clique para recarregar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
