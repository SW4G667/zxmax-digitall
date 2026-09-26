import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Banknote, CheckCircle2, Clock3, CreditCard, Headset,
  PackageCheck, Receipt, RefreshCcw, ShieldCheck, ShoppingBag, Store, Zap,
} from "lucide-react";
import AppShell from "@/components/AppShell";

export type MarketplaceInfoKind =
  | "como-funciona"
  | "comprar"
  | "vender"
  | "seguranca"
  | "pagamentos"
  | "tarifas"
  | "reembolsos"
  | "entrega-automatica"
  | "vendedores-verificados"
  | "central-ajuda";

type Section = { title: string; text: string; icon: React.ComponentType<{ className?: string }> };

const CONTENT: Record<MarketplaceInfoKind, {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Section[];
  primary: { label: string; to: string };
  secondary?: { label: string; to: string };
}> = {
  "como-funciona": {
    eyebrow: "Visão geral",
    title: "Como funciona a ZXMAX",
    intro: "A plataforma organiza descoberta, pagamento, acompanhamento e entrega em um único fluxo para reduzir improvisos durante uma negociação digital.",
    sections: [
      { title: "1. Encontre uma oferta", text: "Pesquise pelo catálogo, abra categorias e compare os detalhes de cada anúncio antes de comprar.", icon: ShoppingBag },
      { title: "2. Revise e pague", text: "O checkout apresenta produto, quantidade e método disponível antes da confirmação.", icon: CreditCard },
      { title: "3. Acompanhe o pedido", text: "Depois do pagamento, o pedido continua dentro da área autenticada com status e ações próprias.", icon: PackageCheck },
      { title: "4. Confirme a entrega", text: "A confirmação encerra o fluxo normal da compra; problemas podem seguir para suporte e análise.", icon: CheckCircle2 },
    ],
    primary: { label: "Explorar marketplace", to: "/loja" },
    secondary: { label: "Central de ajuda", to: "/central-de-ajuda" },
  },
  comprar: {
    eyebrow: "Para compradores",
    title: "Comprar produtos digitais com mais contexto",
    intro: "A ZXMAX separa catálogo, anúncio, checkout e acompanhamento para que você saiba em qual etapa está e quem está vendendo.",
    sections: [
      { title: "Compare antes de comprar", text: "Use categorias, ordenação, entrega automática, perfil público e dados do anúncio para decidir.", icon: ShoppingBag },
      { title: "Confira o vendedor", text: "Perfis e identificadores públicos ajudam a diferenciar vendedores e manter o histórico dentro da plataforma.", icon: BadgeCheck },
      { title: "Revise o checkout", text: "Preço, quantidade e método de pagamento devem ser conferidos antes da confirmação.", icon: Receipt },
      { title: "Use o suporte quando necessário", text: "Pedidos e problemas ficam ligados à sua conta para facilitar a análise do atendimento.", icon: Headset },
    ],
    primary: { label: "Começar a comprar", to: "/loja" },
    secondary: { label: "Ver categorias", to: "/categorias" },
  },
  vender: {
    eyebrow: "Para vendedores",
    title: "Venda com uma vitrine organizada",
    intro: "Crie anúncios, acompanhe pedidos e mantenha a comunicação e a entrega vinculadas à sua conta.",
    sections: [
      { title: "Publique seu anúncio", text: "Defina categoria, preço, estoque, descrição e forma de entrega com informações claras.", icon: Store },
      { title: "Acompanhe novas vendas", text: "Pedidos pagos aparecem na sua área para que você saiba o que precisa entregar.", icon: Receipt },
      { title: "Use entrega automática quando fizer sentido", text: "Produtos compatíveis podem reduzir trabalho manual e acelerar o recebimento pelo comprador.", icon: Zap },
      { title: "Construa reputação", text: "Mantenha anúncios corretos, responda clientes e cumpra o que foi descrito na oferta.", icon: BadgeCheck },
    ],
    primary: { label: "Gerenciar meus anúncios", to: "/meus-produtos" },
    secondary: { label: "Ver regras", to: "/regras" },
  },
  seguranca: {
    eyebrow: "Confiança",
    title: "Segurança pensada para o fluxo inteiro",
    intro: "A experiência separa identidade pública, permissões administrativas, pedido e pagamento para reduzir exposição desnecessária e ações fora de contexto.",
    sections: [
      { title: "Pagamento verificado no servidor", text: "A confirmação não depende apenas do navegador: o backend valida o estado do pagamento antes de concluir o pedido.", icon: ShieldCheck },
      { title: "Permissões por área", text: "Recursos de comprador, vendedor, suporte e administração ficam em rotas e ações distintas.", icon: BadgeCheck },
      { title: "Histórico do pedido", text: "Status e ações permanecem associados ao pedido para facilitar acompanhamento e suporte.", icon: Receipt },
      { title: "Evite negociações por fora", text: "Manter pagamento e acompanhamento dentro da plataforma preserva as evidências do fluxo.", icon: CheckCircle2 },
    ],
    primary: { label: "Ver como funciona", to: "/como-funciona" },
    secondary: { label: "Regras da plataforma", to: "/regras" },
  },
  pagamentos: {
    eyebrow: "Checkout",
    title: "Formas de pagamento",
    intro: "As opções exibidas no checkout dependem das integrações ativas da plataforma. O comprador vê somente métodos atualmente disponíveis.",
    sections: [
      { title: "PIX", text: "Quando disponível, o checkout gera os dados de pagamento e acompanha a confirmação pelo provedor configurado.", icon: Banknote },
      { title: "Métodos adicionais", text: "Outros gateways podem aparecer quando estiverem ativos e configurados pela administração.", icon: CreditCard },
      { title: "Status do pagamento", text: "O pedido só avança quando a confirmação correspondente é recebida e validada.", icon: CheckCircle2 },
      { title: "Sem credenciais no navegador", text: "Chaves privadas de gateway permanecem no backend e não fazem parte do código público da página.", icon: ShieldCheck },
    ],
    primary: { label: "Explorar produtos", to: "/loja" },
    secondary: { label: "Segurança", to: "/seguranca" },
  },
  tarifas: {
    eyebrow: "Transparência",
    title: "Tarifas e prazos",
    intro: "Valores, eventuais taxas e prazos aplicáveis devem aparecer no fluxo correspondente antes de uma ação financeira ser concluída.",
    sections: [
      { title: "Preço do anúncio", text: "O valor principal é definido no produto e exibido no anúncio e no checkout.", icon: Receipt },
      { title: "Taxas aplicáveis", text: "Quando houver cobrança adicional, ela deve ser apresentada antes da confirmação para evitar surpresa no total.", icon: Banknote },
      { title: "Prazo de entrega", text: "Cada vendedor informa o prazo ou o tipo de entrega do anúncio; ofertas automáticas são identificadas separadamente.", icon: Clock3 },
      { title: "Prazo do pedido", text: "O andamento pode variar conforme pagamento, entrega e necessidade de suporte.", icon: PackageCheck },
    ],
    primary: { label: "Abrir catálogo", to: "/loja" },
    secondary: { label: "Formas de pagamento", to: "/formas-de-pagamento" },
  },
  reembolsos: {
    eyebrow: "Pedidos e problemas",
    title: "Reembolsos e resolução de problemas",
    intro: "Solicitações relacionadas a uma compra devem partir do pedido correspondente para que a equipe consiga analisar contexto, pagamento e entrega.",
    sections: [
      { title: "Abra o pedido correto", text: "Use a área de compras para localizar a transação e evitar solicitações sem referência.", icon: Receipt },
      { title: "Informe o problema", text: "Descreva o que ocorreu e mantenha as informações relacionadas ao pedido dentro da plataforma.", icon: Headset },
      { title: "Aguarde a análise", text: "Quando houver disputa, as ações administrativas seguem o estado registrado do pedido.", icon: Clock3 },
      { title: "Resultado registrado", text: "A resolução altera o estado do pedido e pode gerar notificações para comprador e vendedor.", icon: RefreshCcw },
    ],
    primary: { label: "Meus pedidos", to: "/minhas-compras" },
    secondary: { label: "Termos de uso", to: "/termos" },
  },
  "entrega-automatica": {
    eyebrow: "Entrega",
    title: "Entrega automática",
    intro: "Anúncios compatíveis podem entregar o conteúdo após a confirmação do pagamento, reduzindo etapas manuais para comprador e vendedor.",
    sections: [
      { title: "Identificação no catálogo", text: "Ofertas com entrega automática recebem indicação própria para facilitar a comparação.", icon: Zap },
      { title: "Pagamento confirmado", text: "A entrega não deve ocorrer antes da validação do pagamento correspondente.", icon: ShieldCheck },
      { title: "Estoque controlado", text: "Itens automáticos dependem de estoque e disponibilidade definidos pelo vendedor.", icon: PackageCheck },
      { title: "Pedido continua registrado", text: "Mesmo com entrega rápida, a compra permanece vinculada ao histórico da conta.", icon: Receipt },
    ],
    primary: { label: "Ver entrega automática", to: "/loja?delivery=auto" },
    secondary: { label: "Como funciona", to: "/como-funciona" },
  },
  "vendedores-verificados": {
    eyebrow: "Identidade pública",
    title: "Vendedores verificados",
    intro: "A verificação é um sinal adicional exibido no marketplace. Ela não substitui a leitura do anúncio, do histórico e das condições de entrega.",
    sections: [
      { title: "Selo visível", text: "Quando disponível para o perfil, o selo ajuda a identificar contas que passaram pelo processo definido pela plataforma.", icon: BadgeCheck },
      { title: "ID público", text: "O marketplace usa identificadores públicos para diferenciar vendedores sem expor dados privados.", icon: ShieldCheck },
      { title: "Avaliações e vendas", text: "Quando registradas, métricas do anúncio e avaliações ajudam a adicionar contexto à decisão.", icon: CheckCircle2 },
      { title: "Compare a oferta completa", text: "Preço, prazo, estoque e descrição continuam importantes mesmo quando o vendedor é verificado.", icon: ShoppingBag },
    ],
    primary: { label: "Ver vendedores verificados", to: "/loja?verified=1" },
    secondary: { label: "Segurança", to: "/seguranca" },
  },
  "central-ajuda": {
    eyebrow: "Ajuda",
    title: "Central de ajuda",
    intro: "Comece pelas orientações públicas e, se o problema estiver ligado a uma conta ou pedido, entre na área de suporte autenticada.",
    sections: [
      { title: "Perguntas frequentes", text: "Consulte respostas rápidas sobre conta, compra, venda e funcionamento geral.", icon: CheckCircle2 },
      { title: "Pedidos e compras", text: "Abra sua área de pedidos para conferir status e ações disponíveis para cada compra.", icon: Receipt },
      { title: "Suporte autenticado", text: "Problemas específicos da sua conta podem ser tratados pela área de suporte.", icon: Headset },
      { title: "Segurança", text: "Consulte orientações para manter negociação, pagamento e entrega dentro da plataforma.", icon: ShieldCheck },
    ],
    primary: { label: "Abrir FAQ", to: "/faq" },
    secondary: { label: "Entrar no suporte", to: "/suporte" },
  },
};

export default function MarketplaceInfo({ kind }: { kind: MarketplaceInfoKind }) {
  const page = CONTENT[kind];
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0d1118] px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_0%,rgba(22,140,255,.22),transparent_34%)]" />
          <div className="relative max-w-3xl">
            <p className="text-[10px] font-black uppercase tracking-[0.19em] text-[#73c1ff]">{page.eyebrow}</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.05em] text-white sm:text-5xl">{page.title}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">{page.intro}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to={page.primary.to} className="inline-flex items-center gap-2 rounded-xl bg-[#168cff] px-4 py-3 text-xs font-black text-white transition hover:bg-[#0877e6]">{page.primary.label}<ArrowRight className="h-3.5 w-3.5" /></Link>
              {page.secondary && <Link to={page.secondary.to} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.11] bg-white/[0.035] px-4 py-3 text-xs font-black text-white/70 transition hover:bg-white/[0.07] hover:text-white">{page.secondary.label}</Link>}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {page.sections.map((section, index) => (
            <article key={section.title} className="rounded-2xl border border-white/[0.075] bg-[#101319] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#168cff]/15 bg-[#168cff]/10 text-[#72c0ff]"><section.icon className="h-5 w-5" /></span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/28">Etapa {String(index + 1).padStart(2, "0")}</p>
                  <h2 className="mt-1 text-base font-black text-white">{section.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/45">{section.text}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-6 rounded-2xl border border-white/[0.075] bg-[#101319] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div><p className="text-sm font-black text-white">Ainda precisa de ajuda?</p><p className="mt-1 text-xs text-white/40">Use o FAQ para dúvidas gerais ou o suporte autenticado para problemas ligados à sua conta.</p></div>
            <div className="flex gap-2"><Link to="/faq" className="rounded-xl border border-white/[0.1] px-4 py-2.5 text-xs font-black text-white/70 hover:text-white">FAQ</Link><Link to="/central-de-ajuda" className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black">Central de ajuda</Link></div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
