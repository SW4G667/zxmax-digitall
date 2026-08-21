import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FireEmoji, PackageEmoji, HeadsetEmoji, ShieldEmoji, BagCheckEmoji } from "@/components/CustomEmojis";
import { useAuth } from "@/hooks/useAuth";
import AuthScreen from "@/components/AuthScreen";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "withdraw";

interface Props {
  current?: View;
  onChange?: (v: View) => void;
}

const PATHS: Record<View, string> = {
  store: "/loja",
  inventory: "/meus-produtos",
  purchases: "/minhas-compras",
  support: "/suporte",
  admin: "/admin",
  withdraw: "/sacar",
};

function pathToView(path: string): View {
  if (path.startsWith("/meus-produtos")) return "inventory";
  if (path.startsWith("/minhas-compras")) return "purchases";
  if (path.startsWith("/suporte")) return "support";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/sacar")) return "withdraw";
  return "store";
}

export default function BottomNav({ current: propCurrent, onChange: propOnChange }: Props) {
  const { isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);

  const derivedCurrent = propCurrent ?? pathToView(location.pathname);

  const handleChange = (v: View) => {
    if (propOnChange) {
      propOnChange(v);
      return;
    }
    if (!user && v !== "store") {
      setAuthOpen(true);
      return;
    }
    navigate(PATHS[v]);
  };

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
            onClick={() => handleChange(item.key)}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all ${
              derivedCurrent === item.key ? "text-primary" : "text-muted-foreground opacity-60 hover:opacity-100"
            }`}
          >
            {item.emoji}
            <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
          </button>
        ))}
      </nav>
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </>
  );
}
