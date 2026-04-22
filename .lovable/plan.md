

# Plano de Implementacao — ZXMAX Digital

Este projeto atualmente funciona 100% no localStorage (sem banco de dados, sem auth real, sem storage). A migração para backend real é extensa. Divido em 4 partes.

---

## Parte 1 — Correcao dos 5 bugs + Auth real (email + Discord)

### Database: criar tabelas fundamentais

Migration com:
- `profiles` (id uuid FK auth.users, email, display_name, avatar_url, pix_key, created_at)
- `user_roles` (user_id, role enum: admin/support/user)
- RLS em todas as tabelas

### Auth real com Supabase

- Refatorar `AuthScreen.tsx`: usar `supabase.auth.signUp` (registro) e `supabase.auth.signInWithPassword` (login) separados
- Listener `onAuthStateChange` para session
- Buscar/criar profile automaticamente via trigger `on_auth_user_created`
- Mostrar display_name em vez de email em todos os chats

### Discord Auth

- Lovable Cloud nao suporta Discord OAuth nativamente. Solucao: criar edge function `discord-callback` que recebe o `code`, troca pelo `access_token` usando client_secret (secret a configurar), busca perfil do usuario via Discord API, e faz `supabase.auth.admin.createUser` ou login via custom token
- Preciso que voce adicione o secret `DISCORD_CLIENT_SECRET` quando eu pedir

### Upload de arquivos

- Criar storage bucket `documents` (privado) e `chat-attachments` (privado)
- RLS policies para uploads
- Refatorar componente de upload para usar `supabase.storage.from('documents').upload()`

### Chat da equipe em tempo real

- Criar tabela `team_chat` (id, user_id, message, created_at)
- Habilitar realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE team_chat`
- Subscription no frontend para mensagens em tempo real

---

## Parte 2 — Sistema de banimento + Tela "Conta Banida" + ID unico

### Tabelas

- `bans` (id, user_id, reason, banned_by, created_at, active boolean)

### Logica

- No login, checar se usuario tem ban ativo. Se sim, redirecionar para tela `BannedScreen`
- `BannedScreen`: mostra motivo, data, UUID do usuario, botao "Sair"
- Admin panel: campo para colar UUID + botoes Banir/Desbanir + motivo
- Mostrar UUID do usuario no perfil e no admin

---

## Parte 3 — Integracao AbacatePay (pagamentos + saques PIX)

### Preparacao

- Pedir secret `ABACATEPAY_API_KEY` via tool
- Remover edge function `create-checkout` (Stripe)
- Remover secret Stripe (ou deixar, nao interfere)

### Edge function `create-abacatepay-checkout`

- Recebe: productName, priceInCents, buyerEmail
- Chama API AbacatePay para criar cobranca PIX
- Retorna URL de checkout

### Edge function `abacatepay-withdraw`

- Recebe: pixKey, amount, userId
- Chama `/pix/create` da AbacatePay
- Registra saque na tabela `withdrawals`

### Tabelas

- `products` (id, name, price, category, seller_id, description, image_url, delivery_type, delivery_content, approved, allow_affiliates, affiliate_commission, created_at)
- `purchases` (id, product_id, buyer_id, seller_id, status, amount, created_at)
- `purchase_messages` (id, purchase_id, sender_id, message, created_at)
- `withdrawals` (id, user_id, amount, pix_key, status, created_at)

### Frontend

- Botao "Comprar" chama edge function e redireciona para URL da AbacatePay
- Saque: so aparece se saldo >= R$3.50, status "Em processamento (7-10 dias uteis)"
- Remover mencoes a Stripe e saque instantaneo

---

## Parte 4 — Avaliacoes, duvidas, afiliados, seguranca, painel suporte

### Avaliacoes e duvidas

- Tabela `reviews` (id, purchase_id, product_id, user_id, stars, comment, created_at)
- Tabela `product_questions` (id, product_id, user_id, question, answer, answered_by, created_at)
- Avaliacoes so apos compra confirmada
- Duvidas: qualquer usuario pergunta, vendedor responde

### Sistema de afiliados

- Campos em `products`: allow_affiliates, affiliate_commission_pct
- Tabela `affiliates` (id, product_id, user_id, referral_code unique, created_at)
- Tabela `affiliate_clicks` (id, affiliate_id, clicked_at)
- Tabela `affiliate_commissions` (id, affiliate_id, purchase_id, amount, paid boolean)
- Last-click attribution via cookie/query param
- Vendedor paga afiliado manualmente (botao no painel)

### Documentos para vendedor

- Aceitar RG ou Certidao de Nascimento (remover CPF)
- Upload para bucket `documents`

### Painel de Suporte (separado do Admin)

- Tabela `support_permissions` (user_id) — admin adiciona UUID para dar acesso
- Painel limitado: tickets, banir/desbanir, chat interno da equipe suporte
- Apenas `admin@keybot.com` pode contratar suporte (colar UUID)

### Seguranca

- RLS em TODAS as tabelas
- Security definer functions para checagem de roles
- Validacao de input em todas as edge functions
- Scan de seguranca completo ao final

### Outros

- Botao fechar modal de produto
- Remover produto (botao)
- Clique na foto do vendedor abre perfil
- Notificacao de compra leva ao produto
- Admin: taxa configuravel, historico de saques, lista de usuarios com ID

---

## Pre-requisitos que precisarei de voce

1. Secret `ABACATEPAY_API_KEY` — pedirei via tool antes de implementar Parte 3
2. Secret `DISCORD_CLIENT_SECRET` — pedirei via tool para a edge function de callback
3. Aprovar as migrations de banco de dados quando solicitado

---

## Ordem de implementacao

Implementarei na ordem Parte 1 → 2 → 3 → 4, cada uma em mensagens separadas para nao sobrecarregar. Ao final, listo o que voce precisa configurar manualmente.

