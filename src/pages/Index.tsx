import React, { useState, useEffect } from "react";
import { useStore, StoreProvider } from "@/store/StoreContext";
import AuthScreen from "@/components/AuthScreen";
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
  const [view, setView] = useState<View>(() => state.currentUser?.isAdmin ? "admin" : "store");
  const [profileOpen, setProfileOpen] = useState(false);

  // Handle payment success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success" && state.currentUser) {
      // Mark the most recent pending purchase as paid
      const pendingPurchase = state.purchases
        .filter((p) => p.buyerEmail === state.currentUser!.email && p.status === "pending")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (pendingPurchase) {
        markPurchasePaid(pendingPurchase.id);
        toast.success("Pagamento confirmado! Acesse 'Minhas Compras' para ver seu pedido.");
      }
      // Clean URL
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
        {view === "admin" && state.currentUser.isAdmin && <AdminView />}
      </main>

      <BottomNav current={view} onChange={setView} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}

export default function Index() {
  return (
    <StoreProvider>
      <Dashboard />
    </StoreProvider>
  );
}
