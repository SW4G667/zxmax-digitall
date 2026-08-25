import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Plug, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type Field = { key: string; label: string; secret?: boolean; placeholder?: string; readOnly?: boolean };

const PROVIDERS: { id: string; name: string; hint: string; fields: Field[] }[] = [
  {
    id: "vexopay",
    name: "VexoPay (PIX + Crypto)",
    hint: "Use o Client ID e o Client Secret gerados no painel da VexoPay em API Keys. A base padrão é https://www.vexopay.com.br/api",
    fields: [
      { key: "baseUrl", label: "Base URL", placeholder: "https://www.vexopay.com.br/api" },
      { key: "clientId", label: "Client ID (ci)", placeholder: "vxp_ci_..." },
      { key: "clientSecret", label: "Client Secret (cs)", secret: true, placeholder: "vxp_cs_..." },
      { key: "webhookSecret", label: "Segredo do webhook (opcional)", secret: true },
    ],
  },
  {
    id: "evopay",
    name: "EvoPay (PIX)",
    hint: "Gateway de pagamento ativo. Cole a API Key gerada no painel da EvoPay.",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "evp_..." },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    hint: "Opcional. Usado para cobranças internacionais em cartão.",
    fields: [
      { key: "publishableKey", label: "Publishable Key", placeholder: "pk_live_..." },
      { key: "secretKey", label: "Secret Key", secret: true, placeholder: "sk_live_..." },
      { key: "webhookSecret", label: "Webhook Secret", secret: true, placeholder: "whsec_..." },
    ],
  },
  {
    id: "discord",
    name: "Discord OAuth",
    hint: "Login social via Discord. O Redirect URI precisa ser idêntico ao cadastrado no Discord Developer Portal.",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "ID do aplicativo no Discord Developer Portal" },
      { key: "clientSecret", label: "Client Secret", secret: true },
      { key: "redirectUri", label: "Redirect URI", placeholder: window.location.origin + "/" },
      { key: "scopes", label: "Scopes", placeholder: "identify email" },
      { key: "serverLink", label: "Link do servidor", placeholder: "https://discord.gg/..." },
    ],
  },
];

export default function IntegrationsPanel() {
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [masks, setMasks] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [webhookUrl, setWebhookUrl] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("integrations-config", { body: { action: "get" } });
    if (error || data?.error) {
      toast.error("Não foi possível carregar as integrações.");
      setLoading(false);
      return;
    }
    const next: Record<string, Record<string, string>> = {};
    const nextMasks: Record<string, Record<string, string>> = {};
    for (const p of PROVIDERS) {
      const cfg = data.integrations?.[p.id] || {};
      next[p.id] = {};
      nextMasks[p.id] = {};
      for (const f of p.fields) {
        if (f.secret) nextMasks[p.id][f.key] = cfg[`${f.key}_masked`] || "";
        else next[p.id][f.key] = cfg[f.key] || "";
      }
    }
    setWebhookUrl(data.webhookUrl || "");
    setValues(next);
    setMasks(nextMasks);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const setField = (provider: string, key: string, val: string) =>
    setValues((v) => ({ ...v, [provider]: { ...(v[provider] || {}), [key]: val } }));

  const run = async (provider: string, action: "save" | "test" | "simulate") => {
    setBusy(`${provider}:${action}`);
    const { data, error } = await supabase.functions.invoke("integrations-config", {
      body: { action, provider, values: values[provider] || {}, test: action === "save" },
    });
    setBusy(null);
    if (error || data?.error) {
      toast.error(data?.error || "Falha ao comunicar com o servidor.");
      return;
    }
    if (action === "save") {
      toast.success("Credenciais salvas com segurança no servidor.");
      if (data.test) setResults((r) => ({ ...r, [provider]: data.test }));
      void load();
    } else {
      setResults((r) => ({ ...r, [provider]: { ok: !!data.ok, message: data.message } }));
      data.ok ? toast.success("Conexão bem-sucedida!") : toast.error("Conexão falhou.");
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-8 bg-card flex items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando integrações...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4 bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-primary" />
          <h3 className="font-bold text-foreground text-sm">Credenciais e APIs</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Tudo é gravado apenas no servidor. As chaves secretas nunca voltam para o navegador — você vê só a máscara e pode
          substituí-las quando quiser.
        </p>
      </div>

      {PROVIDERS.map((p) => {
        const result = results[p.id];
        return (
          <div key={p.id} className="glass-card p-5 bg-card space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <Plug className="w-4 h-4 text-primary" /> {p.name}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{p.hint}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {p.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">{f.label}</label>
                  <input
                    type={f.secret ? "password" : "text"}
                    value={values[p.id]?.[f.key] || ""}
                    onChange={(e) => setField(p.id, f.key, e.target.value)}
                    placeholder={
                      f.secret && masks[p.id]?.[f.key]
                        ? "•••••••• (configurada — preencha para alterar)"
                        : f.placeholder || ""
                    }
                    className="w-full p-3 rounded-xl bg-muted text-sm text-foreground font-mono"
                  />
                </div>
              ))}
            </div>

            {result && (
              <div className={`flex items-start gap-2 text-xs p-3 rounded-xl ${result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {result.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
                <span className="break-all">{result.message}</span>
              </div>
            )}

            {p.id === "evopay" && webhookUrl && (
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                  URL do Webhook (cole no painel da EvoPay — contém um token secreto)
                </label>
                <input
                  readOnly
                  value={webhookUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full p-3 rounded-xl bg-muted text-[11px] text-foreground font-mono select-all"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Chamadas sem esse token são rejeitadas, e todo pagamento é reconferido direto na EvoPay antes de liberar o pedido.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => run(p.id, "save")}
                disabled={busy !== null}
                className="btn-gradient px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50"
              >
                {busy === `${p.id}:save` ? "Salvando..." : "Salvar credenciais"}
              </button>
              <button
                onClick={() => run(p.id, "test")}
                disabled={busy !== null}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-muted text-foreground disabled:opacity-50"
              >
                {busy === `${p.id}:test` ? "Testando..." : "Testar conexão"}
              </button>
              <button onClick={() => run(p.id, "simulate")} disabled={busy !== null} className="px-4 py-2.5 rounded-xl text-xs font-bold border border-border text-foreground disabled:opacity-50">
                {busy === `${p.id}:simulate` ? "Simulando..." : "Simular evento"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
