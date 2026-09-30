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
      { title: "Publique seu anúncio", text: "Envie uma imagem principal e defina categoria, preço, estoque, descrição e forma de entrega com informações claras.", icon: Store },
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
    intro: "Vendas do marketplace e cobranças do App Gateway usam saldos e prazos diferentes. Taxas e valores aplicáveis são apresentados no fluxo correspondente antes da ação financeira.",
    sections: [
      { title: "Preço do anúncio", text: "O valor principal é definido no produto e exibido no anúncio e no checkout.", icon: Receipt },
      { title: "Taxas aplicáveis", text: "O App Gateway pode ter taxa de depósito, taxa de saque e saque mínimo próprios; vendas do marketplace seguem as taxas e o prazo de segurança configurados para vendas.", icon: Banknote },
      { title: "Prazo de entrega", text: "Cada vendedor informa o prazo ou o tipo de entrega do anúncio; ofertas automáticas são identificadas separadamente.", icon: Clock3 },
      { title: "Saldo de vendas", text: "Após a entrega, o comprador tem até 5 dias para confirmar. Sem ação, a entrega é concluída automaticamente; então começa o período de segurança da carteira, atualmente em 10 dias.", icon: PackageCheck },
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
      <div className="mx-auto max-w-[900px]">
        <header className="border-b border-white/[0.07] pb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">{page.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl">{page.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/45">{page.intro}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to={page.primary.to} className="rounded-md bg-[#168cff] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0878dc]">{page.primary.label}</Link>
            {page.secondary ? <Link to={page.secondary.to} className="rounded-md border border-white/[0.1] px-4 py-2.5 text-xs font-medium text-white/60 hover:bg-white/[0.035] hover:text-white">{page.secondary.label}</Link> : null}
          </div>
        </header>

        <div className="mt-6 divide-y divide-white/[0.07] rounded-lg border border-white/[0.08] bg-[#101013]">
          {page.sections.map((section) => (
            <article key={section.title} className="flex gap-3 p-4 sm:p-5">
              <section.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#5eafff]" />
              <div>
                <h2 className="text-sm font-semibold text-white">{section.title}</h2>
                <p className="mt-1 text-sm leading-6 text-white/40">{section.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
