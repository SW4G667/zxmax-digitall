import React, { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Download, Package, ShieldCheck, ShoppingBag, TicketCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { useSiteBranding } from "@/context/SiteBrandingContext";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function AppInstall() {
  const { branding } = useSiteBranding();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(Boolean(standalone));

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      toast.success("ZXMAX instalado. Abra pelo ícone da tela inicial.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (installed) {
      toast.success("O ZXMAX já está instalado neste dispositivo.");
      return;
    }
    if (!promptEvent) {
      toast.info("No Chrome, abra o menu ⋮ e toque em “Instalar aplicativo” ou “Adicionar à tela inicial”.");
      return;
    }
    await promptEvent.prompt();
    const result = await promptEvent.userChoice;
    if (result.outcome === "accepted") setPromptEvent(null);
  };

  const icon = branding.appIconUrl || branding.logoUrl || "/favicon.ico";

  return (
    <AppShell>
      <main className="mx-auto max-w-[980px] px-1 pb-14 pt-3 sm:pt-8">
        <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#08080a]">
          <div className="grid gap-7 p-5 sm:p-8 md:grid-cols-[1.05fr_.95fr] md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <img
                  src={icon}
                  alt=""
                  className="h-14 w-14 rounded-2xl border border-white/[0.09] bg-white/[0.03] object-cover"
                />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/28">Aplicativo de gerenciamento</p>
                  <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white">{branding.siteName || "ZXMAX"} App</h1>
                </div>
              </div>

              <p className="mt-6 max-w-xl text-sm leading-6 text-white/45">
                Instale o painel de gerenciamento da ZXMAX. O aplicativo é separado da loja: ele abre direto em vendas,
                cobranças, carteira, produtos, tickets e perfil.
              </p>

              <button
                type="button"
                onClick={() => void install()}
                className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-black transition hover:bg-white/90 sm:w-auto sm:min-w-[220px]"
              >
                {installed ? <CheckCircle2 className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {installed ? "Aplicativo instalado" : "Instalar ZXMAX"}
              </button>

              <p className="mt-3 text-[10px] leading-4 text-white/25">
                Depois de instalado, abra pelo ícone da ZXMAX na tela inicial. Essa página continua sendo apenas a instalação;
                o painel completo aparece no aplicativo.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/[0.07] bg-black p-4">
              <div className="rounded-[20px] border border-white/[0.06] bg-[#0b0b0d] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-[0.14em] text-white/25">Prévia do app</p>
                    <p className="mt-1 text-sm font-black text-white">Painel ZXMAX</p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-emerald-300/75" />
                </div>
                <div className="mt-4 rounded-2xl border border-white/[0.055] bg-black p-4">
                  <p className="text-[8px] uppercase tracking-wide text-white/22">Saldo Gateway</p>
                  <p className="mt-1 text-2xl font-black text-white">R$ 0,00</p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {["Cobrar", "Sacar", "Extrato"].map((item, index) => (
                      <span key={item} className={`rounded-xl px-2 py-2.5 text-center text-[9px] font-bold ${index === 0 ? "bg-white text-black" : "border border-white/[0.07] text-white/40"}`}>{item}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    ["Vendas", ShoppingBag],
                    ["Produtos", Package],
                    ["Tickets", TicketCheck],
                    ["Rendimento", BarChart3],
                  ].map(([label, Icon]: any) => (
                    <div key={label} className="rounded-xl border border-white/[0.055] bg-black p-3">
                      <Icon className="h-4 w-4 text-white/35" />
                      <p className="mt-3 text-[10px] font-bold text-white/60">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-px border-t border-white/[0.06] bg-white/[0.05] sm:grid-cols-3">
            {[
              ["Gateway separado", "Cobranças PIX e saldo próprio", Wallet],
              ["Gestão de vendas", "Pedidos, entregas e reembolsos", ShoppingBag],
              ["Suporte", "Tickets e mensagens em um só lugar", TicketCheck],
            ].map(([title, text, Icon]: any) => (
              <div key={title} className="bg-[#08080a] p-4 sm:p-5">
                <Icon className="h-4 w-4 text-white/35" />
                <p className="mt-3 text-xs font-black text-white">{title}</p>
                <p className="mt-1 text-[10px] leading-4 text-white/28">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
