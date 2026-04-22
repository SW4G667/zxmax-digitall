import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          toast.error("Erro ao autenticar com Discord");
          navigate("/");
          return;
        }

        if (session) {
          toast.success("Login realizado com sucesso!");
          navigate("/");
        } else {
          toast.error("Sessao nao encontrada");
          navigate("/");
        }
      } catch (err) {
        console.error('Callback error:', err);
        toast.error("Erro ao processar login");
        navigate("/");
      }
    };

    handleCallback();
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
