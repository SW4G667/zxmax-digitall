import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Loader2, Plug, RefreshCw, XCircle } from "lucide-react";

type ProviderId = "magnuspay" | "zennithpay" | "vexopay" | "stripe";

interface ProviderConfig {
  pixEnabled?: boolean;
  pixFee?: number;
  cryptoEnabled?: boolean;
  cardEnabled?: boolean;
  boletoEnabled?: boolean;
  boletoExpiresAfterDays?: number;
}

const LABELS: Record<ProviderId, { name: string; description: string }> = {
  magnuspay: {
    name: "MagnusPay",
    description: "PIX principal da ZXMAX. A API key fica apenas nos Secrets do Supabase.",
  },
  zennithpay: {
    name: "ZennithPay",
    description: "Gateway PIX legado. Mantido para compatibilidade.",
  },
  vexopay: {
    name: "VexoPay",
    description: "PIX legado e pagamentos em crypto.",
  },
  stripe: {
    name: "Stripe",
    description: "Cartão e boleto, quando configurados no servidor.",
  },
};

export default function IntegrationsPanel() {
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({});
  const [secretStatus, setSecretStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("integrations-config", { body: { action: "get" } });
    setLoading(false);
    if (error || data?.error) {
      toast.error(data?.error || "Não foi possível carregar os gateways.");
      return;
    }
    setConfigs(data?.integrations || {});
    setSecretStatus(data?.secretStatus || {});
  };

  useEffect(() => { void load(); }, []);

  const update = (provider: ProviderId, patch: ProviderConfig) => {
    setConfigs((current) => ({
      ...current,
      [provider]: { ...(current[provider] || {}), ...patch },
    }));
  };

  const save = async (provider: ProviderId) => {
    setBusy(`${provider}:save`);
    const { data, error } = await supabase.functions.invoke("integrations-config", {
      body: { action: "save", provider, values: configs[provider] || {} },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error || "Falha ao salvar.");
      return;
    }
    toast.success("Gateway atualizado.");
    await load();
  };

  const test = async (provider: ProviderId) => {
    setBusy(`${provider}:test`);
    const { data, error } = await supabase.functions.invoke("integrations-config", {
      body: { action: "test", provider },
    });
    setBusy(null);
    const result = {
      ok: !error && !!data?.ok,
      message: data?.message || data?.error || error?.message || "Falha no teste.",
    };
    setResults((current) => ({ ...current, [provider]: result }));
    result.ok ? toast.success(result.message) : toast.error(result.message);
  };

  if (loading) {
    return (
      <div className="glass-card p-8 bg-card flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando integrações...
      </div>
    );
  }

  const magnusReady = !!secretStatus.MAGNUSPAY_API_KEY;

  return (
    <div className="space-y-5">
      <div className="glass-card p-5 bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-primary" />
          <h3 className="font-black text-foreground">Pagamentos e credenciais</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Chaves privadas não são salvas no navegador nem retornam por esta tela. Configure a secret
          <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground">MAGNUSPAY_API_KEY</code>
          no Supabase. O checkout só libera PIX quando a secret existe.
        </p>
      </div>

      <div className="glass-card p-5 border border-primary/30 bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Plug className="w-4 h-4 text-primary" />
              <h3 className="font-black text-foreground">MagnusPay · PIX principal</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{LABELS.magnuspay.description}</p>
          </div>
          <span className={`text-[11px] font-black px-2.5 py-1 rounded-full ${magnusReady ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {magnusReady ? "SECRET CONFIGURADA" : "FALTA API KEY"}
          </span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          <label className="p-4 rounded-xl bg-muted flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-bold text-foreground">Ativar PIX</span>
              <span className="block text-[11px] text-muted-foreground">Desativa automaticamente outros PIX.</span>
            </span>
            <input
              type="checkbox"
              checked={configs.magnuspay?.pixEnabled === true}
              onChange={(e) => update("magnuspay", { pixEnabled: e.target.checked })}
              className="w-5 h-5 accent-primary"
            />
          </label>
          <label className="p-4 rounded-xl bg-muted">
            <span className="block text-sm font-bold text-foreground mb-2">Taxa adicional no checkout (R$)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={configs.magnuspay?.pixFee ?? 0}
              onChange={(e) => update("magnuspay", { pixFee: Number(e.target.value) || 0 })}
              className="w-full p-2.5 rounded-lg bg-card border border-border text-foreground"
            />
          </label>
        </div>

        {results.magnuspay && (
          <div className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${results.magnuspay.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {results.magnuspay.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {results.magnuspay.message}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => save("magnuspay")} disabled={busy !== null} className="btn-gradient px-4 py-2.5 rounded-xl text-xs font-black disabled:opacity-50">
            {busy === "magnuspay:save" ? "Salvando..." : "Salvar MagnusPay"}
          </button>
          <button onClick={() => test("magnuspay")} disabled={busy !== null} className="px-4 py-2.5 rounded-xl text-xs font-black bg-muted text-foreground disabled:opacity-50">
            {busy === "magnuspay:test" ? "Testando..." : "Verificar secret"}
          </button>
          <button onClick={() => void load()} disabled={busy !== null} className="px-4 py-2.5 rounded-xl text-xs font-black border border-border text-foreground flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {(["zennithpay", "vexopay", "stripe"] as ProviderId[]).map((provider) => (
          <div key={provider} className="glass-card p-4 bg-card">
            <h4 className="font-bold text-foreground">{LABELS[provider].name}</h4>
            <p className="text-[11px] text-muted-foreground mt-1 min-h-[34px]">{LABELS[provider].description}</p>
            <button onClick={() => test(provider)} disabled={busy !== null} className="mt-3 text-xs font-bold text-primary hover:underline">
              Testar configuração
            </button>
            {results[provider] && <p className={`text-[11px] mt-2 ${results[provider].ok ? "text-success" : "text-destructive"}`}>{results[provider].message}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
