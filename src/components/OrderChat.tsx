import React, { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStore } from "@/store/StoreContext";
import { Send, ImagePlus, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

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
}

export default function OrderChat({ orderId, locked }: Props) {
  const { state } = useStore();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const me = state.currentUser?.id;

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
    if (!me) return;
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

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await sendMessage(text.trim(), null);
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

  if (locked) {
    return (
      <div className="glass-card p-4 flex flex-col items-center justify-center py-10 text-center">
        <Clock className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground font-medium">O chat libera após a confirmação do pagamento.</p>
      </div>
    );
  }

  return (
    <div>
      <div ref={scrollRef} className="glass-card p-4 mb-3 min-h-[280px] max-h-[400px] overflow-y-auto flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-10">Nenhuma mensagem ainda. Combine a entrega aqui.</p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === me;
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

      <div className="flex gap-2 items-center">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="p-3 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition disabled:opacity-50"
          title="Enviar imagem"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Digite sua mensagem..."
          className="flex-1 p-3 rounded-xl bg-card border border-border/40 focus:ring-2 ring-primary outline-none text-sm text-foreground"
        />
        <button onClick={handleSend} disabled={sending} className="btn-gradient p-3 rounded-xl disabled:opacity-50">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
