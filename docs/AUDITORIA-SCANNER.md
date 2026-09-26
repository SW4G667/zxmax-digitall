# Scanner técnico ZXMAX

Gerado em 2026-08-24T05:15:29.505Z

## Pipeline

- ✅ TypeScript (`npx tsc -b`)
- ✅ Build (`npm run build`)
- ❌ Lint (`npm run lint`)
- ✅ Testes (`npm test`)

## Resumo

- Crítico: 0
- Alto: 12
- Médio: 16
- Baixo: 7
- Melhorias futuras: 0

## Alto

### View public.profiles_public sem security_invoker
- **Área:** `supabase/migrations/20260612013401_d4e32f0e-9e03-41b4-a413-a38a660ea846.sql`
- **Impacto:** A view roda com os privilégios do dono e ignora a RLS da tabela base, podendo expor linhas privadas.
- **Correção segura:** Recriar com WITH (security_invoker = true).
- **Teste de regressão:** consultar a view como anon e conferir que só retorna linhas permitidas

### View public.products_public sem security_invoker
- **Área:** `supabase/migrations/20260705121912_cb37aa65-c271-4d82-a260-14b3b7bf746f.sql`
- **Impacto:** A view roda com os privilégios do dono e ignora a RLS da tabela base, podendo expor linhas privadas.
- **Correção segura:** Recriar com WITH (security_invoker = true).
- **Teste de regressão:** consultar a view como anon e conferir que só retorna linhas permitidas

### View public.profiles_public sem security_invoker
- **Área:** `supabase/migrations/20260705121912_cb37aa65-c271-4d82-a260-14b3b7bf746f.sql`
- **Impacto:** A view roda com os privilégios do dono e ignora a RLS da tabela base, podendo expor linhas privadas.
- **Correção segura:** Recriar com WITH (security_invoker = true).
- **Teste de regressão:** consultar a view como anon e conferir que só retorna linhas permitidas

### Função com service_role, verify_jwt=false e CORS '*'
- **Área:** `supabase/functions/check-evopay-status/index.ts`
- **Impacto:** Qualquer site pode chamar a função em nome do visitante, com privilégios totais no banco.
- **Correção segura:** Restringir Access-Control-Allow-Origin ao domínio da ZXMAX e exigir JWT ou assinatura do provedor.
- **Teste de regressão:** chamar a função de outra origem e esperar bloqueio

### Função com service_role, verify_jwt=false e CORS '*'
- **Área:** `supabase/functions/create-evopay-pix/index.ts`
- **Impacto:** Qualquer site pode chamar a função em nome do visitante, com privilégios totais no banco.
- **Correção segura:** Restringir Access-Control-Allow-Origin ao domínio da ZXMAX e exigir JWT ou assinatura do provedor.
- **Teste de regressão:** chamar a função de outra origem e esperar bloqueio

### Função com service_role, verify_jwt=false e CORS '*'
- **Área:** `supabase/functions/create-purchase/index.ts`
- **Impacto:** Qualquer site pode chamar a função em nome do visitante, com privilégios totais no banco.
- **Correção segura:** Restringir Access-Control-Allow-Origin ao domínio da ZXMAX e exigir JWT ou assinatura do provedor.
- **Teste de regressão:** chamar a função de outra origem e esperar bloqueio

### Função com service_role, verify_jwt=false e CORS '*'
- **Área:** `supabase/functions/discord-callback/index.ts`
- **Impacto:** Qualquer site pode chamar a função em nome do visitante, com privilégios totais no banco.
- **Correção segura:** Restringir Access-Control-Allow-Origin ao domínio da ZXMAX e exigir JWT ou assinatura do provedor.
- **Teste de regressão:** chamar a função de outra origem e esperar bloqueio

### Função com service_role, verify_jwt=false e CORS '*'
- **Área:** `supabase/functions/evopay-webhook/index.ts`
- **Impacto:** Qualquer site pode chamar a função em nome do visitante, com privilégios totais no banco.
- **Correção segura:** Restringir Access-Control-Allow-Origin ao domínio da ZXMAX e exigir JWT ou assinatura do provedor.
- **Teste de regressão:** chamar a função de outra origem e esperar bloqueio

### Função com service_role, verify_jwt=false e CORS '*'
- **Área:** `supabase/functions/evopay-withdraw/index.ts`
- **Impacto:** Qualquer site pode chamar a função em nome do visitante, com privilégios totais no banco.
- **Correção segura:** Restringir Access-Control-Allow-Origin ao domínio da ZXMAX e exigir JWT ou assinatura do provedor.
- **Teste de regressão:** chamar a função de outra origem e esperar bloqueio

### Função com service_role, verify_jwt=false e CORS '*'
- **Área:** `supabase/functions/integrations-config/index.ts`
- **Impacto:** Qualquer site pode chamar a função em nome do visitante, com privilégios totais no banco.
- **Correção segura:** Restringir Access-Control-Allow-Origin ao domínio da ZXMAX e exigir JWT ou assinatura do provedor.
- **Teste de regressão:** chamar a função de outra origem e esperar bloqueio

### Função com service_role, verify_jwt=false e CORS '*'
- **Área:** `supabase/functions/mark-order-delivered/index.ts`
- **Impacto:** Qualquer site pode chamar a função em nome do visitante, com privilégios totais no banco.
- **Correção segura:** Restringir Access-Control-Allow-Origin ao domínio da ZXMAX e exigir JWT ou assinatura do provedor.
- **Teste de regressão:** chamar a função de outra origem e esperar bloqueio

### 1 dependência(s) com vulnerabilidade high
- **Área:** `package.json`
- **Impacto:** Cadeia de suprimento: código de terceiros com falha conhecida.
- **Correção segura:** Rodar `npm audit fix` e revisar breaking changes.
- **Teste de regressão:** npm audit deve zerar o nível correspondente

## Médio

### Acesso administrativo condicionado por estado do React
- **Área:** `src/components/AdminView.tsx`
- **Impacto:** Se a RLS não repetir a mesma regra, basta alterar o estado no navegador para ler dados administrativos.
- **Correção segura:** Garantir que a policy no banco use has_role(auth.uid(),'admin') para as mesmas tabelas.
- **Teste de regressão:** chamar a tabela com uma conta comum e esperar 401/403

### Acesso administrativo condicionado por estado do React
- **Área:** `src/hooks/useAuth.tsx`
- **Impacto:** Se a RLS não repetir a mesma regra, basta alterar o estado no navegador para ler dados administrativos.
- **Correção segura:** Garantir que a policy no banco use has_role(auth.uid(),'admin') para as mesmas tabelas.
- **Teste de regressão:** chamar a tabela com uma conta comum e esperar 401/403

### Acesso administrativo condicionado por estado do React
- **Área:** `src/store/StoreContext.tsx`
- **Impacto:** Se a RLS não repetir a mesma regra, basta alterar o estado no navegador para ler dados administrativos.
- **Correção segura:** Garantir que a policy no banco use has_role(auth.uid(),'admin') para as mesmas tabelas.
- **Teste de regressão:** chamar a tabela com uma conta comum e esperar 401/403

### Fluxo sensível sem rate limiting aparente
- **Área:** `supabase/functions/admin-login/index.ts`
- **Impacto:** Permite força bruta, criação de pedidos em massa e abuso de gateway.
- **Correção segura:** Aplicar limite por usuário/IP (tabela de contadores ou serviço de rate limit).
- **Teste de regressão:** disparar N chamadas seguidas e esperar 429

### Mensagem de erro do servidor devolvida ao cliente
- **Área:** `supabase/functions/admin-verify/index.ts`
- **Impacto:** Detalhe interno (SQL, nome de coluna, provedor) chega ao navegador.
- **Correção segura:** Logar no servidor e devolver um código/flag genérico.
- **Teste de regressão:** forçar erro e inspecionar a resposta

### Mensagem de erro do servidor devolvida ao cliente
- **Área:** `supabase/functions/check-evopay-status/index.ts`
- **Impacto:** Detalhe interno (SQL, nome de coluna, provedor) chega ao navegador.
- **Correção segura:** Logar no servidor e devolver um código/flag genérico.
- **Teste de regressão:** forçar erro e inspecionar a resposta

### Mensagem de erro do servidor devolvida ao cliente
- **Área:** `supabase/functions/create-evopay-pix/index.ts`
- **Impacto:** Detalhe interno (SQL, nome de coluna, provedor) chega ao navegador.
- **Correção segura:** Logar no servidor e devolver um código/flag genérico.
- **Teste de regressão:** forçar erro e inspecionar a resposta

### Fluxo sensível sem rate limiting aparente
- **Área:** `supabase/functions/create-purchase/index.ts`
- **Impacto:** Permite força bruta, criação de pedidos em massa e abuso de gateway.
- **Correção segura:** Aplicar limite por usuário/IP (tabela de contadores ou serviço de rate limit).
- **Teste de regressão:** disparar N chamadas seguidas e esperar 429

### Mensagem de erro do servidor devolvida ao cliente
- **Área:** `supabase/functions/create-stripe-checkout/index.ts`
- **Impacto:** Detalhe interno (SQL, nome de coluna, provedor) chega ao navegador.
- **Correção segura:** Logar no servidor e devolver um código/flag genérico.
- **Teste de regressão:** forçar erro e inspecionar a resposta

### Fluxo sensível sem rate limiting aparente
- **Área:** `supabase/functions/create-stripe-checkout/index.ts`
- **Impacto:** Permite força bruta, criação de pedidos em massa e abuso de gateway.
- **Correção segura:** Aplicar limite por usuário/IP (tabela de contadores ou serviço de rate limit).
- **Teste de regressão:** disparar N chamadas seguidas e esperar 429

### Mensagem de erro do servidor devolvida ao cliente
- **Área:** `supabase/functions/create-vexopay-crypto/index.ts`
- **Impacto:** Detalhe interno (SQL, nome de coluna, provedor) chega ao navegador.
- **Correção segura:** Logar no servidor e devolver um código/flag genérico.
- **Teste de regressão:** forçar erro e inspecionar a resposta

### Mensagem de erro do servidor devolvida ao cliente
- **Área:** `supabase/functions/evopay-withdraw/index.ts`
- **Impacto:** Detalhe interno (SQL, nome de coluna, provedor) chega ao navegador.
- **Correção segura:** Logar no servidor e devolver um código/flag genérico.
- **Teste de regressão:** forçar erro e inspecionar a resposta

### Fluxo sensível sem rate limiting aparente
- **Área:** `supabase/functions/evopay-withdraw/index.ts`
- **Impacto:** Permite força bruta, criação de pedidos em massa e abuso de gateway.
- **Correção segura:** Aplicar limite por usuário/IP (tabela de contadores ou serviço de rate limit).
- **Teste de regressão:** disparar N chamadas seguidas e esperar 429

### Mensagem de erro do servidor devolvida ao cliente
- **Área:** `supabase/functions/mark-order-delivered/index.ts`
- **Impacto:** Detalhe interno (SQL, nome de coluna, provedor) chega ao navegador.
- **Correção segura:** Logar no servidor e devolver um código/flag genérico.
- **Teste de regressão:** forçar erro e inspecionar a resposta

### 3 dependência(s) com vulnerabilidade moderate
- **Área:** `package.json`
- **Impacto:** Cadeia de suprimento: código de terceiros com falha conhecida.
- **Correção segura:** Rodar `npm audit fix` e revisar breaking changes.
- **Teste de regressão:** npm audit deve zerar o nível correspondente

### Lint falhou
- **Área:** `pipeline`
- **Impacto:** Quebra o deploy ou libera regressão para produção.
- **Correção segura:** Corrigir os erros reportados por `npm run lint`.
- **Teste de regressão:** npm run lint

## Baixo

### Largura fixa grande em px
- **Área:** `src/components/AdminExtraPanels.tsx`
- **Impacto:** Pode gerar rolagem horizontal em telas pequenas.
- **Correção segura:** Usar largura relativa/max-width com breakpoints.
- **Teste de regressão:** abrir em viewport de 360px

### Largura fixa grande em px
- **Área:** `src/components/AdminMorePanels.tsx`
- **Impacto:** Pode gerar rolagem horizontal em telas pequenas.
- **Correção segura:** Usar largura relativa/max-width com breakpoints.
- **Teste de regressão:** abrir em viewport de 360px

### Largura fixa grande em px
- **Área:** `src/components/AdminView.tsx`
- **Impacto:** Pode gerar rolagem horizontal em telas pequenas.
- **Correção segura:** Usar largura relativa/max-width com breakpoints.
- **Teste de regressão:** abrir em viewport de 360px

### Largura fixa grande em px
- **Área:** `src/components/LoadingScreen.tsx`
- **Impacto:** Pode gerar rolagem horizontal em telas pequenas.
- **Correção segura:** Usar largura relativa/max-width com breakpoints.
- **Teste de regressão:** abrir em viewport de 360px

### Largura fixa grande em px
- **Área:** `src/components/SideMenu.tsx`
- **Impacto:** Pode gerar rolagem horizontal em telas pequenas.
- **Correção segura:** Usar largura relativa/max-width com breakpoints.
- **Teste de regressão:** abrir em viewport de 360px

### Largura fixa grande em px
- **Área:** `src/components/ui/drawer.tsx`
- **Impacto:** Pode gerar rolagem horizontal em telas pequenas.
- **Correção segura:** Usar largura relativa/max-width com breakpoints.
- **Teste de regressão:** abrir em viewport de 360px

### Largura fixa grande em px
- **Área:** `src/components/ui/toast.tsx`
- **Impacto:** Pode gerar rolagem horizontal em telas pequenas.
- **Correção segura:** Usar largura relativa/max-width com breakpoints.
- **Teste de regressão:** abrir em viewport de 360px

