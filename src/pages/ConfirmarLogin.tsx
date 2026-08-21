import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { saveTrustedDevice, getOrCreateDeviceId } from "@/lib/adminGate";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export default function ConfirmarLogin() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Confirmando seu login...");

  useEffect(() => {
    const token = params.get("token") || "";
    if (!token) {
      setStatus("error");
      setMessage("Link inválido.");
      return;
    }
    void (async () => {
      try {
        getOrCreateDeviceId();
        const { data, error } = await supabase.functions.invoke("admin-login", {
          body: { action: "confirm_email", token },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message || "Falha");
        if (data?.deviceToken) saveTrustedDevice(data.deviceToken, data.expiresAt);
        setStatus("ok");
        setMessage("Login confirmado. Este aparelho fica liberado por 30 dias.");
        setTimeout(() => navigate("/admin", { replace: true }), 1600);
      } catch (e: any) {
        setStatus("error");
        setMessage(e?.message || "Não foi possível confirmar.");
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#15151a] border border-[#25252e] rounded-2xl p-8 text-center">
        {status === "loading" && <Loader2 className="w-10 h-10 mx-auto text-[#0084ff] animate-spin mb-4" />}
        {status === "ok" && <CheckCircle2 className="w-10 h-10 mx-auto text-[#00c950] mb-4" />}
        {status === "error" && <XCircle className="w-10 h-10 mx-auto text-red-400 mb-4" />}
        <h1 className="text-xl font-black text-white">ZX<span className="text-[#0084ff]">MAX</span></h1>
        <p className="text-sm text-white/60 mt-3">{message}</p>
        {status === "error" && (
          <button onClick={() => navigate("/admin")} className="mt-6 bg-[#0084ff] text-white px-5 py-3 rounded-xl text-sm font-bold">
            Voltar
          </button>
        )}
      </div>
    </div>
  );
}
