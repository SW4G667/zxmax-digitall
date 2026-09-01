-- Perguntas legadas vivem no JSON público do anúncio. O campo userEmail não
-- é necessário para leitura ou resposta e não pode permanecer nesse payload.
UPDATE public.products
SET questions = (
  SELECT COALESCE(jsonb_agg(question - 'userEmail'), '[]'::jsonb)
  FROM jsonb_array_elements(questions) AS question
)
WHERE jsonb_typeof(questions) = 'array'
  AND questions::text LIKE '%"userEmail"%';
