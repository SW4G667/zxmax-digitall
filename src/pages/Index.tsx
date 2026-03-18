import React, { useState } from "react";
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
  const { state } = useStore();
  const [view, setView] = useState<View>(() => state.currentUser?.isAdmin ? "admin" : "store");
  const [profileOpen, setProfileOpen] = useState(false);

  if (!state.currentUser) return <AuthScreen />;

  return (
    <div className="bg-gradient-page min-h-screen pb-24">
      {/* Global notice banner - only show if set */}
      {state.config.globalNotice && state.config.globalNotice.trim() && (
        <div className="bg-primary text-primary-foreground text-center text-xs sm:text-sm py-2 px-4 font-medium flex items-center justify-center gap-2">
          <span>{state.config.globalNotice}</span>
        </div>
      )}

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
