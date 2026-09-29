create or replace function public.get_order_participant_locales(_order_id bigint)
returns table(user_id uuid, locale text, country_code text)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  p public.purchases%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado' using errcode='42501';
  end if;

  select * into p from public.purchases where id=_order_id;
  if p is null then raise exception 'Pedido não encontrado'; end if;

  if auth.uid()<>p.buyer_id
     and auth.uid()<>p.seller_id
     and not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Sem permissão' using errcode='42501';
  end if;

  return query
  select pr.user_id, pr.locale, pr.country_code
  from public.profiles pr
  where pr.user_id in (p.buyer_id,p.seller_id);
end;
$$;
revoke all on function public.get_order_participant_locales(bigint) from public,anon;
grant execute on function public.get_order_participant_locales(bigint) to authenticated,service_role;
