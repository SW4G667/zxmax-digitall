import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, PackageCheck, ShieldCheck, ShoppingBag } from "lucide-react";
import AppShell from "@/components/AppShell";

const steps = [
  { icon: ShoppingBag, title: "1. Escolha o anúncio", text: "Confira descrição, vendedor, ID do produto, prazo de entrega e quantidade antes de comprar." },
  { icon: ShieldCheck, title: "2. Pague no checkout", text: "A cobrança PIX é criada pelo backend. O navegador não define o valor final nem recebe a chave privada do gateway." },
  { icon: PackageCheck, title: "3. Acompanhe o pedido", text: "O histórico do pedido concentra status, entrega, mensagens e eventual disputa." },
  { icon: CheckCircle2, title: "4. Finalize com segurança", text: "Confirme a entrega somente depois de receber o que foi anunciado. Em caso de problema, use a disputa do pedido." },
];

export default function ComoFunciona() {
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Marketplace</p>
          <h1 className="text-3xl md:text-5xl font-black text-foreground mt-2">Como funciona</h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">Compra, pagamento, entrega e suporte ficam ligados ao mesmo pedido para facilitar rastreio e moderação.</p>
        </header>
        <div className="grid md:grid-cols-2 gap-4">
          {steps.map(({ icon: Icon, title, text }) => (
            <article key={title} className="glass-card p-5 bg-card">
              <Icon className="w-5 h-5 text-primary mb-3" />
              <h2 className="font-black text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{text}</p>
            </article>
          ))}
        </div>
        <div className="glass-card p-6 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div><h2 className="font-black text-foreground">Pronto para explorar?</h2><p className="text-sm text-muted-foreground mt-1">Use filtros, compare anúncios e confira o vendedor antes de pagar.</p></div>
          <Link to="/loja" className="btn-gradient px-5 py-3 rounded-xl font-black text-sm inline-flex items-center gap-2">Abrir loja <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </div>
    </AppShell>
  );
}
