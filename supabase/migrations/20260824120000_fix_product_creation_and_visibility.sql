-- ============================================================================
-- ZXMAX · 2026-08-24 · Correção definitiva de criação e visibilidade de anúncios
--
-- Motivo (ver docs/DIAGNOSTICO-ZXMAX.md):
--   1. `validate_product_price()` ainda exigia R$ 5,00 enquanto a UI e a
--      constraint `products_minimum_price` exigiam R$ 2,00. Todo anúncio entre
--      R$ 2,00 e R$ 4,99 era rejeitado pelo trigger e o frontend mostrava
--      apenas "Não foi possível criar o produto".
--   2. `products_public` só existe com `stock/min_quantity/delivery_time` se as
--      migrations de 2026-08 tiverem sido aplicadas. Em bancos desatualizados o
--      SELECT do frontend quebrava e a loja exibia "Todos os produtos (0)".
--   3. `approved` dependia do estado do React: um vendedor comum podia enviar
--      `approved=true` no INSERT. Agora quem decide é o banco.
--
-- Este arquivo é IDEMPOTENTE e ADITIVO: pode ser reexecutado sem risco e não
-- remove tabelas, colunas nem dados.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Colunas esperadas pelo frontend
-- ----------------------------------------------------------------------------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_quantity integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS delivery_time text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seller_rating numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seller_reviews integer;

-- ----------------------------------------------------------------------------
-- 2) Preço: uma única regra (R$ 2,00) no trigger e na constraint
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_product_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.price IS NULL OR NEW.price <> NEW.price THEN            -- NULL / NaN
    RAISE EXCEPTION 'Preço inválido' USING ERRCODE = '22P02';
  END IF;
  IF NEW.price < 2 THEN
    RAISE EXCEPTION 'O preço mínimo de um anúncio é R$ 2,00' USING ERRCODE = '23514';
  END IF;
  IF NEW.price > 1000000 THEN
    RAISE EXCEPTION 'O preço máximo de um anúncio é R$ 1.000.000,00' USING ERRCODE = '23514';
  END IF;
  -- `price numeric(12,2)` já arredonda, mas normalizamos para não depender disso.
  NEW.price := round(NEW.price, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_price_trg ON public.products;
CREATE TRIGGER validate_product_price_trg
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_price();

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_minimum_price;
ALTER TABLE public.products ADD CONSTRAINT products_minimum_price CHECK (price >= 2) NOT VALID;

-- Variações também precisam respeitar o mínimo e não podem carregar lixo.
CREATE OR REPLACE FUNCTION public.validate_product_variations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
BEGIN
  IF NEW.variations IS NULL THEN
    NEW.variations := '[]'::jsonb;
  END IF;
  IF jsonb_typeof(NEW.variations) <> 'array' THEN
    RAISE EXCEPTION 'Variações inválidas' USING ERRCODE = '22P02';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.variations) LOOP
    IF coalesce(btrim(item->>'name'), '') = '' THEN
      RAISE EXCEPTION 'Toda variação precisa de um nome' USING ERRCODE = '23502';
    END IF;
    IF (item->>'price') IS NULL OR (item->>'price')::numeric < 2 THEN
      RAISE EXCEPTION 'O preço mínimo de uma variação é R$ 2,00' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_product_variations_trg ON public.products;
CREATE TRIGGER validate_product_variations_trg
  BEFORE INSERT OR UPDATE OF variations ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_variations();

-- ----------------------------------------------------------------------------
-- 3) Aprovação decidida pelo banco, nunca pelo cliente
-- ----------------------------------------------------------------------------
-- No INSERT: administrador publica direto, qualquer outra pessoa entra como
-- pendente mesmo que envie `approved = true`. Isso substitui a regra que vivia
-- no estado do React e fecha o caminho de auto-aprovação.
CREATE OR REPLACE FUNCTION public.enforce_product_insert_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;                       -- service_role (edge functions)
  END IF;
  NEW.seller_id := auth.uid();        -- impede forjar o vendedor
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    NEW.approved := false;
    NEW.sales    := 0;                -- vendas e reputação não vêm do cliente
    NEW.rating   := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_insert_approval_trg ON public.products;
CREATE TRIGGER enforce_product_insert_approval_trg
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_insert_approval();

-- No UPDATE: apenas admin aprova; ninguém troca de dono nem edita vendas.
CREATE OR REPLACE FUNCTION public.protect_product_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;
  IF NEW.approved = true AND COALESCE(OLD.approved, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar anúncios' USING ERRCODE = '42501';
  END IF;
  NEW.seller_id := OLD.seller_id;
  NEW.sales     := OLD.sales;
  NEW.rating    := OLD.rating;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_product_approval_trigger ON public.products;
CREATE TRIGGER protect_product_approval_trigger
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.protect_product_approval();

REVOKE ALL ON FUNCTION public.validate_product_price() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_product_variations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_product_insert_approval() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_product_approval() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) Matriz de visibilidade (RLS)
--    visitante  -> aprovados
--    logado     -> aprovados + os próprios (inclusive pendentes)
--    admin      -> tudo
-- ----------------------------------------------------------------------------
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved products are public" ON public.products;
DROP POLICY IF EXISTS "Public can view approved products" ON public.products;
DROP POLICY IF EXISTS "Public can view approved products via public view" ON public.products;
DROP POLICY IF EXISTS "Public can view approved safe products" ON public.products;
DROP POLICY IF EXISTS "Users can view approved and own" ON public.products;
DROP POLICY IF EXISTS "Authenticated can view approved and own and admin can view all" ON public.products;

CREATE POLICY "Anon can view approved products"
ON public.products FOR SELECT TO anon
USING (approved = true);

CREATE POLICY "Authenticated can view approved own and admin all"
ON public.products FOR SELECT TO authenticated
USING (
  approved = true
  OR auth.uid() = seller_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Users can create own products" ON public.products;
CREATE POLICY "Users can create own products"
ON public.products FOR INSERT TO authenticated
WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Sellers and admins can update products" ON public.products;
DROP POLICY IF EXISTS "Sellers can update own unapproved fields and admins can manage products" ON public.products;
CREATE POLICY "Sellers update own listings and admins manage all"
ON public.products FOR UPDATE TO authenticated
USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Sellers and admins can delete products" ON public.products;
CREATE POLICY "Sellers and admins can delete products"
ON public.products FOR DELETE TO authenticated
USING (auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- ----------------------------------------------------------------------------
-- 5) Read model público
-- ----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.products_public;
CREATE VIEW public.products_public
WITH (security_invoker = true) AS
SELECT
  id, seller_id, seller_public_id, seller_name, name, price, category,
  image, banner, description, approved, delivery_type, variations, questions,
  sales, rating, created_at, updated_at, stock, min_quantity, delivery_time
FROM public.products
WHERE approved = true;

GRANT SELECT ON public.products_public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6) Grants por coluna
--    `seller_email` e `delivery_content` NUNCA são legíveis pelo cliente.
-- ----------------------------------------------------------------------------
REVOKE SELECT ON public.products FROM anon, authenticated;
GRANT SELECT (
  id, seller_id, seller_public_id, seller_name, name, price, category,
  image, banner, description, approved, delivery_type, variations, questions,
  sales, rating, created_at, updated_at, stock, min_quantity, delivery_time,
  seller_rating, seller_reviews
) ON public.products TO anon, authenticated;

GRANT INSERT (
  seller_id, seller_public_id, seller_name, seller_email, name, price, category,
  image, banner, description, approved, delivery_type, variations, questions,
  stock, min_quantity, delivery_time
) ON public.products TO authenticated;

GRANT UPDATE (
  seller_public_id, seller_name, name, price, category, image, banner,
  description, approved, delivery_type, variations, questions, updated_at,
  stock, min_quantity, delivery_time
) ON public.products TO authenticated;

GRANT DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- ----------------------------------------------------------------------------
-- 7) Índices de leitura da loja
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_approved_created ON public.products(approved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_seller ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category) WHERE approved = true;

-- ----------------------------------------------------------------------------
-- 8) Trilha de auditoria administrativa
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log(created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;

DROP POLICY IF EXISTS "Admins read audit log" ON public.admin_audit_log;
CREATE POLICY "Admins read audit log"
ON public.admin_audit_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins write audit log" ON public.admin_audit_log;
CREATE POLICY "Admins write audit log"
ON public.admin_audit_log FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND actor_id = auth.uid());

-- Registro automático de aprovação/reprovação de anúncios.
CREATE OR REPLACE FUNCTION public.log_product_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.approved IS DISTINCT FROM OLD.approved THEN
    INSERT INTO public.admin_audit_log (actor_id, action, target_table, target_id, metadata)
    VALUES (
      auth.uid(),
      CASE WHEN NEW.approved THEN 'product.approved' ELSE 'product.unapproved' END,
      'products',
      NEW.id::text,
      jsonb_build_object('seller_id', NEW.seller_id, 'name', NEW.name)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_product_moderation_trg ON public.products;
CREATE TRIGGER log_product_moderation_trg
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_moderation();

REVOKE ALL ON FUNCTION public.log_product_moderation() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 9) Recuperação de dados legados (idempotente, não inventa preço)
--    Robux antigos gravados por unidade voltam ao preço do pacote.
-- ----------------------------------------------------------------------------
UPDATE public.products p
SET price = sub.pkg_price
FROM (
  SELECT id, (
    SELECT (elem->>'price')::numeric
    FROM jsonb_array_elements(
      CASE jsonb_typeof(p.variations) WHEN 'array' THEN p.variations ELSE '[]'::jsonb END
    ) AS elem
    WHERE (elem->>'price') ~ '^[0-9]+(\.[0-9]+)?$'
      AND (elem->>'price')::numeric >= 2
    ORDER BY (elem->>'price')::numeric ASC
    LIMIT 1
  ) AS pkg_price
  FROM public.products p
  WHERE p.category = 'Robux e Gift Cards' AND p.price < 2
) sub
WHERE p.id = sub.id AND sub.pkg_price IS NOT NULL;
