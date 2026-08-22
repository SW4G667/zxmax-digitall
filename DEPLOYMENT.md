# Configuração e Deploy — ZXMAX

Este guia mostra **o que precisa ser configurado no servidor** para que o site funcione
de verdade. Os erros que você viu ("não consigo aprovar a verificação", "o código 2FA
some", "o e-mail de confirmação não chega", "produtos não aparecem para todos") quase
sempre são causados por **falta de variáveis de ambiente / migrações não aplicadas**
no Supabase — não por bug no front.

> **Status esperado após o deploy (22/08/2026):**
> - Frontend publicado em `https://zxmax.vercel.app`.
> - Projeto Supabase: `https://dbekdedzgkfgtlytrnyw.supabase.co`.
> - Deploy do backend feito com `scripts/deploy-supabase.sh` (migrações + Edge Functions).
> - Login admin por **código OTP do Supabase Auth** (sem `RESEND_API_KEY`).

## 🚀 Deploy rápido (uma única vez)

```sh
# 1) Gere um token: https://supabase.com/dashboard/account/tokens  (sbp_...)
# 2) Rode:
export SUPABASE_ACCESS_TOKEN="sbp_xxx"
export SUPABASE_PROJECT_REF="dbekdedzgkfgtlytrnyw"
./scripts/deploy-supabase.sh
```

O script vincula o projeto, aplica as migrações e faz o deploy de **todas** as 14 Edge
Functions. Depois configure as secrets no dashboard do Supabase
(`Supabase → Project Settings → Functions`) e **faça redeploy** do frontend na Vercel.

> O frontend (React) já está corrigido. O que está faltando é configurar o backend.

---

## 0. Sobre as credenciais no repositório (importante)

No repositório **não estão as chaves secretas** (anon key, service role, RESEND, EVOPAY).
Elas não devem mesmo estar — é o correto do ponto de vista de segurança. O que existe no
repositório é:

- O **ID do projeto** (`dbekdedzgkfgtlytrnyw`) em `supabase/config.toml`.
- O código das Edge Functions, que **lêem** as chaves do ambiente do Supabase
  via `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`, etc.
- `.env.example` com os nomes das variáveis (vazios).

Ou seja, o deploy dos **serviços** (banco, funções, e-mail, pagamento) precisa das keys,
que ficam no **painel do Supabase** (não no git). O script `scripts/deploy-supabase.sh`
lhe mostra exatamente quais secrets definir.

---

## 1. Visão geral da arquitetura

- **Frontend:** React + Vite + TypeScript (deploy na Vercel).
- **Backend:** Supabase (banco Postgres + Auth + Storage + Edge Functions).
- **Login admin:** código OTP por e-mail usando o **Supabase Auth** (provedor de e-mail embutido).
- **Pagamento Pix:** EvoPay (`EVOPAY_API_KEY`).
- **Notificações/Recuperação de senha:** e-mail via Supabase Auth (configurado no painel do Supabase).

---

## 2. Variáveis de ambiente (frontend → Vercel)

No painel da **Vercel** (Settings → Environment Variables), configure:

| Variável | Valor |
|---|---|
| `VITE_SUPABASE_URL` | ex.: `https://dbekdedzgkfgtlytrnyw.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | a **anon key** (chave pública) do projeto Supabase |

Depois, faça **redeploy** do projeto para as variáveis entrarem no build.

---

## 3. Variáveis de ambiente (Edge Functions → Supabase)

Cada Edge Function precisa das seguintes variáveis. Defina no painel do **Supabase**
(Project Settings → Edge Functions → Secrets) ou via CLI.

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | mesmo valor da URL do projeto |
| `SUPABASE_ANON_KEY` | chave anon (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave **service role** (secret) — usada pelas funções de admin |
| `RESEND_API_KEY` | **opcional** — só se você usar a função `send-email`/outros e-mails com Resend |
| `EMAIL_FROM` | ex.: `ZXMAX <noreply@seudominio.com>` (opcional) |
| `SITE_URL` | ex.: `https://zxmax.vercel.app` |
| `EVOPAY_API_KEY` | chave da **EvoPay** |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | OAuth do Discord (opcional) |

> **Importante:** o login admin usa **código OTP do Supabase Auth**, então **não precisa
> de `RESEND_API_KEY`** para o e-mail do admin funcionar. Sem `EVOPAY_API_KEY` o checkout
> Pix não funciona.

---

## 4. Aplicar as migrações do banco

As migrações já estão na pasta `supabase/migrations`. Elas criam as tabelas
(`admin_trusted_devices`, `admin_login_tokens`, `admin_webauthn_credentials`,
`seller_documents`, `support_tickets`, `global_notices`, `app_settings`, etc.),
ajustam as políticas de acesso (RLS) e a view pública `products_public`.

Aplique-as **uma vez** se ainda não foram aplicadas:

```sh
supabase link --project-ref dbekdedzgkfgtlytrnyw
supabase db push
```

(ou use `supabase migration up`). Sem essa etapa, o painel admin não consegue
aprovar verificações e os produtos não aparecem para visitantes.

---

## 5. Deploy das Edge Functions

Suba as funções no Supabase:

```sh
supabase functions deploy admin-login
supabase functions deploy admin-verify
supabase functions deploy create-purchase
supabase functions deploy create-evopay-pix
supabase functions deploy evopay-webhook
supabase functions deploy evopay-withdraw
supabase functions deploy mark-order-delivered
supabase functions deploy order-action
supabase functions deploy check-evopay-status
supabase functions deploy create-vexopay-crypto
supabase functions deploy create-stripe-checkout
supabase functions deploy discord-callback
supabase functions deploy integrations-config
supabase functions deploy send-email
```

Confirme que cada função tem as secrets do item 3.

---

## 6. Configurar o Supabase Auth (código OTP por e-mail)

1. **Authentication → Providers → Email:** ligue o **"Enable Email provider"**. O provedor
   embutido do Supabase é suficiente para enviar o código de 6 dígitos; **não é preciso**
   configurar SMTP do Proton (o plano gratuito não libera SMTP).
2. **Authentication → URL Configuration:** aponte o **Site URL** para
   `https://zxmax.vercel.app` (ou seu domínio).
3. Confirme que o e-mail do admin (`jnpereiraalves@gmail.com`) tem uma conta no Auth
   do mesmo projeto (para `shouldCreateUser: false` não falhar).

---

## 7. Fluxo de login do admin (30 dias)

O acesso ao painel admin é protegido por **um** destes métodos (você escolhe na tela):

- **E-mail (código OTP de 6 dígitos):** o front chama `signInWithOtp` para
  `jnpereiraalves@gmail.com` com `shouldCreateUser: false`; o Supabase Auth envia o código
  usando o **provedor de e-mail embutido** (sem Resend). Ao digitar o código, o front chama
  `verifyOtp` e o aparelho fica liberado por **30 dias**.
- **Google Authenticator (código de 6 dígitos):** usa o Supabase Auth MFA direto do app e
  não depende da função `admin-login`. O aparelho fica liberado por **30 dias**.
- **Senha / biometria do celular** (WebAuthn): cadastra a biometria do aparelho e fica
  liberado por **30 dias** nesse aparelho. **Requer a função `admin-login` deployada.**

O código OTP é enviado **somente** para `jnpereiraalves@gmail.com` (fixo em
`src/lib/adminGate.ts`). Não gera e-mail para mais ninguém.

---

## 8. Configurações no painel admin

Ao entrar em `/admin`, abra em ordem:

1. **Plataforma / Config** → defina a taxa de comissão e a taxa de saque instantâneo.
2. **APIs & Credenciais** → cole `EVOPAY_API_KEY`, `RESEND_API_KEY`, credenciais do
   Discord/Stripe e clique em **Testar conexão**.
3. **Categorias** → ajuste as categorias da loja.
4. **Segurança 2FA** → (opcional) ative o `Google Authenticator` para pedir um código
   de 6 dígitos por login.

---

## 9. Testar o pagamento (Pix / cartão)

1. Cadastre a `EVOPAY_API_KEY` (ou Stripe) no painel **APIs & Credenciais**.
2. Use uma conta de teste para comprar um produto.
3. Confirme que o webhook `evopay-webhook` atualiza o pedido para **Pago**.
4. O admin aprova a entrega e o comprador libera o chat.

---

## 10. Problemas comuns → solução

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Não consigo aprovar a verificação" | Edge `admin-verify` sem `SUPABASE_SERVICE_ROLE_KEY` ou migrações não aplicadas | Aplicar migrações + secrets + redeploy das functions |
| Código OTP do admin não chega | Provedor de e-mail do Supabase Auth desligado (ou SMTP não suportado) | Authentication → Providers → Email → **Enable Email provider**; usar o provedor embutido (não SMTP Proton gratuito) |
| Código 2FA some / não valida | Autenticador não está em segundo plano / outro aparelho | Use a biometria do celular ou o link do e-mail; confirme que está no mesmo aparelho (o token é por aparelho) |
| Produtos não aparecem para visitantes | `approved=false` ou view `products_public` sem permissão | Clique em "Aprovar TODOS produtos" no admin e aplique as migrações |
| Foto abre "Arquivos" em vez da galeria | O navegador decide; o input de foto usa MIME de imagem e o de arquivo usa extensões | Os botões de **foto** abrem galeria; os de **documento/arquivo** abrem arquivos |
| Pagamento Pix não gera QR | `EVOPAY_API_KEY` ausente/modo manual | Configurar em APIs & Credenciais e testar |
| "Não consigo gerar um novo código / QR" (sempre o mesmo erro) | O Supabase exige sessão **AAL2** para apagar um autenticador já verificado — pelo navegador é impossível quando o app/celular foi perdido | Use o botão **"Perdi o celular / o app não gera mais o código"** na tela de bloqueio do admin (ou "Perdi o acesso ao autenticador" em Segurança). Ele chama a edge function `admin-login` com a ação `reset_mfa`, que apaga o fator antigo com a service role. **É necessário ter feito o redeploy da function `admin-login`** (`./scripts/deploy-supabase.sh`) e ter a secret `SUPABASE_SERVICE_ROLE_KEY` configurada |
| O site desloga sozinho / fica carregando pra sempre | Timeouts curtos (2s) nas consultas de sessão e chamadas Supabase dentro do callback `onAuthStateChange` (deadlock do client) | Corrigido no código: os timeouts passaram para 8–10s, a sessão nunca é apagada em timeout e o trabalho pesado saiu de dentro do callback |

---

## 11. Deploy na Vercel

O projeto já tem `vercel.json` pronto (SPA rewrites + headers de segurança). Basta:

1. Importar o repositório na Vercel.
2. Definir as variáveis de ambiente do item 2.
3. Deploy.

O Live app publicado: `https://zxmax.vercel.app` (o repositório README também menciona o
app Lovable original).
