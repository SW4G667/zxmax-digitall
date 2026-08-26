-- ZXMAX · Registro mínimo de eventos de autenticação, com deduplicação por origem.

CREATE OR REPLACE FUNCTION public.record_security_event(
  _actor_id uuid,
  _event_type text,
  _outcome text,
  _context jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subject_hash text := NULLIF(_context->>'subject_hash', '');
BEGIN
  IF _event_type NOT IN ('auth.login', 'auth.recovery', 'auth.discord', 'admin.access')
    OR _outcome NOT IN ('success', 'failure', 'blocked') THEN
    RAISE EXCEPTION 'Evento de segurança inválido' USING ERRCODE = '22023';
  END IF;

  -- Evita que uma origem provoque um volume ilimitado de logs sem ocultar
  -- tentativas repetidas de naturezas diferentes.
  IF subject_hash IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.security_events
    WHERE event_type = _event_type
      AND outcome = _outcome
      AND context->>'subject_hash' = subject_hash
      AND created_at >= now() - interval '30 seconds'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.security_events (actor_id, event_type, outcome, context)
  VALUES (_actor_id, _event_type, _outcome, _context - 'subject_hash');
END;
$$;

REVOKE ALL ON FUNCTION public.record_security_event(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_security_event(uuid, text, text, jsonb) TO service_role;
