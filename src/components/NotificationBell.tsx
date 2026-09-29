import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, CircleDollarSign, Headphones, MessageCircleQuestion, Shield, ShoppingBag, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type NotificationRow = {
  id: number;
  type: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function Icon({ type }: { type: string }) {
  if (type === "sale") return <CircleDollarSign className="h-4 w-4" />;
  if (type === "question" || type === "chat") return <MessageCircleQuestion className="h-4 w-4" />;
  if (type === "notice") return <Shield className="h-4 w-4" />;
  if (type === "support") return <Headphones className="h-4 w-4" />;
  return <ShoppingBag className="h-4 w-4" />;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "orders" | "messages" | "sales" | "notices">("all");
  const ref = useRef<HTMLDivElement>(null);

  const showNativeNotification = useCallback((row: NotificationRow) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (window.localStorage.getItem("zxmax_browser_notifications") !== "1") return;
    try {
      const notice = new Notification(row.title, { body: row.body || "Você recebeu uma nova atualização.", tag: `zxmax-${row.id}` });
      notice.onclick = () => {
        window.focus();
        if (row.href?.startsWith("/")) window.location.assign(row.href);
        notice.close();
      };
    } catch {
      // The in-app notification center remains the reliable fallback.
    }
  }, []);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      return;
    }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("notifications")
      .select("id,type,title,body,href,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);
    setLoading(false);
    if (!error) setRows((data || []) as NotificationRow[]);
  }, [user?.id]);

  useEffect(() => {
    void load();
    if (!user) return;
    const interval = window.setInterval(() => void load(), 30000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);

    const channel = supabase
      .channel(`zxmax_notifications_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as NotificationRow;
          setRows((current) => current.some((item) => item.id === row.id) ? current : [row, ...current].slice(0, 40));
          showNativeNotification(row);
        },
      )
      .subscribe();

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, load, showNativeNotification]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) return null;

  const unread = rows.filter((row) => !row.read_at).length;
  const groupOf = (row: NotificationRow) => row.type === "sale" ? "sales" : (row.type === "question" || row.type === "chat" || row.type === "support") ? "messages" : row.type === "notice" ? "notices" : "orders";
  const visibleRows = filter === "all" ? rows : rows.filter((row) => groupOf(row) === filter);
  const groupUnread = (group: typeof filter) => group === "all" ? unread : rows.filter((row) => !row.read_at && groupOf(row) === group).length;

  const markAllRead = async () => {
    const unreadIds = rows.filter((row) => !row.read_at).map((row) => row.id);
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    setRows((current) => current.map((row) => unreadIds.includes(row.id) ? { ...row, read_at: now } : row));
    const { error } = await (supabase as any)
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) void load();
  };

  const deleteNotification = async (event: React.MouseEvent, row: NotificationRow) => {
    event.stopPropagation();
    const previous = rows;
    setRows((current) => current.filter((item) => item.id !== row.id));
    const { error } = await (supabase as any).from("notifications").delete().eq("id", row.id).eq("user_id", user.id);
    if (error) setRows(previous);
  };

  const clearVisible = async () => {
    const ids = visibleRows.map((row) => row.id);
    if (!ids.length) return;
    if (!window.confirm(filter === "all" ? "Apagar todas as suas notificações?" : "Apagar as notificações desta categoria?")) return;
    const previous = rows;
    setRows((current) => current.filter((row) => !ids.includes(row.id)));
    const { error } = await (supabase as any).from("notifications").delete().eq("user_id", user.id).in("id", ids);
    if (error) setRows(previous);
  };

  const openNotification = async (row: NotificationRow) => {
    setOpen(false);
    if (!row.read_at) {
      const now = new Date().toISOString();
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, read_at: now } : item));
      await (supabase as any).from("notifications").update({ read_at: now }).eq("id", row.id).eq("user_id", user.id);
    }
    if (row.href?.startsWith("/")) navigate(row.href);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="zx-icon-action relative"
        title="Notificações"
        aria-label={unread ? `Notificações, ${unread} não lidas` : "Notificações"}
        aria-expanded={open}
      >
        <Bell className="h-4 w-4 text-white/60" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-[#0b0b0e] bg-[var(--zx-accent)] px-1 text-[8px] font-black text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <section className="fixed left-3 right-3 top-[4.15rem] z-[100] mx-auto max-h-[72dvh] max-w-[400px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0f0f13] shadow-2xl shadow-black/60 sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-[390px]" aria-label="Central de notificações">
          <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5">
            <div>
              <p className="text-sm font-black text-white">Notificações</p>
              <p className="mt-0.5 text-[10px] text-white/35">{unread ? `${unread} não lida(s)` : "Tudo em dia"}</p>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button type="button" onClick={() => void markAllRead()} className="grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.05] hover:text-white" title="Marcar todas como lidas">
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.05] hover:text-white" aria-label="Fechar notificações">
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex items-center gap-1 overflow-x-auto border-b border-white/[0.07] px-3 py-2 scrollbar-none">
            {([
              ["all", "Tudo"], ["orders", "Pedidos"], ["messages", "Mensagens"], ["sales", "Vendas"], ["notices", "Avisos"],
            ] as const).map(([key, label]) => {
              const count = groupUnread(key);
              return <button key={key} type="button" onClick={() => setFilter(key)} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${filter === key ? "bg-[#168cff] text-white" : "bg-white/[0.035] text-white/45 hover:text-white"}`}>{label}{count ? <span className="ml-1.5 opacity-80">{count}</span> : null}</button>;
            })}
            {visibleRows.length ? <button type="button" onClick={() => void clearVisible()} className="ml-auto shrink-0 rounded-lg px-2 py-1.5 text-[9px] font-bold text-red-300/65 hover:bg-red-500/10 hover:text-red-300">Limpar</button> : null}
          </div>

          <div className="max-h-[60dvh] overflow-y-auto">
            {loading && rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-white/35">Carregando notificações…</p>
            ) : visibleRows.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell className="mx-auto h-6 w-6 text-white/18" />
                <p className="mt-3 text-xs font-semibold text-white/55">{rows.length ? "Nada nesta categoria" : "Nenhuma notificação ainda"}</p>
                <p className="mt-1 text-[10px] leading-4 text-white/28">Vendas, perguntas, pedidos, disputas e avisos aparecerão aqui.</p>
              </div>
            ) : (
              visibleRows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void openNotification(row)}
                  className={`flex w-full gap-3 border-b border-white/[0.055] px-4 py-3.5 text-left transition hover:bg-white/[0.035] ${!row.read_at ? "bg-[#168cff]/[0.045]" : ""}`}
                >
                  <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${!row.read_at ? "border-[#168cff]/25 bg-[#168cff]/10 text-[#70bdff]" : "border-white/[0.07] bg-white/[0.025] text-white/38"}`}>
                    <Icon type={row.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-xs font-bold text-white">{row.title}</span>
                      {!row.read_at && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#168cff]" />}
                    </span>
                    {row.body ? <span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-white/38">{row.body}</span> : null}
                    <span className="mt-1.5 block text-[9px] text-white/22">{new Date(row.created_at).toLocaleString("pt-BR")}</span>
                  </span>
                  <button type="button" onClick={(event) => void deleteNotification(event, row)} className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/20 transition hover:bg-red-500/10 hover:text-red-300" title="Apagar notificação" aria-label="Apagar notificação"><Trash2 className="h-3.5 w-3.5" /></button>
                </button>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// deploy-trigger: notification-center-v2
