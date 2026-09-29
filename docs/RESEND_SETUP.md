# Resend + Supabase no ZXMAX

O ZXMAX usa dois caminhos de e-mail:

1. **E-mails transacionais do marketplace** (pedido, pagamento, venda, entrega, pergunta, avaliação, moderação e reembolso) passam pela Edge Function `send-email` e pela API da Resend.
2. **E-mails de autenticação** (confirmação de cadastro, recuperação de senha, magic link e alteração de e-mail) passam pelo Supabase Auth via SMTP da Resend.

## 1. Verifique um domínio na Resend

Para enviar para usuários reais, a Resend exige um domínio que você controla e consegue configurar no DNS.

> `ZXMAX-DIGITAL@proton.me` não pode ser usado como remetente da Resend porque `proton.me` não é um domínio controlado pelo ZXMAX. Ele pode ser usado como **Reply-To**.

Exemplo recomendado depois de verificar seu domínio:

- From: `ZXMAX Digital <noreply@seu-dominio.com>`
- Reply-To: `ZXMAX-DIGITAL@proton.me`

## 2. Secrets das Edge Functions

No Supabase, configure:

```
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=ZXMAX Digital <noreply@seu-dominio.com>
EMAIL_REPLY_TO=ZXMAX-DIGITAL@proton.me
SITE_URL=https://zxmax.vercel.app
```

Nunca coloque a chave da Resend no frontend, GitHub ou Vercel client-side.

## 3. SMTP do Supabase Auth

Em Authentication > SMTP Settings:

- Enable Custom SMTP: ON
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: a mesma API Key da Resend
- Sender name: `ZXMAX Digital`
- Sender email: um endereço do domínio verificado, por exemplo `auth@seu-dominio.com`

Os templates de confirmação, recuperação e alteração de e-mail podem ser personalizados em Authentication > Email Templates.

## 4. Eventos já cobertos pela Edge Function

- pedido criado
- pagamento confirmado
- nova venda
- entrega marcada
- recebimento confirmado (comprador e vendedor)
- reembolso (comprador e vendedor)
- disputa aberta e resolvida
- pergunta em anúncio
- avaliação recebida
- anúncio aprovado, reprovado ou removido

A função usa idempotência para reduzir e-mails duplicados e grava os resultados em `webhook_logs`.

## 5. Validação

Depois de configurar a chave e o domínio:

1. crie uma compra de teste;
2. confirme o pagamento;
3. confira a linha correspondente em `webhook_logs` com `source = 'email'`;
4. confirme no painel da Resend se o evento chegou como sent/delivered;
5. teste cadastro e recuperação de senha separadamente pelo Supabase Auth.
