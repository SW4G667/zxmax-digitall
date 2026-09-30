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
        <p>Todo anúncio deve possuir uma imagem principal e passa por aprovação. A equipe pode reprovar, pausar ou remover anúncios que estejam incompletos, violem as regras, a lei ou direitos de terceiros.</p>
      </Section>
      <Section heading="5. Pagamentos e comissão">
        <p>Os pagamentos são processados por Pix através do gateway parceiro. A plataforma cobra uma comissão sobre cada venda concluída, informada no painel do vendedor. O valor mínimo por produto é R$ 2,00.</p>
      </Section>
      <Section heading="6. Entrega, confirmação e liberação da venda">
        <p>Entregas automáticas são disponibilizadas após a confirmação válida do pagamento; entregas manuais devem ser realizadas pelo vendedor dentro do pedido. Depois da entrega, o comprador pode confirmar o recebimento. Se ele não confirmar nem abrir uma disputa, o sistema conclui a entrega automaticamente após 5 dias. A partir dessa confirmação — manual ou automática — começa o período de segurança da carteira do marketplace, atualmente configurado em 10 dias. O saldo da venda só fica disponível ao vendedor após esse período.</p>
      </Section>
      <Section heading="7. Saques">
        <p>Saques exigem chave Pix cadastrada e documentos aprovados. Mínimos, taxas e saldo disponível dependem da carteira utilizada e são exibidos no painel antes da solicitação. Saques suspeitos de fraude, inconsistência ou disputa podem ser retidos para análise antes do processamento.</p>
      </Section>
      <Section heading="8. Pagamentos fora da plataforma">
        <p>É proibido usar anúncios, perguntas, chat de pedidos ou qualquer recurso da ZXMAX para desviar uma venda iniciada na plataforma para pagamento externo com o objetivo de evitar a proteção do pedido ou as tarifas aplicáveis. Quando houver evidência verificável de evasão de intermediação, fraude, estorno ou prejuízo diretamente ligado à transação, a conta poderá ser suspensa e poderá receber um ajuste financeiro documentado, limitado às tarifas não pagas ou ao prejuízo comprovado. Todo ajuste deve registrar valor, motivo e administrador responsável e pode ser contestado pelo suporte.</p>
      </Section>
      <Section heading="9. App Gateway, cobranças e carteira">
        <p>A criação de cobranças pelo App Gateway exige documentos aprovados. Essas cobranças são separadas das vendas de produtos: depois da confirmação servidor a servidor do identificador, status e valor da transação, o valor líquido é creditado imediatamente no saldo Gateway, sem o período de entrega aplicado ao marketplace. A taxa de depósito, a taxa de saque e o saque mínimo do Gateway são configuráveis pela administração e exibidos no painel. O saldo Gateway e o saldo de vendas do marketplace são contabilizados separadamente.</p>
      </Section>
      <Section heading="10. Condutas proibidas">
        <p>São proibidos: conteúdo adulto, gore ou infantil, material criminoso, lavagem de dinheiro, chargeback fraudulento, pagamentos simulados, ofensas à moderação e a outros usuários, e não entregar o produto vendido. A punição pode variar de advertência a suspensão permanente, sempre preservando registros necessários para disputas e auditoria.</p>
      </Section>
      <Section heading="11. Suspensão e revisão">
        <p>A conta suspensa perde acesso à loja, aos anúncios e ao saque enquanto durar a análise. O motivo e o ID são exibidos na tela de bloqueio. Decisões de moderação e ajustes financeiros podem ser contestados pelo suporte, com análise dos registros relacionados.</p>
      </Section>
      <Section heading="12. Alterações">
        <p>Estes termos podem ser atualizados a qualquer momento. Alterações relevantes passam a valer após sua publicação; o uso continuado do serviço fica sujeito à versão vigente.</p>
      </Section>
    </LegalPage>
  );
}
