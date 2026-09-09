import { useEffect, useState } from "react";
import { BadgeCheck, KeyRound, Loader2, ShieldCheck, Power, PowerOff, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { unwrapEdgeCall } from "@/lib/edgeErrors";
import { toast } from "sonner";

type GatewayConfig = {
  pixEnabled?: boolean;
  cryptoEnabled?: boolean;
  pixFee?: number;
  withdrawalsEnabled?: boolean;
};

type StripeConfig = {
  cardEnabled?: boolean;
  boletoEnabled?: boolean;
  boletoExpiresAfterDays?: number;
};

type DiscordOAuthStatus = {
  enabled?: boolean;
  providerCallback?: string;
  appCallback?: string;
};

type Provider = {
  id: "evopay" | "zennithpay" | "vexopay";
  name: string;
  description: string;
  secretNames: string[];
  supportsCrypto?: boolean;
  supportsWithdraw?: boolean;
  docUrl?: string;
};

const PROVIDERS: Provider[] = [
  {
    id: "evopay",
    name: "Evopay PIX (Recomendado)",
    description: "Gateway Evopay - PIX com saque automático e reembolso direto para o banco do comprador. Taxa configurável aplicada no checkout.",
    secretNames: ["EVOPAY_API_KEY"],
    supportsWithdraw: true,
    docUrl: "https://docs.partners.evopay.cash/pt",
  },
  {
    id: "zennithpay",
    name: "ZennithPay PIX",
    description: "Método PIX independente. A taxa exibida é aplicada pelo servidor ao criar o pedido.",
    secretNames: ["ZENNITH_API_KEY", "ZENNITH_WEBHOOK_SECRET"],
  },
  {
    id: "vexopay",
    name: "VexoPay PIX e Crypto",
    description: "Permite PIX como opção distinta e mantém Crypto separado no checkout.",
    secretNames: ["VEXOPAY_CLIENT_ID", "VEXOPAY_CLIENT_SECRET", "VEXOPAY_WEBHOOK_SECRET"],
    supportsCrypto: true,
  },
];

const emptyConfig: Record<Provider["id"], GatewayConfig> = {
  evopay: { pixEnabled: false, pixFee: 0.9, withdrawalsEnabled: true },
  zennithpay: { pixEnabled: false, pixFee: 0.9 },
  vexopay: { pixEnabled: false, cryptoEnabled: false, pixFee: 1.2 },
};

export default function IntegrationsPanel() {
  const [configs, setConfigs] = useState<Record<Provider["id"], GatewayConfig>>(emptyConfig);
  const [stripe, setStripe] = useState<StripeConfig>({ cardEnabled: false, boletoEnabled: false, boletoExpiresAfterDays: 3 });
  const [discord, setDiscord] = useState<DiscordOAuthStatus>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [secretStatus, setSecretStatus] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const result = await unwrapEdgeCall<{ integrations?: Record<string, GatewayConfig & StripeConfig>; secretStatus?: Record<string, boolean>; discord?: DiscordOAuthStatus }>(
      await supabase.functions.invoke("integrations-config", { body: { action: "get" } }),
      "Não foi possível carregar a configuração de pagamentos.",
    );
    if (result.errorMessage) toast.error(result.errorMessage);
    const received = result.data?.integrations || {};
    setConfigs({
      evopay: { ...emptyConfig.evopay, ...(received.evopay || {}) },
      zennithpay: { ...emptyConfig.zennithpay, ...(received.zennithpay || {}) },
      vexopay: { ...emptyConfig.vexopay, ...(received.vexopay || {}) },
    });
    setStripe({ cardEnabled: false, boletoEnabled: false, boletoExpiresAfterDays: 3, ...(received.stripe || {}) });
    setSecretStatus(result.data?.secretStatus || {});
    setDiscord(result.data?.discord || {});
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const update = (id: Provider["id"], key: keyof GatewayConfig, value: string | boolean) => {
    setConfigs((current) => {
      const next = { ...current, [id]: { ...current[id], [key]: value } };
      if (key === "pixEnabled" && value === true) {
        const others = PROVIDERS.filter(p => p.id !== id).map(p => p.id);
        for (const other of others) {
          next[other] = { ...next[other], pixEnabled: false };
        }
      }
      return next;
    });
  };

  const save = async (provider: Provider) => {
    setBusy(`${provider.id}:save`);
    try {
      const result = await unwrapEdgeCall<{ saved?: boolean }>(
        await supabase.functions.invoke("integrations-config", { body: { action: "save", provider: provider.id, values: configs[provider.id] } }),
        "Não foi possível salvar a configuração do gateway.",
      );
      if (result.errorMessage || !result.data?.saved) throw new Error(result.errorMessage || "A configuração não foi salva.");
      toast.success(`${provider.name} atualizado.`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  };

  const activateProvider = async (provider: Provider) => {
    // Ativa este provedor como PIX único
    setBusy(`${provider.id}:activate`);
    try {
      const values = { ...configs[provider.id], pixEnabled: true };
      const result = await unwrapEdgeCall<{ saved?: boolean }>(
        await supabase.functions.invoke("integrations-config", { body: { action: "save", provider: provider.id, values } }),
        "Não foi possível ativar o gateway.",
      );
      if (result.errorMessage || !result.data?.saved) throw new Error(result.errorMessage || "A configuração não foi salva.");
      toast.success(`${provider.name} ATIVADO como PIX único!`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível ativar.");
    } finally {
      setBusy(null);
    }
  };

  const deactivateProvider = async (provider: Provider) => {
    setBusy(`${provider.id}:deactivate`);
    try {
      const values = { ...configs[provider.id], pixEnabled: false };
      const result = await unwrapEdgeCall<{ saved?: boolean }>(
        await supabase.functions.invoke("integrations-config", { body: { action: "save", provider: provider.id, values } }),
        "Não foi possível desativar o gateway.",
      );
      if (result.errorMessage || !result.data?.saved) throw new Error(result.errorMessage || "A configuração não foi salva.");
      toast.success(`${provider.name} DESATIVADO.`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível desativar.");
    } finally {
      setBusy(null);
    }
  };

  const test = async (provider: Provider) => {
    setBusy(`${provider.id}:test`);
    try {
      const result = await unwrapEdgeCall<{ ok?: boolean; message?: string }>(
        await supabase.functions.invoke("integrations-config", { body: { action: "test", provider: provider.id } }),
        "Não foi possível testar a conexão.",
      );
      if (result.errorMessage || !result.data?.ok) throw new Error(result.errorMessage || result.data?.message || "Conexão indisponível.");
      toast.success(result.data.message || "Conexão verificada no servidor.");
    } catch (error: any) {
      toast.error(error?.message || "Teste não concluído.");
    } finally {
      setBusy(null);
    }
  };

  const saveStripe = async () => {
    setBusy("stripe:save");
    try {
      const result = await unwrapEdgeCall<{ saved?: boolean }>(
        await supabase.functions.invoke("integrations-config", { body: { action: "save", provider: "stripe", values: stripe } }),
        "Não foi possível salvar a configuração da Stripe.",
      );
      if (result.errorMessage || !result.data?.saved) throw new Error(result.errorMessage || "A configuração não foi salva.");
      toast.success("Stripe atualizada.");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar.");
    } finally {
      setBusy(null);
    }
  };

  const testStripe = async () => {
    setBusy("stripe:test");
    try {
      const result = await unwrapEdgeCall<{ ok?: boolean; message?: string }>(
        await supabase.functions.invoke("integrations-config", { body: { action: "test", provider: "stripe" } }),
        "Não foi possível testar a Stripe.",
      );
      if (result.errorMessage || !result.data?.ok) throw new Error(result.errorMessage || result.data?.message || "Conexão indisponível.");
      toast.success(result.data.message || "Stripe verificada no servidor.");
    } catch (error: any) {
      toast.error(error?.message || "Teste não concluído.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Carregando gateways…</div>;

  // Determina qual PIX está ativo no checkout (prioridade Evopay > Zennith > Vexo)
  const evopayReady = Boolean(secretStatus["EVOPAY_API_KEY"]);
  const zennithReady = Boolean(secretStatus["ZENNITH_API_KEY"]);
  const vexoReady = Boolean(secretStatus["VEXOPAY_CLIENT_ID"] && secretStatus["VEXOPAY_CLIENT_SECRET"]);
  const activePix = configs.evopay.pixEnabled && evopayReady ? "evopay" : configs.zennithpay.pixEnabled && zennithReady ? "zennithpay" : configs.vexopay.pixEnabled && vexoReady ? "vexopay" : null;

  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        <div className="flex gap-2 font-semibold"><ShieldCheck className="h-5 w-5 shrink-0" />Segredos permanecem fora do navegador</div>
        <p className="mt-1 text-amber-100/80">Este painel só administra disponibilidade e taxas. Escolha no máximo um provedor de PIX; ao habilitar um, os outros são desativados automaticamente. Evopay tem prioridade e inclui saque e reembolso automático. Chaves de gateways são lidas exclusivamente como secrets pelas funções Edge.</p>
      </div>

      <div className={`rounded-xl border p-4 text-sm ${activePix ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-red-500/30 bg-red-500/10 text-red-100"}`}>
        <div className="flex items-center gap-2 font-bold">
          {activePix ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          Status atual do PIX no checkout: {activePix ? `${PROVIDERS.find(p=>p.id===activePix)?.name} ATIVO` : "NENHUM PIX ATIVO - compradores não conseguem pagar"}
        </div>
        <p className="mt-1 text-xs opacity-80">
          {activePix ? "Compradores veem PIX no checkout e conseguem pagar." : "Ative um provedor abaixo para liberar pagamentos. Se nenhum estiver ativo, o checkout fica sem PIX."}
        </p>
      </div>

      <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100">
        <p className="font-semibold">Como configurar Evopay</p>
        <ol className="mt-2 list-decimal pl-5 space-y-1 text-blue-100/80 text-xs leading-5">
          <li>Crie conta em <a href="https://partners.evopay.cash" target="_blank" rel="noreferrer" className="underline">partners.evopay.cash</a> e gere um token com permissões <code>DEPOSIT</code> e <code>WITHDRAW</code>.</li>
          <li>No Supabase Dashboard → Edge Functions → Secrets, adicione <code>EVOPAY_API_KEY</code> com o token.</li>
          <li>Volte aqui, clique em <strong>ATIVAR Evopay</strong>. O callback será <code>/functions/v1/evopay-webhook</code> automaticamente.</li>
          <li>Use <strong>Testar no servidor</strong> para verificar se a secret foi detectada.</li>
        </ol>
      </div>

      {PROVIDERS.map((provider) => {
        const config = configs[provider.id];
        const ready = provider.secretNames.every((name) => secretStatus[name]);
        const isPixActive = config.pixEnabled === true;
        const isCurrentlyActiveInCheckout = activePix === provider.id;
        const isBusy = busy !== null;
        return (
          <article key={provider.id} className={`rounded-2xl border bg-card p-5 shadow-sm ${isCurrentlyActiveInCheckout ? "border-emerald-500/50 ring-1 ring-emerald-500/20" : "border-border"}`}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="flex-1">
                <h3 className="font-bold text-card-foreground flex items-center gap-2 flex-wrap">
                  {provider.name}
                  {provider.id === "evopay" && <span className="text-[10px] bg-blue-500 text-white px-2 py-0.5 rounded-full">RECOMENDADO</span>}
                  {isCurrentlyActiveInCheckout ? <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse">PIX ATIVO NO CHECKOUT</span> : isPixActive ? <span className="text-[10px] bg-amber-500 text-black px-2 py-0.5 rounded-full">MARCADO MAS SEM SECRET</span> : <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">INATIVO</span>}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{provider.description}</p>
                {provider.docUrl && <a href={provider.docUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline mt-1 inline-block">Documentação oficial</a>}
              </div>
              <div className="flex flex-col gap-2 items-end">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${ready ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600"}`}><BadgeCheck className="h-3.5 w-3.5" />{ready ? "Secrets detectados" : "Secrets pendentes"}</span>
                {isPixActive && <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${isCurrentlyActiveInCheckout ? "bg-emerald-500 text-white" : "bg-amber-500 text-black"}`}>{isCurrentlyActiveInCheckout ? "● ATIVO" : "○ INATIVO (sem secret?)"}</span>}
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-semibold text-foreground">Endpoint protegido</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {provider.id === "evopay" ? "Base: https://api.evopay.cash/v1 | PIX: /pix/ | Saque: /withdraw/ | Reembolso: /user/refund/{id} | Callback: /functions/v1/evopay-webhook" : "A rota oficial é fixada no servidor. O painel não aceita URLs arbitrárias nem armazena chaves."}
                </p>
              </div>
              <label className="space-y-1 text-sm font-medium">Taxa PIX para o comprador (R$)<input type="number" min="0" max="1000" step="0.01" value={config.pixFee ?? 0} onChange={(event) => update(provider.id, "pixFee", event.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
              {provider.supportsCrypto && <label className="flex items-center gap-2"><input type="checkbox" checked={config.cryptoEnabled === true} onChange={(event) => update(provider.id, "cryptoEnabled", event.target.checked)} />Oferecer Crypto via VexoPay</label>}
              {provider.supportsWithdraw && <label className="flex items-center gap-2"><input type="checkbox" checked={config.withdrawalsEnabled !== false} onChange={(event) => update(provider.id, "withdrawalsEnabled", event.target.checked)} />Habilitar saques via {provider.name.split(" ")[0]}</label>}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 items-center">
              {/* Botões principais ATIVAR / DESATIVAR */}
              {isPixActive ? (
                <button
                  type="button"
                  onClick={() => void deactivateProvider(provider)}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 shadow"
                >
                  <PowerOff className="h-4 w-4" />
                  {busy === `${provider.id}:deactivate` ? "Desativando…" : `DESATIVAR ${provider.name.split(" ")[0].toUpperCase()}`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void activateProvider(provider)}
                  disabled={isBusy || !ready}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50 shadow"
                  title={!ready ? "Configure a secret primeiro no Supabase" : "Ativar como PIX único"}
                >
                  <Power className="h-4 w-4" />
                  {busy === `${provider.id}:activate` ? "Ativando…" : `ATIVAR ${provider.name.split(" ")[0].toUpperCase()} COMO PIX ÚNICO`}
                </button>
              )}

              <button type="button" onClick={() => void save(provider)} disabled={isBusy} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">
                {busy === `${provider.id}:save` ? "Salvando…" : "Salvar taxa"}
              </button>

              <button type="button" onClick={() => void test(provider)} disabled={!ready || isBusy} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold disabled:opacity-50">
                <KeyRound className="h-4 w-4" />{busy === `${provider.id}:test` ? "Testando…" : "Testar no servidor"}
              </button>
            </div>

            {!ready && (
              <p className="mt-3 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                ⚠️ Para ATIVAR este gateway, configure primeiro {provider.secretNames.join(", ")} em Supabase → Edge Functions → Secrets. Depois clique em Testar.
              </p>
            )}
          </article>
        );
      })}

      {(() => {
        const ready = Boolean(secretStatus.STRIPE_SECRET_KEY && secretStatus.STRIPE_WEBHOOK_SECRET);
        return (
          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div><h3 className="font-bold text-card-foreground">Stripe · cartão e boleto</h3><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Checkout hospedado para cartão e boleto. A entrega é confirmada somente pelo webhook assinado; o retorno do navegador não libera pedidos.</p></div>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${ready ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}><BadgeCheck className="h-3.5 w-3.5" />{ready ? "Secrets e webhook detectados" : "Secrets/webhook pendentes"}</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stripe.cardEnabled === true} onChange={(event) => setStripe((current) => ({ ...current, cardEnabled: event.target.checked }))} />Oferecer cartão</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={stripe.boletoEnabled === true} onChange={(event) => setStripe((current) => ({ ...current, boletoEnabled: event.target.checked }))} />Oferecer boleto</label>
              <label className="text-sm font-medium">Validade do boleto (dias)<input type="number" min="0" max="60" value={stripe.boletoExpiresAfterDays ?? 3} onChange={(event) => setStripe((current) => ({ ...current, boletoExpiresAfterDays: Number(event.target.value) }))} className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2" /></label>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Configure <code>STRIPE_SECRET_KEY</code> e <code>STRIPE_WEBHOOK_SECRET</code> somente nos secrets da função. No Stripe, use <code>/functions/v1/stripe-webhook</code> e assine os eventos de Checkout concluído, pagamento assíncrono aprovado e pagamento assíncrono falho.</p>
            <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => void saveStripe()} disabled={busy !== null} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-50">{busy === "stripe:save" ? "Salvando…" : "Salvar configuração"}</button><button type="button" onClick={() => void testStripe()} disabled={!ready || busy !== null} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-bold disabled:opacity-50"><KeyRound className="h-4 w-4" />{busy === "stripe:test" ? "Testando…" : "Testar no servidor"}</button></div>
          </article>
        );
      })()}

      <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><h3 className="font-bold text-card-foreground">Discord OAuth</h3><p className="mt-1 max-w-2xl text-sm text-muted-foreground">O cliente inicia OAuth com PKCE pelo Supabase. Client ID e Client Secret pertencem somente ao Discord Developer Portal e ao Supabase Auth.</p></div>
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${discord.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}><BadgeCheck className="h-3.5 w-3.5" />{discord.enabled ? "Provedor habilitado" : "Provedor não habilitado"}</span>
        </div>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-xs leading-5 text-muted-foreground">
          <li>Crie ou abra a aplicação ZXMAX no Discord Developer Portal e cadastre o callback do provedor abaixo.</li>
          <li>No Supabase, vá em Authentication → Providers → Discord, habilite o provedor e informe Client ID e Client Secret.</li>
          <li>Em Authentication → URL Configuration, mantenha o callback da aplicação permitido para o retorno seguro da sessão.</li>
        </ol>
        <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-[11px] font-bold text-muted-foreground">Callback no Discord</p><code className="mt-1 block break-all text-xs text-foreground">{discord.providerCallback || "Carregando…"}</code></div><div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-[11px] font-bold text-muted-foreground">Callback permitido da aplicação</p><code className="mt-1 block break-all text-xs text-foreground">{discord.appCallback || "Carregando…"}</code></div></div>
        <div className="mt-5 flex flex-wrap gap-3"><a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer" className="rounded-lg border border-border px-4 py-2 text-sm font-bold">Abrir Discord Developer Portal</a><a href="https://supabase.com/dashboard/project/szvkktvubyhulzipcxfk/auth/providers" target="_blank" rel="noreferrer" className="rounded-lg border border-border px-4 py-2 text-sm font-bold\">Abrir Supabase Auth</a></div>
      </article>
    </section>
  );
}
