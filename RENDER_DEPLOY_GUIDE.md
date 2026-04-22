# Guia de Hospedagem no Render - ZXMAX Digital

Como este projeto e um aplicativo **Vite + React**, ele deve ser hospedado como um **Static Site** no Render.

## Passo a Passo para o Deploy

1. **Conecte seu GitHub**: No painel do Render, clique em "New +" e escolha "Static Site".
2. **Selecione o Repositorio**: Escolha `Htt-devs/zxmax-digital`.
3. **Configuracoes de Build**:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. **Configuracoes de Roteamento (IMPORTANTE)**:
   - Va em **Redirects/Rewrites**.
   - Adicione uma regra:
     - **Source**: `/*`
     - **Destination**: `/index.html`
     - **Action**: `Rewrite`
   - *Isso garante que as rotas do React (como /auth/callback) funcionem corretamente ao atualizar a pagina.*

## Variaveis de Ambiente

No Render, va na aba **Environment** e adicione:

| Chave | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Sua URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Sua Chave Anonima do Supabase |

## Observacao sobre Edge Functions

As **Edge Functions** (como o checkout do AbacatePay e o cadastro seguro) continuam rodando no **Supabase**. Voce nao precisa hospedá-las no Render. Apenas garanta que as chaves abaixo estejam configuradas no painel do Supabase (Project Settings -> Edge Functions):

- `ABACATEPAY_API_KEY`: Sua chave secreta do AbacatePay.
- `SUPABASE_SERVICE_ROLE_KEY`: Necessaria para a funcao de cadastro seguro.
