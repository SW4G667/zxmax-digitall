import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const getReadableAuthError = (errorMessage: string) => {
  const normalized = errorMessage.toLowerCase();

  if (normalized.includes('identity_already_exists')) {
    return 'Esta conta do Discord ja esta vinculada a outro usuario.';
  }

  if (normalized.includes('account') && normalized.includes('exists')) {
    return 'Ja existe uma conta com estes dados. Tente entrar novamente ou use o metodo original desta conta.';
  }

  if (normalized.includes('access_denied')) {
    return 'O login com Discord foi cancelado.';
  }

  if (normalized.includes('code') && normalized.includes('expired')) {
    return 'O retorno do Discord expirou. Tente novamente.';
  }

  return 'Erro ao autenticar com Discord.';
};

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const currentUrl = new URL(window.location.href);
        const authCode = currentUrl.searchParams.get('code');
        const authError = currentUrl.searchParams.get('error');
        const authErrorDescription = currentUrl.searchParams.get('error_description');

        if (authError || authErrorDescription) {
          const combinedError = decodeURIComponent(authErrorDescription || authError || '');
          toast.error(getReadableAuthError(combinedError));
          navigate('/', { replace: true });
          return;
        }

        let activeSession = null;

        if (authCode) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);

          if (error) {
            throw error;
          }

          activeSession = data.session;
        }

        if (!activeSession) {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) {
            throw error;
          }

          activeSession = session;
        }

        if (activeSession?.user) {
          toast.success('Login realizado com sucesso!');
          navigate('/', { replace: true });
          return;
        }

        toast.error('Sessao nao encontrada apos o retorno do Discord.');
        navigate('/', { replace: true });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('Discord auth callback error:', err);
        toast.error(getReadableAuthError(errorMessage));
        navigate('/', { replace: true });
      }
    };

    void handleCallback();
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-page">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Processando login...</p>
      </div>
    </div>
  );
}
