# Diagnóstico ZXMAX — criação e exibição de produtos

**Data:** 2026-08-24 · **Branch:** `arena/01a0321b-zxmax-digitall` · **Base:** `main@f4acd15`

---

## 1. Causa raiz

Foram confirmadas **duas causas independentes**. Cada uma sozinha já reproduz um dos sintomas
relatados; juntas explicam todos eles.

### 1.1 CONFIRMADA — o trigger de preço exigia R$ 5,00 enquanto a interface exigia R$ 2,00

`supabase/migrations/20260608000319_*.sql` criou:

```sql
CREATE OR REPLACE FUNCTION public.validate_product_price()
...
  IF NEW.price < 5 THEN
    RAISE EXCEPTION 'O preço mínimo de um produto é R$ 5,00';
```

Esse trigger **nunca foi substituído**. Enquanto isso, `src/lib/catalog.ts` define
`MIN_PRODUCT_PRICE = 2` e a migration `20260823130000` adicionou
`CHECK (price >= 2)`.

Resultado: **todo anúncio entre R$ 2,00 e R$ 4,99 é rejeitado pelo banco.**
Como `addProduct` engolia o erro num `for` de tentativas e caía num
`toast.error("Não foi possível criar o produto. Tente novamente.")`, a mensagem real
(`O preço mínimo de um produto é R$ 5,00`) nunca chegava ao vendedor.

O caso Robux era ainda pior: a versão antiga da tela gravava **preço por unidade**
(R$ 2,00 ÷ 1000 Robux = **R$ 0,002**). Além de violar o mínimo, `products.price` é
`numeric(12,2)`, então 0,002 arredondava para `0.00`. Isso explica os dois sintomas ao
mesmo tempo:

- os anúncios de Robux **falhavam ao ser criados** (0,00 < 5);
- os que entraram antes do trigger ficaram gravados como **R$ 0,002 / R$ 0,00**.

### 1.2 CONFIRMADA — o SELECT do catálogo quebrava inteiro por uma coluna ausente

`loadCatalog` pedia uma lista fixa de colunas na view pública:

```ts
supabase.from("products_public").select(SAFE_PRODUCT_COLUMNS)
// ...,stock,min_quantity,delivery_time
```

`stock`, `min_quantity` e `delivery_time` só existem se as migrations de agosto/2026
(`20260821000000` em diante) tiverem sido aplicadas no banco remoto. Em um banco
desatualizado o PostgREST responde `42703 column ... does not exist` e **descarta a
consulta inteira** — não devolve as outras colunas. A loja recebia zero linhas e exibia
`Todos os produtos (0)`, exatamente o que continua acontecendo em
<https://zxmax.vercel.app/loja> (verificado nesta análise).

Os *fallbacks* existentes não salvavam a situação:

| Fallback | Por que falhava |
|---|---|
| Edge Function `public-products` | Só é chamada se o primeiro SELECT devolver 0 linhas — e, ao errar, também devolvia `{products: []}` com status 200, mascarando a falha. |
| `products` com `approved=true` | Usava **a mesma lista de colunas**, então quebrava pelo mesmo motivo. |
| REST direto no `StoreView` | Terceiro caminho de dados, com `console.log`, que só disfarçava o problema. |

### 1.3 Hipóteses avaliadas e **descartadas**

| Hipótese | Veredito |
|---|---|
| Policy de INSERT ausente | ❌ `Users can create own products` existe desde `20260425004619` e está correta (`auth.uid() = seller_id`). |
| Grants de coluna bloqueando o INSERT | ❌ `20260823120000` concede INSERT em todas as colunas enviadas, inclusive `seller_email` e `approved`. |
| `products_public` sem `security_invoker` | ❌ Corrigido em `20260821000000`; a view atual está correta. |
| Projeto Supabase errado em produção | ❌ `supabase/config.toml`, `DEPLOYMENT.md` e o `StoreContext` apontam todos para `dbekdedzgkfgtlytrnyw`. |
| Usuário não autenticado no momento do INSERT | ⚠️ Possível em sessão expirada, mas não é a causa principal — agora tem mensagem própria. |

### 1.4 Riscos adicionais encontrados (não eram a causa, mas eram bugs reais)

| # | Achado | Efeito |
|---|---|---|
| A | `mergeCatalog` preservava para sempre IDs otimistas (`Date.now()`, `> 1e12`) | Produto que **falhou** ou foi **excluído** continuava na tela ("produtos fantasma"). |
| B | Edge Function `public-products`: se não houvesse aprovados, devolvia **todos** os produtos | **Vazamento**: anúncio pendente de terceiros aparecia para visitante anônimo. |
| C | `approved` era decidido por `state.currentUser.isAdmin` no React e enviado no INSERT | O cliente participava da decisão de aprovação. |
| D | `Produto.tsx` tratava o preço de pacote Robux como **preço por unidade** e multiplicava por `quantity` (default 2000) | Um pacote de R$ 2,00 gerava checkout de R$ 4.000,00. |
| E | `InventoryView` renderizava `p.price.toFixed(5)` | Exibia `R$ 2.00000`. |
| F | `stock`, `min_quantity` e `delivery_time` eram coletados no formulário mas **não enviados** no INSERT | Dados do vendedor perdidos; a UI então inventava `stock = sales*137+500`, `rating 99.4`, `100 avaliações`. |
| G | Selo "vendedor verificado" fixo em `verified: true` | Selo de confiança falso. |
| H | `VITE_SUPABASE_URL/KEY` usados sem validação | Variável ausente na Vercel ⇒ erro opaco indistinguível de "loja vazia". |

---

## 2. Erros de browser / Network / Supabase

Estado observado em produção (<https://zxmax.vercel.app/loja>, aba anônima):

```
Todos os produtos (0)
Nenhum produto encontrado
```

O HTML é servido corretamente (frontend publicado e funcional), portanto a falha está na
camada de dados. As mensagens abaixo são as que o Supabase devolve para cada causa
confirmada:

| Origem | Erro real |
|---|---|
| INSERT em `products` com preço entre 2 e 4,99 | `23514 — O preço mínimo de um produto é R$ 5,00` |
| INSERT de Robux por unidade | mesma exceção, com `price = 0.00` |
| SELECT em `products_public` em banco desatualizado | `42703 — column products_public.stock does not exist` |
| PostgREST com cache de schema antigo | `PGRST204 — Could not find the 'delivery_time' column` |

> **Limitação honesta desta análise:** o sandbox não tem saída HTTPS direta, então não foi
> possível executar consultas autenticadas contra `dbekdedzgkfgtlytrnyw.supabase.co` para
> imprimir a resposta literal do banco. Por isso foi entregue
> `supabase/verify_schema.sql`, que confirma cada um desses pontos em 30 segundos no SQL
> Editor. A verificação do frontend (loja vazia em produção) **foi** feita diretamente.

---

## 3. Status do deploy de frontend

✅ **Publicado e saudável.** `https://zxmax.vercel.app/loja` responde 200, renderiza o
shell, o consentimento de cookies, as categorias e o hero. O problema **não** é de deploy
de frontend.

---

## 4. Status das migrations no banco remoto

⚠️ **Não confirmado — e provavelmente desatualizado.**

Existem **34 migrations** em `supabase/migrations` (33 antes desta entrega). Quando a
integração automática aparece como *skipped*, o banco **não** recebeu nada — publicar na
Vercel não aplica SQL. A combinação "frontend novo + banco antigo" reproduz exatamente
`Todos os produtos (0)`.

O procedimento operacional (sem pedir credenciais) está em
**[`docs/APLICAR-MIGRATIONS.md`](./APLICAR-MIGRATIONS.md)**.

---

## 5. Objetos de banco envolvidos

| Tipo | Objeto | Papel |
|---|---|---|
| Tabela | `public.products` | Catálogo. `price numeric(12,2)`, `approved boolean default false`. |
| Tabela | `public.product_delivery` | Conteúdo de entrega, fora da tabela pública. |
| Tabela | `public.admin_audit_log` | **Novo.** Trilha de auditoria de moderação. |
| View | `public.products_public` | Read model público (`security_invoker`, `WHERE approved = true`). |
| View | `public.profiles_public` | Card público de vendedor. |
| Função | `public.has_role(uuid, app_role)` | `SECURITY DEFINER`, base de toda checagem de admin. |
| Função | `public.validate_product_price()` | **Corrigida:** mínimo 2, rejeita NULL/NaN/overflow. |
| Função | `public.validate_product_variations()` | **Nova.** Valida nome e preço de cada variação. |
| Função | `public.enforce_product_insert_approval()` | **Nova.** Força `approved=false`, `seller_id=auth.uid()`, `sales=0` no INSERT de não-admin. |
| Função | `public.protect_product_approval()` | **Reforçada:** também congela `seller_id`, `sales` e `rating` no UPDATE. |
| Função | `public.log_product_moderation()` | **Nova.** Grava aprovação/reprovação em `admin_audit_log`. |
| Policy | `Anon can view approved products` | Visitante vê só aprovados. |
| Policy | `Authenticated can view approved own and admin all` | Matriz de visibilidade completa. |
| Policy | `Users can create own products` | `WITH CHECK (auth.uid() = seller_id)`. |
| Grants | por coluna em `products` | `seller_email` e `delivery_content` **removidos** do SELECT de `anon`/`authenticated`. |

---

## 6. Diferença entre local, `main`, Vercel e Supabase

| Camada | Estado |
|---|---|
| Local (esta branch) | Correções de código + migration `20260824120000` + testes + scanner. |
| `main` | Frontend com o bug de mensagem genérica e o SELECT frágil. |
| Vercel | Reflete `main`: publicado, funcional, porém com `Todos os produtos (0)`. |
| Supabase remoto | **Desconhecido.** É a divergência crítica. Só `verify_schema.sql` responde. |

---

## 7. Plano de correção (ordem de prioridade)

| # | Ação | Status |
|---|---|---|
| 1 | Alinhar o preço mínimo em trigger, constraint e UI em R$ 2,00 | ✅ feito (`20260824120000`) |
| 2 | Tornar o SELECT do catálogo resiliente a schema antigo (retry sem colunas novas) | ✅ feito |
| 3 | Expor o erro real do Supabase como mensagem específica e segura | ✅ feito (`src/lib/productErrors.ts`) |
| 4 | Mover a decisão de `approved` para o banco | ✅ feito (trigger de INSERT) |
| 5 | Eliminar produtos-fantasma (`mergeCatalog`) | ✅ feito |
| 6 | Fechar o vazamento de pendentes na Edge Function | ✅ feito |
| 7 | Corrigir preço de pacote Robux no checkout e na exibição | ✅ feito |
| 8 | Enviar `stock`/`min_quantity`/`delivery_time` reais e remover números inventados | ✅ feito |
| 9 | **Aplicar as migrations no Supabase remoto** | ⏳ **requer acesso do responsável** |
| 10 | Rodar `verify_schema.sql` e o roteiro de validação em aba anônima | ⏳ depende do item 9 |

---

## 8. Riscos de segurança e de regressão

### Segurança corrigida nesta entrega

| Risco | Correção |
|---|---|
| Anúncio pendente de terceiros visível a anônimos | Filtro `approved=true` é agora a fronteira de autorização da Edge Function. |
| `seller_email` legível por `anon`/`authenticated` | `REVOKE SELECT (seller_email)`. |
| Auto-aprovação e falsificação de `seller_id`/`sales`/`rating` | Triggers de INSERT e UPDATE no banco. |
| Vazamento técnico em toast | Erro completo só no console; usuário recebe texto fixo (coberto por teste). |
| `vitest` com CVE crítica + 16 highs | `npm audit fix`: 21 → 4 vulnerabilidades. |

### Riscos residuais / de regressão

| Risco | Mitigação |
|---|---|
| `REVOKE SELECT (seller_email)` esvazia o e-mail em telas de admin | Admin já lê e-mail via `userDirectory` (`profiles`). Reversível com um `GRANT`. |
| Constraint `products_minimum_price` é `NOT VALID` | Proposital: preserva linhas históricas legíveis e protege toda escrita nova. |
| `react-router` mantém 1 alerta *high* (open redirect) | Correção exige major v7. Registrado como pendência priorizada. |
| Lint com 170 erros herdados (`no-explicit-any`) | Fora do escopo desta correção; documentado no scanner. |
| Migration reexecutada | Toda ela é idempotente (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE`). |

---

## 9. Referências consultadas

- **`https://zxmax.vercel.app/loja`** — verificado: `Todos os produtos (0)`.
- **`https://ggmax.com.br`** — usado apenas como referência de organização, navegação e
  sinais de confiança. **Nenhum ativo, texto ou layout foi copiado**; a identidade ZXMAX
  (azul `#0084ff`, fundo `#0a0a0f`, tipografia black) foi mantida.
- **MediaFire `d94cskhhovfi9/ZXMAX`** — pasta acessível, porém **vazia**: *"The owner of
  this folder has not added any files" / "0 items were found in this folder"*.
  Nenhuma tela foi inventada a partir dela, conforme instruído.
