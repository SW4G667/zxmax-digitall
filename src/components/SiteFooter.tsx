import React from "react";
import { Link } from "react-router-dom";
import { useSiteBranding } from "@/context/SiteBrandingContext";
import BrandMark from "@/components/BrandMark";

const columns = [
  {
    title: "Sobre",
    items: [
      ["Como funciona", "/como-funciona"],
      ["Segurança", "/seguranca"],
      ["Central de ajuda", "/central-de-ajuda"],
      ["Perguntas frequentes", "/faq"],
    ],
  },
  {
    title: "Acesso rápido",
    items: [
      ["Anunciar", "/meus-produtos"],
      ["Categorias", "/categorias"],
      ["Robux", "/robux"],
      ["Meus pedidos", "/minhas-compras"],
    ],
  },
  {
    title: "Como funciona",
    items: [
      ["Como comprar", "/comprar"],
      ["Como vender", "/vender"],
      ["Tarifas e prazos", "/tarifas-e-prazos"],
      ["Formas de pagamento", "/formas-de-pagamento"],
    ],
  },
  {
    title: "Institucional",
    items: [
      ["Termos de uso", "/termos"],
      ["Política de privacidade", "/privacidade"],
      ["Regras da plataforma", "/regras"],
      ["Reembolsos", "/reembolsos"],
    ],
  },
];

export default function SiteFooter() {
  const { branding } = useSiteBranding();

  return (
    <footer className="mt-10 border-t border-white/[0.065] bg-[#090a0d]">
      <div className="mx-auto max-w-[1180px] px-4 py-8 sm:py-10">
        <div className="grid gap-9 lg:grid-cols-[1.2fr_2fr]">
          <div className="max-w-sm">
            <Link to="/" className="inline-flex">
              <BrandMark />
            </Link>
            <p className="mt-4 max-w-xs text-[11px] leading-5 text-white/32">
              Marketplace para compra e venda de produtos e serviços digitais, com pedidos e pagamentos organizados pela plataforma.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.13em] text-white/35">{column.title}</h2>
                <div className="mt-3 space-y-2.5">
                  {column.items.map(([label, to]) => (
                    <Link key={to} to={to} className="block text-xs text-white/38 transition hover:text-white">{label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-9 border-t border-white/[0.06] pt-5 text-[10px] text-white/22">
          © {new Date().getFullYear()} {branding.siteName || "ZXMAX"}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
