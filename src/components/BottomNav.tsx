import React from "react";
import { FireEmoji, PackageEmoji, HeadsetEmoji, ShieldEmoji, BagCheckEmoji } from "@/components/CustomEmojis";
import { useStore } from "@/store/StoreContext";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "profile";

interface Props {
  current: View;
  onChange: (v: View) => void;
}

export default function BottomNav({ current, onChange }: Props) {
  const { state } = useStore();
  const isAdmin = state.currentUser?.isAdmin;

  const items: { key: View; label: string; emoji: React.ReactNode }[] = [
    { key: "store", label: "Loja", emoji: <FireEmoji className="w-6 h-6" /> },
    { key: "inventory", label: "Anúncios", emoji: <PackageEmoji className="w-6 h-6" /> },
    { key: "support", label: "Suporte", emoji: <HeadsetEmoji className="w-6 h-6" /> },
  ];

  if (isAdmin) {
    items.push({ key: "admin", label: "Admin", emoji: <ShieldEmoji className="w-6 h-6" /> });
  }

  return (
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
    </nav>
  );
}
