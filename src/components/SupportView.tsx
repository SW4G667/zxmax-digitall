import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Headphones,
  LifeBuoy,
  MessageCircle,
  Package,
  Send,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/StoreContext";
import { useSiteBranding } from "@/context/SiteBrandingContext";

const CATEGORIES = [
  "Compra ou entrega",
  "Pagamento",
  "Saque ou carteira",
  "Anúncio ou venda",
  "Conta ou segurança",
  "Outro assunto",
];

const FAQ = [
  {
    title: "Meu pagamento ainda aparece como pendente",
    body: "Abra o pedido em Meus pedidos e use a atualização de pagamento disponível nele. Não envie outro pagamento para o mesmo pedido enquanto o primeiro ainda estiver em análise.",
  },
  {
    title: "Não recebi o produto",
    body: "Entre em Meus pedidos e abra a conversa do pedido. Se a entrega não for resolvida pelo vendedor, use a disputa dentro do próprio pedido para manter todo o histórico vinculado à compra.",
  },
  {
    title: "Quero anunciar na ZXMAX",
    body: "Para publicar um anúncio, a conta precisa ter o e-mail confirmado e a conta do Discord vinculada precisa estar no servidor oficial. Número de telefone não é requisito para anunciar.",
  },
  {
    title: "Para que servem CPF, RG e selfie?",
    body: "Esses dados são usados somente nos fluxos de verificação financeira, como carteira e saque. Eles não são exigidos para criar um anúncio e não são exibidos publicamente.",
  },
];

export default function SupportView() {
  const { state, addTicket, replyTicket, closeTicket } = useStore();
  const { branding } = useSiteBranding();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [sending, setSending] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const discordInvite = branding.discordInviteUrl || state.config.discordLink || "https://discord.gg/zxmax";
  const externalSupport = branding.supportUrl || "";

  const myTickets = useMemo(
    () => state.tickets
      .filter((ticket) => ticket.userId === state.currentUser?.id)
      .sort((a, b) => {
        const aDate = new Date(a.messages.at(-1)?.date || 0).getTime();
        const bDate = new Date(b.messages.at(-1)?.date || 0).getTime();
        return bDate - aDate;
      }),
    [state.tickets, state.currentUser?.id],
  );
  const active = myTickets.find((ticket) => ticket.id === selectedTicket);
  const openCount = myTickets.filter((ticket) => ticket.status === "open").length;

  const handleCreate = async () => {
    if (!state.currentUser) {
      toast.error("Entre na sua conta para abrir um atendimento.");
      return;
    }
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    if (!cleanSubject || cleanMessage.length < 10) {
      toast.error("Informe o assunto e descreva o problema com pelo menos 10 caracteres.");
      return;
    }

    setSending(true);
    const ok = await addTicket(`[${category}] ${cleanSubject}`, cleanMessage);
    setSending(false);
    if (!ok) {
      toast.error("Não foi possível abrir o atendimento. Tente novamente.");
      return;
    }

    toast.success("Atendimento aberto e salvo.");
    setSubject("");
    setMessage("");
    setCategory(CATEGORIES[0]);
    setShowNewTicket(false);
  };

  const handleReply = async () => {
    if (!active || active.status !== "open" || !reply.trim() || sending) return;
    const text = reply.trim();
    setSending(true);
    const ok = await replyTicket(active.id, text);
    setSending(false);
    if (!ok) {
      toast.error("Não foi possível enviar a mensagem.");
      return;
    }
    setReply("");
  };

  const handleClose = async () => {
    if (!active || active.status !== "open") return;
    const ok = await closeTicket(active.id);
    ok ? toast.success("Atendimento finalizado.") : toast.error("Não foi possível finalizar o atendimento.");
  };

  if (selectedTicket !== null && active) {
    return (
      <div className="mx-auto max-w-3xl animate-fade-in-up pb-24">
        <button
          type="button"
          onClick={() => setSelectedTicket(null)}
          className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a Central de Ajuda
        </button>

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111114]">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] p-5">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--zx-accent)]">Atendimento #{active.id}</p>
              <h1 className="mt-1 truncate text-lg font-black text-white">{active.subject}</h1>
              <p className="mt-1 text-[11px] text-white/35">As mensagens deste atendimento ficam salvas na sua conta.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${active.status === "open" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-white/40"}`}>
                {active.status === "open" ? "EM ABERTO" : "FINALIZADO"}
              </span>
              {active.status === "open" ? (
                <button type="button" onClick={() => void handleClose()} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[10px] font-bold text-white/45 hover:bg-white/[0.04] hover:text-white">
                  Finalizar
                </button>
              ) : null}
            </div>
          </header>

          <div className="max-h-[58vh] min-h-[320px] overflow-y-auto p-4 sm:p-5">
            <div className="space-y-3">
              {active.messages.map((item, index) => {
                const isMe = item.from === state.currentUser?.email;
                return (
                  <div key={index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${isMe ? "rounded-br-md bg-[var(--zx-accent)] text-white" : "rounded-bl-md border border-white/[0.07] bg-white/[0.035] text-white/78"}`}>
                      <p className="mb-1 text-[9px] font-black uppercase tracking-wide opacity-60">{isMe ? "Você" : "Equipe ZXMAX"}</p>
                      <p className="whitespace-pre-wrap break-words leading-5">{item.text}</p>
                      <p className="mt-1.5 text-right text-[8px] opacity-45">{new Date(item.date).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <footer className="border-t border-white/[0.07] bg-[#0d0d10] p-4">
            {active.status === "open" ? (
              <div className="flex gap-2">
                <textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder="Escreva sua mensagem..."
                  rows={2}
                  maxLength={2000}
                  className="min-h-12 flex-1 resize-none rounded-xl border border-white/[0.09] bg-[#151519] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-[var(--zx-accent)]"
                />
                <button type="button" onClick={() => void handleReply()} disabled={sending || !reply.trim()} className="grid w-12 place-items-center rounded-xl bg-[var(--zx-accent)] text-white disabled:opacity-40" aria-label="Enviar resposta">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <p className="text-center text-xs text-white/35">Este atendimento foi finalizado. Abra um novo se precisar de outra ajuda.</p>
            )}
          </footer>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl animate-fade-in-up pb-24">
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#101013]">
        <div className="relative p-5 sm:p-7">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[var(--zx-accent)]/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--zx-accent)]">Central de ajuda</p>
              <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">Resolva rápido ou fale com a equipe</h1>
              <p className="mt-2 text-xs leading-5 text-white/40">Pedidos, pagamentos, anúncios, carteira e conta ficam organizados por assunto. Para problemas de compra, mantenha a conversa e a disputa dentro do pedido.</p>
            </div>
            <div className="flex gap-2">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-center">
                <p className="text-xl font-black text-white">{myTickets.length}</p>
                <p className="text-[9px] font-bold uppercase text-white/30">Atendimentos</p>
              </div>
              <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] px-4 py-3 text-center">
                <p className="text-xl font-black text-emerald-300">{openCount}</p>
                <p className="text-[9px] font-bold uppercase text-white/30">Em aberto</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => setShowNewTicket(true)} className="rounded-2xl border border-white/[0.08] bg-[#111114] p-4 text-left transition hover:border-[var(--zx-accent)]/30 hover:bg-white/[0.025]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--zx-accent)]/10 text-[var(--zx-accent)]"><Headphones className="h-4 w-4" /></span>
          <p className="mt-3 text-sm font-black text-white">Abrir atendimento</p>
          <p className="mt-1 text-[10px] leading-4 text-white/34">Fale com a equipe e mantenha o histórico salvo.</p>
        </button>

        <Link to="/minhas-compras" className="rounded-2xl border border-white/[0.08] bg-[#111114] p-4 text-left transition hover:border-white/[0.15] hover:bg-white/[0.025]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/10 text-amber-300"><ShoppingBag className="h-4 w-4" /></span>
          <p className="mt-3 text-sm font-black text-white">Problema com pedido</p>
          <p className="mt-1 text-[10px] leading-4 text-white/34">Pagamento, entrega, chat ou disputa da compra.</p>
        </Link>

        <Link to="/meus-produtos" className="rounded-2xl border border-white/[0.08] bg-[#111114] p-4 text-left transition hover:border-white/[0.15] hover:bg-white/[0.025]">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/10 text-emerald-300"><Package className="h-4 w-4" /></span>
          <p className="mt-3 text-sm font-black text-white">Sou vendedor</p>
          <p className="mt-1 text-[10px] leading-4 text-white/34">Anúncios, vendas, entrega e acesso ao Discord.</p>
        </Link>

        <a href={discordInvite} target="_blank" rel="noreferrer" className="rounded-2xl border border-[#5865f2]/20 bg-[#5865f2]/[0.055] p-4 text-left transition hover:border-[#5865f2]/40 hover:bg-[#5865f2]/10">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#5865f2]/15 text-[#aeb4ff]"><Users className="h-4 w-4" /></span>
          <p className="mt-3 flex items-center gap-1.5 text-sm font-black text-white">Servidor do Discord <ExternalLink className="h-3 w-3 text-white/30" /></p>
          <p className="mt-1 text-[10px] leading-4 text-white/34">Entre na comunidade oficial configurada pela administração.</p>
        </a>
      </div>

      {externalSupport ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <div>
            <p className="text-xs font-bold text-white/70">Canal externo de suporte</p>
            <p className="mt-0.5 text-[10px] text-white/30">A administração também disponibilizou um canal externo.</p>
          </div>
          <a href={externalSupport} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[var(--zx-accent)]">Abrir <ExternalLink className="h-3 w-3" /></a>
        </div>
      ) : null}

      {showNewTicket ? (
        <section className="mt-5 rounded-2xl border border-[var(--zx-accent)]/20 bg-[#111114] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--zx-accent)]">Novo atendimento</p>
              <h2 className="mt-1 text-lg font-black text-white">Explique o que aconteceu</h2>
              <p className="mt-1 text-[11px] text-white/35">Inclua o ID do pedido ou anúncio quando houver. Não envie senha, código 2FA ou chave privada.</p>
            </div>
            <button type="button" onClick={() => setShowNewTicket(false)} className="rounded-lg p-2 text-white/35 hover:bg-white/[0.04] hover:text-white" aria-label="Fechar formulário"><X className="h-4 w-4" /></button>
          </div>

          {!state.currentUser ? (
            <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
              <p className="text-xs text-amber-100/80">Entre na sua conta para abrir e acompanhar um atendimento.</p>
              <Link to="/loja?login=1" className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-black">Entrar</Link>
            </div>
          ) : (
            <div className="mt-5 grid gap-3">
              <label className="text-[10px] font-bold uppercase tracking-wide text-white/35">Categoria
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-[#0c0c10] px-3.5 py-3 text-sm text-white outline-none focus:border-[var(--zx-accent)]">
                  {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-white/35">Assunto
                <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} placeholder="Ex.: pagamento do pedido #123 não atualizou" className="mt-1.5 w-full rounded-xl border border-white/[0.09] bg-[#0c0c10] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/22 focus:border-[var(--zx-accent)]" />
              </label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-white/35">Descrição
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={5} placeholder="Conte o que você fez, o que esperava acontecer e o que apareceu na tela." className="mt-1.5 w-full resize-none rounded-xl border border-white/[0.09] bg-[#0c0c10] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/22 focus:border-[var(--zx-accent)]" />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10px] text-white/28"><ShieldCheck className="h-3.5 w-3.5" /> Nunca envie senha ou código de autenticação.</p>
                <button type="button" onClick={() => void handleCreate()} disabled={sending || !subject.trim() || message.trim().length < 10} className="inline-flex items-center gap-2 rounded-xl bg-[var(--zx-accent)] px-5 py-3 text-xs font-black text-white disabled:opacity-40">
                  {sending ? "Enviando..." : "Abrir atendimento"} <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-white">Meus atendimentos</h2>
              <p className="mt-1 text-[10px] text-white/30">Histórico salvo da sua conta.</p>
            </div>
            {!showNewTicket ? <button type="button" onClick={() => setShowNewTicket(true)} className="text-[11px] font-bold text-[var(--zx-accent)]">+ Novo</button> : null}
          </div>

          {myTickets.length ? (
            <div className="space-y-2">
              {myTickets.map((ticket) => {
                const last = ticket.messages.at(-1);
                return (
                  <button key={ticket.id} type="button" onClick={() => setSelectedTicket(ticket.id)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-[#111114] p-4 text-left transition hover:border-white/[0.14] hover:bg-white/[0.025]">
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ticket.status === "open" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.04] text-white/30"}`}>
                      {ticket.status === "open" ? <MessageCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold text-white">{ticket.subject}</span>
                      <span className="mt-1 block truncate text-[10px] text-white/30">{last?.text || "Sem mensagens"}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={`block text-[9px] font-black uppercase ${ticket.status === "open" ? "text-emerald-300" : "text-white/30"}`}>{ticket.status === "open" ? "Aberto" : "Finalizado"}</span>
                      <span className="mt-1 block text-[8px] text-white/20">{last?.date ? new Date(last.date).toLocaleDateString("pt-BR") : ""}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.09] bg-white/[0.015] px-6 py-10 text-center">
              <LifeBuoy className="mx-auto h-6 w-6 text-white/16" />
              <p className="mt-3 text-xs font-bold text-white/50">Nenhum atendimento ainda</p>
              <p className="mt-1 text-[10px] text-white/25">Quando você abrir um chamado, ele aparecerá aqui.</p>
            </div>
          )}
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-sm font-black text-white">Dúvidas rápidas</h2>
            <p className="mt-1 text-[10px] text-white/30">Respostas sobre os fluxos principais.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111114]">
            {FAQ.map((item, index) => {
              const open = openFaq === index;
              return (
                <div key={item.title} className="border-b border-white/[0.06] last:border-b-0">
                  <button type="button" onClick={() => setOpenFaq(open ? null : index)} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
                    <span className="text-xs font-bold text-white/70">{item.title}</span>
                    {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/30" />}
                  </button>
                  {open ? <p className="px-4 pb-4 text-[10px] leading-5 text-white/38">{item.body}</p> : null}
                </div>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-4">
            <p className="flex items-center gap-2 text-xs font-bold text-amber-100/75"><AlertTriangle className="h-4 w-4" /> Compra com problema?</p>
            <p className="mt-1 text-[10px] leading-4 text-white/32">Prefira o chat e a disputa do próprio pedido. Isso mantém produto, comprador, vendedor e histórico vinculados ao caso.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
