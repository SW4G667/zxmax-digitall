import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Plug, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { unwrapEdgeCall } from "@/lib/edgeErrors";

const ZENNITH_WEBHOOK = "https://dbekdedzgkfgtlytrnyw.supabase.co/functions/v1/zennith-webhook";
const EVOPAY_WEBHOOK = "https://dbekdedzgkfgtlytrnyw.supabase.co/functions/v1/evopay-webhook";

type Field = { key: string; label: string; secret?: boolean; placeholder?: string; readOnly?: boolean };

const PROVIDERS: { id: string; name: string; hint: string; fields: Field[] }[] = [
  {
    id: "zennithpay",
    name: "ZennithPay (PIX + Saques)",
    hint: "Gateway principal de PIX e saques. Cole a chave privada gerada em Credenciais no painel da ZennithPay. A chave nunca volta para o navegador.",
    fields: [
      { key: "baseUrl", label: "Base URL", placeholder: "https://zennithpay.online/api/v1" },
      { key: "apiKey", label: "API Key (X-API-Key)", secret: true, placeholder: "zpk_live_..." },
      { key: "webhookSecret", label: "Segredo HMAC do webhook", secret: true, placeholder: "usado para validar X-Zennith-Signature" },
    ],
  },
  {
    id: "vexopay",
    name: "VexoPay (Crypto)",
    hint: "Somente cobranças em cripto (USDT / USDC / BTC / TRX). Use o Client ID e o Client Secret gerados em API Keys.",
    fields: [
      { key: "baseUrl", label: "Base URL", placeholder: "https://www.vexopay.com.br/api" },
      { key: "clientId", label: "Client ID (ci)", placeholder: "vxp_ci_..." },
      { key: "clientSecret", label: "Client Secret (cs)", secret: true, placeholder: "vxp_cs_..." },
      { key: "webhookSecret", label: "Segredo do webhook (opcional)", secret: true },
    ],
  },
  {
    id: "evopay",
    name: "EvoPay (legado)",
    hint: "Mantido só como fallback. O PIX ativo é a ZennithPay.",
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
  const [webhookUrl, setWebhookUrl] = useState(EVOPAY_WEBHOOK);
  const [zennithWebhookUrl, setZennithWebhookUrl] = useState(ZENNITH_WEBHOOK);
  const [gateways, setGateways] = useState({ pix: true, crypto: true, card: false, boleto: false });

  const load = async () => {
    setLoading(true);
    const res = await unwrapEdgeCall<{ integrations?: Record<string, Record<string, string>>; webhookUrl?: string; zennithWebhookUrl?: string }>(
      await supabase.functions.invoke("integrations-config", { body: { action: "get" } }),
      "Não foi possível carregar as integrações.",
    );
    const next: Record<string, Record<string, string>> = {};
    const nextMasks: Record<string, Record<string, string>> = {};
    for (const p of PROVIDERS) {
      const cfg = res.data?.integrations?.[p.id] || {};
      next[p.id] = {};
      nextMasks[p.id] = {};
      for (const f of p.fields) {
        if (f.secret) nextMasks[p.id][f.key] = cfg[`${f.key}_masked`] || "";
        else next[p.id][f.key] = cfg[f.key] || "";
      }
    }

    // Função antiga publicada não conhece Zennith: lê direto do banco (admin RLS).
    if (!res.data?.integrations?.zennithpay) {
      const { data: row } = await (supabase as any).from("app_settings").select("value").eq("key", "zennithpay").maybeSingle();
      const cfg = (row?.value || {}) as Record<string, string>;
      next.zennithpay = {
        baseUrl: cfg.baseUrl || next.zennithpay?.baseUrl || "https://zennithpay.online/api/v1",
      };
      nextMasks.zennithpay = {
        apiKey: cfg.apiKey ? "••••••••" : "",
        webhookSecret: cfg.webhookSecret ? "••••••••" : "",
      };
    }

    setWebhookUrl(res.data?.webhookUrl || EVOPAY_WEBHOOK);
    setZennithWebhookUrl(res.data?.zennithWebhookUrl || ZENNITH_WEBHOOK);
    setValues(next);
    setMasks(nextMasks);

    const { data: rows } = await (supabase as any)
      .from("app_settings")
      .select("key, value")
      .in("key", ["zennithpay", "vexopay", "stripe", "checkout_gateways"]);
    const byKey = Object.fromEntries((rows || []).map((r: any) => [r.key, r.value || {}]));
    const saved = byKey.checkout_gateways || {};
    setGateways({
      pix: saved.pix ?? byKey.zennithpay?.enabled !== false,
      crypto: saved.crypto ?? byKey.vexopay?.enabled !== false,
      card: saved.card ?? byKey.stripe?.enabled === true,
      boleto: saved.boleto ?? byKey.stripe?.boletoEnabled === true,
    });
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const setField = (provider: string, key: string, val: string) =>
    setValues((v) => ({ ...v, [provider]: { ...(v[provider] || {}), [key]: val } }));

  const copyWebhook = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Webhook copiado.");
      return;
    } catch { /* fallback abaixo — clipboard some em WebView */ }
    try {
      const el = document.createElement("textarea");
      el.value = url;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
      toast.success("Webhook copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const toggleGateway = async (id: "pix" | "crypto" | "card" | "boleto") => {
    const next = { ...gateways, [id]: !gateways[id] };
    setGateways(next);
    try {
      await (supabase as any).from("app_settings").upsert({ key: "checkout_gateways", value: next }, { onConflict: "key" });
      const map: Record<string, { provider: string; flag: string }> = {
        pix: { provider: "zennithpay", flag: "enabled" },
        crypto: { provider: "vexopay", flag: "enabled" },
        card: { provider: "stripe", flag: "enabled" },
        boleto: { provider: "stripe", flag: "boletoEnabled" },
      };
      const target = map[id];
      const { data: existing } = await (supabase as any).from("app_settings").select("value").eq("key", target.provider).maybeSingle();
      const value = { ...(existing?.value || {}), [target.flag]: next[id] };
      await (supabase as any).from("app_settings").upsert({ key: target.provider, value }, { onConflict: "key" });
      toast.success(next[id] ? `${id.toUpperCase()} ativado no checkout.` : `${id.toUpperCase()} desativado no checkout.`);
    } catch (e: any) {
      setGateways(gateways);
      toast.error(e?.message || "Não foi possível alterar o gateway.");
    }
  };

  const saveDirect = async (provider: string) => {
    const incoming = values[provider] || {};
    const { data: existing, error: readError } = await (supabase as any)
      .from("app_settings")
      .select("value")
      .eq("key", provider)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    const current: Record<string, unknown> = { ...(existing?.value || {}) };
    for (const [k, v] of Object.entries(incoming)) {
      if (typeof v === "string" && v.trim() !== "") current[k] = v.trim();
    }
    current.enabled = true;
    const { error } = await (supabase as any)
      .from("app_settings")
      .upsert({ key: provider, value: current }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  };

  const run = async (provider: string, action: "save" | "test" | "simulate") => {
    setBusy(`${provider}:${action}`);
    const res = await unwrapEdgeCall<{ ok?: boolean; message?: string; test?: { ok: boolean; message: string }; saved?: boolean }>(
      await supabase.functions.invoke("integrations-config", {
        body: { action, provider, values: values[provider] || {}, test: false },
      }),
      action === "save" ? "Não foi possível salvar as credenciais." : "Falha ao comunicar com o servidor.",
    );

    if (action === "save") {
      if (res.errorMessage) {
        try {
          await saveDirect(provider);
          toast.success("Credenciais salvas no servidor.");
          void load();
        } catch (e: any) {
          toast.error(res.errorMessage || e?.message || "Falha ao salvar. Confira se você está logado como admin.");
        }
        setBusy(null);
        return;
      }
      toast.success("Credenciais salvas com segurança no servidor.");
      if (res.data?.test) setResults((r) => ({ ...r, [provider]: res.data!.test! }));
      void load();
      setBusy(null);
      return;
    }

    setBusy(null);
    if (res.errorMessage) {
      toast.error(res.errorMessage);
      return;
    }
    setResults((r) => ({ ...r, [provider]: { ok: !!res.data?.ok, message: res.data?.message || "" } }));
    res.data?.ok ? toast.success("Conexão bem-sucedida!") : toast.error(res.data?.message || "Conexão falhou.");
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

      <div className="glass-card p-5 bg-card space-y-3">
        <h3 className="font-bold text-foreground text-sm">Gateways ativos no checkout</h3>
        <p className="text-[11px] text-muted-foreground">Escolha o que o comprador pode usar. PIX = ZennithPay, Crypto = VexoPay.</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "pix" as const, label: "PIX" },
            { id: "crypto" as const, label: "Crypto" },
            { id: "card" as const, label: "Cartão" },
            { id: "boleto" as const, label: "Boleto" },
          ]).map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => void toggleGateway(g.id)}
              className={`p-3 rounded-xl border text-sm font-bold transition ${gateways[g.id] ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}
            >
              {gateways[g.id] ? `${g.label} ligado` : `${g.label} desligado`}
            </button>
          ))}
        </div>
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

            {p.id === "zennithpay" && zennithWebhookUrl && (
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                  URL do Webhook (cole no painel da ZennithPay)
                </label>
                <input
                  readOnly
                  value={zennithWebhookUrl}
                  onClick={() => void copyWebhook(zennithWebhookUrl)}
                  className="w-full p-3 rounded-xl bg-muted text-[11px] text-foreground font-mono select-all cursor-pointer"
                />
                <button type="button" onClick={() => void copyWebhook(zennithWebhookUrl)} className="mt-2 text-[11px] font-bold text-primary">
                  Copiar webhook
                </button>
                <p className="text-[10px] text-muted-foreground mt-1">
                  A ZennithPay assina cada entrega com HMAC-SHA256 (X-Zennith-Signature). Sem o segredo, o webhook é recusado. Todo Pix pago é reconferido na API antes de liberar o pedido.
                </p>
              </div>
            )}
            {p.id === "evopay" && webhookUrl && (
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                  URL do Webhook legado EvoPay
                </label>
                <input
                  readOnly
                  value={webhookUrl}
                  onClick={() => void copyWebhook(webhookUrl)}
                  className="w-full p-3 rounded-xl bg-muted text-[11px] text-foreground font-mono select-all cursor-pointer"
                />
                <button type="button" onClick={() => void copyWebhook(webhookUrl)} className="mt-2 text-[11px] font-bold text-primary">
                  Copiar webhook
                </button>
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
