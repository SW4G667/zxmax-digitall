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
import AdminLoginGate from "@/components/AdminLoginGate";
import MyPurchasesView from "@/components/MyPurchasesView";
import WithdrawView from "@/components/WithdrawView";
import AppShell from "@/components/AppShell";
import LoadingScreen from "@/components/LoadingScreen";
import { supabase } from "@/integrations/supabase/client";
import { consumeRememberedRedirectUri, DISCORD_REDIRECT_STORAGE_KEY } from "@/lib/discordAuth";
import { toast } from "sonner";

type View = "store" | "inventory" | "purchases" | "support" | "admin" | "withdraw";
const PATHS: Record<View, string> = { store: "/loja", inventory: "/meus-produtos", purchases: "/minhas-compras", support: "/suporte", admin: "/admin", withdraw: "/sacar" };

const PROTECTED_VIEWS: View[] = ["inventory", "purchases", "support", "withdraw"];

function Dashboard({ view }: { view: View }) {
  const { refreshPurchases } = useStore();
  const { isAdmin, user, adminGateUnlocked } = useAuth();
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

  useEffect(() => {
    // Close the auth modal as soon as the login is confirmed.
    if (user) setAuthOpen(false);
  }, [user]);

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
      {/* O código do autenticador só é pedido aqui, dentro do painel admin.
          Uma vez confirmado, fica desbloqueado neste navegador até sair da conta. */}
      {view === "admin" && user && isAdmin && (adminGateUnlocked ? <AdminView /> : <AdminLoginGate />)}
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
    if (user) return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    // Só tratamos o retorno como Discord se esta aba iniciou o fluxo (marcador
    // salvo antes do redirect). Um ?code= solto pode ser confirmação de e-mail
    // do Supabase (PKCE), que o próprio client troca automaticamente.
    let isDiscordReturn = false;
    try {
      isDiscordReturn = !!sessionStorage.getItem(DISCORD_REDIRECT_STORAGE_KEY);
    } catch { /* noop */ }
    if (!isDiscordReturn) return;

    // A redirect_uri da troca TEM que ser idêntica à usada na autorização.
    const redirectUri = consumeRememberedRedirectUri() || window.location.origin + "/";
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);
    setDiscordLoading(true);

    supabase.functions
      .invoke("discord-callback", { body: { code, redirectUri } })
      .then(({ data, error }) => {
        if (error) {
          console.error("discord-callback invoke error:", error);
          toast.error("Discord: não foi possível concluir o login (servidor). Verifique o deploy da função discord-callback.");
          setDiscordLoading(false);
          return;
        }
        if (!data?.success) {
          toast.error("Discord: " + (data?.error || "Erro desconhecido. Tente novamente."));
          setDiscordLoading(false);
          return;
        }
        if (data.password && data.user?.email) {
          supabase.auth.signInWithPassword({ email: data.user.email, password: data.password }).then(({ error: signInErr }) => {
            if (signInErr) toast.error("Erro ao autenticar: " + signInErr.message);
            else toast.success("Login com Discord realizado!");
            setDiscordLoading(false);
          });
        } else {
          toast.error("Resposta inesperada do servidor Discord.");
          setDiscordLoading(false);
        }
      })
      .catch((err) => {
        console.error("Discord callback exception", err);
        toast.error("Discord: falha inesperada ao concluir o login.");
        setDiscordLoading(false);
      });
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
