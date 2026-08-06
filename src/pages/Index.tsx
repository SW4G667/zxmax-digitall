import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useStore, StoreProvider } from "@/store/StoreContext";
import AuthScreen from "@/components/AuthScreen";
import BannedScreen from "@/components/BannedScreen";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ProfileModal from "@/components/ProfileModal";
import SideMenu from "@/components/SideMenu";
import StoreView from "@/components/StoreView";
import InventoryView from "@/components/InventoryView";
import SupportView from "@/components/SupportView";
import AdminView from "@/components/AdminView";
import MyPurchasesView from "@/components/MyPurchasesView";
import WithdrawView from "@/components/WithdrawView";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "withdraw";
const PATHS: Record<View, string> = { store: "/loja", inventory: "/meus-produtos", purchases: "/minhas-compras", support: "/suporte", admin: "/admin", withdraw: "/sacar" };

function Dashboard({ view }: { view: View }) {
  const { refreshPurchases } = useStore();
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);

  const handleOpenChat = (purchaseId: number) => {
    setSelectedPurchaseId(purchaseId);
    navigate(PATHS.purchases);
  };

  useEffect(() => {
    if (isAdmin && view === "store") {
      navigate(PATHS.admin, { replace: true });
    }
  }, [isAdmin]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success" && user) {
      void refreshPurchases();
      toast.info("Voltamos do pagamento. A confirmação será validada automaticamente.");
      window.history.replaceState({}, "", "/");
      navigate(PATHS.purchases, { replace: true });
    } else if (params.get("payment") === "canceled") {
      toast.info("Pagamento cancelado.");
      window.history.replaceState({}, "", "/");
    }
  }, [user, refreshPurchases]);

  return (
    <div className="bg-gradient-page min-h-screen pb-24">
      <Header onProfileClick={() => setProfileOpen(true)} onAuthClick={() => setAuthOpen(true)} onMenuClick={() => setMenuOpen(true)} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {view === "store" && <StoreView />}
        {view === "inventory" && <InventoryView onOpenChat={handleOpenChat} />}
        {view === "purchases" && <MyPurchasesView initialSelectedId={selectedPurchaseId} />}
        {view === "support" && <SupportView />}
        {view === "admin" && isAdmin && <AdminView />}
        {view === "withdraw" && <WithdrawView />}
      </main>
      <BottomNav current={view} onChange={(next) => {
        if (!user && next !== "store") return setAuthOpen(true);
        navigate(PATHS[next]);
      }} />
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

function AppGate({ view }: { view: View }) {
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
          supabase.auth.verifyOtp({
            email: data.user.email,
            token: data.access_token,
            type: "magiclink",
          }).then(({ error: verifyErr }) => {
            if (verifyErr) {
              toast.error("Erro ao autenticar: " + verifyErr.message);
            } else {
              toast.success("Login com Discord realizado!");
            }
            setDiscordLoading(false);
          }).catch((err) => {
            toast.error("Erro inesperado ao autenticar.");
            setDiscordLoading(false);
          });
        }
        // Handle password flow for new users
        else if (data.password && data.user?.email) {
          supabase.auth.signInWithPassword({
            email: data.user.email,
            password: data.password,
          }).then(({ error: signInErr }) => {
            if (signInErr) {
              toast.error("Erro ao autenticar: " + signInErr.message);
            } else {
              toast.success("Conta criada e login realizado com Discord!");
            }
            setDiscordLoading(false);
          }).catch((err) => {
            toast.error("Erro inesperado ao autenticar.");
            setDiscordLoading(false);
          });
        } else {
          toast.error("Resposta inesperada do servidor Discord.");
          setDiscordLoading(false);
        }
      }).catch((err) => {
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

  if (user && banned) return <BannedScreen />;

  return (
    <StoreProvider>
      <Dashboard view={view} />
    </StoreProvider>
  );
}

export default function Index({ view }: { view: View }) {
  return (
    <AuthProvider>
      <AppGate view={view} />
    </AuthProvider>
  );
}
