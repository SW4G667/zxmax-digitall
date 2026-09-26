import { Fingerprint, KeyRound, LockKeyhole, ScanSearch, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";

export default function Seguranca() {
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Proteção da conta e dos pedidos</p>
          <h1 className="text-3xl md:text-5xl font-black text-foreground mt-2">Segurança por camadas</h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">Dados públicos do vendedor ficam separados de dados privados, pagamentos são criados no servidor e ações administrativas usam controles próprios.</p>
        </header>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            [KeyRound, "Credenciais do gateway", "A chave da MagnusPay fica em Secret do Supabase e não é enviada ao navegador."],
            [Fingerprint, "Perfil público separado", "A loja usa somente ID público, nome, avatar e status de vendedor; e-mail, CPF, telefone e Pix ficam fora dessa projeção."],
            [ShieldCheck, "2FA administrativo", "O painel possui suporte a autenticação em duas etapas para reduzir risco de tomada de conta."],
            [ScanSearch, "Rastreio de pedidos", "Status, mensagens, IDs e eventos ajudam suporte e moderação a analisar o que ocorreu."],
            [LockKeyhole, "Arquivos sensíveis", "Documentos e anexos de pedido usam buckets privados, enquanto imagens de catálogo e identidade visual podem ser públicas."],
          ].map(([Icon, title, text]: any) => (
            <article key={title} className="glass-card p-5 bg-card"><Icon className="w-5 h-5 text-primary" /><h2 className="font-black text-foreground mt-3">{title}</h2><p className="text-sm text-muted-foreground mt-2 leading-relaxed">{text}</p></article>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
