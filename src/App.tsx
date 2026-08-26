import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
import NotFound from "./pages/NotFound.tsx";
import Produto from "./pages/Produto.tsx";
import Robux from "./pages/Robux.tsx";
import Favoritos from "./pages/Favoritos.tsx";
import AuthCallback from "./pages/AuthCallback.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ErrorBoundary>
        <AuthProvider>
          <StoreProvider>
            <BrowserRouter>
              <Sonner position="top-center" richColors />
              <CookieConsent />
              <Routes>
                <Route path="/" element={<Index view="store" />} />
                <Route path="/loja" element={<Index view="store" />} />
                <Route path="/produto/:id" element={<Produto />} />
                <Route path="/robux" element={<Robux />} />
                <Route path="/favoritos" element={<Favoritos />} />
                <Route path="/meus-produtos" element={<Index view="inventory" />} />
                <Route path="/minhas-compras" element={<Index view="purchases" />} />
                <Route path="/suporte" element={<Index view="support" />} />
                <Route path="/admin" element={<Index view="admin" />} />
                <Route path="/sacar" element={<Index view="withdraw" />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/faq" element={<Faq />} />
                <Route path="/termos" element={<Termos />} />
                <Route path="/privacidade" element={<Privacidade />} />
                <Route path="/regras" element={<Regras />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </StoreProvider>
        </AuthProvider>
      </ErrorBoundary>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
