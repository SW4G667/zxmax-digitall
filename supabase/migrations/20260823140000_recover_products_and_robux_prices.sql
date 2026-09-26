-- Recover products created while admin role detection failed, without affecting regular sellers.
UPDATE public.products p
SET approved = true
WHERE p.approved = false
  AND public.has_role(p.seller_id, 'admin'::app_role);

-- Promote the valid package price for legacy Robux listings that stored a per-unit amount.
UPDATE public.products p
SET price = sub.pkg_price
FROM (
  SELECT id, (
    SELECT (elem->>'price')::numeric
    FROM jsonb_array_elements(CASE jsonb_typeof(p.variations) WHEN 'array' THEN p.variations ELSE '[]'::jsonb END) AS elem
    WHERE (elem->>'price')::numeric >= 2
    ORDER BY (elem->>'price')::numeric ASC
    LIMIT 1
  ) AS pkg_price
  FROM public.products p
  WHERE p.category = 'Robux e Gift Cards' AND p.price < 2
) sub
WHERE p.id = sub.id AND sub.pkg_price IS NOT NULL;
