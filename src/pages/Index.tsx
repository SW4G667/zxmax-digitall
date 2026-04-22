import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthScreen from "@/components/AuthScreen";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ProfileModal from "@/components/ProfileModal";
import StoreView from "@/components/StoreView";
import InventoryView from "@/components/InventoryView";
import SupportView from "@/components/SupportView";
import AdminView from "@/components/AdminView";
import MyPurchasesView from "@/components/MyPurchasesView";
import BannedScreen from "@/components/BannedScreen";
import { toast } from "sonner";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "profile";

function Dashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const [view, setView] = useState<View>("store");
  const [profileOpen, setProfileOpen] = useState(false);

  // Update view when profile changes
  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'support') {
      setView("admin");
    }
  }, [profile?.role]);

  // Handle payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      toast.success("Pagamento confirmado! Acesse 'Minhas Compras' para ver seu pedido.");
      window.history.replaceState({}, "", "/");
      setView("purchases");
    } else if (params.get("payment") === "canceled") {
      toast.info("Pagamento cancelado.");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  // 1. Se estiver carregando a sessão inicial e não tiver usuário ainda, mostra um loading rápido
  if (loading && !user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-page">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Iniciando...</p>
        </div>
      </div>
    );
  }

  // 2. Se não estiver carregando e não tiver usuário, mostra tela de login
  if (!user) {
    return <AuthScreen />;
  }

  // 3. Se tiver usuário mas o perfil ainda não carregou (ou falhou), usamos dados de fallback
  const activeProfile = profile || {
    id: user.id,
    email: user.email || '',
    display_name: user.email?.split('@')[0] || 'Usuario',
    role: user.email === 'admin@keybot.com' ? 'admin' : 'user',
    is_banned: false,
    balance: 0,
    earnings: 0
  };

  // 4. Se o usuário estiver banido, mostra tela de banimento
  if (activeProfile.is_banned) {
    return (
      <BannedScreen
        reason={activeProfile.ban_reason || "Motivo nao informado"}
        bannedAt={activeProfile.banned_at || new Date().toISOString()}
        userId={activeProfile.id}
        onLogout={signOut}
      />
    );
  }

  const isAdmin = activeProfile.role === 'admin';
  const isSupport = activeProfile.role === 'support';
  const isSeller = activeProfile.role === 'seller' || activeProfile.is_seller;

  return (
    <div className="bg-gradient-page min-h-screen pb-24">
      <Header onProfileClick={() => setProfileOpen(true)} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === "store" && <StoreView />}
        {view === "inventory" && isSeller && <InventoryView />}
        {view === "purchases" && <MyPurchasesView />}
        {view === "support" && <SupportView />}
        {view === "admin" && (isAdmin || isSupport) && <AdminView />}
      </main>

      <BottomNav current={view} onChange={setView} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

export default function Index() {
  return <Dashboard />;
}
