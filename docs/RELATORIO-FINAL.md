# Relatório final — correção e evolução do ZXMAX

**Branch:** `arena/01a0321b-zxmax-digitall` · **Base:** `main@f4acd15` · **Data:** 2026-08-24

Documentos relacionados:
- [`DIAGNOSTICO-ZXMAX.md`](./DIAGNOSTICO-ZXMAX.md) — Fase 0, causa raiz
- [`APLICAR-MIGRATIONS.md`](./APLICAR-MIGRATIONS.md) — procedimento operacional
- [`AUDITORIA-SCANNER.md`](./AUDITORIA-SCANNER.md) — saída do scanner (Fase 3)

---

## 1. Problemas encontrados e corrigidos

| # | Problema | Correção | Onde |
|---|---|---|---|
| 1 | Trigger exigia R$ 5,00; UI e constraint exigiam R$ 2,00 ⇒ **todo anúncio de R$ 2–4,99 falhava** | `validate_product_price()` alinhada em R$ 2,00, agora rejeitando também NULL/NaN/overflow | migration `20260824120000` |
| 2 | Um SELECT com coluna inexistente derrubava o catálogo inteiro ⇒ **"Todos os produtos (0)"** | `selectProducts()` faz retry sem as colunas novas; a view é lida com `*` | `StoreContext.tsx` |
| 3 | Toast genérico "Tente novamente" escondia o erro do banco | `productErrors.ts` mapeia 11 tipos de falha para mensagens acionáveis; o erro cru vai só ao console | `lib/productErrors.ts` |
| 4 | Produtos-fantasma após falha/exclusão | `mergeCatalog` deixou de preservar IDs otimistas; leitura bem-sucedida é autoritativa | `lib/catalog.ts` |
| 5 | Edge Function devolvia **todos** os produtos quando não havia aprovados | `approved=true` virou fronteira de autorização explícita; erro devolve 503, não `[]` | `functions/public-products` |
| 6 | `approved` decidido pelo React e enviado no INSERT | `enforce_product_insert_approval()` força `approved=false`, `seller_id=auth.uid()`, `sales=0` | migration |
| 7 | Pacote Robux tratado como preço unitário (R$ 2,00 → checkout de R$ 4.000) | `robuxPackageUnits()` / `unitPriceFromPackage()`; o preço gravado continua sendo o do pacote | `Produto.tsx`, `catalog.ts` |
| 8 | `R$ 2.00000` na tela | `formatBRL()` único em todo o app | `catalog.ts` + telas |
| 9 | `stock`, `min_quantity`, `delivery_time` coletados mas não gravados | Enviados no INSERT com degradação segura | `StoreContext.tsx` |
| 10 | Estoque/nota/avaliações inventados (`sales*137+500`, `99.4`, `100`) | Removidos; a UI mostra "—" quando o dado não existe | `StoreContext.tsx`, `Produto.tsx` |
| 11 | Selo "verificado" fixo em `true` | Lido de `profiles.is_verified_seller` | `Produto.tsx`, `StoreView.tsx` |
| 12 | `/produto/:id` dizia "não encontrado" durante o carregamento | Skeleton enquanto `catalogStatus === "loading"`; erro com "Tentar novamente" | `Produto.tsx` |
| 13 | Variações sem validação | `validate_product_variations()` no banco + validação no formulário | migration, `InventoryView.tsx` |
| 14 | `VITE_SUPABASE_*` sem validação | Falha explícita no boot nomeando a variável ausente | `integrations/supabase/client.ts` |
| 15 | `seller_email` legível por `anon`/`authenticated` | `REVOKE SELECT (seller_email)` | migration |
| 16 | Sem trilha de auditoria administrativa | `admin_audit_log` + trigger automático de moderação | migration |
| 17 | `parsePriceInput("<script>…")` retornava `1` | Só aceita string com cara de moeda | `catalog.ts` (achado pelos próprios testes) |
| 18 | Preço acima do teto era **silenciosamente truncado** | Passa a ser inválido | `catalog.ts` (achado pelos testes) |
| 19 | 21 vulnerabilidades npm (1 crítica, 16 altas) | `npm audit fix` ⇒ **4** (3 moderadas, 1 alta) | `package-lock.json` |
| 20 | `npx tsc --noEmit` não checava nada (`files: []`) + 3 erros de tipo | `withTimeout` aceita `PromiseLike`; `npm run typecheck` = `tsc -b` real | `authSession.ts`, `package.json` |
| 21 | Menu lateral sem papéis, sem teclado, sem rota ativa | Reescrito com seções por permissão, foco preso, setas/Esc, `aria-current` | `SideMenu.tsx` |
| 22 | Loja sem loading/erro/vazio reais, sem debounce, sem filtros | Skeleton, erro com retry, vazio honesto, debounce 300 ms, 5 ordenações, 3 filtros, paginação | `StoreView.tsx` |

---

## 2. Migrations e como foram validadas

**Nova:** `supabase/migrations/20260824120000_fix_product_creation_and_visibility.sql`
— idempotente e aditiva (`IF NOT EXISTS`, `DROP … IF EXISTS`, `CREATE OR REPLACE`).
Não remove tabela, coluna nem dado.

Conteúdo em 9 blocos: colunas obrigatórias · preço (trigger + constraint + variações) ·
aprovação no banco · RLS · `products_public` · grants por coluna · índices ·
`admin_audit_log` · recuperação de Robux legado.

**Validação:** `supabase/verify_schema.sql` (11 blocos, somente leitura). O bloco 6 é o
que prova que a correção chegou ao banco:

```sql
SELECT CASE
  WHEN pg_get_functiondef('public.validate_product_price()'::regprocedure) LIKE '%NEW.price < 2%'
  THEN 'OK (minimo R$ 2,00)' ELSE 'FALHOU (migration nao aplicada)' END;
```

⚠️ **Ainda não aplicada no Supabase remoto** — exige acesso do responsável
(ver [`APLICAR-MIGRATIONS.md`](./APLICAR-MIGRATIONS.md)).

---

## 3. Alterações por camada

**Banco:** 1 migration nova, 1 script de verificação, 3 funções novas, 2 reforçadas,
6 policies reescritas, grants por coluna endurecidos, 1 tabela de auditoria, 3 índices.

**Backend (Edge Function):** `public-products` — vazamento fechado, retry de schema,
503 honesto no erro, `Cache-Control: 15s`.

**Frontend:** `lib/catalog.ts` (reescrito), `lib/productErrors.ts` (novo),
`store/StoreContext.tsx`, `components/StoreView.tsx` (reescrito),
`components/SideMenu.tsx` (reescrito), `components/InventoryView.tsx`,
`components/AdminView.tsx` (aba na URL), `pages/Produto.tsx`,
`integrations/supabase/client.ts`, `lib/authSession.ts`.

**Ferramentas:** `scripts/audit.mjs` (scanner), `npm run typecheck | audit | audit:full`.

---

## 4. Testes executados

```
npx tsc -b        ✅ 0 erros (antes: 3, e o comando não checava nada)
npm run build     ✅ built in ~5s
npm test          ✅ 67 testes, 7 arquivos (antes: 21 testes)
npm run lint      ❌ 170 erros herdados (antes: 178) — dívida pré-existente
npm audit         ⚠️ 4 vulnerabilidades (antes: 21; crítica eliminada)
node scripts/audit.mjs --full  ⚠️ 0 críticos, 12 altos, 16 médios, 7 baixos
```

### Cobertura dos 15 fluxos críticos exigidos

| # | Fluxo | Onde é garantido | Status |
|---|---|---|---|
| 1 | Visitante vê apenas aprovados | teste `matriz de visibilidade` + policy `Anon can view approved products` | ✅ |
| 2 | Vendedor cria produto válido | teste `addProduct` (sucesso) + `enforce_product_insert_approval` | ✅ |
| 3 | Vendedor não pode `approved=true` | teste "o cliente não decide privilégios" + trigger de INSERT | ✅ |
| 4 | Admin aprova | `protect_product_approval` + `approveProduct` | ✅ (revalidar em produção) |
| 5 | Vendedor vê o próprio pendente | teste da matriz + `storefrontProducts` | ✅ |
| 6 | Outro usuário não vê pendente alheio | teste da matriz + policy | ✅ |
| 7 | Aprovado aparece na loja pública | `products_public` + `public-products` | ⏳ depende da migration |
| 8 | Produto não some após refresh | teste `mergeCatalog` + skeleton em `Produto.tsx` | ✅ |
| 9 | `2,00` é aceito | `parsePriceInput` + trigger alinhado | ✅ |
| 10 | Abaixo de R$ 2,00 é bloqueado | teste + UI + trigger + CHECK | ✅ |
| 11 | Robux legado normalizado sem inventar valor | testes de `normalizeProductPrice` | ✅ |
| 12 | `seller_id`/`approved`/vendas/estoque não manipuláveis | teste + triggers de INSERT e UPDATE | ✅ |
| 13 | Falha de rede mostra erro útil | teste `traduz falha de rede` + estado de erro da loja | ✅ |
| 14 | Sem permissão não acessa dado administrativo | policies com `has_role`; menu admin nem é construído | ✅ |
| 15 | Mobile funciona | grid 2 col., menu 88% vw, verificação de largura fixa no scanner | ✅ |

---

## 5. Pendências que exigem acesso do proprietário

| # | Pendência | Por quê |
|---|---|---|
| 1 | **Aplicar as migrations no Supabase remoto** | Precisa de token/console do dono. **Bloqueia tudo.** |
| 2 | `supabase functions deploy public-products` | Mesma razão. |
| 3 | Rodar `verify_schema.sql` e confirmar `administradores >= 1` | Sem admin, ninguém aprova anúncio. |
| 4 | Conferir `VITE_SUPABASE_URL` na Vercel | Garantir que produção usa o projeto certo. |
| 5 | Validação ponta a ponta com 3 contas | Critério de aceite final. |
| 6 | Decidir sobre `react-router` v7 | Alerta *high* restante exige upgrade major. |
| 7 | Restringir CORS `*` das Edge Functions de pagamento | Precisa do domínio definitivo. |
| 8 | Limpar 170 erros de lint herdados | Dívida técnica fora do escopo desta correção. |

---

## 6. Checklist de deploy

- [ ] `npm ci && npm run typecheck && npm run build && npm test` verdes
- [ ] `node scripts/audit.mjs` sem achados **Críticos**
- [ ] Migrations aplicadas (`supabase db push` ou SQL Editor)
- [ ] `supabase/verify_schema.sql` sem nenhum `FALHOU`
- [ ] `administradores >= 1` em `user_roles`
- [ ] Edge Function `public-products` reimplantada
- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` conferidas na Vercel
- [ ] Deploy do frontend
- [ ] Roteiro da seção 7 executado
- [ ] Nenhum segredo em commit, log ou toast

**Rollback:** reverter o merge desta branch restaura o frontend. A migration é aditiva —
mantê-la é seguro e mantém o preço mínimo correto.

---

## 7. Validação em produção

> Executar **depois** das migrations, com aba anônima limpa.

### Conta A — visitante (aba anônima)
1. Abrir `/loja` → deve listar produtos aprovados (nunca `(0)` se existirem aprovados).
2. Buscar um termo → filtra com ~300 ms de atraso.
3. Abrir um produto → preço em `R$ x,xx`, sem `0,002` e sem `2.00000`.
4. Tentar `/produto/<id-pendente>` → "não encontrado". **Nunca** exibir pendente alheio.
5. `F5` → o produto permanece.

### Conta B — vendedor comum verificado
6. Criar anúncio de **R$ 2,00** → sucesso, com "Aguardando aprovação da moderação".
7. Criar anúncio de **R$ 1,99** → bloqueado com "O preço mínimo é R$ 2,00".
8. Criar Robux `1000 Robux / R$ 2,00` → lista mostra `R$ 2,00 / pacote de 1.000 Robux`.
9. Abrir esse produto → checkout usa o preço do pacote, **nunca** ~R$ 4.000.
10. "Meus Anúncios" → aparece como **Pendente**. `F5` → continua lá.
11. Aba anônima → o pendente **não** aparece.
12. DevTools → tentar `PATCH products?id=eq.<id>` com `approved=true` → **rejeitado**.
13. Modo offline → criar anúncio → "Falha de conexão…", sem card fantasma.

### Conta C — administrador
14. Menu → seção **Administração** com contador de pendentes.
15. `/admin?tab=products` abre direto na moderação.
16. Aprovar o anúncio da conta B.
17. Aba anônima → o produto **aparece**. `F5` → permanece. ✅ **critério de aceite**
18. `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 5;` → registra a aprovação.

### Mobile (≤ 390 px)
19. Menu das três barras: abre, rola, fecha com `Esc`, sem rolagem horizontal.
20. Conta comum → **nenhum** link administrativo em lugar nenhum.

---

## 8. Critério de aceite

> Um produto criado por uma conta de teste aparece para o vendedor, é aprovado pelo
> fluxo correto, aparece para um visitante em aba anônima, permanece após recarregar e
> apresenta preço e variações corretos.

**Status:** ✅ código, banco e testes prontos · ⏳ aguardando a aplicação das migrations
no Supabase remoto (item 5.1) para a confirmação final em produção.
