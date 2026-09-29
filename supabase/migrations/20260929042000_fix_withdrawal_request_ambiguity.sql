create or replace function public.request_withdrawal(
  _amount numeric,
  _method text default 'normal',
  _idempotency_key text default null,
  _retry_of bigint default null,
  _pix_key text default null
)
returns public.withdrawals
language plpgsql
security definer
set search_path=public
as $$
declare
  w public.withdrawals;
  prof public.profiles;
  idem_key text := coalesce(nullif(trim(_idempotency_key), ''), gen_random_uuid()::text);
  prev public.withdrawals;
  chosen_pix text;
  req_amount numeric := round(_amount, 2);
  settings jsonb := '{}'::jsonb;
  min_required numeric := 20.00;
  fixed_fee numeric := 3.50;
  small_min numeric := 5.00;
  small_extra numeric := 1.00;
  available_balance numeric := 0;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;

  select s.value into settings
  from public.app_settings s
  where s.key='platform';

  min_required:=coalesce((settings->>'min_withdraw')::numeric,20.00);
  fixed_fee:=coalesce((settings->>'withdraw_fee')::numeric,3.50);
  small_min:=coalesce((settings->>'small_withdraw_min')::numeric,5.00);
  small_extra:=coalesce((settings->>'small_withdraw_extra_fee')::numeric,1.00);

  if _method='flex' then
    min_required:=small_min;
    fixed_fee:=fixed_fee+small_extra;
  elsif _method not in ('normal','admin_fee') then
    raise exception 'Método de saque inválido';
  end if;

  if req_amount is null or req_amount<min_required then
    raise exception 'O valor mínimo de saque é R$ %',to_char(min_required,'FM999999990D00');
  end if;
  if fixed_fee<0 or req_amount<=fixed_fee then
    raise exception 'O valor do saque precisa ser maior que a taxa configurada';
  end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  select wd.* into w
  from public.withdrawals wd
  where wd.idempotency_key=idem_key;

  if w is not null then
    if w.user_id<>auth.uid() then raise exception 'Chave de idempotência inválida'; end if;
    return w;
  end if;

  select p.* into prof
  from public.profiles p
  where p.user_id=auth.uid();

  if prof is null then raise exception 'Perfil não encontrado'; end if;

  if _method='admin_fee' then
    if not public.has_role(auth.uid(),'admin'::public.app_role) then
      raise exception 'Apenas administradores podem sacar taxas da plataforma';
    end if;
  else
    if prof.verification_status<>'approved' then
      raise exception 'Conclua a verificação de documentos antes de sacar';
    end if;
    available_balance:=public.wallet_available_balance(auth.uid());
    if req_amount>available_balance then
      raise exception 'Saldo disponível insuficiente para este saque';
    end if;
  end if;

  if _retry_of is not null then
    select wd.* into prev
    from public.withdrawals wd
    where wd.id=_retry_of
    for update;
    if prev is null or prev.user_id<>auth.uid() then raise exception 'Saque original não encontrado'; end if;
    if prev.status<>'rejected' then raise exception 'Só é possível reenviar um saque recusado'; end if;
  end if;

  chosen_pix:=coalesce(nullif(trim(_pix_key),''),prof.pix_key,'');
  if chosen_pix='' then raise exception 'Cadastre uma chave Pix no perfil antes de solicitar saque'; end if;

  insert into public.withdrawals(user_id,user_public_id,user_email,amount,fee,net_amount,method,pix_key,idempotency_key,retry_of)
  values(auth.uid(),prof.public_id::text,prof.email,req_amount,round(fixed_fee,2),round(req_amount-fixed_fee,2),coalesce(_method,'normal'),chosen_pix,idem_key,_retry_of)
  returning * into w;

  insert into public.withdrawal_events(withdrawal_id,event_type,actor_id,note)
  values(w.id,case when _retry_of is null then 'requested' else 'resubmitted' end,auth.uid(),'');

  return w;
end;
$$;

create or replace function public.request_withdrawal(
  _amount numeric,
  _method text default 'normal',
  _idempotency_key text default null,
  _retry_of bigint default null
)
returns public.withdrawals
language plpgsql
security definer
set search_path=public
as $$
begin
  return public.request_withdrawal(_amount,_method,_idempotency_key,_retry_of,null);
end;
$$;
