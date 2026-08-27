import { useEffect, useState } from "react";
import { ShieldCheck, Wrench } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AuthScreen from "@/components/AuthScreen";

type PlatformStatus = { maintenance?: boolean; message?: string };

export default function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, isAdmin, adminRoleResolved, refreshAuthorization } = useAuth();
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await (supabase as any).rpc("get_platform_status");
      if (active && !error) setStatus((data || {}) as PlatformStatus);
      if (active && error) setStatus({ maintenance: false });
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    // After a successful password login or TOTP verification, Supabase may
    // emit a session for the same user id. Ask the server to resolve role
    // again instead of returning an administrator to the maintenance screen.
    if (status?.maintenance && user && !adminRoleResolved) {
      void refreshAuthorization();
    }
  }, [adminRoleResolved, refreshAuthorization, status?.maintenance, user?.id]);

  const authRoute = location.pathname === "/auth/callback" || location.pathname === "/reset-password";
  const adminAllowed = !!user && adminRoleResolved && isAdmin;
  if (authRoute || !status?.maintenance || adminAllowed) return <>{children}</>;

  const validatingAdmin = !!user && !adminRoleResolved;

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#070910] p-5 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_15%,rgba(0,132,255,0.26),transparent_30%),radial-gradient(circle_at_92%_88%,rgba(0,92,190,0.16),transparent_30%)]" />
      <section className="relative w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[#10121b]/95 p-7 text-center shadow-[0_32px_100px_rgba(0,0,0,0.55)] sm:p-10">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl border border-[#168cff]/25 bg-[#168cff]/10 text-[#5aafff]"><Wrench className="h-6 w-6" /></div>
        <div className="text-2xl font-black tracking-[-0.07em]">ZX<span className="text-[#168cff]">MAX</span></div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#5aafff]">Manutenção programada</p>
        <h1 className="mt-2 text-2xl font-black sm:text-3xl">Estamos preparando uma experiência melhor.</h1>
        <p className="mt-3 text-sm leading-6 text-white/55">{status.message || "O catálogo está temporariamente indisponível. Tente novamente em alguns instantes."}</p>
        <div className="mt-7 flex items-center justify-center gap-2 text-[11px] font-semibold text-emerald-300/90"><ShieldCheck className="h-4 w-4" /> Seus dados e pedidos permanecem protegidos.</div>
        {validatingAdmin ? (
          <div className="mt-8 rounded-xl border border-[#168cff]/20 bg-[#168cff]/10 px-5 py-3 text-sm font-bold text-[#8bc7ff]" role="status">Validando permissões administrativas…</div>
        ) : (
          <button onClick={() => setAuthOpen(true)} className="mt-8 min-h-12 rounded-xl border border-white/10 bg-white/[0.055] px-5 text-sm font-bold text-white transition hover:bg-white/10 active:scale-[0.98]">Entrar como administrador</button>
        )}
      </section>
      {authOpen && <AuthScreen onClose={() => setAuthOpen(false)} />}
    </main>
  );
}
