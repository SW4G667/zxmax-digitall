-- Correções diretamente fundamentadas nos avisos do Supabase Security Advisor.
-- As funções de pergunta continuam disponíveis apenas para usuários autenticados;
-- a função de event trigger não deve ser exposta pelo PostgREST.
ALTER FUNCTION public.contains_external_contact(text) SET search_path = public;
ALTER FUNCTION public.refresh_product_review_stats(bigint) SET search_path = public;
ALTER FUNCTION public.maintain_product_review_stats() SET search_path = public;

REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.ask_product_question(bigint, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.answer_product_question(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ask_product_question(bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.answer_product_question(bigint, text) TO authenticated, service_role;
