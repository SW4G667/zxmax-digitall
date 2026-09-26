import { ReceiptText, WalletCards } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useStore } from "@/store/StoreContext";

export default function Taxas() {
  const { state } = useStore();
  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Valores</p>
          <h1 className="text-3xl md:text-5xl font-black text-foreground mt-2">Taxas e recebimentos</h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">O checkout usa o valor calculado no servidor. Quando o meio de pagamento tiver uma taxa adicional configurada, ela aparece antes da geração da cobrança.</p>
        </header>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="glass-card p-5 bg-card">
            <ReceiptText className="w-5 h-5 text-primary" />
            <h2 className="font-black text-foreground mt-3">Venda</h2>
            <p className="text-sm text-muted-foreground mt-2">A comissão configurada da plataforma é de <strong className="text-foreground">{Number(state.config.commission || 0).toFixed(2)}%</strong>. Confira o painel antes de publicar ou alterar preços.</p>
          </div>
          <div className="glass-card p-5 bg-card">
            <WalletCards className="w-5 h-5 text-primary" />
            <h2 className="font-black text-foreground mt-3">Pagamento e saque</h2>
            <p className="text-sm text-muted-foreground mt-2">Taxas do gateway e do tipo de saque podem variar conforme a configuração ativa. O valor relevante deve ser exibido na etapa correspondente antes da confirmação.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Esta página descreve a configuração atual carregada pelo site; o valor efetivo registrado no pedido é o calculado pelo backend no momento da operação.</p>
      </div>
    </AppShell>
  );
}
