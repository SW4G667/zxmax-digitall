import LegalPage, { Section } from "@/components/LegalPage";

export default function Regras() {
  return (
    <LegalPage title="Regras da plataforma" subtitle="Essas são as regras. Qualquer uma quebrada resulta em suspensão do site.">
      <Section heading="Proibido">
        <p>1 - Venda de conteúdo adulto.</p>
        <p>2 - Lavagem de dinheiro dentro do site.</p>
        <p>3 - Venda de gore/CP ou qualquer outro conteúdo errado.</p>
        <p>4 - Conteúdo de ensino criminoso.</p>
        <p>5 - Não entregar o produto mesmo após a venda.</p>
        <p>6 - Xingamento contra a moderação e clientes do site.</p>
      </Section>
      <Section heading="Punições">
        <p>Quem quebrar as quatro primeiras regras é suspenso permanentemente, com o saldo retido em análise e denúncia às autoridades quando cabível.</p>
        <p>Quem não entregar o produto após a venda perde a disputa, o comprador é reembolsado e a conta pode ser suspensa em caso de reincidência.</p>
        <p>Ofensas à moderação ou a clientes geram advertência e, na reincidência, suspensão.</p>
      </Section>
      <Section heading="Boas práticas">
        <p>Descreva o produto exatamente como ele é, responda perguntas no anúncio, entregue no chat do pedido em até 24 horas e mantenha o histórico dentro da plataforma — negociações por fora não têm proteção.</p>
      </Section>
    </LegalPage>
  );
}
