import LegalPage, { Section } from "@/components/LegalPage";

export default function Faq() {
  return (
    <LegalPage title="Perguntas frequentes" subtitle="Tudo o que você precisa saber para comprar e vender na ZXMAX.">
      <Section heading="O que é a ZXMAX?">
        <p>A ZXMAX é um marketplace de produtos digitais: bots, contas, scripts, assinaturas, designs, keys de software, serviços online e arquivos. Compradores e vendedores negociam dentro da plataforma, com pagamento por Pix e chat de pedido protegido.</p>
      </Section>
      <Section heading="Como funciona a compra?">
        <p>1. Escolha o produto e clique em <strong>Comprar</strong>. 2. Faça login ou crie sua conta. 3. Um QR Code Pix é gerado com validade curta. 4. Assim que o pagamento é confirmado pelo gateway, o pedido muda para <strong>Pago</strong> automaticamente. 5. A entrega é liberada (automática) ou feita pelo vendedor no chat do pedido (manual).</p>
      </Section>
      <Section heading="Quanto tempo demora a entrega?">
        <p>Produtos com entrega automática são liberados na hora da confirmação do pagamento. Produtos com entrega manual devem ser entregues pelo vendedor no chat do pedido em até 24 horas.</p>
      </Section>
      <Section heading="E se o vendedor não entregar?">
        <p>Abra uma disputa no pedido em <em>Minhas compras</em>. A equipe analisa as mensagens do chat e as provas enviadas. Se a falha for do vendedor, o valor é devolvido e ele pode ser suspenso.</p>
      </Section>
      <Section heading="Como recebo o dinheiro das minhas vendas?">
        <p>O valor da venda entra no seu saldo já com a comissão da plataforma descontada. Para sacar, cadastre uma chave Pix no perfil, envie seus documentos para verificação e solicite o saque. Após a aprovação da equipe, o Pix é enviado em 5 a 7 dias úteis.</p>
      </Section>
      <Section heading="Qual é o valor mínimo?">
        <p>O valor mínimo de um produto é R$ 2,00 e o valor mínimo de saque é R$ 5,00 (com taxa de transferência Pix de R$ 1,20).</p>
      </Section>
      <Section heading="Por que preciso enviar documentos?">
        <p>A verificação (RG ou certidão) protege a plataforma contra fraude e lavagem de dinheiro. Ela é exigida apenas para quem vai <strong>sacar</strong> valores, e os arquivos ficam em armazenamento privado, visíveis somente para a equipe de verificação.</p>
      </Section>
      <Section heading="Meu anúncio sumiu da loja. O que houve?">
        <p>Todo anúncio passa por moderação. Enquanto não é aprovado pela equipe, ele aparece somente para você em <em>Meus produtos</em>. Se você editar informações essenciais (preço, descrição, entrega), ele volta para a fila de aprovação.</p>
      </Section>
      <Section heading="Posso vender qualquer coisa?">
        <p>Não. Conteúdo adulto, gore, material criminoso, lavagem de dinheiro e produtos que você não pode entregar são proibidos e resultam em suspensão. Veja a página de <a className="text-primary font-semibold" href="/regras">Regras</a>.</p>
      </Section>
    </LegalPage>
  );
}
