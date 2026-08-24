# Pendência de deploy — Supabase (estado em 2026-08-24)

> **Resumo objetivo:** o código do repositório está pronto e validado
> (`tsc`, `build`, `test`, `audit`), mas o **banco Supabase remoto** usado pela
> produção ainda **não recebeu as migrations recentes** e as **Edge Functions
> corrigidas ainda não foram publicadas**. Nesta sessão do Arena **não há
> credencial do Supabase conectada** (`SUPABASE_ACCESS_TOKEN` ausente), então
> **nada foi aplicado remotamente** — e nada disso é aplicável pela Vercel:
> deploy da Vercel publica apenas o frontend.

## O que está pendente, exatamente

1. **Migrations de banco** — em especial
   `supabase/migrations/20260824130000_product_questions_and_public_seller_signals.sql`
   (cria `product_questions` + RPCs `ask_product_question` /
   `answer_product_question` + bloqueio de contato externo no servidor).
   Sintoma atual em produção: toast
   `Could not find the function public.ask_product_question(...) in the schema cache`
   e "As perguntas anteriores não estão disponíveis neste momento."
2. **Edge Functions** — republicar as 4 alteradas:
   - `integrations-config` (ação `payment_methods` com erros honestos + `v: 2`
     + PIX ativo com VexoPay **ou** EvoPay);
   - `create-evopay-pix` (**VexoPay virou o gateway primário do PIX**; EvoPay é
     fallback automático; usa a API key salva no painel; erro amigável);
   - `create-vexopay-crypto` (lê `app_settings.vexopay` corretamente);
   - `check-evopay-status` (consulta cobranças `vexo:` na VexoPay).
   Enquanto a `integrations-config` antiga estiver publicada, o checkout mostra
   "Estamos atualizando os meios de pagamento" (antes parecia "nada configurado").

> **Sobre a VexoPay gerar PIX:** a doc pública documenta o padrão
> `/gateway/<recurso>-create` com headers `ci`/`cs` (é assim que o Crypto já
> funciona em `create-vexopay-crypto`). O PIX tenta
> `/gateway/pix-create` → `/gateway/pix` → `/pix/create` e normaliza a
> resposta. Se a sua doc da VexoPay (área logada) indicar outro caminho, é um
> ajuste de UMA constante em `create-evopay-pix` e `check-evopay-status` — nos
> mande só o print/caminho do endpoint, **nunca as credenciais**.

## Como resolver SEM abrir o SQL Editor (recomendado)

No terminal do responsável (uma única vez, ~2 min):

```bash
# 1) gere um Personal Access Token em https://supabase.com/dashboard/account/tokens
#    (começa com sbp_). NÃO cole em chat, issue ou commit.
export SUPABASE_ACCESS_TOKEN=sbp_...        # só no SEU terminal
export SUPABASE_PROJECT_REF=dbekdedzgkfgtlytrnyw

# 2) aplique tudo (migrations + Edge Functions):
./scripts/deploy-supabase.sh
#    (equivale a: npx supabase link --project-ref dbekdedzgkfgtlytrnyw &&
#                 npx supabase db push &&
#                 npx supabase functions deploy integrations-config &&
#                 npx supabase functions deploy create-evopay-pix &&
#                 npx supabase functions deploy create-vexopay-crypto)
```

## Como conectar o Supabase a esta sessão do Arena (para o agente aplicar)

- Conecte a integração **Supabase** na conta/plataforma do Arena e reconecte a
  sessão, **ou** exporte `SUPABASE_ACCESS_TOKEN` no ambiente do agente.
- Com o token presente, o agente executa o passo a passo acima — sem SQL Editor
  manual e sem você colar nenhum segredo no chat.
- **Nunca** envie o token, service role key, senhas ou keys de gateway por chat.

## Depois de aplicar: validação em 2 minutos

1. `https://zxmax.vercel.app/produto/41` → aba anônima: a seção PERGUNTAS mostra
   "Ainda não há perguntas" (sem aviso de indisponibilidade).
2. Logado como comprador: enviar "Aceita PIX?" → toast "Pergunta enviada ao
   vendedor." → recarregar a página → a pergunta continua lá.
3. Enviar "me chama no whatsapp 11 91234-5678" → bloqueado com mensagem amigável.
4. Logado como o vendedor do anúncio: campo "Responder ao comprador" visível;
   responder → resposta aparece publicada.
5. Abrir o checkout → só aparecem habilitados os meios realmente configurados;
   com a nova função publicada, o painel de integrações passa a fazer o PIX
   ficar ativo assim que a API Key EvoPay estiver salva.
6. Opcional: rodar `supabase/verify_schema.sql` — bloco 12 confere as perguntas.

## Checagem de projeto (se os pagamentos continuarem "em atualização")

No painel da Vercel → **Settings → Environment Variables** → confira se
`VITE_SUPABASE_URL` é `https://dbekdedzgkfgtlytrnyw.supabase.co` (o mesmo ref do
`supabase/config.toml`). Se for outro ref, as credenciais do painel admin estão
sendo gravadas em um banco diferente do que o site lê — esse seria o problema a
corrigir primeiro.
