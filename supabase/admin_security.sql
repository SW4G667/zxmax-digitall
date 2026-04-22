-- Função de segurança para verificar papel do usuário autenticado
create or replace function public.tem_funcao(funcao_requerida text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return coalesce(
    (
      select role = funcao_requerida
      from public.users
      where id = auth.uid()
      limit 1
    ),
    false
  );
end;
$$;

-- Promoção manual segura do email reservado para admin.
-- Use esta função apenas via SQL Editor ou fluxo administrativo controlado.
create or replace function public.promover_admin_reservado()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set role = 'admin', updated_at = now()
  where lower(email) = 'admin@keybot.com';
end;
$$;

comment on function public.promover_admin_reservado() is
'Promove manualmente o email reservado admin@keybot.com para admin depois que a conta for criada de forma controlada.';
