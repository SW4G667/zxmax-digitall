-- A leitura do diretório operacional acompanha as mesmas garantias de sessão
-- reforçada aplicadas à alteração de papel e capacidades.

CREATE OR REPLACE FUNCTION public.get_admin_capability_directory()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_primary_admin();

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'public_id', p.public_id,
        'display_name', p.display_name,
        'role', ur.role,
        'capabilities', CASE
          WHEN ur.role = 'admin'::public.app_role THEN to_jsonb(ARRAY[
            'moderate_catalog',
            'review_identity',
            'manage_user_safety',
            'manage_tags',
            'view_sanitized_webhooks'
          ]::text[])
          ELSE COALESCE((
            SELECT jsonb_agg(uc.capability ORDER BY uc.capability)
            FROM public.user_capabilities uc
            WHERE uc.user_id = ur.user_id
          ), '[]'::jsonb)
        END
      )
      ORDER BY p.public_id
    )
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.role IN ('admin'::public.app_role, 'support'::public.app_role)
  ), '[]'::jsonb);
END;
$$;
