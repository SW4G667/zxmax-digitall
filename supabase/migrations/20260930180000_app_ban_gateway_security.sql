-- Security sweep: App Gateway authorization and active-ban enforcement.
-- Admin accounts are allowed to operate the platform gateway without falsely
-- marking their identity documents as approved.

create or replace function public.can_use_merchant_gateway(_user_id uuid)
returns boolean
language sql
stable security definer
set search_path=public
as $$
  select
    _user_id is not null
    and not public.is_banned(_user_id)
    and (
      public.has_role(_user_id,'admin'::public.app_role)
      or exists (
        select 1 from public.profiles p
        where p.user_id=_user_id and p.verification_status='approved'
      )
    );
$$;

revoke all on function public.can_use_merchant_gateway(uuid) from public,anon,authenticated;
grant execute on function public.can_use_merchant_gateway(uuid) to service_role;

create or replace function public.can_use_merchant_gateway()
returns boolean
language sql
stable security definer
set search_path=public
as $$
  select auth.uid() is not null and public.can_use_merchant_gateway(auth.uid());
$$;

revoke all on function public.can_use_merchant_gateway() from public,anon;
grant execute on function public.can_use_merchant_gateway() to authenticated;

create or replace function public.get_my_app_dashboard_secure()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  if public.is_banned(auth.uid()) then
    raise exception 'Conta suspensa. O aplicativo de gerenciamento está bloqueado.' using errcode='42501';
  end if;
  return public.get_my_app_dashboard();
end;
$$;

revoke all on function public.get_my_app_dashboard_secure() from public,anon;
grant execute on function public.get_my_app_dashboard_secure() to authenticated;

create or replace function public.request_gateway_withdrawal(_amount numeric,_pix_key text default null,_idempotency_key text default null)
returns public.withdrawals
language plpgsql
security definer
set search_path=public
as $$
declare
  prof public.profiles;
  w public.withdrawals;
  settings jsonb:='{}'::jsonb;
  req numeric:=round(coalesce(_amount,0),2);
  fee numeric:=0;
  min_required numeric:=5;
  chosen_pix text;
  idem text:=coalesce(nullif(btrim(_idempotency_key),''),gen_random_uuid()::text);
begin
  if auth.uid() is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  if public.is_banned(auth.uid()) then raise exception 'Conta suspensa. Saques estão bloqueados.' using errcode='42501'; end if;
  if not public.can_use_merchant_gateway(auth.uid()) then
    raise exception 'Conclua a verificação de documentos antes de sacar' using errcode='42501';
  end if;

  select * into prof from public.profiles where user_id=auth.uid();
  if prof is null then raise exception 'Perfil não encontrado'; end if;

  select value into settings from public.app_settings where key='merchant_gateway';
  fee:=greatest(0,coalesce((settings->>'withdrawFee')::numeric,0));
  min_required:=greatest(1,coalesce((settings->>'minWithdraw')::numeric,5));
  if req<min_required then raise exception 'O saque mínimo do App Gateway é R$ %',to_char(min_required,'FM999999990D00'); end if;
  if fee>=req then raise exception 'O valor precisa ser maior que a taxa de saque'; end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select * into w from public.withdrawals where idempotency_key=idem;
  if w is not null then
    if w.user_id<>auth.uid() then raise exception 'Chave de idempotência inválida'; end if;
    return w;
  end if;

  if req>public.merchant_gateway_available_balance(auth.uid()) then raise exception 'Saldo Gateway insuficiente'; end if;

  chosen_pix:=coalesce(nullif(btrim(_pix_key),''),prof.pix_key,'');
  if chosen_pix='' then raise exception 'Cadastre uma chave Pix antes de solicitar saque'; end if;

  insert into public.withdrawals(user_id,user_public_id,user_email,amount,fee,net_amount,method,pix_key,idempotency_key)
  values(auth.uid(),prof.public_id::text,prof.email,req,round(fee,2),round(req-fee,2),'gateway',chosen_pix,idem)
  returning * into w;

  insert into public.withdrawal_events(withdrawal_id,event_type,actor_id,note)
  values(w.id,'gateway_requested',auth.uid(),'Saque solicitado pelo App Gateway');
  return w;
end;
$$;

create or replace function public.block_banned_user_write()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is not null and public.is_banned(auth.uid()) then
    raise exception 'Conta suspensa. Esta ação está bloqueada.' using errcode='42501';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  tbl text;
  trg text;
begin
  foreach tbl in array array[
    'products','purchases','order_messages','product_questions',
    'support_tickets','withdrawals','profiles','wallet_ledger','seller_documents'
  ]
  loop
    if to_regclass('public.'||tbl) is not null then
      trg:='zx_block_banned_'||tbl;
      execute format('drop trigger if exists %I on public.%I',trg,tbl);
      execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.block_banned_user_write()',trg,tbl);
    end if;
  end loop;
end $$;

-- Keep abandoned gateway rows from looking active forever after interrupted
-- network requests or expired PIX codes.
update public.merchant_charges
set status='failed',updated_at=now()
where status='creating' and created_at<now()-interval '15 minutes';

update public.merchant_charges
set status='expired',updated_at=now()
where status='pending' and expires_at is not null and expires_at<now();

do $$
declare existing bigint;
begin
  select jobid into existing from cron.job where jobname='zxmax-merchant-charge-cleanup' limit 1;
  if existing is not null then perform cron.unschedule(existing); end if;
  perform cron.schedule(
    'zxmax-merchant-charge-cleanup',
    '*/5 * * * *',
    $job$
      update public.merchant_charges
      set status='failed',updated_at=now()
      where status='creating' and created_at<now()-interval '15 minutes';
      update public.merchant_charges
      set status='expired',updated_at=now()
      where status='pending' and expires_at is not null and expires_at<now();
    $job$
  );
end $$;
