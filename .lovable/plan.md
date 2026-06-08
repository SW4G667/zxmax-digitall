# Fechar o ciclo completo de venda (Lovable Cloud)

Mapeamento da spec para o schema real do projeto:
- "orders" = tabela `purchases` (já existe)
- "payments" = não existe; os dados do Pix ficam salvos na própria `purchases`
- "order_messages" = nova tabela (hoje as mensagens vivem num campo JSONB)
- bucket "order-attachments" = novo bucket privado
- "report-evidence" = não existe; usaremos `order-attachments`

Itens que **já existem** e não vou refazer: preço mínimo R$5 no Pix, upload com URL assinada de 1 ano, webhook EvoPay marcando como pago/entregue, tela de banido, ID público numérico no perfil.

## 1. Banco de dados (migração única)
- **`purchases`**: adicionar colunas `evopay_charge_id` (text), `pix_qr_code` (text), `pix_expires_at` (timestamptz) para permitir reabrir o Pix depois de trocar de aba. Adicionar status `cancelled` aos valores aceitos (validação por trigger, não CHECK).
- **Nova tabela `order_messages`**: `id`, `order_id` (bigint, referencia purchases), `sender_id` (uuid), `body` (text null), `image_path` (text null), `created_at`. 
  - GRANT para `authenticated` e `service_role`.
  - RLS leitura: comprador, vendedor ou admin do pedido (via subconsulta em purchases).
  - RLS inserção: comprador ou vendedor do pedido, **somente se** o pedido está `paid` ou `delivered`, e forçando `sender_id = auth.uid()`.
  - Realtime habilitado (`ALTER PUBLICATION supabase_realtime ADD TABLE order_messages` + `REPLICA IDENTITY FULL`).
- **Bucket privado `order-attachments`** (via tool): caminho `<order_id>/<auth.uid()>/<arquivo>`. Políticas em `storage.objects`: leitura/escrita restritas às partes do pedido.
- **Trigger** para impedir produto com preço < 5 (e a UI também valida).

## 2. Anúncios — editar/excluir + Vendas Recebidas
`InventoryView.tsx` ganha duas abas no topo: **Meus Produtos** e **Vendas Recebidas**.
- **Editar**: botão em cada card abre o formulário pré-preenchido (nome, categoria, descrição, preço, imagem/banner, variações, tipo e conteúdo de entrega). Trocar imagem é opcional. Ao salvar, se preço ou conteúdo essencial mudou → volta para "Em análise" (`approved=false`); senão mantém. Usa `update` direto (RLS já permite dono/admin).
- **Excluir**: pede confirmação. Se o produto já tem pedidos, oferece **Pausar** (novo campo/`approved=false` + flag) em vez de apagar, evitando quebrar histórico.
- **Vendas Recebidas**: lista pedidos onde sou vendedor, filtro por status (pendente/pago/entregue/disputa). Cada pedido abre o chat compartilhado + dados (produto, variação, valor, comprador via ID público). Entrega manual: botão **Marcar como entregue**.
- Preço mínimo R$5 validado na criação/edição.

## 3. Minhas Compras lendo do banco + retomar Pix
`MyPurchasesView.tsx`:
- Lista a partir de `purchases` (filtrando `buyer_id = eu`), status reais: Pendente, Pago, Entregue, Disputa, Cancelado.
- Pedido **pendente**: botão **Pagar com Pix** que reabre o `PixPaymentModal` reaproveitando o QR salvo em `purchases` (evopay_charge_id/pix_qr_code). Se `pix_expires_at` passou → botão **Gerar novo Pix** (chama `create-evopay-pix` de novo e atualiza a linha).
- Pedido **pago**: entrega automática mostra caixa com conteúdo + copiar; entrega manual mostra "Aguardando o vendedor entregar" + chat liberado.
- Modal do Pix pode ser fechado sem perder o pedido (continua Pendente e retomável).

## 4. Chat real de pedido (componente compartilhado)
Novo componente `OrderChat.tsx` usado por comprador (Minhas Compras) e vendedor (Vendas Recebidas):
- Lê/escreve em `order_messages`, liberado só quando `paid`/`delivered`.
- Suporta texto e **imagem** (upload para `order-attachments`, exibida via URL assinada).
- **Realtime**: assina mudanças da tabela para os dois lados verem mensagens novas sem recarregar.
- Vendedor pode **Marcar como entregue** (pedidos manuais) chamando a edge function.

## 5. Fluxo de pagamento
- `StoreView.handleBuy` salva `evopay_charge_id`, `pix_qr_code` e `pix_expires_at` na purchase logo após gerar o Pix.
- Webhook já promove o pedido para pago/entregue no banco (sem reabrir modal).
- Após pago, `StoreContext` recarrega purchases para refletir o status.

## 6. Edge function nova `mark-order-delivered`
Valida que o chamador é o vendedor do pedido e que o status é `paid`; muda para `delivered`. Deploy automático.

## 7. Perfil do vendedor com foto + ID
- `UserProfileModal.tsx` busca o `profiles` real (avatar_url + public_id) por `user_id` do vendedor, mostrando a foto real e o ID público numérico (não o email).
- No card/detalhe do produto (`StoreView`), o avatar do vendedor usa `avatar_url` real quando disponível; clicar abre o perfil com a foto e o ID.

## 8. Galeria em uploads
Garantir que todos os inputs de imagem/documento (produtos, chat de pedido, documentos do vendedor) usem `accept="image/*"` sem `capture`, para abrir a galeria do dispositivo.

## Ordem de execução
1. Migração (`purchases` colunas + `order_messages` + RLS + realtime + trigger preço) e bucket `order-attachments`.
2. Edge function `mark-order-delivered`.
3. Anúncios: editar/excluir + aba Vendas Recebidas.
4. Minhas Compras lendo `purchases` + retomar Pix.
5. `OrderChat` compartilhado (texto + imagem + realtime) e entrega manual.
6. Perfil do vendedor com foto/ID e ajustes de upload (galeria).
7. Smoke test do fluxo completo.

## Detalhes técnicos
- Sem CHECK constraints com tempo; usar triggers de validação.
- `order_messages` força `sender_id = auth.uid()` na política de inserção.
- Storage `order-attachments` privado, com URLs assinadas para exibição.
- Nada de localStorage para compras/vendas: leitura direta do banco com fallback ao estado atual.
