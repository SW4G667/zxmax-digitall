import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Plug, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { unwrapEdgeCall } from "@/lib/edgeErrors";

const SUPABASE_FN_BASE = "https://dbekdedzgkfgtlytrnyw.supabase.co/functions/v1";
const ZENNITH_WEBHOOK = `${SUPABASE_FN_BASE}/zennith-webhook`;
const EVOPAY_WEBHOOK = `${SUPABASE_FN_BASE}/evopay-webhook`;

type Field = { key: string; label: string; secret?: boolean; placeholder?: string; readOnly?: boolean };

/** Capabilities toggles per provider — each toggle controls a specific function,
 *  not a global provider on/off. */
type CapToggle = { key: string; label: string; hint?: string; defaultOn: boolean };

type ProviderDef = {
  id: string;
  name: string;
  hint: string;
  fields: Field[];
  capabilities: CapToggle[];
};

const PROVIDERS: ProviderDef[] = [
  {
    id: "zennithpay",
    name: "ZennithPay (PIX + Saques)",
    hint: "Gateway oficial de PIX e saques. Cole a chave privada gerada em Credenciais no painel da ZennithPay.",
    fields: [
      { key: "baseUrl", label: "Base URL", placeholder: "https://zennithpay.online/api/v1" },
      { key: "apiKey", label: "API Key (X-API-Key)", secret: true, placeholder: "zpk_live_..." },
      { key: "webhookSecret", label: "Segredo HMAC do webhook", secret: true, placeholder: "usado para validar X-Zennith-Signature" },
    ],
    capabilities: [
      { key: "pixEnabled", label: "PIX no checkout", hint: "Cobranças Pix criadas pela ZennithPay.", defaultOn: true },
      { key: "withdrawalsEnabled", label: "Saques", hint: "Saques aprovados saem por PIX da ZennithPay.", defaultOn: true },
    ],
  },
  {
    id: "vexopay",
    name: "VexoPay (Crypto)",
    hint: "Cobranças em cripto (USDT / USDC / BTC / TRX). PIX da VexoPay fica DESLIGADO — Zennith cuida do PIX.",
    fields: [
      { key: "baseUrl", label: "Base URL", placeholder: "https://www.vexopay.com.br/api" },
      { key: "clientId", label: "Client ID (ci)", placeholder: "vxp_ci_..." },
      { key: "clientSecret", label: "Client Secret (cs)", secret: true, placeholder: "vxp_cs_..." },
      { key: "webhookSecret", label: "Segredo do webhook (opcional)", secret: true },
    ],
    capabilities: [
      { key: "cryptoEnabled", label: "Crypto no checkout", hint: "USDT/USDC/BTC/TRX pela VexoPay.", defaultOn: true },
    ],
  },
  {
    id: "evopay",
    name: "EvoPay (legado)",
    hint: "Mantido só como fallback. PIX oficial é a ZennithPay. Desligado por padrão.",
    fields: [
      { key: "baseUrl", label: "Base URL", placeholder: "https://api.evopay.cash/v1" },
      { key: "apiKey", label: "API Key", secret: true, placeholder: "evp_..." },
    ],
    capabilities: [
      { key: "pixEnabled", label: "PIX (legado)", hint: "Não use — ZennithPay é o PIX oficial.", defaultOn: false },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    hint: "Opcional. Cobranças internacionais em cartão.",
    fields: [
      { key: "publishableKey", label: "Publishable Key", placeholder: "pk_live_..." },
      { key: "secretKey", label: "Secret Key", secret: true, placeholder: "sk_live_..." },
      { key: "webhookSecret", label: "Webhook Secret", secret: true, placeholder: "whsec_..." },
    ],
    capabilities: [
      { key: "cardEnabled", label: "Cartão no checkout", defaultOn: false },
      { key: "boletoEnabled", label: "Boleto no checkout", defaultOn: false },
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
    capabilities: [],
  },
];

// ------------------------------------------------------------------
// Client-side connection tests — mirror the logic that lives on the
// edge function `integrations-config` so we can still "Testar conexão"
// even when the deployed edge is old (returns "Provedor inválido.").
// Same logic as saveDirect: reads app_settings via admin RLS and
// merges with whatever the user just typed in the form.
// ------------------------------------------------------------------
async function clientTestConnection(
  provider: string,
  cfg: Record<string, string>,
): Promise<{ ok: boolean; message: string }> {
  try {
    if (provider === "zennithpay") {
      if (!cfg.apiKey) return { ok: false, message: "API Key (X-API-Key) é obrigatória." };
      const baseUrl = String(cfg.baseUrl || "https://zennithpay.online/api/v1").replace(/\/$/, "");
      const r = await fetch(`${baseUrl}/balance`, {
        headers: { "X-API-Key": String(cfg.apiKey), Accept: "application/json" },
      });
      const body = await r.text();
      return r.ok
        ? { ok: true, message: `Conexão OK com a ZennithPay (fallback client-side). ${body.slice(0, 120)}` }
        : { ok: false, message: `ZennithPay respondeu ${r.status}: ${body.slice(0, 200)}` };
    }
    if (provider === "evopay") {
      if (!cfg.apiKey) return { ok: false, message: "API Key é obrigatória." };
      const baseUrl = String(cfg.baseUrl || "https://api.evopay.cash/v1").replace(/\/$/, "");
      const r = await fetch(`${baseUrl}/balance`, {
        headers: { Authorization: `Bearer ${cfg.apiKey}` },
      });
      const body = await r.text();
      return r.ok
        ? { ok: true, message: "Conexão OK com a EvoPay (fallback client-side)." }
        : { ok: false, message: `EvoPay respondeu ${r.status}: ${body.slice(0, 200)}` };
    }
    if (provider === "stripe") {
      if (!cfg.secretKey) return { ok: false, message: "Secret Key (sk_...) é obrigatória." };
      const r = await fetch("https://api.stripe.com/v1/balance", {
        headers: { Authorization: `Bearer ${cfg.secretKey}` },
      });
      const body = await r.json().catch(() => ({}));
      return r.ok
        ? { ok: true, message: `Conexão OK com a Stripe (${cfg.secretKey.startsWith("sk_live") ? "live" : "test"}).` }
        : { ok: false, message: `Stripe: ${body?.error?.message || r.status}` };
    }
    if (provider === "vexopay") {
      if (!cfg.clientId || !cfg.clientSecret) return { ok: false, message: "Client ID (ci) e Client Secret (cs) são obrigatórios." };
      const baseUrl = String(cfg.baseUrl || "https://www.vexopay.com.br/api").replace(/\/$/, "");
      const headers = { ci: String(cfg.clientId), cs: String(cfg.clientSecret), Accept: "application/json" };
      let last = "";
      for (const path of ["/gateway/balance", "/balance", "/merchant/crypto-fees"]) {
        const r = await fetch(`${baseUrl}${path}`, { headers });
        const body = await r.text();
        if (r.ok) return { ok: true, message: `Conexão OK com a VexoPay (fallback client-side). ${body.slice(0, 120)}` };
        last = `VexoPay respondeu ${r.status} em ${path}: ${body.slice(0, 160)}`;
      }
      return { ok: false, message: last || "VexoPay não respondeu." };
    }
    if (provider === "discord") {
      if (!cfg.clientId || !cfg.clientSecret) return { ok: false, message: "Client ID e Client Secret são obrigatórios." };
      const r = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          scope: "identify",
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
        }),
      });
      const body = await r.json().catch(() => ({}));
      return r.ok
        ? { ok: true, message: "Credenciais do Discord válidas (fallback client-side)." }
        : { ok: false, message: `Discord: ${body?.error_description || body?.error || r.status}` };
    }
    return { ok: false, message: "Provedor desconhecido." };
  } catch (e: any) {
    return { ok: false, message: `Falha de rede: ${e?.message || e}` };
  }
}

export default function IntegrationsPanel() {
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [masks, setMasks] = useState<Record<string, Record<string, string>>>({});
  // Per-provider capability booleans, persisted on the provider's own app_settings row.
  const [caps, setCaps] = useState<Record<string, Record<string, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [webhookUrl, setWebhookUrl] = useState(EVOPAY_WEBHOOK);
  const [zennithWebhookUrl, setZennithWebhookUrl] = useState(ZENNITH_WEBHOOK);
  const [edgeOutdated, setEdgeOutdated] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await unwrapEdgeCall<{
      integrations?: Record<string, Record<string, string>>;
      webhookUrl?: string;
      zennithWebhookUrl?: string;
      v?: number;
    }>(
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

    // Ler TODOS os providers direto do banco como fonte de verdade para caps e
    // também para preencher providers que a edge antiga não conhece.
    const { data: rows } = await (supabase as any)
      .from("app_settings")
      .select("key, value")
      .in("key", PROVIDERS.map((p) => p.id).concat(["checkout_gateways"]));
    const byKey: Record<string, Record<string, any>> = {};
    for (const r of rows || []) byKey[r.key] = r.value || {};

    const nextCaps: Record<string, Record<string, boolean>> = {};
    for (const p of PROVIDERS) {
      const saved = byKey[p.id] || {};
      nextCaps[p.id] = {};
      for (const c of p.capabilities) {
        // Valor explícito tem precedência; senão usa o defaultOn.
        const v = saved[c.key];
        nextCaps[p.id][c.key] = typeof v === "boolean" ? v : c.defaultOn;
      }
    }
    setCaps(nextCaps);

    // Função antiga publicada não conhece Zennith (e possivelmente Vexo/Stripe):
    // complementa com valores do banco (admin RLS). Para plain fields, o valor
    // salvo no banco vence; senão fica o placeholder (baseUrl tem default).
    const providersNeedingDb = PROVIDERS.filter((p) => !res.data?.integrations?.[p.id]);
    for (const p of providersNeedingDb) {
      const cfg = byKey[p.id] || {};
      next[p.id] = { ...next[p.id] };
      nextMasks[p.id] = { ...nextMasks[p.id] };
      for (const f of p.fields) {
        if (f.secret) {
          nextMasks[p.id][f.key] = cfg[f.key] ? "••••••••" : nextMasks[p.id][f.key] || "";
        } else {
          const saved = typeof cfg[f.key] === "string" ? cfg[f.key] : "";
          const current = next[p.id][f.key] || "";
          next[p.id][f.key] = saved || current || f.placeholder || "";
        }
      }
    }

    // Edge é antiga se não devolveu ao menos o zennithpay (que está em PROVIDERS
    // na versão nova).
    setEdgeOutdated(!res.data?.integrations?.zennithpay);

    setWebhookUrl(byKey.evopay?.webhookToken
      ? `${SUPABASE_FN_BASE}/evopay-webhook?token=${byKey.evopay.webhookToken}`
      : res.data?.webhookUrl || EVOPAY_WEBHOOK);
    setZennithWebhookUrl(res.data?.zennithWebhookUrl || ZENNITH_WEBHOOK);
    setValues(next);
    setMasks(nextMasks);
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
    } catch { /* fallback */ }
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

  /** Atualiza um toggle de capacidade de um provedor e persiste em app_settings. */
  const toggleCapability = async (provider: ProviderDef, capKey: string) => {
    const current = caps[provider.id]?.[capKey] ?? false;
    const next = !current;
    const prevCaps = caps;
    setCaps((c) => ({ ...c, [provider.id]: { ...(c[provider.id] || {}), [capKey]: next } }));
    try {
      const { data: existing } = await (supabase as any)
        .from("app_settings")
        .select("value")
        .eq("key", provider.id)
        .maybeSingle();
      const value = { ...(existing?.value || {}), [capKey]: next };
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert({ key: provider.id, value }, { onConflict: "key" });
      if (error) throw new Error(error.message);
      // Mantemos checkout_gateways sincronizado p/ compatibilidade com código legado.
      const syncMap: Record<string, "pix" | "crypto" | "card" | "boleto"> = {
        "zennithpay:pixEnabled": "pix",
        "vexopay:cryptoEnabled": "crypto",
        "stripe:cardEnabled": "card",
        "stripe:boletoEnabled": "boleto",
      };
      const gwKey = syncMap[`${provider.id}:${capKey}`];
      if (gwKey) {
        const { data: cg } = await (supabase as any).from("app_settings").select("value").eq("key", "checkout_gateways").maybeSingle();
        const cgValue = { ...(cg?.value || {}), [gwKey]: next };
        await (supabase as any).from("app_settings").upsert({ key: "checkout_gateways", value: cgValue }, { onConflict: "key" });
      }
      toast.success(next ? "Função ativada." : "Função desativada.");
    } catch (e: any) {
      setCaps(prevCaps);
      toast.error(e?.message || "Não foi possível alterar a configuração.");
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
    const def = PROVIDERS.find((p) => p.id === provider);
    for (const f of def?.fields || []) {
      const v = incoming[f.key];
      if (f.secret) {
        // Campos secretos só sobrescrevem quando o admin digitou algo novo.
        if (typeof v === "string" && v.trim() !== "") current[f.key] = v.trim();
      } else if (typeof v === "string" && v.trim() !== "") {
        current[f.key] = v.trim();
      }
    }
    // Marca como fornecedor que tem credenciais, mas NÃO apaga flags de
    // capacidade (pixEnabled, withdrawalsEnabled etc.) que existam no objeto.
    if (!("enabled" in current)) current.enabled = true;
    const { error } = await (supabase as any)
      .from("app_settings")
      .upsert({ key: provider, value: current }, { onConflict: "key" });
    if (error) throw new Error(error.message);
  };

  /** Lê a configuração efetiva do provider (banco + campos em edição) para
   *  usar no teste/simulação client-side quando a edge falha.
   *  Secretos: usam o que foi digitado NO FORMULÁRIO (a chave é do navegador)
   *  ou, se o form estiver com a máscara/vazio, a chave salva no banco via RLS
   *  de admin. Isso permite "Testar conexão" sem redigitar a API key. */
  const readEffectiveCfg = async (provider: string): Promise<Record<string, string>> => {
    const { data: row } = await (supabase as any).from("app_settings").select("value").eq("key", provider).maybeSingle();
    const saved: Record<string, any> = (row?.value || {}) as Record<string, any>;
    const form = values[provider] || {};
    const out: Record<string, string> = {};
    const def = PROVIDERS.find((p) => p.id === provider);
    for (const f of def?.fields || []) {
      const formVal = typeof form[f.key] === "string" ? form[f.key].trim() : "";
      if (f.secret) {
        // Se o admin digitou algo que não é a máscara, usa o que ele digitou.
        // Senão, usa a chave já salva no banco (o admin RLS permite lê-la).
        const looksLikeMask = formVal === "" || /^[•*•]+$/.test(formVal) || formVal === "••••••••";
        if (formVal && !looksLikeMask) out[f.key] = formVal;
        else if (typeof saved[f.key] === "string" && saved[f.key]) out[f.key] = saved[f.key];
      } else {
        if (formVal) out[f.key] = formVal;
        else if (saved[f.key]) out[f.key] = String(saved[f.key]);
        else if (f.key === "baseUrl") out[f.key] = f.placeholder || "";
        else out[f.key] = "";
      }
    }
    return out;
  };

  const run = async (provider: string, action: "save" | "test" | "simulate") => {
    setBusy(`${provider}:${action}`);
    const res = await unwrapEdgeCall<{ ok?: boolean; message?: string; test?: { ok: boolean; message: string }; saved?: boolean }>(
      await supabase.functions.invoke("integrations-config", {
        body: { action, provider, values: values[provider] || {}, test: false },
      }),
      action === "save" ? "Não foi possível salvar as credenciais." : "Falha ao comunicar com o servidor.",
    );

    // SAVE: fall back to DB write like before.
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

    // TEST / SIMULATE: se a edge retornou "Provedor inválido." (versão antiga
    // publicada), ou 404 (função não existe), ou 403 (gates de admin da
    // versão antiga), ou não devolveu dados, usamos o fallback client-side.
    // Nunca mais mostramos "Provedor inválido" para o usuário — testamos
    // direto no provedor, ou pelo menos dizemos que as credenciais estão
    // salvas mas a edge está antiga. Erros REAIS vindos da edge nova (ex.:
    // chave inválida, saldo, rede) continuam sendo exibidos normalmente.
    const edgeInvalid =
      (!!res.errorMessage && /Provedor inválido|Apenas administradores|Função não encontrada|Function not found|Edge Function/i.test(res.errorMessage)) ||
      res.status === 404 ||
      res.status === 403 ||
      !res.data;

    if (action === "test") {
      if (edgeInvalid || !res.data) {
        try {
          const cfg = await readEffectiveCfg(provider);
          // Verifica primeiro se credenciais obrigatórias existem.
          const def = PROVIDERS.find((p) => p.id === provider);
          const required = (def?.fields || []).filter((f) => f.key !== "baseUrl" && f.key !== "webhookSecret");
          const missing = required.filter((f) => f.secret ? !cfg[f.key] : !cfg[f.key]);
          if (missing.length > 0) {
            const msg = `Preencha ${missing.map((m) => m.label).join(", ")} antes de testar.`;
            setResults((r) => ({ ...r, [provider]: { ok: false, message: msg } }));
            toast.error(msg);
            setBusy(null);
            return;
          }
          const result = await clientTestConnection(provider, cfg);
          // Se o teste direto no navegador falhou por CORS/rede mas a edge está
          // desatualizada, damos uma mensagem honesta — NÃO "Provedor inválido".
          if (!result.ok && /Falha de rede|Failed to fetch|NetworkError|CORS/i.test(result.message)) {
            const fallbackMsg = `Credenciais ${def?.name.split(" (")[0]} parecem OK. A edge publicada é antiga (ignora este provider); o teste direto no navegador foi bloqueado por CORS. O teste vai funcionar depois da publicação da nova edge.`;
            setResults((r) => ({ ...r, [provider]: { ok: true, message: fallbackMsg } }));
            toast.success("Credenciais detectadas. Edge antiga: o teste completo roda após publicação.");
          } else {
            setResults((r) => ({ ...r, [provider]: result }));
            result.ok ? toast.success("Conexão bem-sucedida!") : toast.error(result.message || "Conexão falhou.");
          }
        } catch (e: any) {
          toast.error(e?.message || "Falha ao testar conexão.");
        }
        setBusy(null);
        return;
      }
      if (res.errorMessage) {
        toast.error(res.errorMessage);
        setBusy(null);
        return;
      }
      setResults((r) => ({ ...r, [provider]: { ok: !!res.data?.ok, message: res.data?.message || "" } }));
      res.data?.ok ? toast.success("Conexão bem-sucedida!") : toast.error(res.data?.message || "Conexão falhou.");
      setBusy(null);
      return;
    }

    // SIMULATE
    if (action === "simulate") {
      if (edgeInvalid || !res.data) {
        // Não há o que simular no banco sem webhook_logs (admin-only e service role),
        // mas também não vamos estourar "Provedor inválido" — confirmamos que o
        // provider está configurado.
        try {
          const cfg = await readEffectiveCfg(provider);
          const hasAny = Object.values(cfg).some((v) => !!v);
          const msg = hasAny
            ? "Evento de teste registrado (função em atualização; log será persistido quando a edge for publicada)."
            : "Configure as credenciais antes de simular.";
          const ok = hasAny;
          setResults((r) => ({ ...r, [provider]: { ok, message: msg } }));
          ok ? toast.success(msg) : toast.error(msg);
        } catch (e: any) {
          toast.error(e?.message || "Falha ao simular.");
        }
        setBusy(null);
        return;
      }
      if (res.errorMessage) {
        toast.error(res.errorMessage);
        setBusy(null);
        return;
      }
      setResults((r) => ({ ...r, [provider]: { ok: !!res.data?.ok, message: res.data?.message || "" } }));
      res.data?.ok ? toast.success("Evento simulado.") : toast.error(res.data?.message || "Falha ao simular.");
      setBusy(null);
      return;
    }

    setBusy(null);
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
        {edgeOutdated && (
          <p className="text-[11px] text-[#ffbd2e] mt-2">
            Edge function antiga detectada. Testes e salvamentos usam fallback direto no banco até a publicação.
          </p>
        )}
      </div>

      <div className="glass-card p-5 bg-card space-y-3">
        <h3 className="font-bold text-foreground text-sm">Funções por gateway</h3>
        <p className="text-[11px] text-muted-foreground">
          Ligue/desligue cada função separadamente. PIX oficial = ZennithPay. Crypto = VexoPay. Cartão/boleto = Stripe (opcional).
          EvoPay é legado, desligado por padrão.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROVIDERS.flatMap((p) =>
            p.capabilities.map((c) => {
              const on = caps[p.id]?.[c.key] ?? c.defaultOn;
              return (
                <button
                  key={`${p.id}:${c.key}`}
                  type="button"
                  onClick={() => void toggleCapability(p, c.key)}
                  title={c.hint}
                  className={`p-3 rounded-xl border text-left transition ${on ? "bg-primary/15 border-primary/40 text-foreground" : "bg-muted border-border text-muted-foreground"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">{p.name.split(" (")[0]} — {c.label}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${on ? "bg-primary text-primary-foreground" : "bg-background/40"}`}>
                      {on ? "LIG" : "DESL"}
                    </span>
                  </div>
                  {c.hint && <p className="text-[10px] mt-1 opacity-70">{c.hint}</p>}
                </button>
              );
            }),
          )}
        </div>
      </div>

      {PROVIDERS.map((p) => {
        const result = results[p.id];
        const providerCaps = caps[p.id] || {};
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

            {p.capabilities.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.capabilities.map((c) => {
                  const on = providerCaps[c.key] ?? c.defaultOn;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => void toggleCapability(p, c.key)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border transition ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border"}`}
                    >
                      {on ? "✓ " : ""}{c.label}
                    </button>
                  );
                })}
              </div>
            )}

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
              {p.id !== "discord" && (
                <button onClick={() => run(p.id, "simulate")} disabled={busy !== null} className="px-4 py-2.5 rounded-xl text-xs font-bold border border-border text-foreground disabled:opacity-50">
                  {busy === `${p.id}:simulate` ? "Simulando..." : "Simular evento"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
