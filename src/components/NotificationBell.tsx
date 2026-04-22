import React, { useState, useRef, useEffect } from "react";
import { useStore } from "@/store/StoreContext";
import { Bell } from "lucide-react";
import { BagCheckEmoji, StarEmoji, ChatEmoji, ShieldEmoji, MoneyEmoji } from "@/components/CustomEmojis";

const isBrowser = typeof window !== 'undefined';

export default function NotificationBell() {
  const { state } = useStore();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"purchases" | "global">("purchases");
  const [lastSeenCount, setLastSeenCount] = useState(() => {
    if (isBrowser) {
      try {
        return parseInt(localStorage.getItem("zxmax_notif_seen") || "0", 10);
      } catch { return 0; }
    }
    return 0;
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isBrowser) return;
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
  const hasNew = totalCount > lastSeenCount;

  const handleOpen = () => {
    setOpen(!open);
    if (!open) {
      setLastSeenCount(totalCount);
      if (isBrowser) {
        try {
          localStorage.setItem("zxmax_notif_seen", String(totalCount));
        } catch {}
      }
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="p-2 rounded-xl hover:bg-muted transition relative"
        title="Notificações"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {hasNew && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[9px] font-black rounded-full border-2 border-card animate-emoji-pulse">
            {totalCount - lastSeenCount > 9 ? "9+" : totalCount - lastSeenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 sm:w-96 glass-card bg-card p-0 overflow-hidden z-[100] animate-fade-in-up shadow-xl rounded-2xl">
          {/* Tabs */}
          <div className="flex border-b border-border/40 bg-muted/30">
            <button
              onClick={() => setTab("purchases")}
              className={`flex-1 py-3 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === "purchases"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BagCheckEmoji className="w-4 h-4" /> Compras
            </button>
            <button
              onClick={() => setTab("global")}
              className={`flex-1 py-3 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === "global"
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ChatEmoji className="w-4 h-4" /> Mensagens
              {globalCount > 0 && (
                <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{globalCount > 9 ? "9+" : globalCount}</span>
              )}
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {tab === "purchases" && (
              <>
                {purchaseNotifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <BagCheckEmoji className="w-8 h-8 text-muted-foreground/50 mb-2" />
                    <p className="text-center text-muted-foreground text-xs">Nenhuma notificação de compra.</p>
                  </div>
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
                              <BagCheckEmoji className="w-3 h-3 inline mr-1" />
                              Alguém comprou <span className="font-bold">{product?.name}</span>
                            </p>
                          ) : (
                            <p className="text-xs text-foreground truncate">
                              <span className="font-bold">{product?.name}</span> pronto para entrega
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
                {globalNotices.length === 0 && ticketNotifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8">
                    <ChatEmoji className="w-8 h-8 text-muted-foreground/50 mb-2" />
                    <p className="text-center text-muted-foreground text-xs">Nenhuma mensagem nova.</p>
                  </div>
                ) : (
                  <>
                    {/* Global notices */}
                    {globalNotices.map((n) => (
                      <div key={n.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition border-b border-border/20">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <ShieldEmoji className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">📢 Aviso Global</p>
                          <p className="text-[10px] text-muted-foreground truncate">{n.text}</p>
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">{new Date(n.date).toLocaleDateString("pt-BR")}</p>
                        </div>
                      </div>
                    ))}

                    {/* Ticket replies */}
                    {ticketNotifs.map((t) => {
                      const lastMsg = t.messages.filter((m) => m.from !== email).pop();
                      return (
                        <div key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition border-b border-border/20 cursor-pointer">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <ChatEmoji className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">💬 {t.subject}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{lastMsg?.text}</p>
                            <p className="text-[9px] text-muted-foreground/60 mt-0.5">{new Date(lastMsg?.date || "").toLocaleDateString("pt-BR")}</p>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
