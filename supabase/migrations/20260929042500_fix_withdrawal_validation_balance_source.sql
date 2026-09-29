create or replace function public.validate_withdrawal()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  settings jsonb := '{}'::jsonb;
  min_required numeric := 20.00;
  fixed_fee numeric := 3.50;
  small_min numeric := 5.00;
  small_extra numeric := 1.00;
  available numeric := 0;
  gross numeric := 0;
  already numeric := 0;
begin
  select s.value into settings
  from public.app_settings s
  where s.key='platform';

  min_required:=coalesce((settings->>'min_withdraw')::numeric,20.00);
  fixed_fee:=coalesce((settings->>'withdraw_fee')::numeric,3.50);
  small_min:=coalesce((settings->>'small_withdraw_min')::numeric,5.00);
  small_extra:=coalesce((settings->>'small_withdraw_extra_fee')::numeric,1.00);

  if new.method='flex' then
    min_required:=small_min;
    fixed_fee:=fixed_fee+small_extra;
  elsif new.method not in ('normal','admin_fee') then
    raise exception 'Método de saque inválido';
  end if;

  if new.amount is null or round(new.amount,2)<min_required then
    raise exception 'O valor mínimo de saque é R$ %',to_char(min_required,'FM999999990D00');
  end if;

  if coalesce(trim(new.pix_key),'')='' then
    raise exception 'Cadastre uma chave Pix antes de solicitar saque';
  end if;

  new.amount:=round(new.amount,2);
  new.fee:=round(fixed_fee,2);
  new.net_amount:=round(new.amount-new.fee,2);
  if new.net_amount<=0 then
    raise exception 'O valor do saque precisa ser maior que a taxa configurada';
  end if;

  if new.method='admin_fee' then
    if not public.has_role(new.user_id,'admin'::public.app_role) then
      raise exception 'Apenas administradores podem sacar taxas da plataforma';
    end if;

    select coalesce(sum(coalesce(p.buyer_fee,0)),0) into gross
    from public.purchases p
    where p.payment_status='paid'
      and p.status in ('paid','delivered_pending_confirmation','delivered');

    select coalesce(sum(w.amount),0) into already
    from public.withdrawals w
    where w.method='admin_fee'
      and w.status in ('pending','approved')
      and w.id<>coalesce(new.id,-1);

    available:=greatest(0,round(gross-already,2));
  else
    -- Single source of truth: only released seller funds + available wallet
    -- credits count, while existing pending/approved withdrawals stay reserved.
    available:=public.withdrawable_balance(new.user_id,new.id);
  end if;

  if new.amount>available then
    raise exception 'Saldo insuficiente. Disponível para saque: R$ %',round(available,2);
  end if;

  return new;
end;
$$;
