import React, { useState } from "react";
import { useStore } from "@/store/StoreContext";
import { HeadsetEmoji, ChatEmoji, ShieldEmoji } from "@/components/CustomEmojis";
import { Send, AlertTriangle, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function SupportView() {
  const { state, addTicket, replyTicket } = useStore();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [showNewTicket, setShowNewTicket] = useState(false);

  const myTickets = state.tickets.filter((t) => t.userId === state.currentUser?.id);
  const active = myTickets.find((t) => t.id === selectedTicket);

  const handleCreate = () => {
    if (!subject || !message) return toast.error("Preencha o motivo e a descrição.");
    addTicket(subject, message);
    toast.success("Ticket de suporte aberto! Aguarde retorno.");
    setSubject("");
    setMessage("");
    setShowNewTicket(false);
  };

  const handleReply = () => {
    if (!reply || !selectedTicket) return;
    replyTicket(selectedTicket, reply);
    setReply("");
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up pb-20">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-2">
          <h1 className="text-3xl md:text-4xl font-black text-foreground">Suporte</h1>
          <HeadsetEmoji className="w-8 h-8" />
        </div>
        <p className="text-muted-foreground">Como podemos ajudar você hoje?</p>
      </div>

      {!selectedTicket ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div 
              className="glass-card p-6 flex flex-col items-center text-center gap-4 cursor-pointer hover:border-primary/50 transition-all group"
              onClick={() => setShowNewTicket(true)}
            >
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <HeadsetEmoji className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">Chamar Suporte</h4>
                <p className="text-xs text-muted-foreground mt-1">Fale com um administrador sobre qualquer assunto.</p>
              </div>
            </div>
            <div className="glass-card p-6 flex flex-col items-center text-center gap-4 opacity-50 cursor-not-allowed">
              <div className="w-14 h-14 bg-destructive/10 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h4 className="font-bold text-foreground">Disputas</h4>
                <p className="text-xs text-muted-foreground mt-1">Para disputas, acesse a página "Compras".</p>
              </div>
            </div>
          </div>

          {showNewTicket && (
            <div className="glass-card p-6 mb-8 border-2 border-primary/20 animate-fade-in-up">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Novo Ticket de Suporte
                </h3>
                <button onClick={() => setShowNewTicket(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Qual o motivo do contato?</label>
                  <input 
                    value={subject} 
                    onChange={(e) => setSubject(e.target.value)} 
                    placeholder="Ex: Problema com saque, erro no site..." 
                    className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Descrição detalhada</label>
                  <textarea 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)} 
                    placeholder="Explique o que está acontecendo..." 
                    rows={4} 
                    className="w-full p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm resize-none" 
                  />
                </div>
                <button onClick={handleCreate} className="w-full btn-gradient py-3 rounded-xl font-bold text-sm">Abrir Chamado</button>
              </div>
            </div>
          )}

          {/* Ticket list */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase px-1">Meus Atendimentos</h3>
            {myTickets.length > 0 ? (
              myTickets.map((t) => (
                <div key={t.id} onClick={() => setSelectedTicket(t.id)} className="glass-card p-4 cursor-pointer flex justify-between items-center hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${t.status === 'open' ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                    <div>
                      <p className="font-bold text-foreground text-sm">{t.subject}</p>
                      <p className="text-[10px] text-muted-foreground">Última atualização: {new Date(t.messages[t.messages.length-1].date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${t.status === "open" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {t.status === "open" ? "Em Aberto" : "Finalizado"}
                  </span>
                </div>
              ))
            ) : (
              <div className="bg-card/50 rounded-2xl p-8 text-center border border-dashed border-border">
                <p className="text-xs text-muted-foreground">Você não possui tickets de suporte abertos.</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="animate-fade-in-up">
          <button onClick={() => setSelectedTicket(null)} className="flex items-center gap-2 text-primary font-bold text-sm mb-6 hover:translate-x-1 transition-transform">
            ← Voltar para lista
          </button>
          <div className="glass-card flex flex-col h-[60vh]">
            <div className="p-4 border-b border-border/40 bg-muted/30">
              <h3 className="font-bold text-foreground">{active?.subject}</h3>
              <p className="text-[10px] text-muted-foreground uppercase">Ticket #{active?.id}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {active?.messages.map((m, i) => {
                const isMe = m.from === state.currentUser?.email;
                return (
                  <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                      <p className="text-[9px] font-bold mb-1 opacity-70 uppercase">{isMe ? "Você" : "Equipe ZXMAX"}</p>
                      <p className="leading-relaxed">{m.text}</p>
                      <p className="text-[8px] mt-1 opacity-50 text-right">{new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="p-4 border-t border-border/40 bg-card">
              <div className="flex gap-2">
                <input 
                  value={reply} 
                  onChange={(e) => setReply(e.target.value)} 
                  placeholder="Responda aqui..." 
                  className="flex-1 p-3 rounded-xl bg-muted border-none focus:ring-2 ring-primary outline-none text-foreground text-sm" 
                  onKeyDown={(e) => e.key === "Enter" && handleReply()} 
                />
                <button onClick={handleReply} className="btn-gradient p-3 rounded-xl shadow-lg shadow-primary/20">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const X = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
