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
  const { isAdmin, isSupport, user } = useAuth();
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

  if (isAdmin || isSupport) {
    items.push({ key: "admin", label: isAdmin ? "Admin" : "Operações", icon: Shield });
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] bg-[#0d0d10]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
        <div className="mx-auto grid h-[62px] max-w-md items-center" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = derivedCurrent === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleChange(item.key)}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-md px-1 py-2 transition-colors ${
                active ? "text-[var(--zx-accent)]" : "text-white/35 hover:text-white/75"
              }`}
            >
              <Icon className={`h-[19px] w-[19px] ${active ? "text-[var(--zx-accent)]" : "text-white/35"}`} />
              <span className="max-w-full truncate text-[9px] font-semibold">{item.label}</span>
            </button>
          );
        })}
        </div>
      </nav>
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </>
  );
}
