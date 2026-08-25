import React, { useEffect, useState } from "react";
import Header from "@/components/Header";
import SideMenu from "@/components/SideMenu";
import BottomNav from "@/components/BottomNav";
import ProfileModal from "@/components/ProfileModal";
import AuthScreen from "@/components/AuthScreen";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { if (!user) { setProfileOpen(false); setMenuOpen(false); } }, [user]);

  return (
    <div className="bg-gradient-page min-h-screen pb-24 text-foreground">
      <Header
        onProfileClick={() => setProfileOpen(true)}
        onAuthClick={() => setAuthOpen(true)}
        onMenuClick={() => setMenuOpen(true)}
      />
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-5">{children}</main>
      <SiteFooter />
      <BottomNav />
      <SideMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onNavigate={(next) => {
          if (!user && next !== "store") return setAuthOpen(true);
          navigate(PATHS[next]);
        }}
        onOpenProfile={() => (user ? setProfileOpen(true) : setAuthOpen(true))}
      />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
