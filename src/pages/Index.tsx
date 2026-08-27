import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useStore } from "@/store/StoreContext";
import AuthScreen from "@/components/AuthScreen";
import BannedScreen from "@/components/BannedScreen";
import StoreView from "@/components/StoreView";
import InventoryView from "@/components/InventoryView";
import SupportView from "@/components/SupportView";
import AdminView from "@/components/AdminView";
import AdminLoginGate from "@/components/AdminLoginGate";
import MyPurchasesView from "@/components/MyPurchasesView";
import WithdrawView from "@/components/WithdrawView";
import AppShell from "@/components/AppShell";
import LoadingScreen from "@/components/LoadingScreen";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { recordSecurityEvent } from "@/lib/securityEvents";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "withdraw";
const PATHS: Record<View, string> = { store: "/loja", inventory: "/meus-produtos", purchases: "/minhas-compras", support: "/suporte", admin: "/admin", withdraw: "/sacar" };

const PROTECTED_VIEWS: View[] = ["inventory", "purchases", "support", "withdraw"];

function Dashboard({ view }: { view: View }) {
  const { refreshPurchases } = useStore();
  const { isAdmin, isSupport, user, adminGateUnlocked, adminRoleResolved } = useAuth();
  const isOperator = isAdmin || isSupport;
  const navigate = useNavigate();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(null);
  const lastAdminBlockRef = useRef<string | null>(null);
  const purchaseScope = new URLSearchParams(location.search).get("scope");
  const initialPurchaseScope = purchaseScope === "sales" || purchaseScope === "purchases" ? purchaseScope : "all";

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

  useEffect(() => {
    // Close the auth modal as soon as the login is confirmed.
    if (user) setAuthOpen(false);
  }, [user]);

  useEffect(() => {
    if (view !== "admin") {
      lastAdminBlockRef.current = null;
      return;
    }
    if (!user || !adminRoleResolved || isOperator || lastAdminBlockRef.current === user.id) return;
    lastAdminBlockRef.current = user.id;
    void recordSecurityEvent(supabase, "admin.access", "blocked");
  }, [adminRoleResolved, isOperator, user, view]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("login") !== "1" || user) return;
    setAuthOpen(true);
    params.delete("login");
    const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    navigate(next, { replace: true });
  }, [location.pathname, location.search, navigate, user]);

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
      {view === "purchases" && user && <MyPurchasesView initialSelectedId={selectedPurchaseId} initialScope={initialPurchaseScope} />}
      {view === "support" && user && <SupportView />}
      {/* O código do autenticador só é pedido aqui, dentro do painel admin.
          Uma vez confirmado, fica desbloqueado neste navegador até sair da conta. */}
      {view === "admin" && user && isOperator && (adminGateUnlocked ? <AdminView /> : <AdminLoginGate />)}
      {view === "admin" && user && !adminRoleResolved && <LoadingScreen message="Verificando permissões..." />}
      {view === "withdraw" && user && <WithdrawView />}
      {requiresAuth && !user && (
        <div className="text-center py-20 bg-[#15151a] border border-[#25252e] rounded-2xl p-10">
          <p className="text-3xl mb-3">🔐</p>
          <p className="text-white font-bold mb-1">Faça login para continuar</p>
          <p className="text-white/40 text-sm mb-5">Você precisa estar conectado para acessar esta área.</p>
          <button onClick={() => setAuthOpen(true)} className="bg-[#0084ff] text-white px-6 py-3 rounded-xl font-bold text-sm">Entrar / Criar conta</button>
        </div>
      )}
      {view === "admin" && user && adminRoleResolved && !isOperator && (
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
  if (loading) {
    return <LoadingScreen message="Carregando..." />;
  }

  if (user && banned) return <BannedScreen />;

  return <Dashboard view={view} />;
}

export default function Index({ view }: { view: View }) {
  return <AppGate view={view} />;
}
