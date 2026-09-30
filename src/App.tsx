import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { StoreProvider } from "@/store/StoreContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import CookieConsent from "@/components/CookieConsent";
import Index from "./pages/Index.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import Faq from "./pages/Faq.tsx";
import Termos from "./pages/Termos.tsx";
import Privacidade from "./pages/Privacidade.tsx";
import Regras from "./pages/Regras.tsx";
import Perfil from "./pages/Perfil.tsx";
import Configuracoes from "./pages/Configuracoes.tsx";
import Categorias from "./pages/Categorias.tsx";
import NotFound from "./pages/NotFound.tsx";
import Produto from "./pages/Produto.tsx";
import Robux from "./pages/Robux.tsx";
import Favoritos from "./pages/Favoritos.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";
import MaintenanceGate from "@/components/MaintenanceGate";
import AdminBranding from "./pages/AdminBranding.tsx";
import MarketplaceHome from "./pages/MarketplaceHome.tsx";
import MarketplaceInfo from "./pages/MarketplaceInfo.tsx";
import AppDashboard from "./pages/AppDashboard.tsx";
import { SiteBrandingProvider } from "@/context/SiteBrandingContext";

const queryClient = new QueryClient();

const isInstalledApp = () =>
  window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

function ManagementAppRoute() {
  // /app is an internal start URL for the installed PWA. In a normal browser,
  // keep ZXMAX as the marketplace and never replace the public storefront with
  // the management dashboard.
  return isInstalledApp() ? <AppDashboard /> : <Navigate to="/" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <SiteBrandingProvider>
          <AuthProvider>
            <StoreProvider>
              <BrowserRouter>
                <Sonner position="top-center" richColors />
                <CookieConsent />
                <MaintenanceGate>
                  <Routes>
                    <Route path="/" element={<MarketplaceHome />} />
                    <Route path="/loja" element={<Index view="store" />} />
                    <Route path="/categorias" element={<Categorias />} />
                    <Route path="/produto/:id" element={<Produto />} />
                    <Route path="/robux" element={<Robux />} />
                    <Route path="/favoritos" element={<Favoritos />} />
                    <Route path="/app" element={<ManagementAppRoute />} />

                    <Route path="/como-funciona" element={<MarketplaceInfo kind="como-funciona" />} />
                    <Route path="/comprar" element={<MarketplaceInfo kind="comprar" />} />
                    <Route path="/vender" element={<MarketplaceInfo kind="vender" />} />
                    <Route path="/seguranca" element={<MarketplaceInfo kind="seguranca" />} />
                    <Route path="/formas-de-pagamento" element={<MarketplaceInfo kind="pagamentos" />} />
                    <Route path="/tarifas-e-prazos" element={<MarketplaceInfo kind="tarifas" />} />
                    <Route path="/reembolsos" element={<MarketplaceInfo kind="reembolsos" />} />
                    <Route path="/entrega-automatica" element={<MarketplaceInfo kind="entrega-automatica" />} />
                    <Route path="/vendedores-verificados" element={<MarketplaceInfo kind="vendedores-verificados" />} />
                    <Route path="/central-de-ajuda" element={<Index view="support" />} />

                    <Route path="/meus-produtos" element={<Index view="inventory" />} />
                    <Route path="/minhas-compras" element={<Index view="purchases" />} />
                    <Route path="/suporte" element={<Index view="support" />} />
                    <Route path="/admin" element={<Index view="admin" />} />
                    <Route path="/admin/branding" element={<AdminBranding />} />
                    <Route path="/sacar" element={<Index view="withdraw" />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/faq" element={<Faq />} />
                    <Route path="/termos" element={<Termos />} />
                    <Route path="/privacidade" element={<Privacidade />} />
                    <Route path="/regras" element={<Regras />} />
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/configuracoes" element={<Configuracoes />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </MaintenanceGate>
              </BrowserRouter>
            </StoreProvider>
          </AuthProvider>
        </SiteBrandingProvider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
