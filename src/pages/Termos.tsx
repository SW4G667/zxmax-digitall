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
        <p>Os pagamentos são processados por Pix através do gateway parceiro. A plataforma cobra uma comissão sobre cada venda concluída, informada no painel do vendedor. O valor mínimo por produto é R$ 2,00.</p>
      </Section>
      <Section heading="6. Entrega, disputas e reembolso">
        <p>Entregas automáticas são liberadas na confirmação do pagamento; entregas manuais devem ocorrer em até 24 horas pelo chat do pedido. O comprador pode abrir disputa em caso de não entrega ou produto diferente do anunciado. A decisão da equipe, com base nas provas do chat, é final.</p>
      </Section>
      <Section heading="7. Saques">
        <p>Saques exigem chave Pix cadastrada e documentos aprovados. O valor mínimo é R$ 2,00 e o pagamento ocorre em 5 a 7 dias úteis após aprovação. Saques suspeitos de fraude podem ser bloqueados para análise.</p>
      </Section>
      <Section heading="8. Pagamentos fora da plataforma">
        <p>É proibido usar anúncios, perguntas, chat de pedidos ou qualquer recurso da ZXMAX para desviar uma venda iniciada na plataforma para pagamento externo com o objetivo de evitar a proteção do pedido ou as tarifas aplicáveis. Quando houver evidência verificável de evasão de intermediação, fraude, estorno ou prejuízo diretamente ligado à transação, a conta poderá ser suspensa e poderá receber um ajuste financeiro documentado, limitado às tarifas não pagas ou ao prejuízo comprovado. Todo ajuste deve registrar valor, motivo e administrador responsável e pode ser contestado pelo suporte.</p>
      </Section>
      <Section heading="9. Cobranças avulsas e carteira">
        <p>A criação de cobranças avulsas exige documentos aprovados. As cobranças devem corresponder a finalidade lícita e identificável. Um valor só entra na carteira depois de a ZXMAX consultar o provedor de pagamento e confirmar servidor a servidor o identificador, o status e o valor da transação. Taxas do provedor e de saque podem reduzir o valor líquido disponível e são informadas no painel.</p>
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
