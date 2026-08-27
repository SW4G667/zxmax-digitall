import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore, Purchase } from "@/store/StoreContext";
import { Send, ImagePlus, Loader2, Clock, CheckCircle2, ShieldCheck, Undo2, AlertCircle, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { containsExternalContact } from "@/lib/externalContact";

interface OrderMessage {
  id: string;
  order_id: number;
  sender_id: string;
  body: string | null;
  image_path: string | null;
  created_at: string;
  imageUrl?: string;
}

interface Props {
  orderId: number;
  locked?: boolean;
  purchase?: Purchase | null;
  onRefresh?: () => void;
}

export default function OrderChat({ orderId, locked, purchase: propPurchase, onRefresh }: Props) {
  const { state, confirmDelivery, confirmOrderReceipt, sellerRefundOrder } = useStore();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const me = state.currentUser?.id;

  const purchase = propPurchase || state.purchases.find((p) => p.id === orderId) || null;
  const isSeller = !!me && purchase?.sellerId === me;
  const isBuyer = !!me && purchase?.buyerId === me;
  const isAdmin = state.currentUser?.isAdmin || false;

  const signImages = async (rows: OrderMessage[]) => {
    const withImages = await Promise.all(
      rows.map(async (m) => {
        if (m.image_path) {
          const { data } = await supabase.storage.from("order-attachments").createSignedUrl(m.image_path, 60 * 60 * 6);
          return { ...m, imageUrl: data?.signedUrl };
        }
        return m;
      })
    );
    return withImages;
  };

  const load = async () => {
    const { data } = await supabase
      .from("order_messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (data) setMessages(await signImages(data as OrderMessage[]));
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel(`order_messages_${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        async (payload) => {
          const m = payload.new as OrderMessage;
          const [signed] = await signImages([m]);
          setMessages((prev) => (prev.some((x) => x.id === signed.id) ? prev : [...prev, signed]));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (body: string | null, imagePath: string | null) => {
    if (!me) return false;
    const { error } = await supabase.from("order_messages").insert({
      order_id: orderId,
      sender_id: me,
      body,
      image_path: imagePath,
    });
    if (error) {
      toast.error("Não foi possível enviar a mensagem.");
      return false;
    }
    return true;
  };

  const sanitize = (input: string) => {
    return input
      .replace(/<[^>]*>/g, "")
      .replace(/[\u{1F600}-\u{1F6FF}]{3,}/gu, "")
      .trim()
      .slice(0, 1000);
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    const clean = sanitize(text);
    if (!clean) return toast.error("Mensagem inválida");
    setSending(true);
    const ok = await sendMessage(clean, null);
    if (ok) {
      setText("");
      void load();
    }
    setSending(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !me) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo: 5MB.");
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${orderId}/${me}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("order-attachments").upload(path, file, { contentType: file.type });
      if (error) throw error;
      await sendMessage(null, path);
      void load();
    } catch (err: any) {
      toast.error("Erro ao enviar imagem: " + (err?.message || "tente novamente"));
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleConfirmDeliverySeller = async () => {
    setActionLoading(true);
    const ok = await confirmDelivery(orderId);
    setActionLoading(false);
    if (ok) {
      toast.success("Entrega confirmada pelo vendedor! Aguardando o comprador.");
      void load();
      if (onRefresh) onRefresh();
    } else {
      toast.error("Não foi possível confirmar a entrega.");
    }
  };

  const handleConfirmReceiptBuyer = async () => {
    setActionLoading(true);
    const ok = await confirmOrderReceipt(orderId);
    setActionLoading(false);
    if (ok) {
      toast.success("Recebimento confirmado! Dinheiro liberado para o vendedor.");
      void load();
      if (onRefresh) onRefresh();
    } else {
      toast.error("Não foi possível confirmar o recebimento.");
    }
  };

  const handleConfirmRefund = async () => {
    const cleanReason = refundReason.trim();
    if (cleanReason.length < 10) {
      return toast.error("O motivo do reembolso deve ter pelo menos 10 caracteres.");
    }
    if (containsExternalContact(cleanReason)) {
      return toast.error("Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, telefone ou links).");
    }

    setRefunding(true);
    const result = await sellerRefundOrder(orderId, cleanReason);
    setRefunding(false);

    if (result.success) {
      toast.success("Reembolso efetuado! O dinheiro foi devolvido à conta/banco do comprador.");
      setShowRefundModal(false);
      setRefundReason("");
      void load();
      if (onRefresh) onRefresh();
    } else {
      toast.error(result.error || "Falha ao processar o reembolso.");
    }
  };

  if (locked) {
    return (
      <div className="glass-card p-4 flex flex-col items-center justify-center py-10 text-center">
        <Clock className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground font-medium">O chat libera após a confirmação do pagamento.</p>
      </div>
    );
  }

  // Calculate auto-release formatted timestamp (delivered_pending_at + 3 days)
  let autoReleaseText = "";
  if (purchase?.deliveredPendingAt) {
    const autoDate = new Date(new Date(purchase.deliveredPendingAt).getTime() + 3 * 24 * 60 * 60 * 1000);
    const dayMonth = autoDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const timeStr = autoDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    autoReleaseText = `${dayMonth} às ${timeStr}`;
  } else if (purchase?.updatedAt && purchase.status === "delivered_pending_confirmation") {
    const autoDate = new Date(new Date(purchase.updatedAt).getTime() + 3 * 24 * 60 * 60 * 1000);
    const dayMonth = autoDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const timeStr = autoDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    autoReleaseText = `${dayMonth} às ${timeStr}`;
  }

  const isRefundable = (isSeller || isAdmin) && purchase && ["paid", "delivered_pending_confirmation", "delivered"].includes(purchase.status);

  return (
    <div>
      {/* Escrow Banner & Action Bar */}
      {purchase && (
        <div className="glass-card p-4 mb-3 border border-border/40 bg-card/60 space-y-3">
          {purchase.status === "paid" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#5aaeff]">
                <ShieldCheck className="w-4.5 h-4.5 shrink-0" />
                <span>Pagamento confirmado em Escrow (Garantia ZXMAX)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isSeller
                  ? "O valor está retido na plataforma. Faça a entrega e clique em 'Confirmar Entrega'."
                  : "O vendedor foi notificado e realizará a entrega do seu produto."}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {isSeller && (
                  <Button
                    onClick={handleConfirmDeliverySeller}
                    disabled={actionLoading}
                    className="btn-gradient text-xs font-bold h-9"
                  >
                    <PackageCheck className="w-4 h-4 mr-1.5" />
                    {actionLoading ? "Enviando..." : "Confirmar Entrega"}
                  </Button>
                )}
                {isRefundable && (
                  <Button
                    onClick={() => setShowRefundModal(true)}
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-bold h-9"
                  >
                    <Undo2 className="w-4 h-4 mr-1.5" />
                    Reembolsar Comprador
                  </Button>
                )}
              </div>
            </div>
          )}

          {purchase.status === "delivered_pending_confirmation" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                <Clock className="w-4.5 h-4.5 shrink-0 animate-pulse" />
                <span>Entrega realizada pelo vendedor · Aguardando confirmação</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isBuyer
                  ? "Verifique o produto recebido. Se estiver tudo OK, clique em 'Confirmar Recebimento' para liberar o pagamento ao vendedor."
                  : "Aguardando o comprador confirmar o recebimento."}
                {autoReleaseText && (
                  <span className="block font-semibold text-foreground mt-1">
                    Liberação automática para o vendedor em {autoReleaseText}.
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {isBuyer && (
                  <Button
                    onClick={handleConfirmReceiptBuyer}
                    disabled={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    {actionLoading ? "Confirmando..." : "Confirmar Recebimento"}
                  </Button>
                )}
                {isRefundable && (
                  <Button
                    onClick={() => setShowRefundModal(true)}
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-bold h-9"
                  >
                    <Undo2 className="w-4 h-4 mr-1.5" />
                    Reembolsar Comprador
                  </Button>
                )}
              </div>
            </div>
          )}

          {purchase.status === "delivered" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
                <span>Pedido Concluído · Dinheiro liberado para o vendedor</span>
              </div>
              {isRefundable && (
                <div className="pt-1">
                  <Button
                    onClick={() => setShowRefundModal(true)}
                    variant="outline"
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs font-bold h-8"
                  >
                    <Undo2 className="w-3.5 h-3.5 mr-1" />
                    Reembolsar Comprador
                  </Button>
                </div>
              )}
            </div>
          )}

          {purchase.status === "refunded" && (
            <div className="space-y-1 bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
              <div className="flex items-center gap-2 text-xs font-bold text-destructive">
                <Undo2 className="w-4.5 h-4.5 shrink-0" />
                <span>Pedido Reembolsado pelo Vendedor</span>
              </div>
              <p className="text-xs text-foreground">
                O valor de R$ {Number(purchase.amount).toFixed(2)} foi devolvido para a conta/banco do comprador.
              </p>
              {purchase.refundReason && (
                <p className="text-[11px] text-muted-foreground italic">
                  Motivo: "{purchase.refundReason}"
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div ref={scrollRef} className="glass-card p-4 mb-3 min-h-[280px] max-h-[400px] overflow-y-auto flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem ainda. Combine a entrega aqui.</p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === me;
            const isSystem = m.sender_id === "System" || !m.sender_id;
            if (isSystem) {
              return (
                <div key={m.id} className="flex justify-center my-1">
                  <div className="bg-primary/10 border border-primary/20 text-foreground text-xs px-3 py-2 rounded-xl max-w-[90%] text-center">
                    <p className="whitespace-pre-wrap font-medium">{m.body}</p>
                    <p className="text-[9px] opacity-50 mt-1">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            }
            return (
              <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"}`}>
                  {m.imageUrl && (
                    <a href={m.imageUrl} target="_blank" rel="noreferrer">
                      <img src={m.imageUrl} alt="anexo" className="rounded-lg max-h-48 mb-1 object-cover" />
                    </a>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  <p className={`text-[9px] mt-1 opacity-60 ${isMe ? "text-right" : "text-left"}`}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input controls */}
      <div className="flex gap-2 items-center">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || purchase?.status === "refunded" || purchase?.status === "cancelled"}
          className="p-3 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-50"
          title="Enviar imagem"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={purchase?.status === "refunded" || purchase?.status === "cancelled"}
          placeholder={purchase?.status === "refunded" ? "Pedido reembolsado." : "Digite sua mensagem..."}
          className="flex-1 p-3 rounded-xl bg-card border border-border/40 focus:ring-2 ring-primary outline-none text-sm text-foreground disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={sending || purchase?.status === "refunded" || purchase?.status === "cancelled"}
          className="btn-gradient p-3 rounded-xl disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Seller Refund Modal */}
      {showRefundModal && purchase && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRefundModal(false)}>
          <div className="bg-[#15151a] border border-[#25252e] rounded-2xl w-full max-w-md p-6 space-y-4 animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-destructive font-black text-lg">
              <Undo2 className="w-5 h-5" />
              <h3>Reembolsar Comprador</h3>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-xs text-foreground space-y-1">
              <p className="font-bold">⚠️ Informação importante:</p>
              <p>
                O valor de <span className="font-black text-destructive">R$ {Number(purchase.amount).toFixed(2)}</span> será devolvido diretamente à conta/banco do comprador através do gateway de pagamento.
              </p>
              <p className="text-muted-foreground">O dinheiro NUNCA entra como saldo no site nem em faturamento da plataforma.</p>
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">
                Motivo do Reembolso (obrigatório, mín. 10 caracteres)
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Descreva detalhadamente o motivo do reembolso ao comprador..."
                className="w-full p-3.5 rounded-xl bg-[#0a0a0f] border border-[#25252e] text-white placeholder:text-white/20 text-sm focus:border-[#0084ff] outline-none min-h-[100px] resize-none"
              />
              {refundReason.trim().length > 0 && refundReason.trim().length < 10 && (
                <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Faltam {10 - refundReason.trim().length} caracteres.
                </p>
              )}
              {containsExternalContact(refundReason) && (
                <p className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Não é permitido enviar contatos externos (WhatsApp, Discord, e-mail, telefone ou links).
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowRefundModal(false)}
                className="flex-1 bg-muted text-foreground border-border"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmRefund}
                disabled={refunding || refundReason.trim().length < 10 || containsExternalContact(refundReason)}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-white font-bold"
              >
                {refunding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Reembolso"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
