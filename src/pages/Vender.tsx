import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Boxes, FileCheck2, MessageSquareText } from "lucide-react";
import AppShell from "@/components/AppShell";

export default function Vender() {
  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Área do vendedor</p>
          <h1 className="text-3xl md:text-5xl font-black text-foreground mt-2">Venda sem perder o controle do pedido</h1>
          <p className="text-muted-foreground mt-3 leading-relaxed">Cadastre o anúncio, informe estoque e entrega com clareza e acompanhe cada venda dentro da plataforma.</p>
        </header>
        <div className="grid md:grid-cols-4 gap-3">
          {[
            [Boxes, "Catálogo", "Crie e edite anúncios, variações, estoque e imagens."],
            [FileCheck2, "Moderação", "Anúncios podem passar por revisão antes de aparecer publicamente."],
            [MessageSquareText, "Pedido", "Converse e entregue pelo histórico do pedido quando a entrega for manual."],
            [BadgeCheck, "Perfil", "Mantenha identidade, avatar e dados de recebimento atualizados."],
          ].map(([Icon, title, text]: any) => (
            <article key={title} className="glass-card p-4 bg-card"><Icon className="w-5 h-5 text-primary" /><h2 className="font-black text-foreground mt-3">{title}</h2><p className="text-xs text-muted-foreground mt-2 leading-relaxed">{text}</p></article>
          ))}
        </div>
        <div className="glass-card p-6 bg-card">
          <h2 className="font-black text-foreground">Antes de publicar</h2>
          <p className="text-sm text-muted-foreground mt-2">Use título objetivo, imagem própria ou autorizada, descrição precisa, prazo realista, estoque verdadeiro e conteúdo de entrega que você consegue cumprir. Produtos que violam as regras podem ser pausados ou removidos.</p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/meus-produtos" className="btn-gradient px-5 py-3 rounded-xl text-sm font-black inline-flex items-center gap-2">Gerenciar anúncios <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/regras" className="px-5 py-3 rounded-xl text-sm font-black bg-muted text-foreground">Ver regras</Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
