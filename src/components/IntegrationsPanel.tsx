import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, QrCode, CreditCard, Bitcoin, RefreshCw } from "lucide-react";

type Settings = {
  magnuspay: { pixEnabled: boolean; pixFee: number };
  zennithpay: { pixEnabled: boolean; pixFee: number };
  vexopay: { pixEnabled: boolean; cryptoEnabled: boolean; pixFee: number };
  stripe: { cardEnabled: boolean; boletoEnabled: boolean; boletoExpiresAfterDays: number };
};

const defaults: Settings = {
  magnuspay: { pixEnabled: true, pixFee: 0 },
  zennithpay: { pixEnabled: false, pixFee: 0.9 },
  vexopay: { pixEnabled: false, cryptoEnabled: false, pixFee: 1.2 },
  stripe: { cardEnabled: false, boletoEnabled: false, boletoExpiresAfterDays: 3 },
};

const card = "bg-[#121217] border border-white/10 rounded-2xl p-5";
const input = "w-full rounded-xl bg-[#0a0a0f] border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-[#0084ff]";

export default function IntegrationsPanel() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [secretStatus, setSecretStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("integrations-config", { body: { action: "get" } });
    setLoading(false);
    if (error || data?.error) return toast.error(data?.error || "Não foi possível carregar os gateways.");
    setSettings({ ...defaults, ...(data.integrations || {}) });
    setSecretStatus(data.secretStatus || {});
  };

  useEffect(() => { void load(); }, []);

  const save = async (provider: keyof Settings) => {
    setBusy(provider);
    const { data, error } = await supabase.functions.invoke("integrations-config", {
      body: { action: "save", provider, values: settings[provider] },
    });
    setBusy(null);
    if (error || data?.error) return toast.error(data?.error || "Falha ao salvar.");
    toast.success("Configuração de pagamento salva.");
    await load();
  };

  const test = async (provider: keyof Settings) => {
    setBusy(`${provider}:test`);
    const { data, error } = await supabase.functions.invoke("integrations-config", { body: { action: "test", provider } });
    setBusy(null);
    if (error || data?.error) return toast.error(data?.error || "Falha no teste.");
    setResults((r) => ({ ...r, [provider]: { ok: !!data.ok, message: data.message || "" } }));
  };

  const status = (key: string) => secretStatus[key] ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400"><CheckCircle2 className="w-3 h-3" /> credencial instalada</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400"><XCircle className="w-3 h-3" /> credencial ausente</span>
  );

  if (loading) return <div className={card+" flex items-center justify-center gap-2 text-white/40"}><Loader2 className="w-4 h-4 animate-spin" /> Carregando gateways...</div>;

  return (
    <div className="space-y-4 text-white">
      <div className={card+" bg-[#0084ff]/5 border-[#0084ff]/20"}>
        <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#0084ff]" /><h3 className="font-black">Pagamentos e gateways</h3></div>
        <p className="text-xs text-white/45 mt-2 leading-relaxed">
          Ative métodos e configure taxas aqui. Chaves secretas ficam somente nos Secrets do Supabase e nunca são devolvidas ao navegador.
          O Pix principal usa MagnusPay quando a chave <code className="text-white/70">MAGNUSPAY_API_KEY</code> está instalada.
        </p>
        <button onClick={load} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[#0084ff]"><RefreshCw className="w-3.5 h-3.5" /> Atualizar status</button>
      </div>

      <div className={card}>
        <div className="flex items-start justify-between gap-3">
          <div><div className="flex items-center gap-2"><QrCode className="w-5 h-5 text-[#0084ff]" /><h3 className="font-black">MagnusPay · Pix principal</h3></div><div className="mt-1">{status("MAGNUSPAY_API_KEY")}</div></div>
          <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={settings.magnuspay.pixEnabled} onChange={e=>setSettings(s=>({...s,magnuspay:{...s.magnuspay,pixEnabled:e.target.checked}}))} /> Ativo</label>
        </div>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <label><span className="text-[10px] text-white/40 font-bold uppercase">Taxa adicional Pix (R$)</span><input type="number" min="0" step="0.01" className={input+" mt-1"} value={settings.magnuspay.pixFee} onChange={e=>setSettings(s=>({...s,magnuspay:{...s.magnuspay,pixFee:Number(e.target.value)}}))} /></label>
          <div className="rounded-xl border border-white/10 bg-[#0a0a0f] p-3 text-xs text-white/45">
            Endpoint protegido no servidor. O pagamento só é liberado após conferir ID, valor e status com a MagnusPay.
          </div>
        </div>
        {results.magnuspay && <p className={`mt-3 text-xs ${results.magnuspay.ok?"text-emerald-400":"text-red-400"}`}>{results.magnuspay.message}</p>}
        <div className="flex gap-2 mt-4">
          <button disabled={!!busy} onClick={()=>void save("magnuspay")} className="bg-[#0084ff] px-4 py-2.5 rounded-xl text-xs font-black disabled:opacity-50">{busy==="magnuspay"?"Salvando...":"Salvar MagnusPay"}</button>
          <button disabled={!!busy} onClick={()=>void test("magnuspay")} className="border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50">{busy==="magnuspay:test"?"Testando...":"Testar chave"}</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className={card}>
          <div className="flex items-center gap-2"><Bitcoin className="w-5 h-5 text-amber-400" /><h3 className="font-black">VexoPay</h3></div>
          <div className="mt-1">{status("VEXOPAY_CLIENT_ID")} {status("VEXOPAY_CLIENT_SECRET")}</div>
          <div className="mt-4 space-y-3 text-xs">
            <label className="flex items-center justify-between"><span>Pix alternativo</span><input type="checkbox" checked={settings.vexopay.pixEnabled} onChange={e=>setSettings(s=>({...s,vexopay:{...s.vexopay,pixEnabled:e.target.checked}}))} /></label>
            <label className="flex items-center justify-between"><span>Crypto</span><input type="checkbox" checked={settings.vexopay.cryptoEnabled} onChange={e=>setSettings(s=>({...s,vexopay:{...s.vexopay,cryptoEnabled:e.target.checked}}))} /></label>
            <label><span className="text-white/40">Taxa Pix (R$)</span><input className={input+" mt-1"} type="number" min="0" step="0.01" value={settings.vexopay.pixFee} onChange={e=>setSettings(s=>({...s,vexopay:{...s.vexopay,pixFee:Number(e.target.value)}}))} /></label>
          </div>
          <button onClick={()=>void save("vexopay")} disabled={!!busy} className="mt-4 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold">Salvar</button>
        </div>

        <div className={card}>
          <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-violet-400" /><h3 className="font-black">Stripe</h3></div>
          <div className="mt-1">{status("STRIPE_SECRET_KEY")} {status("STRIPE_WEBHOOK_SECRET")}</div>
          <div className="mt-4 space-y-3 text-xs">
            <label className="flex items-center justify-between"><span>Cartão</span><input type="checkbox" checked={settings.stripe.cardEnabled} onChange={e=>setSettings(s=>({...s,stripe:{...s.stripe,cardEnabled:e.target.checked}}))} /></label>
            <label className="flex items-center justify-between"><span>Boleto</span><input type="checkbox" checked={settings.stripe.boletoEnabled} onChange={e=>setSettings(s=>({...s,stripe:{...s.stripe,boletoEnabled:e.target.checked}}))} /></label>
            <label><span className="text-white/40">Expiração boleto (dias)</span><input className={input+" mt-1"} type="number" min="1" max="60" value={settings.stripe.boletoExpiresAfterDays} onChange={e=>setSettings(s=>({...s,stripe:{...s.stripe,boletoExpiresAfterDays:Number(e.target.value)}}))} /></label>
          </div>
          <button onClick={()=>void save("stripe")} disabled={!!busy} className="mt-4 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold">Salvar</button>
        </div>
      </div>

      <div className={card+" opacity-80"}>
        <h3 className="font-black text-sm">ZennithPay</h3>
        <p className="text-xs text-white/40 mt-1">Gateway Pix alternativo. Apenas um provedor Pix fica ativo por vez para evitar checkout ambíguo.</p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={settings.zennithpay.pixEnabled} onChange={e=>setSettings(s=>({...s,zennithpay:{...s.zennithpay,pixEnabled:e.target.checked}}))} /> Ativar Pix</label>
          <button onClick={()=>void save("zennithpay")} disabled={!!busy} className="border border-white/10 px-4 py-2 rounded-xl text-xs font-bold">Salvar</button>
        </div>
      </div>
    </div>
  );
}
