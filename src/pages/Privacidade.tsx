import LegalPage, { Section } from "@/components/LegalPage";

export default function Privacidade() {
  return (
    <LegalPage title="Política de privacidade" subtitle="Como a ZXMAX coleta, usa e protege seus dados.">
      <Section heading="1. Dados que coletamos">
        <p>Cadastro: e-mail, nome de exibição, foto e ID numérico público. Financeiro: chave Pix e histórico de pedidos e saques. Verificação: documento enviado voluntariamente por quem deseja sacar. Uso: mensagens do chat de pedido, tickets de suporte e registros técnicos de pagamento.</p>
      </Section>
      <Section heading="2. Para que usamos">
        <p>Operar a conta, processar pagamentos e saques, moderar anúncios, resolver disputas, prevenir fraude e cumprir obrigações legais.</p>
      </Section>
      <Section heading="3. O que é público">
        <p>Outros usuários veem apenas seu nome de exibição, foto, ID numérico, anúncios aprovados e avaliações. E-mail, chave Pix e documentos <strong>nunca</strong> são exibidos publicamente.</p>
      </Section>
      <Section heading="4. Compartilhamento">
        <p>Compartilhamos o mínimo necessário com o gateway de pagamento para processar Pix e com autoridades quando exigido por lei. Não vendemos dados pessoais.</p>
      </Section>
      <Section heading="5. Segurança">
        <p>Os dados ficam em banco com regras de acesso por linha (RLS); documentos ficam em armazenamento privado com links temporários; chaves de API vivem apenas no servidor e nunca chegam ao navegador.</p>
      </Section>
      <Section heading="6. Retenção">
        <p>Mantemos registros de pedidos e pagamentos pelo prazo legal, mesmo após a exclusão da conta, para fins fiscais e de prevenção à fraude. Documentos de verificação são apagados após a análise quando não houver obrigação de guarda.</p>
      </Section>
      <Section heading="7. Seus direitos">
        <p>Você pode acessar, corrigir ou solicitar a exclusão dos seus dados pelo suporte dentro da plataforma. Alguns dados podem ser mantidos quando houver base legal.</p>
      </Section>
      <Section heading="8. Cookies e armazenamento local">
        <p>Usamos armazenamento local apenas para preferências de interface (como o tema claro/escuro) e para manter sua sessão autenticada. Não usamos rastreamento publicitário.</p>
      </Section>
    </LegalPage>
  );
}
