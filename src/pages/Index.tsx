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
    if (!user && requiresAuth) setAuthOpen(true);
  }, [user, requiresAuth]);

  // Fecha o modal de autenticação assim que o login é confirmado.
  // O admin com 2FA pendente tem o modal reaberto em /admin pelo effect abaixo
  // (needsMfa), então o MFA nunca é perdido e nada fica travado em "Aguarde...".
  useEffect(() => {
    if (user) setAuthOpen(false);
  }, [user]);

  useEffect(() => {
    // Only auto-open MFA modal on admin view, not on loja (fix for user complaint that auth appears everywhere)
    if (needsMfa && view === "admin") setAuthOpen(true);
  }, [needsMfa, view]);

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
        <div className="text-center py-20 bg-[#15151a] border border-[#25252e] rounded-2xl p-10">
          <p className="text-3xl mb-3">🔐</p>
          <p className="text-white font-bold mb-1">Faça login para continuar</p>
          <p className="text-white/40 text-sm mb-5">Você precisa estar conectado para acessar esta área.</p>
          <button onClick={() => setAuthOpen(true)} className="bg-[#0084ff] text-white px-6 py-3 rounded-xl font-bold text-sm">Entrar / Criar conta</button>
        </div>
      )}
      {view === "admin" && user && !isAdmin && (
        <div className="text-center py-20 bg-[#15151a] border border-[#25252e] rounded-2xl p-10">
          <p className="text-3xl mb-3">⛔</p>
          <p className="text-white font-bold">Acesso restrito a administradores.</p>
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
    if (!code) return;

    // Native Supabase OAuth (PKCE / Discord). The code is normally exchanged
    // automatically by the client (detectSessionInUrl); here we keep a silent,
    // safe fallback using exchangeCodeForSession. No red error banner is ever
    // shown — worst case we log a warning and stop the loading spinner.
    const originalHref = window.location.href;
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
    setDiscordLoading(true);

    (async () => {
      try {
        // 1) Prefer the native session (already exchanged on init)
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) return;
        // 2) Safe fallback: exchange the code for a session (PKCE)
        const { error } = await supabase.auth.exchangeCodeForSession(originalHref);
        if (error) console.warn("OAuth exchange fallback warning:", error.message);
      } catch (e: any) {
        console.warn("OAuth code exchange warning:", e?.message || e);
      } finally {
        setDiscordLoading(false);
      }
    })();
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
