import React, { useEffect, useState } from "react";
import { Loader2, RefreshCw, Shield, Zap } from "lucide-react";

interface Props {
  message?: string;
}

export default function LoadingScreen({ message = "Carregando..." }: Props) {
  const [showReload, setShowReload] = useState(false);
  const [dots, setDots] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setDots((d) => (d + 1) % 4), 400);
    const elapsedInterval = setInterval(() => setElapsed((e) => e + 1), 1000);
    const t = setTimeout(() => setShowReload(true), 8000);
    return () => {
      clearInterval(interval);
      clearInterval(elapsedInterval);
      clearTimeout(t);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050508] overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent" />
      </div>

      <div className="relative z-10 text-center px-6 max-w-sm w-full">
        <div className="mb-8">
          <h1 className="text-5xl font-black tracking-tighter text-white mb-2">
            ZX<span className="text-primary">MAX</span>
          </h1>
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <Shield className="w-3 h-3 text-primary" /> Marketplace Seguro <Zap className="w-3 h-3 text-yellow-500" /> Entrega Imediata
          </div>
        </div>

        <div className="glass-card bg-white/[0.03] backdrop-blur-xl border-white/10 p-8 rounded-2xl">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl animate-pulse" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">
                {message}
                <span className="inline-block w-6 text-left">{".".repeat(dots)}</span>
              </p>
              <p className="text-white/40 text-[11px] mt-1">
                {elapsed < 3 ? "Conectando com segurança..." : elapsed < 6 ? "Verificando sua sessão..." : "Quase lá..."}
              </p>
            </div>

            {showReload && (
              <div className="mt-4 w-full animate-fade-in-up space-y-3">
                <div className="h-px w-full bg-white/10" />
                <p className="text-[11px] text-white/50 leading-relaxed">
                  Está demorando mais que o esperado. Pode ser sua conexão ou nossos servidores.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary/90 transition"
                  >
                    <RefreshCw className="w-4 h-4" /> Recarregar
                  </button>
                  <button
                    onClick={() => {
                      localStorage.clear();
                      window.location.href = "/";
                    }}
                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm font-bold hover:bg-white/10 transition"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] text-white/20 mt-6 font-mono">zxmax • marketplace seguro</p>
      </div>
    </div>
  );
}
