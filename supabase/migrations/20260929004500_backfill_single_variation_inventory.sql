-- Backfill seguro para anúncios legados com uma única variação.
-- Antes do estoque por variação, esses anúncios guardavam estoque, quantidade
-- mínima, prazo e entrega somente nas colunas do produto. Com uma única
-- variação não há ambiguidade: os valores do produto pertencem àquela opção.
UPDATE public.products AS p
SET variations = jsonb_build_array(
  (p.variations -> 0)
  || jsonb_strip_nulls(
    jsonb_build_object(
      'id',
        COALESCE(NULLIF(p.variations -> 0 ->> 'id', ''), 'legacy_' || p.id::text || '_1'),
      'stock',
        COALESCE(NULLIF(p.variations -> 0 ->> 'stock', '')::integer, p.stock),
      'minQuantity',
        COALESCE(NULLIF(p.variations -> 0 ->> 'minQuantity', '')::integer, p.min_quantity, 1),
      'deliveryTime',
        COALESCE(NULLIF(p.variations -> 0 ->> 'deliveryTime', ''), NULLIF(p.delivery_time, '')),
      'deliveryType',
        COALESCE(NULLIF(p.variations -> 0 ->> 'deliveryType', ''), NULLIF(p.delivery_type, ''), 'manual')
    )
  )
)
WHERE jsonb_typeof(p.variations) = 'array'
  AND jsonb_array_length(p.variations) = 1;