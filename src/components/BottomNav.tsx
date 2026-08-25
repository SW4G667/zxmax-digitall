import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Store, Package, ShoppingBag, Headset, Shield } from "lucide-react";
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

  const items: { key: View; label: string; icon: any }[] = [
    { key: "store", label: "Loja", icon: Store },
    { key: "inventory", label: "Anúncios", icon: Package },
    { key: "purchases", label: "Compras", icon: ShoppingBag },
    { key: "support", label: "Suporte", icon: Headset },
  ];

  if (isAdmin) {
    items.push({ key: "admin", label: "Admin", icon: Shield });
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 h-[64px] px-2 flex items-center justify-around z-50 bg-card border-t border-border safe-area-inset-bottom md:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const active = derivedCurrent === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleChange(item.key)}
              className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors ${
                active ? "text-[#2B7FFF]" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "text-[#2B7FFF]" : "text-muted-foreground"}`} />
              <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </nav>
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </>
  );
}
