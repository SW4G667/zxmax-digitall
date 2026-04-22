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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "profile";

function Dashboard() {
  const { state, markPurchasePaid } = useStore();
  const { isAdmin, user } = useAuth();
  const [view, setView] = useState<View>("store");

  useEffect(() => {
    if (isAdmin) {
      setView("admin");
    }
  }, [isAdmin]);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success" && state.currentUser) {
      const pendingPurchase = state.purchases
        .filter((p) => p.buyerEmail === state.currentUser!.email && p.status === "pending")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (pendingPurchase) {
        markPurchasePaid(pendingPurchase.id);
        toast.success("Pagamento confirmado!");
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
  const [discordLoading, setDiscordLoading] = useState(false);

  // Handle Discord OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    
    if (code && !user) {
      setDiscordLoading(true);
      window.history.replaceState({}, "", "/");

      supabase.functions.invoke("discord-callback", {
        body: { code, redirectUri: window.location.origin + "/" },
      }).then(({ data, error }) => {
        if (error) {
          console.error("Discord callback error:", error);
          toast.error("Erro ao fazer login com Discord: " + error.message);
          setDiscordLoading(false);
          return;
        }

        if (!data?.success) {
          console.error("Discord callback failed:", data);
          toast.error("Erro ao fazer login com Discord: " + (data?.error || "Tente novamente."));
          setDiscordLoading(false);
          return;
        }

        // Handle magic link flow for existing users
        if (data.access_token && data.token_type === "magiclink") {
          console.log("Processing magic link for existing user:", data.user.email);
          supabase.auth.verifyOtp({
            email: data.user.email,
            token: data.access_token,
            type: "magiclink",
          }).then(({ error: verifyErr }) => {
            if (verifyErr) {
              console.error("Magic link verification error:", verifyErr);
              toast.error("Erro ao autenticar: " + verifyErr.message);
            } else {
              console.log("Magic link verified successfully");
              toast.success("Login com Discord realizado!");
            }
            setDiscordLoading(false);
          }).catch((err) => {
            console.error("Unexpected error during magic link verification:", err);
            toast.error("Erro inesperado ao autenticar.");
            setDiscordLoading(false);
          });
        }
        // Handle password flow for new users
        else if (data.password && data.user?.email) {
          console.log("Processing new user with password:", data.user.email);
          supabase.auth.signInWithPassword({
            email: data.user.email,
            password: data.password,
          }).then(({ error: signInErr }) => {
            if (signInErr) {
              console.error("Sign in error:", signInErr);
              toast.error("Erro ao autenticar: " + signInErr.message);
            } else {
              console.log("New user signed in successfully");
              toast.success("Conta criada e login realizado com Discord!");
            }
            setDiscordLoading(false);
          }).catch((err) => {
            console.error("Unexpected error during sign in:", err);
            toast.error("Erro inesperado ao autenticar.");
            setDiscordLoading(false);
          });
        } else {
          console.error("Unexpected response from Discord callback:", data);
          toast.error("Resposta inesperada do servidor Discord.");
          setDiscordLoading(false);
        }
      }).catch((err) => {
        console.error("Discord callback invocation error:", err);
        toast.error("Erro ao conectar com Discord: " + (err.message || "Tente novamente."));
        setDiscordLoading(false);
      });
    }
  }, [user]);

  if (loading || discordLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-page">
        <div className="text-center">
          <h1 className="text-4xl font-black tracking-tighter text-foreground mb-2">
            ZX<span className="text-primary">MAX</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            {discordLoading ? "Autenticando com Discord..." : "Carregando..."}
          </p>
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
