import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/store/StoreContext";
import AuthScreen from "@/components/AuthScreen";
import BannedScreen from "@/components/BannedScreen";
import StoreView from "@/components/StoreView";
import InventoryView from "@/components/InventoryView";
import SupportView from "@/components/SupportView";
import AdminView from "@/components/AdminView";
import MyPurchasesView from "@/components/MyPurchasesView";
import WithdrawView from "@/components/WithdrawView";
import AppShell from "@/components/AppShell";
import LoadingScreen from "@/components/LoadingScreen";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "withdraw";
const PATHS: Record<View, string> = { store: "/loja", inventory: "/meus-produtos", purchases: "/minhas-compras", support: "/suporte", admin: "/admin", withdraw: "/sacar" };

const PROTECTED_VIEWS: View[] = ["inventory", "purchases", "support", "withdraw"];

function Dashboard({ view }: { view: View }) {
  const { refreshPurchases } = useStore();
  const { isAdmin, user, needsMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);

  // Deep-link ?order={id} in minhas-compras (used in emails)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const orderId = params.get("order");
    if (orderId) {
      const num = Number(orderId);
      if (!Number.isNaN(num)) {
        setSelectedPurchaseId(num);
        if (view !== "purchases") {
          navigate(`/minhas-compras?order=${num}`, { replace: true });
        }
      }
    }
  }, [location.search, view, navigate]);

  const handleOpenChat = (purchaseId: number) => {
    setSelectedPurchaseId(purchaseId);
    navigate(`${PATHS.purchases}?order=${purchaseId}`);
  };

  const requiresAuth = PROTECTED_VIEWS.includes(view) || view === "admin";

  useEffect(() => {
    if (!user && requiresAuth) {
      setAuthOpen(true);
    }
  }, [user, requiresAuth]);

  useEffect(() => {
    if (needsMfa) setAuthOpen(true);
  }, [needsMfa]);

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
  }, [user, refreshPurchases, navigate]);

  return (
    <AppShell>
      {view === "store" && <StoreView />}
      {view === "inventory" && user && <InventoryView onOpenChat={handleOpenChat} />}
      {view === "purchases" && user && <MyPurchasesView initialSelectedId={selectedPurchaseId} />}
      {view === "support" && user && <SupportView />}
      {view === "admin" && user && isAdmin && <AdminView />}
      {view === "withdraw" && user && <WithdrawView />}
      {requiresAuth && !user && (
        <div className="text-center py-20 glass-card">
          <p className="text-3xl mb-3">🔐</p>
          <p className="text-foreground font-bold mb-1">Faça login para continuar</p>
          <p className="text-muted-foreground text-sm mb-5">Você precisa estar conectado para acessar esta área.</p>
          <button onClick={() => setAuthOpen(true)} className="btn-gradient px-6 py-3 rounded-xl font-bold text-sm">Entrar / Criar conta</button>
        </div>
      )}
      {view === "admin" && user && !isAdmin && (
        <div className="text-center py-20 glass-card">
          <p className="text-3xl mb-3">⛔</p>
          <p className="text-foreground font-bold">Acesso restrito a administradores.</p>
        </div>
      )}
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </AppShell>
  );
}

function AppGate({ view }: { view: View }) {
  const { user, loading, banned } = useAuth();
  const [discordLoading, setDiscordLoading] = useState(false);

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
        if (data.access_token && data.token_type === "magiclink") {
          supabase.auth.verifyOtp({
            email: data.user.email,
            token: data.access_token,
            type: "magiclink",
          }).then(({ error: verifyErr }) => {
            if (verifyErr) toast.error("Erro ao autenticar: " + verifyErr.message);
            else toast.success("Login com Discord realizado!");
            setDiscordLoading(false);
          }).catch(() => {
            toast.error("Erro inesperado ao autenticar.");
            setDiscordLoading(false);
          });
        } else if (data.password && data.user?.email) {
          supabase.auth.signInWithPassword({
            email: data.user.email,
            password: data.password,
          }).then(({ error: signInErr }) => {
            if (signInErr) toast.error("Erro ao autenticar: " + signInErr.message);
            else toast.success("Conta criada e login realizado com Discord!");
            setDiscordLoading(false);
          }).catch(() => {
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
    return <LoadingScreen message={discordLoading ? "Autenticando com Discord..." : "Carregando..."} />;
  }

  if (user && banned) return <BannedScreen />;

  return <Dashboard view={view} />;
}

export default function Index({ view }: { view: View }) {
  return <AppGate view={view} />;
}
