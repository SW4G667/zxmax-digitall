import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useStore, StoreProvider } from "@/store/StoreContext";
import AuthScreen from "@/components/AuthScreen";
import BannedScreen from "@/components/BannedScreen";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ProfileModal from "@/components/ProfileModal";
import StoreView from "@/components/StoreView";
import InventoryView from "@/components/InventoryView";
import SupportView from "@/components/SupportView";
import AdminView from "@/components/AdminView";
import MyPurchasesView from "@/components/MyPurchasesView";
import { toast } from "sonner";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "profile";

function Dashboard() {
  const { state, markPurchasePaid } = useStore();
  const { isAdmin } = useAuth();
  const [view, setView] = useState<View>(() => isAdmin ? "admin" : "store");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success" && state.currentUser) {
      const pendingPurchase = state.purchases
        .filter((p) => p.buyerEmail === state.currentUser!.email && p.status === "pending")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (pendingPurchase) {
        markPurchasePaid(pendingPurchase.id);
        toast.success("Pagamento confirmado! Acesse 'Minhas Compras' para ver seu pedido.");
      }
      window.history.replaceState({}, "", "/");
      setView("purchases");
    } else if (params.get("payment") === "canceled") {
      toast.info("Pagamento cancelado.");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  return (
    <div className="bg-gradient-page min-h-screen pb-24">
      <Header onProfileClick={() => setProfileOpen(true)} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === "store" && <StoreView />}
        {view === "inventory" && <InventoryView />}
        {view === "purchases" && <MyPurchasesView />}
        {view === "support" && <SupportView />}
        {view === "admin" && isAdmin && <AdminView />}
      </main>
      <BottomNav current={view} onChange={setView} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

function AppGate() {
  const { user, loading, banned } = useAuth();

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-page">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter text-foreground mb-2">
            ZX<span className="text-primary">MAX</span>
          </h1>
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  if (banned) return <BannedScreen />;

  return (
    <StoreProvider>
      <Dashboard />
    </StoreProvider>
  );
}

export default function Index() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
