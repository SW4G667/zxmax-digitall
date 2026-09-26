import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Store, ShoppingBag, BadgeCheck, MessageSquare, Scale, WalletCards, Search, ChevronRight } from "lucide-react";
import AppShell from "@/components/AppShell";

type Kind = "categorias" | "vender" | "como-funciona" | "seguranca" | "central-ajuda";

const content: Record<Kind, { title: string; subtitle: string; items: { icon: any; title: string; text: string }[] }> = {
  categorias: {
    title: "Categorias do marketplace",
    subtitle: "Encontre produtos digitais por tipo, entrega e finalidade.",
    items: [
      { icon: ShoppingBag, title: "Jogos e moedas", text: "Robux, gift cards, itens e produtos relacionados a jogos." },
      { icon: Store, title: "Contas e serviços", text: "Contas, serviços digitais, automações e consultoria." },
      { icon: Search, title: "Bots, scripts e software", text: "Bots para Discord, scripts, licenças e ferramentas." },
      { icon: BadgeCheck, title: "Vendedores verificados", text: "Filtre anúncios de contas com verificação aprovada." },
    ],
  },
  vender: {
    title: "Venda na ZXMAX",
    subtitle: "Publique anúncios profissionais e acompanhe cada etapa da venda.",
    items: [
      { icon: Store, title: "Crie seu anúncio", text: "Adicione título, imagens, estoque, prazo, variações e tipo de entrega." },
      { icon: ShieldCheck, title: "Moderação", text: "Anúncios passam por controles para reduzir fraude e conteúdo proibido." },
      { icon: WalletCards, title: "Receba suas vendas", text: "Acompanhe saldo, pedidos, entregas, disputas e solicitações de saque." },
      { icon: MessageSquare, title: "Atenda compradores", text: "Use o chat do pedido para registrar comunicação dentro da plataforma." },
    ],
  },
  "como-funciona": {
    title: "Como funciona",
    subtitle: "Fluxo claro da compra ao recebimento.",
    items: [
      { icon: Search, title: "1. Encontre", text: "Compare anúncios, preço, estoque, vendedor e avaliações." },
      { icon: WalletCards, title: "2. Pague", text: "Finalize pelo checkout e, no Pix, receba a cobrança MagnusPay." },
      { icon: ShoppingBag, title: "3. Receba", text: "A entrega pode ser automática ou feita pelo vendedor dentro do pedido." },
      { icon: BadgeCheck, title: "4. Avalie", text: "Depois da conclusão, registre sua experiência com o anúncio." },
    ],
  },
  seguranca: {
    title: "Segurança da plataforma",
    subtitle: "Controles de autorização, pagamento e rastreabilidade para reduzir abuso.",
    items: [
      { icon: ShieldCheck, title: "Pagamento validado no servidor", text: "A chave do gateway não fica no navegador e pagamentos são conferidos antes da liberação." },
      { icon: Scale, title: "Disputas e auditoria", text: "Pedidos, eventos administrativos e alterações sensíveis deixam histórico." },
      { icon: BadgeCheck, title: "Verificação de vendedor", text: "A plataforma suporta verificação e moderação de contas vendedoras." },
      { icon: MessageSquare, title: "Chat vinculado ao pedido", text: "Comunicação relevante pode permanecer associada à transação." },
    ],
  },
  "central-ajuda": {
    title: "Central de ajuda",
    subtitle: "Atalhos para resolver problemas de conta, compra e venda.",
    items: [
      { icon: ShoppingBag, title: "Compras", text: "Acompanhe pagamento, entrega, confirmação e avaliação." },
      { icon: Store, title: "Vendas", text: "Gerencie anúncios, estoque, entregas e atendimento." },
      { icon: WalletCards, title: "Pagamentos e saques", text: "Consulte status de Pix, saldo e solicitações de saque." },
      { icon: ShieldCheck, title: "Conta e segurança", text: "Atualize seus dados, senha e verificação de identidade." },
    ],
  },
};

export default function MarketplaceInfo({ kind }: { kind: Kind }) {
  const page = content[kind];
  return (
    <AppShell>
      <div className="max-w-6xl mx-auto">
        <div className="py-8 md:py-12">
          <p className="text-xs text-[#0084ff] font-black uppercase tracking-widest mb-3">ZXMAX Marketplace</p>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">{page.title}</h1>
          <p className="text-white/45 max-w-2xl mt-3">{page.subtitle}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {page.items.map(({icon:Icon,title,text})=>(
            <div key={title} className="bg-[#121217] border border-white/10 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-[#0084ff]/10 text-[#0084ff] grid place-items-center mb-4"><Icon className="w-5 h-5" /></div>
              <h2 className="font-black text-white">{title}</h2>
              <p className="text-sm text-white/40 mt-2 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 bg-[#121217] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div><p className="font-black text-white">Quer explorar agora?</p><p className="text-xs text-white/40 mt-1">Veja anúncios ativos e compare vendedores.</p></div>
          <Link to="/loja" className="bg-[#0084ff] text-white rounded-xl px-4 py-3 text-xs font-black flex items-center gap-2">Ir para a loja <ChevronRight className="w-4 h-4" /></Link>
        </div>
      </div>
    </AppShell>
  );
}
