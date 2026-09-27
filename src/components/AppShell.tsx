import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import SideMenu from "@/components/SideMenu";
import BottomNav from "@/components/BottomNav";
import ProfileModal from "@/components/ProfileModal";
import AuthScreen from "@/components/AuthScreen";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "withdraw";

const PATHS: Record<View, string> = {
  store: "/loja",
  inventory: "/meus-produtos",
  purchases: "/minhas-compras",
  support: "/suporte",
  admin: "/admin",
  withdraw: "/sacar",
};

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfileOpen(false);
      setMenuOpen(false);
    }
  }, [user]);

  useEffect(() => {
    // Warm the lightweight availability endpoint while the visitor is browsing.
    // Checkout still revalidates immediately before purchase, but the Edge
    // Function and browser preflight cache are already warm by then.
    void supabase.functions.invoke("integrations-config", {
      body: { action: "payment_methods" },
    }).then(() => undefined, () => undefined);
  }, []);

  const accountArea = ["/meus-produtos", "/minhas-compras", "/suporte", "/admin", "/sacar", "/perfil", "/configuracoes"]
    .some((prefix) => location.pathname.startsWith(prefix));

  return (
    <div className={`min-h-screen bg-[#0b0b0e] text-white ${accountArea && user ? "pb-20" : ""}`}>
      <Header
        onProfileClick={() => setProfileOpen(true)}
        onAuthClick={() => setAuthOpen(true)}
        onMenuClick={() => setMenuOpen(true)}
        menuOpen={menuOpen}
      />

      <div className="mx-auto w-full max-w-[1240px] px-3 py-5 sm:px-5 sm:py-7">
        {children}
      </div>

      {!accountArea ? <SiteFooter /> : null}
      {accountArea && user ? <BottomNav /> : null}

      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={(next) => {
          if (!user && next !== "store") {
            setAuthOpen(true);
            return;
          }
          navigate(PATHS[next]);
        }}
        onOpenProfile={() => (user ? setProfileOpen(true) : setAuthOpen(true))}
      />

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
