import React, { useState } from "react";
import { FireEmoji, PackageEmoji, HeadsetEmoji, ShieldEmoji, BagCheckEmoji } from "@/components/CustomEmojis";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/store/StoreContext";
import { FileText, X } from "lucide-react";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "profile";

interface Props {
  current: View;
  onChange: (v: View) => void;
}

export default function BottomNav({ current, onChange }: Props) {
  const { isAdmin } = useAuth();
  const { state } = useStore();
  const [showRules, setShowRules] = useState(false);

  const items: { key: View; label: string; emoji: React.ReactNode }[] = [
    { key: "store", label: "Loja", emoji: <FireEmoji className="w-6 h-6" /> },
    { key: "inventory", label: "Anúncios", emoji: <PackageEmoji className="w-6 h-6" /> },
    { key: "purchases", label: "Compras", emoji: <BagCheckEmoji className="w-6 h-6" /> },
    { key: "support", label: "Suporte", emoji: <HeadsetEmoji className="w-6 h-6" /> },
  ];

  if (isAdmin) {
    items.push({ key: "admin", label: "Admin", emoji: <ShieldEmoji className="w-6 h-6" /> });
  }

  return (
    <>
      <nav className="nav-bottom-bar fixed bottom-0 left-0 right-0 h-20 px-4 flex items-center justify-around z-50 safe-area-inset-bottom">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              current === item.key ? "text-primary" : "text-muted-foreground opacity-60 hover:opacity-100"
            }`}
          >
            {item.emoji}
            <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setShowRules(true)}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all text-muted-foreground opacity-60 hover:opacity-100"
        >
          <FileText className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Regras</span>
        </button>
      </nav>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm" onClick={() => setShowRules(false)}>
          <div className="glass-card w-full max-w-lg p-7 bg-card animate-fade-in-up shadow-2xl border border-border/40" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" /> Regras da Plataforma
              </h3>
              <button onClick={() => setShowRules(false)} className="p-2 hover:bg-muted rounded-xl transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="prose dark:prose-invert max-w-none">
              <div className="bg-muted/50 rounded-2xl p-5 border border-border/20">
                <p className="whitespace-pre-wrap text-foreground leading-relaxed text-sm">
                  {state.config.rules}
                </p>
              </div>
            </div>
            <button onClick={() => setShowRules(false)} className="w-full btn-gradient p-4 mt-8 rounded-2xl font-bold shadow-lg shadow-primary/20">Entendi as Regras</button>
          </div>
        </div>
      )}
    </>
  );
}
