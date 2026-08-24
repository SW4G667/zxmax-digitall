-- ============================================================================
-- ZXMAX · Verificação pós-migration
-- Rode no SQL Editor do Supabase (ou `psql`) DEPOIS de aplicar as migrations.
-- Nenhuma linha altera dados. Cada bloco imprime "OK" ou "FALHOU".
-- ============================================================================

\echo '--- 1. Colunas obrigatórias de public.products ---'
SELECT
  c.expected AS coluna,
  CASE WHEN a.attname IS NULL THEN 'FALHOU (ausente)' ELSE 'OK' END AS status
FROM (VALUES
  ('id'),('seller_id'),('seller_public_id'),('seller_name'),('seller_email'),
  ('name'),('price'),('category'),('image'),('banner'),('description'),
  ('approved'),('delivery_type'),('variations'),('questions'),('sales'),
  ('rating'),('created_at'),('updated_at'),('stock'),('min_quantity'),('delivery_time')
) AS c(expected)
LEFT JOIN pg_attribute a
  ON a.attrelid = 'public.products'::regclass
 AND a.attname = c.expected
 AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY 2 DESC, 1;

\echo '--- 2. products_public existe, é security_invoker e só mostra aprovados ---'
SELECT
  CASE WHEN to_regclass('public.products_public') IS NULL THEN 'FALHOU (view ausente)' ELSE 'OK' END AS view_existe,
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.products_public'::regclass
      AND 'security_invoker=true' = ANY (reloptions)
  ) THEN 'OK' ELSE 'FALHOU (sem security_invoker)' END AS security_invoker,
  CASE WHEN pg_get_viewdef('public.products_public'::regclass) ILIKE '%approved%' THEN 'OK' ELSE 'FALHOU (sem filtro approved)' END AS filtro_approved;

\echo '--- 3. RLS habilitado ---'
SELECT relname AS tabela,
       CASE WHEN relrowsecurity THEN 'OK' ELSE 'FALHOU (RLS desligado)' END AS status
FROM pg_class
WHERE relname IN ('products','purchases','withdrawals','profiles','seller_documents','product_delivery')
  AND relnamespace = 'public'::regnamespace
ORDER BY 1;

\echo '--- 4. Policies de public.products ---'
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'products'
ORDER BY cmd, policyname;

\echo '--- 5. Triggers de public.products ---'
SELECT
  t.expected AS trigger_name,
  CASE WHEN g.tgname IS NULL THEN 'FALHOU (ausente)' ELSE 'OK' END AS status
FROM (VALUES
  ('validate_product_price_trg'),
  ('validate_product_variations_trg'),
  ('enforce_product_insert_approval_trg'),
  ('protect_product_approval_trigger'),
  ('log_product_moderation_trg'),
  ('update_products_updated_at')
) AS t(expected)
LEFT JOIN pg_trigger g
  ON g.tgrelid = 'public.products'::regclass
 AND g.tgname = t.expected
 AND NOT g.tgisinternal
ORDER BY 2 DESC, 1;

\echo '--- 6. Preço mínimo do trigger deve ser 2 (nao 5) ---'
SELECT CASE
  WHEN pg_get_functiondef('public.validate_product_price()'::regprocedure) LIKE '%NEW.price < 2%'
    THEN 'OK (minimo R$ 2,00)'
  ELSE 'FALHOU (o trigger ainda usa outro minimo — migration nao aplicada)'
END AS status;

\echo '--- 7. Constraint de preço mínimo ---'
SELECT conname,
       CASE WHEN pg_get_constraintdef(oid) LIKE '%>= 2%' THEN 'OK' ELSE 'FALHOU' END AS status,
       pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'public.products'::regclass AND conname = 'products_minimum_price';

\echo '--- 8. Grants por coluna: seller_email NAO pode ser legivel por anon/authenticated ---'
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name = 'products'
  AND grantee IN ('anon','authenticated')
  AND column_name IN ('seller_email','delivery_content')
ORDER BY grantee, column_name;
-- Esperado: nenhuma linha com privilege_type = 'SELECT'.

\echo '--- 9. Função has_role e roles de admin ---'
SELECT CASE WHEN to_regprocedure('public.has_role(uuid, public.app_role)') IS NULL
            THEN 'FALHOU (has_role ausente)' ELSE 'OK' END AS has_role;

SELECT count(*) AS administradores
FROM public.user_roles
WHERE role = 'admin'::app_role;
-- Esperado: pelo menos 1. Se for 0, nenhum usuario consegue aprovar anuncios.

\echo '--- 10. Saude do catalogo ---'
SELECT
  count(*)                                        AS total,
  count(*) FILTER (WHERE approved)                AS aprovados,
  count(*) FILTER (WHERE NOT approved)            AS pendentes,
  count(*) FILTER (WHERE price < 2)               AS abaixo_do_minimo,
  count(*) FILTER (WHERE category = 'Robux e Gift Cards' AND price < 2) AS robux_legado_por_unidade
FROM public.products;

\echo '--- 11. Tabela de auditoria ---'
SELECT CASE WHEN to_regclass('public.admin_audit_log') IS NULL
            THEN 'FALHOU (ausente)' ELSE 'OK' END AS admin_audit_log;

\echo '--- 12. Perguntas de anuncio (migration 20260824130000) ---'
SELECT CASE WHEN to_regclass('public.product_questions') IS NULL
            THEN 'FALHOU (tabela ausente — migration 20260824130000 nao aplicada)'
            ELSE 'OK' END AS tabela_product_questions;

SELECT CASE WHEN to_regprocedure('public.ask_product_question(bigint, text)') IS NULL
            THEN 'FALHOU (ask_product_question ausente)'
            ELSE 'OK' END AS rpc_ask_product_question;

SELECT CASE WHEN to_regprocedure('public.answer_product_question(bigint, text)') IS NULL
            THEN 'FALHOU (answer_product_question ausente)'
            ELSE 'OK' END AS rpc_answer_product_question;

SELECT CASE WHEN pg_get_functiondef('public.reject_external_contact(text)'::regprocedure) LIKE '%whats%'
            THEN 'OK (bloqueio de contato externo no banco)'
            ELSE 'FALHOU (validacao de contato externo ausente)' END AS validacao_contato;

-- RLS + grants: leitura publica, escrita apenas via RPC.
SELECT count(*) AS policies_produto_perguntas
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'product_questions';
-- Esperado: >= 1 (Anyone can read product questions).

SELECT grantee, privilege_type
FROM information_schema.role_table_privileges
WHERE table_schema = 'public' AND table_name = 'product_questions'
  AND grantee IN ('anon','authenticated')
ORDER BY grantee, privilege_type;
-- Esperado: apenas SELECT para anon/authenticated (INSERT/UPDATE/DELETE revogados).
