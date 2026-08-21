import LegalPage, { Section } from "@/components/LegalPage";

export default function Termos() {
  return (
    <LegalPage title="Termos de uso" subtitle="Condições para usar a ZXMAX como comprador ou vendedor.">
      <Section heading="1. Aceite">
        <p>Ao criar uma conta ou utilizar a ZXMAX você concorda integralmente com estes termos, com as Regras da plataforma e com a Política de privacidade. Se não concordar, não utilize o serviço.</p>
      </Section>
      <Section heading="2. Conta">
        <p>Você é responsável pelos dados informados e pela segurança da sua senha. É proibido criar contas para burlar suspensões, usar identidade de terceiros ou compartilhar acesso. Cada usuário recebe um ID numérico público usado em denúncias e no suporte.</p>
      </Section>
      <Section heading="3. Papel da plataforma">
        <p>A ZXMAX é uma intermediadora: aproxima compradores e vendedores, processa o pagamento e oferece moderação e disputa. A responsabilidade pelo conteúdo, licença e funcionamento do produto é do vendedor.</p>
      </Section>
      <Section heading="4. Anúncios e moderação">
        <p>Todo anúncio passa por aprovação. A equipe pode reprovar, pausar ou remover anúncios que violem as regras, a lei ou direitos de terceiros, sem aviso prévio.</p>
      </Section>
      <Section heading="5. Pagamentos e comissão">
        <p>Os pagamentos são processados por Pix através do gateway parceiro. A plataforma cobra uma comissão sobre cada venda concluída, informada no painel do vendedor. O valor mínimo por produto é R$ 5,00.</p>
      </Section>
      <Section heading="6. Entrega, disputas e reembolso">
        <p>Entregas automáticas são liberadas na confirmação do pagamento; entregas manuais devem ocorrer em até 24 horas pelo chat do pedido. O comprador pode abrir disputa em caso de não entrega ou produto diferente do anunciado. A decisão da equipe, com base nas provas do chat, é final.</p>
      </Section>
      <Section heading="7. Saques">
        <p>Saques exigem chave Pix cadastrada e documentos aprovados. O valor mínimo é R$ 5,00 e o pagamento ocorre em 5 a 7 dias úteis após aprovação. Saques suspeitos de fraude podem ser bloqueados para análise.</p>
      </Section>
      <Section heading="8. Condutas proibidas">
        <p>São proibidos: conteúdo adulto, gore ou infantil, material criminoso, lavagem de dinheiro, chargeback fraudulento, ofensas à moderação e a outros usuários, e não entregar o produto vendido. A punição vai de advertência a suspensão permanente com retenção de saldo em análise.</p>
      </Section>
      <Section heading="9. Suspensão">
        <p>A conta suspensa perde acesso à loja, aos anúncios e ao saque enquanto durar a análise. O motivo e o ID são exibidos na tela de bloqueio e podem ser contestados pelo suporte.</p>
      </Section>
      <Section heading="10. Alterações">
        <p>Estes termos podem ser atualizados a qualquer momento. O uso continuado após a publicação de uma nova versão significa aceite.</p>
      </Section>
    </LegalPage>
  );
}
