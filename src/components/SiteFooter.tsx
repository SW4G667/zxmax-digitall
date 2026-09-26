import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { useSiteBranding } from "@/context/SiteBrandingContext";
import { useStore } from "@/store/StoreContext";

const groups = [
  {
    title: "Marketplace",
    links: [
      ["Comprar", "/loja"],
      ["Categorias", "/categorias"],
      ["Mercado de Robux", "/robux"],
      ["Entrega automática", "/entrega-automatica"],
      ["Vendedores verificados", "/vendedores-verificados"],
    ],
  },
  {
    title: "Comprar e vender",
    links: [
      ["Como funciona", "/como-funciona"],
      ["Como comprar", "/comprar"],
      ["Como vender", "/vender"],
      ["Formas de pagamento", "/formas-de-pagamento"],
      ["Tarifas e prazos", "/tarifas-e-prazos"],
    ],
  },
  {
    title: "Ajuda",
    links: [
      ["Central de ajuda", "/central-de-ajuda"],
      ["Perguntas frequentes", "/faq"],
      ["Reembolsos", "/reembolsos"],
      ["Segurança", "/seguranca"],
      ["Suporte", "/suporte"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Regras da plataforma", "/regras"],
      ["Termos de uso", "/termos"],
      ["Política de privacidade", "/privacidade"],
    ],
  },
];

export default function SiteFooter() {
  const { branding } = useSiteBranding();
  const { state } = useStore();
  const supportUrl = branding.supportUrl || state.config.discordLink || "https://discord.gg/zxmax";

  return (
    <footer className="mt-12 border-t border-white/[0.07] bg-[#07090d]">
      <div className="mx-auto max-w-[1440px] px-4 py-10 sm:px-5 sm:py-12">
        <div className="grid gap-9 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex items-center gap-2">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt={branding.siteName} className="h-8 max-w-[150px] object-contain object-left" />
              ) : (
                <>
                  <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#168cff]/20 bg-[#168cff]/12 text-sm font-black text-[#79c3ff]">Z</span>
                  <span className="text-xl font-black tracking-[-0.055em] text-white">{branding.siteName || "ZXMAX"}</span>
                </>
              )}
            </Link>
            <p className="mt-4 text-sm leading-6 text-white/38">
              Marketplace para produtos e serviços digitais, com catálogo, pedidos, vendedores e pagamento organizados em um único fluxo.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/seguranca" className="inline-flex items-center gap-1.5 rounded-xl border border-[#168cff]/15 bg-[#168cff]/[0.07] px-3 py-2 text-[10px] font-black text-[#83c9ff]">
                <ShieldCheck className="h-3.5 w-3.5" /> Segurança
              </Link>
              <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] font-black text-white/55 hover:text-white">
                Comunidade <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4">
            {groups.map((group) => (
              <section key={group.title}>
                <h2 className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">{group.title}</h2>
                <nav className="mt-3 space-y-2.5">
                  {group.links.map(([label, to]) => (
                    <Link key={to} to={to} className="block text-xs font-semibold text-white/42 transition hover:text-white">
                      {label}
                    </Link>
                  ))}
                </nav>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-5 text-[10px] font-semibold text-white/25 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {branding.siteName || "ZXMAX"}. Todos os direitos reservados.</p>
          <p>Produtos, disponibilidade e condições são definidos pelos anúncios e fluxos da plataforma.</p>
        </div>
      </div>
    </footer>
  );
}
