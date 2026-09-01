import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCircle2, ChevronDown, CircleAlert, EyeOff, Link2, Loader2, PauseCircle, PlayCircle, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { unwrapEdgeCall } from "@/lib/edgeErrors";

type EventType = "sale_confirmed" | "product_question" | "product_review";
type DeliveryStatus = "not_sent" | "sent" | "rate_limited" | "disabled_not_found" | "failed";
type WebhookState = {
  event_type: EventType;
  active: boolean;
  last_delivery_status: DeliveryStatus;
  last_delivery_at: string | null;
  updated_at: string;
};

const EVENTS: Array<{ type: EventType; title: string; description: string }> = [
  { type: "sale_confirmed", title: "Venda confirmada", description: "Aviso enviado somente depois da confirmação de pagamento pelo servidor." },
  { type: "product_question", title: "Nova pergunta", description: "Aviso sobre uma nova pergunta enviada em anúncio aprovado." },
  { type: "product_review", title: "Nova avaliação", description: "Aviso sobre avaliação vinculada a um pedido válido e concluído." },
];

const statusText: Record<DeliveryStatus, string> = {
  not_sent: "Aguardando primeiro evento",
  sent: "Último aviso entregue",
  rate_limited: "Entrega aguardando limite do Discord",
  disabled_not_found: "Destino removido ou indisponível",
  failed: "Última entrega requer revisão",
};

const statusTone: Record<DeliveryStatus, string> = {
  not_sent: "border-white/10 bg-white/[0.04] text-white/55",
  sent: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  rate_limited: "border-amber-300/20 bg-amber-300/10 text-amber-100",
  disabled_not_found: "border-red-300/20 bg-red-400/10 text-red-100",
  failed: "border-red-300/20 bg-red-400/10 text-red-100",
};

const formatDate = (raw: string | null | undefined) => {
  if (!raw) return "Ainda não configurado";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "Data indisponível" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export default function DiscordWebhookSettings() {
  const [webhooks, setWebhooks] = useState<Record<EventType, WebhookState | null>>({ sale_confirmed: null, product_question: null, product_review: null });
  const [drafts, setDrafts] = useState<Record<EventType, string>>({ sale_confirmed: "", product_question: "", product_review: "" });
  const [editing, setEditing] = useState<Record<EventType, boolean>>({ sale_confirmed: false, product_question: false, product_review: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<EventType | null>(null);

  const configuredCount = useMemo(() => EVENTS.filter(({ type }) => Boolean(webhooks[type])).length, [webhooks]);

  const load = async () => {
    setLoading(true);
    const result = await unwrapEdgeCall<{ webhooks?: WebhookState[] }>(
      await supabase.functions.invoke("manage-discord-webhooks", { body: { action: "list" } }),
      "Não foi possível carregar suas integrações.",
    );
    if (result.errorMessage) {
      toast.error(result.errorMessage);
      setLoading(false);
      return;
    }
    const next: Record<EventType, WebhookState | null> = { sale_confirmed: null, product_question: null, product_review: null };
    for (const item of result.data?.webhooks || []) {
      if (item?.event_type in next) next[item.event_type] = item;
    }
    setWebhooks(next);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const save = async (eventType: EventType) => {
    const candidate = drafts[eventType].trim();
    if (!candidate) return toast.error("Informe a URL do webhook para este evento.");
    setBusy(eventType);
    const result = await unwrapEdgeCall<{ webhook?: WebhookState }>(
      await supabase.functions.invoke("manage-discord-webhooks", { body: { action: "set", eventType, webhookUrl: candidate } }),
      "Não foi possível salvar essa integração.",
    );
    setBusy(null);
    if (result.errorMessage || !result.data?.webhook) return toast.error(result.errorMessage || "Não foi possível confirmar a integração.");
    setDrafts((current) => ({ ...current, [eventType]: "" }));
    setEditing((current) => ({ ...current, [eventType]: false }));
    setWebhooks((current) => ({ ...current, [eventType]: result.data!.webhook! }));
    toast.success("Destino salvo. A URL não será exibida novamente.");
  };

  const toggle = async (eventType: EventType, active: boolean) => {
    setBusy(eventType);
    const result = await unwrapEdgeCall<{ webhook?: WebhookState }>(
      await supabase.functions.invoke("manage-discord-webhooks", { body: { action: "toggle", eventType, active } }),
      "Não foi possível atualizar essa integração.",
    );
    setBusy(null);
    if (result.errorMessage || !result.data?.webhook) return toast.error(result.errorMessage || "Não foi possível confirmar a atualização.");
    setWebhooks((current) => ({ ...current, [eventType]: result.data!.webhook! }));
    toast.success(active ? "Notificação reativada." : "Notificação pausada.");
  };

  const remove = async (eventType: EventType) => {
    if (!window.confirm("Remover este destino? A URL deixará de ser usada e não poderá ser exibida novamente.")) return;
    setBusy(eventType);
    const result = await unwrapEdgeCall<{ webhook?: { removed?: boolean } }>(
      await supabase.functions.invoke("manage-discord-webhooks", { body: { action: "remove", eventType } }),
      "Não foi possível remover essa integração.",
    );
    setBusy(null);
    if (result.errorMessage) return toast.error(result.errorMessage);
    setDrafts((current) => ({ ...current, [eventType]: "" }));
    setEditing((current) => ({ ...current, [eventType]: false }));
    setWebhooks((current) => ({ ...current, [eventType]: null }));
    toast.success("Destino removido.");
  };

  if (loading) return <div className="mt-5 grid min-h-40 place-items-center rounded-2xl border border-white/[0.08] bg-[#11131a] text-sm text-white/50"><span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Carregando integrações…</span></div>;

  return (
    <section id="integracoes" className="mt-5 rounded-2xl border border-white/[0.08] bg-[#11131a] p-5 sm:p-6" aria-labelledby="discord-integrations-title">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#5865f2]/15 text-[#aeb5ff]"><BellRing className="h-5 w-5" /></span><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#aeb5ff]">Integrações pessoais</p><h2 id="discord-integrations-title" className="mt-1 font-black text-white">Avisos no Discord</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/45">Configure um destino para cada evento. Você pode repetir a mesma URL em mais de um cartão quando quiser receber avisos no mesmo canal.</p></div></div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/62"><ShieldCheck className="h-3.5 w-3.5 text-[#75c5ff]" />{configuredCount}/3 configurados</span>
      </div>

      <div className="mt-5 rounded-xl border border-[#5865f2]/20 bg-[#5865f2]/[0.07] p-4 text-xs leading-relaxed text-white/62"><div className="flex items-center gap-2 font-bold text-white"><EyeOff className="h-4 w-4 text-[#aeb5ff]" />A URL é tratada como segredo</div><p className="mt-1.5">Depois de salvar, a URL não é mostrada novamente. O aviso parte somente do servidor, após um evento válido. O teste de envio continua desativado nesta etapa para não publicar mensagens externas sem confirmação explícita.</p></div>

      <div className="mt-5 space-y-3">
        {EVENTS.map((event) => {
          const current = webhooks[event.type];
          const isBusy = busy === event.type;
          const showForm = !current || editing[event.type];
          return (
            <article key={event.type} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h3 className="font-black text-white">{event.title}</h3><p className="mt-1 max-w-xl text-xs leading-relaxed text-white/45">{event.description}</p></div>{current ? <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusTone[current.last_delivery_status]}`}>{current.last_delivery_status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />}{statusText[current.last_delivery_status]}</span> : <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-white/48"><ChevronDown className="h-3.5 w-3.5" />Não configurado</span>}</div>

              {current && !showForm && <div className="mt-4 grid gap-3 border-t border-white/[0.07] pt-4 sm:grid-cols-[1fr_auto]"><div className="text-xs text-white/43"><p>Atualizado em <span className="font-semibold text-white/68">{formatDate(current.updated_at)}</span></p><p className="mt-1">Última tentativa: <span className="font-semibold text-white/68">{formatDate(current.last_delivery_at)}</span></p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void toggle(event.type, !current.active)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] px-3 py-2 text-xs font-bold text-white transition hover:border-[#75c5ff]/40 disabled:opacity-50">{isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : current.active ? <PauseCircle className="h-3.5 w-3.5" /> : <PlayCircle className="h-3.5 w-3.5" />}{current.active ? "Pausar" : "Ativar"}</button><button type="button" onClick={() => setEditing((value) => ({ ...value, [event.type]: true }))} disabled={isBusy} className="rounded-lg border border-white/[0.12] px-3 py-2 text-xs font-bold text-white transition hover:border-[#75c5ff]/40 disabled:opacity-50">Trocar URL</button><button type="button" onClick={() => void remove(event.type)} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300/20 bg-red-400/[0.06] px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-400/10 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Remover</button></div></div>}

              {showForm && <form onSubmit={(submit) => { submit.preventDefault(); void save(event.type); }} className="mt-4 border-t border-white/[0.07] pt-4"><label className="block text-xs font-bold text-white/68">URL do webhook Discord<input type="url" autoComplete="off" autoCapitalize="none" spellCheck={false} value={drafts[event.type]} onChange={(change) => setDrafts((current) => ({ ...current, [event.type]: change.target.value }))} className="mt-1.5 w-full rounded-xl border border-[#292c36] bg-[#0c0e14] px-3.5 py-3 font-mono text-xs text-white outline-none transition placeholder:text-white/28 focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/20" placeholder="https://discord.com/api/webhooks/…" aria-describedby={`${event.type}-help`} /></label><p id={`${event.type}-help`} className="mt-2 text-[11px] leading-relaxed text-white/38">Cole uma URL HTTPS de webhook criada para o canal desejado. O valor é enviado uma única vez para armazenamento protegido e é removido deste campo ao salvar.</p><div className="mt-3 flex flex-wrap gap-2"><button type="submit" disabled={isBusy} className="inline-flex items-center gap-2 rounded-lg bg-[#5865f2] px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-[#4752c4] disabled:opacity-50">{isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}{current ? "Salvar nova URL" : "Salvar destino"}</button>{current && <button type="button" onClick={() => { setEditing((value) => ({ ...value, [event.type]: false })); setDrafts((value) => ({ ...value, [event.type]: "" })); }} disabled={isBusy} className="rounded-lg border border-white/[0.12] px-3.5 py-2.5 text-xs font-bold text-white/70 transition hover:text-white disabled:opacity-50">Cancelar</button>}</div></form>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
