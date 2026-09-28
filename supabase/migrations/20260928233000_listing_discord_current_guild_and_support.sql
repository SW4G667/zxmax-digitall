-- Seller gate + support persistence hardening.
-- Listing requires a confirmed e-mail and membership in the CURRENT configured Discord guild.

CREATE OR REPLACE FUNCTION public.enforce_listing_email_discord()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  email_ok boolean := false;
  verified_at timestamptz;
  verified_guild_id text := '';
  configured_guild_id text := '';
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role'
     OR session_user IN ('postgres','supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para anunciar.' USING ERRCODE = '42501';
  END IF;

  IF NEW.seller_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Vendedor inválido.' USING ERRCODE = '42501';
  END IF;

  IF public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  SELECT (u.email_confirmed_at IS NOT NULL)
    INTO email_ok
  FROM auth.users u
  WHERE u.id = auth.uid();

  IF NOT COALESCE(email_ok,false) THEN
    RAISE EXCEPTION 'Confirme seu e-mail antes de anunciar.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(value->>'discordGuildId','')
    INTO configured_guild_id
  FROM public.app_settings
  WHERE key = 'site_branding';

  IF configured_guild_id = '' THEN
    RAISE EXCEPTION 'O servidor oficial do Discord ainda não foi configurado pela administração.' USING ERRCODE = '42501';
  END IF;

  SELECT p.discord_member_verified_at, COALESCE(p.discord_guild_id,'')
    INTO verified_at, verified_guild_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF verified_at IS NULL THEN
    RAISE EXCEPTION 'Entre no servidor do Discord e verifique sua conta antes de anunciar.' USING ERRCODE = '42501';
  END IF;

  IF verified_guild_id IS DISTINCT FROM configured_guild_id THEN
    RAISE EXCEPTION 'O servidor oficial do Discord mudou. Verifique sua participação novamente antes de anunciar.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_listing_email_discord() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_listing_email_discord() TO service_role;

-- Support tickets are persisted server-side. Users may read/open their own
-- tickets; replies and status changes go through authorization-aware RPCs.
DROP POLICY IF EXISTS "Users see own tickets, admin sees all" ON public.support_tickets;
DROP POLICY IF EXISTS "Users and admin can update tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users and staff read support tickets" ON public.support_tickets;

CREATE POLICY "Users and staff read support tickets"
ON public.support_tickets
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  OR public.has_role((SELECT auth.uid()), 'support'::public.app_role)
);

DROP POLICY IF EXISTS "Users can open own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users open own support tickets" ON public.support_tickets;

CREATE OR REPLACE FUNCTION public.open_support_ticket(_subject text, _text text)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  ticket public.support_tickets;
  actor_id uuid := auth.uid();
  actor_email text := '';
  clean_subject text := btrim(COALESCE(_subject,''));
  clean_text text := btrim(COALESCE(_text,''));
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para abrir um atendimento.' USING ERRCODE='42501';
  END IF;

  IF length(clean_subject) < 2 OR length(clean_subject) > 140 THEN
    RAISE EXCEPTION 'O assunto deve ter entre 2 e 140 caracteres.' USING ERRCODE='22023';
  END IF;

  IF length(clean_text) < 10 OR length(clean_text) > 2000 THEN
    RAISE EXCEPTION 'A descrição deve ter entre 10 e 2000 caracteres.' USING ERRCODE='22023';
  END IF;

  SELECT COALESCE(email,'') INTO actor_email
  FROM auth.users
  WHERE id = actor_id;

  INSERT INTO public.support_tickets(user_id,user_email,subject,status,messages,updated_at)
  VALUES (
    actor_id,
    actor_email,
    clean_subject,
    'open',
    jsonb_build_array(jsonb_build_object(
      'from', actor_email,
      'text', clean_text,
      'date', now()
    )),
    now()
  )
  RETURNING * INTO ticket;

  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.reply_support_ticket(_ticket_id bigint, _text text)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  ticket public.support_tickets;
  actor_id uuid := auth.uid();
  actor_email text := '';
  is_staff boolean := false;
  clean_text text := btrim(COALESCE(_text,''));
  sender_label text;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para responder.' USING ERRCODE='42501';
  END IF;

  IF length(clean_text) < 1 OR length(clean_text) > 2000 THEN
    RAISE EXCEPTION 'A mensagem deve ter entre 1 e 2000 caracteres.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO ticket
  FROM public.support_tickets
  WHERE id = _ticket_id
  FOR UPDATE;

  IF ticket.id IS NULL THEN
    RAISE EXCEPTION 'Atendimento não encontrado.' USING ERRCODE='P0002';
  END IF;

  is_staff :=
    public.has_role(actor_id, 'admin'::public.app_role)
    OR public.has_role(actor_id, 'support'::public.app_role);

  IF ticket.user_id IS DISTINCT FROM actor_id AND NOT is_staff THEN
    RAISE EXCEPTION 'Você não pode responder este atendimento.' USING ERRCODE='42501';
  END IF;

  IF ticket.status <> 'open' THEN
    RAISE EXCEPTION 'Este atendimento já foi finalizado.' USING ERRCODE='22023';
  END IF;

  SELECT COALESCE(email,'') INTO actor_email FROM auth.users WHERE id = actor_id;
  sender_label := CASE WHEN is_staff THEN 'Equipe ZXMAX' ELSE actor_email END;

  UPDATE public.support_tickets
  SET
    messages = COALESCE(messages,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'from', sender_label,
      'text', clean_text,
      'date', now()
    )),
    updated_at = now()
  WHERE id = _ticket_id
  RETURNING * INTO ticket;

  IF is_staff THEN
    PERFORM public.push_notification(
      ticket.user_id,
      'support',
      'Nova resposta do suporte',
      left(clean_text,180),
      '/central-de-ajuda?ticket=' || ticket.id,
      'support',
      NULL,
      jsonb_build_object('ticketId',ticket.id)
    );
  ELSE
    PERFORM public.push_notification(
      staff.user_id,
      'support',
      'Usuário respondeu ao suporte',
      left(ticket.subject || ': ' || clean_text,180),
      '/admin?tab=tickets',
      'support',
      NULL,
      jsonb_build_object('ticketId',ticket.id)
    )
    FROM (
      SELECT DISTINCT ur.user_id
      FROM public.user_roles ur
      WHERE ur.role IN ('admin'::public.app_role,'support'::public.app_role)
    ) staff;
  END IF;

  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_support_ticket(_ticket_id bigint)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket public.support_tickets;
  actor_id uuid := auth.uid();
  is_staff boolean := false;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Faça login para continuar.' USING ERRCODE='42501';
  END IF;

  SELECT * INTO ticket
  FROM public.support_tickets
  WHERE id = _ticket_id
  FOR UPDATE;

  IF ticket.id IS NULL THEN
    RAISE EXCEPTION 'Atendimento não encontrado.' USING ERRCODE='P0002';
  END IF;

  is_staff :=
    public.has_role(actor_id, 'admin'::public.app_role)
    OR public.has_role(actor_id, 'support'::public.app_role);

  IF ticket.user_id IS DISTINCT FROM actor_id AND NOT is_staff THEN
    RAISE EXCEPTION 'Você não pode finalizar este atendimento.' USING ERRCODE='42501';
  END IF;

  UPDATE public.support_tickets
  SET status = 'closed', updated_at = now()
  WHERE id = _ticket_id
  RETURNING * INTO ticket;

  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_support_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.push_notification(
    staff.user_id,
    'support',
    'Novo atendimento de suporte',
    left(NEW.subject,180),
    '/admin?tab=tickets',
    'support',
    NULL,
    jsonb_build_object('ticketId',NEW.id)
  )
  FROM (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('admin'::public.app_role,'support'::public.app_role)
  ) staff;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_new_support_ticket_trg ON public.support_tickets;
CREATE TRIGGER notify_new_support_ticket_trg
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_new_support_ticket();

REVOKE ALL ON FUNCTION public.notify_new_support_ticket() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON public.support_tickets FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.support_tickets FROM authenticated;
GRANT SELECT ON public.support_tickets TO authenticated;

REVOKE ALL ON FUNCTION public.open_support_ticket(text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reply_support_ticket(bigint,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.close_support_ticket(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_support_ticket(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reply_support_ticket(bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_support_ticket(bigint) TO authenticated;

CREATE INDEX IF NOT EXISTS support_tickets_user_updated_idx
  ON public.support_tickets(user_id, updated_at DESC);
