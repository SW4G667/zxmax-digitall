# Como aplicar as migrations no Supabase remoto

> **Nunca envie senha, token, service role key ou código 2FA por chat.**
> Todo o procedimento abaixo é feito pelo responsável, na própria conta dele.

Publicar na Vercel **não** aplica SQL. Se a integração de banco aparecer como
*skipped*, o Supabase remoto continua no schema antigo — e a loja continuará
mostrando `Todos os produtos (0)` mesmo com o frontend novo no ar.

---

## Passo 1 — Confirmar o `project ref` que a produção usa

No painel da Vercel, em **Settings → Environment Variables**, leia o valor de
`VITE_SUPABASE_URL`. Ele tem o formato:

```
https://<project-ref>.supabase.co
```

O repositório está configurado para `dbekdedzgkfgtlytrnyw`
(`supabase/config.toml`). **Se o valor na Vercel for diferente, pare aqui**: o site
está apontando para outro banco, e esse é o problema a resolver primeiro.

## Passo 2 — Confirmar acesso ao projeto Supabase

Abra <https://supabase.com/dashboard> e confirme que o projeto com esse `ref`
aparece na sua lista com permissão de escrita. Se não aparecer, peça acesso ao
dono da organização antes de continuar.

## Passo 3 — Aplicar as migrations

Escolha **uma** das opções.

### Opção A — Supabase CLI (recomendada)

```bash
# 1. Gere um access token pessoal em:
#    https://supabase.com/dashboard/account/tokens
#    Exporte-o no SEU terminal. Não cole em chat, issue ou commit.
export SUPABASE_ACCESS_TOKEN=...

# 2. Vincule o repositório ao projeto
npx supabase link --project-ref <project-ref>

# 3. Veja o que será aplicado ANTES de aplicar
npx supabase db diff --linked

# 4. Aplique
npx supabase db push
```

### Opção B — SQL Editor do dashboard

Se não puder usar a CLI, aplique manualmente **em ordem cronológica de nome de
arquivo**, os arquivos de `supabase/migrations/` que ainda faltarem.

O mínimo indispensável para resolver a falha atual é:

1. `20260821000000_fix_admin_rls_products_docs.sql`
2. `20260821120000_fix_verify_catalog_admin_gate.sql`
3. `20260823120000_catalog_insert_grants.sql`
4. `20260823130000_enforce_minimum_product_price.sql`
5. `20260823140000_recover_products_and_robux_prices.sql`
6. **`20260824120000_fix_product_creation_and_visibility.sql`** ← a correção principal

O arquivo 6 é idempotente e pode ser reexecutado sem risco.

### Passo 3.1 — Atualizar a Edge Function corrigida

```bash
npx supabase functions deploy public-products --project-ref <project-ref>
```

## Passo 4 — Validar no banco

No SQL Editor, cole e execute o conteúdo de **`supabase/verify_schema.sql`**.
Ele não altera nada e checa, em 11 blocos:

- colunas obrigatórias de `public.products`;
- `products_public` existe, é `security_invoker` e filtra `approved`;
- RLS habilitado nas tabelas sensíveis;
- policies de `products`;
- os 6 triggers esperados;
- **o trigger de preço usa 2, não 5** (é o teste que prova que a correção chegou);
- a constraint `products_minimum_price`;
- que `seller_email` e `delivery_content` **não** têm SELECT para `anon`/`authenticated`;
- `has_role` e a existência de pelo menos um admin em `user_roles`;
- saúde do catálogo (aprovados, pendentes, abaixo do mínimo, Robux legado);
- `admin_audit_log`.

**Critério de aprovação:** nenhuma linha com `FALHOU` e `administradores >= 1`.

> Se `administradores` for `0`, ninguém consegue aprovar anúncio. Corrija com:
> ```sql
> INSERT INTO public.user_roles (user_id, role)
> SELECT user_id, 'admin'::app_role FROM public.profiles WHERE email = 'SEU_EMAIL_ADMIN'
> ON CONFLICT DO NOTHING;
> ```

## Passo 5 — Verificação pós-migration ponta a ponta

Execute o roteiro de **[`docs/RELATORIO-FINAL.md`](./RELATORIO-FINAL.md#validação-em-produção)**
com três contas (comum, vendedor, admin) e uma aba anônima.

---

## Regra de conclusão

> **A tarefa só está concluída quando o `verify_schema.sql` passa e um produto de
> teste aparece em aba anônima.** Frontend publicado com banco desatualizado **não**
> conta como entregue.
