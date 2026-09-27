import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/StoreContext";
import { Bell } from "lucide-react";
import { BagCheckEmoji, StarEmoji, ChatEmoji, ShieldEmoji } from "@/components/CustomEmojis";

export default function NotificationBell() {
  const { state } = useStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"purchases" | "global">("purchases");
  const [lastSeenCount, setLastSeenCount] = useState(() => {
    try {
      return parseInt(localStorage.getItem("zxmax_notif_seen") || "0", 10);
    } catch { return 0; }
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!state.currentUser) return null;
  const userId = state.currentUser.id;
  const email = state.currentUser.email;

  // Purchase notifications
  const purchaseNotifs = state.purchases
    .filter((p) => {
      const isSeller = p.sellerId === userId;
      const isBuyer = p.buyerId === userId;
      if (!isSeller && !isBuyer) return false;
      if (isSeller && (p.status === "paid" || p.reviewed)) return true;
      if (isBuyer && p.status === "delivered" && !p.reviewed) return true;
      return false;
    })
    .slice(0, 10);

  // Global: support ticket replies + global notices
  const ticketNotifs = state.tickets
    .filter((t) => {
      if (t.userId === userId) {
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
      localStorage.setItem("zxmax_notif_seen", String(totalCount));
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="zx-icon-action relative"
        title="Notificações"
      >
        <Bell className="h-4 w-4 text-white/55" />
        {hasNew && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] min-h-[18px] flex items-center justify-center bg-[var(--zx-accent)] text-white text-[9px] font-black rounded-full border-2 border-card animate-emoji-pulse">
            {totalCount - lastSeenCount > 9 ? "9+" : totalCount - lastSeenCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-3 right-3 top-[4.15rem] z-[100] mx-auto max-h-[72dvh] max-w-[390px] overflow-hidden rounded-xl border border-white/[0.09] bg-[#0f0f13] shadow-2xl shadow-black/50 sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-[370px]">
          {/* Tabs */}
          <div className="flex border-b border-white/[0.07] bg-[#111116]">
            <button
              onClick={() => setTab("purchases")}
              className={`flex-1 py-3 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === "purchases"
                  ? "text-[var(--zx-accent)] border-b-2 border-[var(--zx-accent)] bg-white/[0.025]"
                  : "text-white/38 hover:text-white"
              }`}
            >
              <BagCheckEmoji className="w-4 h-4" /> Compras e Opiniões
            </button>
            <button
              onClick={() => setTab("global")}
              className={`flex-1 py-3 px-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === "global"
                  ? "text-[var(--zx-accent)] border-b-2 border-[var(--zx-accent)] bg-white/[0.025]"
                  : "text-white/38 hover:text-white"
              }`}
            >
              <ChatEmoji className="w-4 h-4" /> Mensagens Globais
              {globalCount > 0 && (
                <span className="ml-1 bg-[var(--zx-accent)] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{globalCount}</span>
              )}
            </button>
          </div>

          <div className="max-h-[58dvh] overflow-y-auto">
            {tab === "purchases" && (
              <>
                {purchaseNotifs.length === 0 ? (
                  <p className="text-center text-white/35 text-xs py-8">Nenhuma nova notificação.</p>
                ) : (
                  purchaseNotifs.map((p) => {
                    const product = state.products.find((pr) => pr.id === p.productId);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setOpen(false); navigate(`/minhas-compras?order=${p.id}`); }}
                        className="flex w-full items-center gap-3 border-b border-white/[0.055] px-4 py-3 text-left transition hover:bg-white/[0.035]"
                      >
                        {product && <img src={product.image} className="w-9 h-9 rounded-lg object-cover shrink-0" alt="" />}
                        <div className="flex-1 min-w-0">
                          {p.reviewed ? (
                            <p className="text-xs text-white truncate">
                              <StarEmoji className="w-3 h-3 inline mr-1" />
                              Novo feedback em <span className="font-bold">{product?.name}</span>
                            </p>
                          ) : p.status === "paid" ? (
                            <p className="text-xs text-white truncate">
                              Alguém comprou <span className="font-bold">{product?.name}</span>
                            </p>
                          ) : (
                            <p className="text-xs text-white truncate">
                              Entrega disponível: <span className="font-bold">{product?.name}</span>
                            </p>
                          )}
                          <p className="text-[10px] text-white/35 mt-0.5">
                            {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}

            {tab === "global" && (
              <>
                {/* Global notices */}
                {globalNotices.map((n) => (
                  <div key={n.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.035] transition border-b border-white/[0.055]">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                      <ShieldEmoji className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">Aviso Global</p>
                      <p className="text-[10px] text-white/35 truncate">{n.text}</p>
                      <p className="text-[9px] text-white/35/60 mt-0.5">{new Date(n.date).toLocaleDateString("pt-BR")}</p>
                    </div>
                  </div>
                ))}

                {/* Ticket replies */}
                {ticketNotifs.map((t) => {
                  const lastMsg = t.messages.filter((m) => m.from !== email).pop();
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setOpen(false); navigate("/suporte"); }}
                      className="flex w-full items-center gap-3 border-b border-white/[0.055] px-4 py-3 text-left transition hover:bg-white/[0.035]"
                    >
                      <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                        <ChatEmoji className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{t.subject}</p>
                        <p className="text-[10px] text-white/35 truncate">{lastMsg?.text}</p>
                      </div>
                    </button>
                  );
                })}

                {globalNotices.length === 0 && ticketNotifs.length === 0 && (
                  <p className="text-center text-white/35 text-xs py-8">Nenhuma mensagem nova.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
