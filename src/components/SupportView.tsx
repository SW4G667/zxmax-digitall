import React, { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { HeadsetEmoji, ChatEmoji, ShieldEmoji } from "@/components/CustomEmojis";
import { Send, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function SupportView() {
  const { state, addTicket, replyTicket } = useStore();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [reply, setReply] = useState("");

  const myTickets = state.tickets.filter((t) => t.userEmail === state.currentUser?.email);
  const active = myTickets.find((t) => t.id === selectedTicket);

  const handleCreate = () => {
    if (!subject || !message) return toast.error("Preencha assunto e mensagem.");
    addTicket(subject, message);
    toast.success("Ticket criado!");
    setSubject("");
    setMessage("");
  };

  const handleReply = () => {
    if (!reply || !selectedTicket) return;
    replyTicket(selectedTicket, reply);
    setReply("");
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground">Suporte</h1>
          <HeadsetEmoji className="w-8 h-8" />
        </div>
        <p className="text-muted-foreground">Estamos aqui para ajudar.</p>
      </div>

      {!selectedTicket ? (
        <>
          <div className="space-y-3 mb-8">
            <div className="glass-card p-5 flex items-center gap-4 cursor-pointer" onClick={() => {}}>
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <ChatEmoji className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">Chat de Vendas</h4>
                <p className="text-sm text-muted-foreground">Fale com compradores e vendedores</p>
              </div>
            </div>
            <div className="glass-card p-5 flex items-center gap-4 cursor-pointer" onClick={() => {}}>
              <div className="w-12 h-12 bg-destructive/10 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">Abrir Disputa</h4>
                <p className="text-sm text-muted-foreground">Relate um problema com sua compra</p>
              </div>
            </div>
          </div>

          {/* New ticket */}
          <div className="glass-card p-6 mb-6">
            <h3 className="font-bold text-foreground mb-4">Novo Ticket</h3>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Assunto" className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm mb-3" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Descreva seu problema..." rows={3} className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm resize-none mb-3" />
            <button onClick={handleCreate} className="btn-gradient px-5 py-2.5 text-sm">Enviar</button>
          </div>

          {/* Ticket list */}
          {myTickets.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-foreground">Meus Tickets</h3>
              {myTickets.map((t) => (
                <div key={t.id} onClick={() => setSelectedTicket(t.id)} className="glass-card p-4 cursor-pointer flex justify-between items-center">
                  <div>
                    <p className="font-medium text-foreground text-sm">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">{t.messages.length} mensagens</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${t.status === "open" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {t.status === "open" ? "Aberto" : "Fechado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div>
          <button onClick={() => setSelectedTicket(null)} className="text-primary font-semibold text-sm mb-4">← Voltar</button>
          <div className="glass-card p-6">
            <h3 className="font-bold text-foreground mb-4">{active?.subject}</h3>
            <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
              {active?.messages.map((m, i) => (
                <div key={i} className={`p-3 rounded-2xl text-sm ${m.from === state.currentUser?.email ? "bg-primary/10 text-foreground ml-8" : "bg-muted text-foreground mr-8"}`}>
                  <p className="text-[10px] text-muted-foreground mb-1 font-semibold">{m.from === state.currentUser?.email ? "Você" : "Suporte"}</p>
                  <p>{m.text}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">{new Date(m.date).toLocaleString("pt-BR")}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Sua mensagem..." className="flex-1 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" onKeyDown={(e) => e.key === "Enter" && handleReply()} />
              <button onClick={handleReply} className="btn-gradient p-3"><Send className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
