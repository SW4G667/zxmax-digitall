import React from "react";
import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function LegalPage({ title, subtitle, children }: Props) {
  return (
    <div className="bg-gradient-page min-h-screen">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <a href="/" className="p-2 rounded-xl hover:bg-muted transition" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </a>
          <h2 className="text-xl font-black tracking-tighter text-foreground">
            ZX<span className="text-primary">MAX</span>
          </h2>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-black text-foreground mb-2">{title}</h1>
        {subtitle && <p className="text-muted-foreground mb-8">{subtitle}</p>}
        <div className="glass-card bg-card p-6 sm:p-8 space-y-6 text-sm leading-relaxed text-foreground">
          {children}
        </div>
        <p className="text-xs text-muted-foreground mt-6">Última atualização: agosto de 2026.</p>
      </main>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-foreground mb-2">{heading}</h2>
      <div className="space-y-2 text-muted-foreground">{children}</div>
    </section>
  );
}
