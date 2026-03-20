import React, { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/StoreContext";
import { Bell } from "lucide-react";
import { BagCheckEmoji, StarEmoji, ChatEmoji, ShieldEmoji } from "@/components/CustomEmojis";

export default function NotificationBell() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"purchases" | "global">("purchases");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!state.currentUser) return null;
  const email = state.currentUser.email;

  // Purchase notifications
  const purchaseNotifs = state.purchases
    .filter((p) => {
      const product = state.products.find((pr) => pr.id === p.productId);
      if (!product) return false;
      const isSeller = product.sellerEmail === email;
      const isBuyer = p.buyerEmail === email;
      if (!isSeller && !isBuyer) return false;
      if (isSeller && (p.status === "paid" || p.reviewed)) return true;
      if (isBuyer && p.status === "delivered" && !p.reviewed) return true;
      return false;
    })
    .slice(0, 10);

  // Global: support ticket replies + global notices
  const ticketNotifs = state.tickets
    .filter((t) => {
      if (t.userEmail === email) {
        return t.messages.some((m) => m.from !== email);
      }
      return false;
    })
    .slice(0, 5);

  const globalNotices = (state.globalNotices || []).slice(0, 10);

  const globalCount = ticketNotifs.length + globalNotices.length;
  const totalCount = purchaseNotifs.length + globalCount;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-xl hover:bg-muted transition relative"
        title="Notificações"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-black rounded-full border-2 border-card animate-emoji-pulse">
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 glass-card bg-card p-0 overflow-hidden z-[100] animate-fade-in-up shadow-xl">
          {/* Tabs */}
          <div className="flex border-b border-border/40">
            <button
              onClick={() => setTab("purchases")}
              className={`flex-1 py-3 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === "purchases"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BagCheckEmoji className="w-4 h-4" /> Compras e Opiniões
            </button>
            <button
              onClick={() => setTab("global")}
              className={`flex-1 py-3 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === "global"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ChatEmoji className="w-4 h-4" /> Mensagens Globais
              {globalCount > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{globalCount}</span>
              )}
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {tab === "purchases" && (
              <>
                {purchaseNotifs.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-8">Nenhuma nova notificação.</p>
                ) : (
                  purchaseNotifs.map((p) => {
                    const product = state.products.find((pr) => pr.id === p.productId);
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition border-b border-border/20 cursor-pointer">
                        {product && <img src={product.image} className="w-9 h-9 rounded-lg object-cover shrink-0" alt="" />}
                        <div className="flex-1 min-w-0">
                          {p.reviewed ? (
                            <p className="text-xs text-foreground truncate">
                              <StarEmoji className="w-3 h-3 inline mr-1" />
                              Novo feedback em <span className="font-bold">{product?.name}</span>
                            </p>
                          ) : p.status === "paid" ? (
                            <p className="text-xs text-foreground truncate">
                              Alguém comprou <span className="font-bold">{product?.name}</span>
                            </p>
                          ) : (
                            <p className="text-xs text-foreground truncate">
                              Entrega disponível: <span className="font-bold">{product?.name}</span>
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {tab === "global" && (
              <>
                {/* Ticket replies */}
                {ticketNotifs.map((t) => {
                  const lastMsg = t.messages.filter((m) => m.from !== email).pop();
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition border-b border-border/20 cursor-pointer">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ChatEmoji className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{t.subject}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{lastMsg?.text}</p>
                      </div>
                    </div>
                  );
                })}

                {ticketNotifs.length === 0 && (
                  <p className="text-center text-muted-foreground text-xs py-8">Nenhuma mensagem nova.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
