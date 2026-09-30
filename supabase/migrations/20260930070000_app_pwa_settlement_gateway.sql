-- ZXMAX app-only management mode, Robux isolation, gateway wallet and delivery settlement.
-- 2026-09-30

-- Fix legacy test listings that escaped into Bots Discord.
update public.products
set category='Robux', updated_at=now()
where lower(btrim(coalesce(name,'')))='robux'
  and category not in ('Robux','Robux e Gift Cards');

update public.products
set approved=false, listing_status='paused', updated_at=now()
where lower(btrim(coalesce(name,'')))='robux'
  and coalesce(btrim(image),'')='';

-- Public products must have a real image. Existing paused legacy rows are left editable.
create or replace function public.enforce_product_image()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op='INSERT' and coalesce(btrim(new.image),'')='' then
    raise exception 'Todo anúncio precisa de uma imagem principal.' using errcode='22023';
  end if;
  if tg_op='UPDATE'
     and coalesce(btrim(new.image),'')=''
     and (new.approved=true or coalesce(new.listing_status,'pending') in ('pending','approved')) then
    raise exception 'Envie uma imagem principal antes de publicar ou enviar para análise.' using errcode='22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_product_image on public.products;
create trigger trg_enforce_product_image
before insert or update on public.products
for each row execute function public.enforce_product_image();

alter table public.merchant_charges add column if not exists platform_fee numeric(12,2);
alter table public.merchant_charges add column if not exists credited_amount numeric(12,2);

insert into public.app_settings(key,value)
values('merchant_gateway','{"depositFeePercent":0,"withdrawFee":0,"minWithdraw":5}'::jsonb)
on conflict(key) do nothing;

update public.app_settings
set value=coalesce(value,'{}'::jsonb)||jsonb_build_object('seller_release_days',10)
where key='platform';

create or replace function public.merchant_gateway_available_balance(_user_id uuid)
returns numeric
language plpgsql
stable security definer
set search_path=public
as $$
declare
  credits numeric:=0;
  reserved numeric:=0;
begin
  if auth.uid() is not null
     and auth.uid() is distinct from _user_id
     and not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Sem permissão para consultar este saldo' using errcode='42501';
  end if;

  select coalesce(sum(amount),0) into credits
  from public.wallet_ledger
  where user_id=_user_id
    and kind='merchant_charge_credit'
    and available_at<=now();

  select coalesce(sum(amount),0) into reserved
  from public.withdrawals
  where user_id=_user_id and method='gateway' and status in ('pending','approved');

  return greatest(0,round(credits-reserved,2));
end;
$$;

create or replace function public.wallet_available_balance(_user_id uuid)
returns numeric
language plpgsql
stable security definer
set search_path=public
as $$
declare
  sales numeric:=0;
  ledger numeric:=0;
  reserved numeric:=0;
begin
  if auth.uid() is not null
     and auth.uid() is distinct from _user_id
     and not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Sem permissão para consultar este saldo' using errcode='42501';
  end if;

  select coalesce(sum(coalesce(product_amount,greatest(amount-coalesce(buyer_fee,0),0))),0)
  into sales
  from public.purchases
  where seller_id=_user_id
    and seller_released=true
    and status='delivered'
    and (released_at is null or released_at<=now());

  select coalesce(sum(amount),0) into ledger
  from public.wallet_ledger
  where user_id=_user_id
    and kind<>'merchant_charge_credit'
    and available_at<=now();

  select coalesce(sum(amount),0) into reserved
  from public.withdrawals
  where user_id=_user_id
    and status in ('pending','approved')
    and method in ('normal','flex');

  return greatest(0,round(sales+ledger-reserved,2));
end;
$$;

create or replace function public.withdrawable_balance(_user_id uuid,_exclude_id bigint default null)
returns numeric
language plpgsql
stable security definer
set search_path=public
as $$
declare
  balance numeric:=0;
  excluded numeric:=0;
  withdrawal_method text:='normal';
begin
  if auth.uid() is not null
     and auth.uid() is distinct from _user_id
     and not public.has_role(auth.uid(),'admin'::public.app_role) then
    raise exception 'Sem permissão para consultar este saldo' using errcode='42501';
  end if;

  if _exclude_id is not null then
    select method,coalesce(amount,0) into withdrawal_method,excluded
    from public.withdrawals
    where id=_exclude_id and user_id=_user_id and status in ('pending','approved');
  end if;

  if withdrawal_method='gateway' then
    balance:=public.merchant_gateway_available_balance(_user_id);
  else
    balance:=public.wallet_available_balance(_user_id);
  end if;
  return round(balance+coalesce(excluded,0),2);
end;
$$;

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
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  select * into prof from public.profiles where user_id=auth.uid();
  if prof is null then raise exception 'Perfil não encontrado'; end if;
  if prof.verification_status<>'approved' then raise exception 'Conclua a verificação de documentos antes de sacar'; end if;

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

  if req>public.merchant_gateway_available_balance(auth.uid()) then
    raise exception 'Saldo Gateway insuficiente';
  end if;

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

create or replace function public.validate_withdrawal()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  platform_settings jsonb:='{}'::jsonb;
  merchant_settings jsonb:='{}'::jsonb;
  min_required numeric:=20;
  fixed_fee numeric:=3.50;
  small_min numeric:=5;
  small_extra numeric:=1;
  available numeric:=0;
  gross numeric:=0;
  already numeric:=0;
begin
  select value into platform_settings from public.app_settings where key='platform';
  select value into merchant_settings from public.app_settings where key='merchant_gateway';

  if new.method='gateway' then
    min_required:=greatest(1,coalesce((merchant_settings->>'minWithdraw')::numeric,5));
    fixed_fee:=greatest(0,coalesce((merchant_settings->>'withdrawFee')::numeric,0));
  else
    min_required:=coalesce((platform_settings->>'min_withdraw')::numeric,20);
    fixed_fee:=coalesce((platform_settings->>'withdraw_fee')::numeric,3.50);
    small_min:=coalesce((platform_settings->>'small_withdraw_min')::numeric,5);
    small_extra:=coalesce((platform_settings->>'small_withdraw_extra_fee')::numeric,1);
    if new.method='flex' then
      min_required:=small_min;
      fixed_fee:=fixed_fee+small_extra;
    elsif new.method not in ('normal','admin_fee') then
      raise exception 'Método de saque inválido';
    end if;
  end if;

  if new.amount is null or round(new.amount,2)<min_required then
    raise exception 'O valor mínimo de saque é R$ %',to_char(min_required,'FM999999990D00');
  end if;
  if coalesce(btrim(new.pix_key),'')='' then raise exception 'Cadastre uma chave Pix antes de solicitar saque'; end if;

  new.amount:=round(new.amount,2);
  new.fee:=round(fixed_fee,2);
  new.net_amount:=round(new.amount-new.fee,2);
  if new.net_amount<=0 then raise exception 'O valor do saque precisa ser maior que a taxa configurada'; end if;

  if new.method='admin_fee' then
    if not public.has_role(new.user_id,'admin'::public.app_role) then raise exception 'Apenas administradores podem sacar taxas da plataforma'; end if;
    select coalesce(sum(coalesce(p.buyer_fee,0)),0) into gross from public.purchases p where p.payment_status='paid' and p.status in ('paid','delivered_pending_confirmation','delivered');
    select coalesce(sum(w.amount),0) into already from public.withdrawals w where w.method='admin_fee' and w.status in ('pending','approved') and w.id<>coalesce(new.id,-1);
    available:=greatest(0,round(gross-already,2));
  elsif new.method='gateway' then
    available:=public.merchant_gateway_available_balance(new.user_id);
    if tg_op='UPDATE' and old.status in ('pending','approved') then available:=available+coalesce(old.amount,0); end if;
  else
    available:=public.withdrawable_balance(new.user_id,new.id);
  end if;

  if new.amount>available then raise exception 'Saldo insuficiente. Disponível para saque: R$ %',round(available,2); end if;
  return new;
end;
$$;

create or replace function public.confirm_order_receipt(_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.purchases;
  now_ts timestamptz:=now();
  release_days integer:=10;
  next_messages jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Faça login novamente.'; end if;
  select * into p from public.purchases where id=_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if p.buyer_id<>auth.uid() then raise exception 'Apenas o comprador pode confirmar o recebimento do pedido.'; end if;
  if p.status not in ('paid','delivered_pending_confirmation') then raise exception 'Status do pedido não permite confirmação de recebimento.'; end if;

  select greatest(1,least(30,coalesce((value->>'seller_release_days')::integer,10))) into release_days
  from public.app_settings where key='platform';

  next_messages:=coalesce(p.messages,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
    'from','System',
    'text','✅ Comprador confirmou o recebimento. O período de segurança da carteira começou agora e o saldo ficará disponível em '||release_days||' dias.',
    'date',now_ts
  ));

  update public.purchases
  set status='delivered',
      seller_released=false,
      released_at=null,
      delivered_pending_at=coalesce(delivered_pending_at,now_ts),
      funds_available_at=now_ts+make_interval(days=>release_days),
      messages=next_messages,
      updated_at=now_ts
  where id=_order_id;

  return jsonb_build_object('success',true,'status','delivered','funds_available_at',now_ts+make_interval(days=>release_days));
end;
$$;

create or replace function public.mark_order_delivered(_order_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.purchases;
  now_ts timestamptz:=now();
  auto_confirm_ts timestamptz:=now_ts+interval '5 days';
  next_messages jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão expirada. Faça login novamente.'; end if;
  select * into p from public.purchases where id=_order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if p.seller_id<>auth.uid() then raise exception 'Apenas o vendedor pode marcar a entrega do pedido.'; end if;
  if p.status<>'paid' then raise exception 'O pedido só pode ser marcado como entregue quando estiver em status pago.'; end if;

  next_messages:=coalesce(p.messages,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
    'from','System',
    'text','📦 O vendedor marcou o pedido como entregue. O comprador tem 5 dias para confirmar; depois disso a entrega será concluída automaticamente e começará o prazo de segurança da carteira.',
    'date',now_ts
  ));

  update public.purchases
  set status='delivered_pending_confirmation',
      delivered_pending_at=now_ts,
      funds_available_at=null,
      seller_released=false,
      released_at=null,
      messages=next_messages,
      updated_at=now_ts
  where id=_order_id;

  return jsonb_build_object('success',true,'status','delivered_pending_confirmation','delivered_pending_at',now_ts,'auto_confirm_at',auto_confirm_ts);
end;
$$;

create or replace function public.process_auto_release_orders()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare
  r record;
  processed integer:=0;
  release_days integer:=10;
begin
  select greatest(1,least(30,coalesce((value->>'seller_release_days')::integer,10))) into release_days
  from public.app_settings where key='platform';

  update public.purchases
  set status='delivered',
      seller_released=false,
      released_at=null,
      funds_available_at=now()+make_interval(days=>release_days),
      updated_at=now(),
      messages=coalesce(messages,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
        'from','System',
        'text','⏰ O pedido foi marcado como entregue automaticamente após 5 dias sem confirmação do comprador. O prazo de segurança de '||release_days||' dias da carteira começou agora.',
        'date',now()
      ))
  where status='delivered_pending_confirmation'
    and delivered_pending_at is not null
    and delivered_pending_at<=now()-interval '5 days';

  for r in
    select id,seller_id from public.purchases
    where status='delivered'
      and seller_released=false
      and funds_available_at is not null
      and funds_available_at<=now()
      and payment_status='paid'
    for update
  loop
    update public.purchases
    set seller_released=true,released_at=now(),updated_at=now(),
        messages=coalesce(messages,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
          'from','System','text','💰 Saldo da venda liberado na carteira após o período de segurança.','date',now()
        ))
    where id=r.id;
    perform public.push_notification(r.seller_id,'sale','Saldo liberado','O saldo do pedido #'||r.id||' já está disponível na carteira.','/sacar','sales','seller:'||r.id||':released',jsonb_build_object('orderId',r.id));
    processed:=processed+1;
  end loop;
  return processed;
end;
$$;

-- Any order still awaiting buyer confirmation must not have a release timestamp yet.
update public.purchases
set funds_available_at=null,seller_released=false,released_at=null
where status='delivered_pending_confirmation' and payment_status='paid';

-- Unreleased concluded orders should respect at least 10 days from conclusion.
update public.purchases
set funds_available_at=greatest(
  coalesce(funds_available_at,'epoch'::timestamptz),
  coalesce(updated_at,delivered_pending_at,paid_at,now())+interval '10 days'
)
where status='delivered' and seller_released=false and payment_status='paid';

create or replace function public.get_admin_platform_settings()
returns jsonb
language plpgsql
stable security definer
set search_path=public
as $$
declare settings jsonb:='{}'::jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Apenas administradores.' using errcode='42501'; end if;
  select value into settings from public.app_settings where key='platform';
  return jsonb_build_object(
    'maintenance',coalesce((settings->>'maintenance')::boolean,false),
    'message',left(coalesce(settings->>'maintenance_message',''),300),
    'minProductPrice',coalesce((settings->>'min_product_price')::numeric,2.00),
    'minWithdraw',coalesce((settings->>'min_withdraw')::numeric,20.00),
    'buyerFee',coalesce((settings->>'buyer_fee')::numeric,0.90),
    'withdrawFee',coalesce((settings->>'withdraw_fee')::numeric,3.50),
    'smallWithdrawMin',coalesce((settings->>'small_withdraw_min')::numeric,5.00),
    'smallWithdrawExtraFee',coalesce((settings->>'small_withdraw_extra_fee')::numeric,1.00),
    'sellerReleaseDays',coalesce((settings->>'seller_release_days')::integer,10)
  );
end;
$$;

create or replace function public.get_public_platform_fees()
returns jsonb
language plpgsql
stable security definer
set search_path=public
as $$
declare settings jsonb:='{}'::jsonb;
begin
  select value into settings from public.app_settings where key='platform';
  return jsonb_build_object(
    'buyerFee',coalesce((settings->>'buyer_fee')::numeric,0.90),
    'minWithdraw',coalesce((settings->>'min_withdraw')::numeric,20.00),
    'withdrawFee',coalesce((settings->>'withdraw_fee')::numeric,3.50),
    'smallWithdrawMin',coalesce((settings->>'small_withdraw_min')::numeric,5.00),
    'smallWithdrawExtraFee',coalesce((settings->>'small_withdraw_extra_fee')::numeric,1.00),
    'sellerReleaseDays',coalesce((settings->>'seller_release_days')::integer,10),
    'minProductPrice',coalesce((settings->>'min_product_price')::numeric,2.00)
  );
end;
$$;

create or replace function public.update_platform_settings(
  _maintenance boolean,_message text,_min_product_price numeric,_min_withdraw numeric,
  _buyer_fee numeric,_withdraw_fee numeric,_small_withdraw_min numeric,_small_withdraw_extra_fee numeric,
  _seller_release_days integer
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare existing jsonb:='{}'::jsonb; next_settings jsonb;
begin
  if auth.uid() is null or not public.has_role(auth.uid(),'admin'::public.app_role) then raise exception 'Apenas administradores.' using errcode='42501'; end if;
  if _message is null or char_length(btrim(_message))>300 then raise exception 'A mensagem de manutenção deve ter até 300 caracteres.'; end if;
  if _min_product_price<2 or _min_product_price>1000000 then raise exception 'Preço mínimo inválido'; end if;
  if _min_withdraw<1 or _min_withdraw>1000000 then raise exception 'Saque mínimo inválido'; end if;
  if _buyer_fee<0 or _buyer_fee>1000 then raise exception 'Taxa do comprador inválida'; end if;
  if _withdraw_fee<0 or _withdraw_fee>=_min_withdraw then raise exception 'Taxa de saque inválida'; end if;
  if _small_withdraw_min<1 or _small_withdraw_min>_min_withdraw then raise exception 'Mínimo reduzido inválido'; end if;
  if _small_withdraw_extra_fee<0 or _small_withdraw_extra_fee>=_small_withdraw_min then raise exception 'Taxa adicional inválida'; end if;
  if _seller_release_days<1 or _seller_release_days>30 then raise exception 'Prazo de liberação deve ficar entre 1 e 30 dias'; end if;

  select value into existing from public.app_settings where key='platform';
  next_settings:=coalesce(existing,'{}'::jsonb)||jsonb_build_object(
    'maintenance',_maintenance,'maintenance_message',btrim(_message),
    'min_product_price',round(_min_product_price,2),'min_withdraw',round(_min_withdraw,2),
    'buyer_fee',round(_buyer_fee,2),'withdraw_fee',round(_withdraw_fee,2),
    'small_withdraw_min',round(_small_withdraw_min,2),'small_withdraw_extra_fee',round(_small_withdraw_extra_fee,2),
    'seller_release_days',_seller_release_days
  );
  insert into public.app_settings(key,value) values('platform',next_settings)
  on conflict(key) do update set value=excluded.value;
  insert into public.admin_audit_log(actor_id,action,target_table,target_id,metadata)
  values(auth.uid(),'platform.settings_updated','app_settings','platform',next_settings);
  return public.get_admin_platform_settings();
end;
$$;

create or replace function public.apply_verified_payment_v2(
  _provider text,_event_key text,_event_type text,_purchase_id bigint,_charge_id text,_confirmed_amount numeric,_payload jsonb default '{}'::jsonb
)
returns table(applied boolean,resulting_status text)
language plpgsql
security definer
set search_path=public
as $$
declare
  purchase_row public.purchases%rowtype;
  product_row public.products%rowtype;
  variation jsonb;
  effective_delivery text;
  delivery_text text;
  next_status text:='paid';
  next_messages jsonb;
  expected_charge text;
  expected_amount numeric;
  delivery_pending timestamptz:=null;
begin
  if current_user not in ('postgres','service_role','supabase_admin') then raise exception 'server_only'; end if;

  insert into public.payment_events(provider,event_key,event_type,purchase_id,charge_id,amount,payload)
  values(_provider,_event_key,_event_type,_purchase_id,_charge_id,_confirmed_amount,coalesce(_payload,'{}'::jsonb))
  on conflict(provider,event_key) do nothing;
  if not found then
    select p.status into resulting_status from public.purchases p where p.id=_purchase_id;
    applied:=false; return next; return;
  end if;

  select * into purchase_row from public.purchases where id=_purchase_id for update;
  if not found then raise exception 'purchase_not_found'; end if;
  if purchase_row.status<>'pending' then resulting_status:=purchase_row.status; applied:=false; return next; return; end if;

  expected_charge:=coalesce(purchase_row.provider_payment_id,purchase_row.evopay_charge_id);
  if expected_charge is distinct from _charge_id then raise exception 'charge_mismatch'; end if;
  expected_amount:=coalesce(purchase_row.provider_amount,purchase_row.amount);
  if round(expected_amount*100) is distinct from round(_confirmed_amount*100) then raise exception 'amount_mismatch'; end if;

  select * into product_row from public.products where id=purchase_row.product_id for update;
  if not found then raise exception 'product_not_found'; end if;

  if purchase_row.variation_id is not null or purchase_row.variation_name is not null then
    select value into variation from jsonb_array_elements(coalesce(product_row.variations,'[]'::jsonb))
    where (purchase_row.variation_id is not null and value->>'id'=purchase_row.variation_id)
       or (purchase_row.variation_id is null and purchase_row.variation_name is not null and value->>'name'=purchase_row.variation_name)
    limit 1;
  end if;

  effective_delivery:=coalesce(nullif(variation->>'deliveryType',''),product_row.delivery_type,'manual');
  next_messages:=coalesce(purchase_row.messages,'[]'::jsonb);

  if effective_delivery='auto' then
    if product_row.inventory_mode='items' then
      delivery_text:=public.consume_purchase_inventory(purchase_row.id);
    else
      select delivery_content into delivery_text from public.product_delivery where product_id=purchase_row.product_id;
    end if;

    if coalesce(delivery_text,'')<>'' then
      next_status:='delivered_pending_confirmation';
      delivery_pending:=now();
      next_messages:=next_messages||jsonb_build_array(
        jsonb_build_object('from','System','text','📦 ENTREGA AUTOMÁTICA\n'||delivery_text,'date',now()),
        jsonb_build_object('from','System','text','Confirme o recebimento quando estiver tudo certo. Se não houver confirmação, o pedido será concluído automaticamente em 5 dias e então começará o prazo de segurança da carteira.','date',now())
      );
    else
      next_messages:=next_messages||jsonb_build_array(jsonb_build_object(
        'from','System','text','⚠️ Pagamento confirmado, mas a entrega automática ficou sem item disponível. O vendedor foi mantido responsável pela entrega manual neste pedido.','date',now()
      ));
      perform public.decrement_purchase_manual_stock(purchase_row.id);
    end if;
  else
    perform public.decrement_purchase_manual_stock(purchase_row.id);
  end if;

  update public.purchases
  set status=next_status,
      payment_status='paid',
      paid_at=coalesce(paid_at,now()),
      delivered_pending_at=delivery_pending,
      funds_available_at=null,
      seller_released=false,
      released_at=null,
      provider_checked_at=now(),
      messages=next_messages,
      updated_at=now()
  where id=_purchase_id;

  update public.products set sales=coalesce(sales,0)+1,updated_at=now() where id=purchase_row.product_id;
  applied:=true; resulting_status:=next_status; return next;
end;
$$;

create or replace function public.pay_purchase_with_wallet(_purchase_id bigint)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.purchases%rowtype;
  prod public.products%rowtype;
  prof public.profiles%rowtype;
  variation jsonb;
  effective_delivery text;
  bal numeric;
  delivery_text text;
  next_status text:='paid';
  next_messages jsonb;
  delivery_pending timestamptz:=null;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select * into prof from public.profiles where user_id=auth.uid();
  if prof is null or prof.verification_status<>'approved' then raise exception 'Verifique seus documentos antes de usar o saldo da carteira.'; end if;

  select * into p from public.purchases where id=_purchase_id for update;
  if p is null or p.buyer_id<>auth.uid() then raise exception 'Pedido não encontrado'; end if;
  if p.status<>'pending' then raise exception 'Este pedido não está aguardando pagamento'; end if;
  if p.payment_provider<>'wallet' then raise exception 'Forma de pagamento inválida'; end if;

  bal:=public.wallet_available_balance(auth.uid());
  if bal<p.amount then raise exception 'Saldo da carteira insuficiente'; end if;
  insert into public.wallet_ledger(user_id,amount,kind,purchase_id,description,dedupe_key)
  values(auth.uid(),-p.amount,'purchase',p.id,'Compra do pedido #'||p.id,'wallet:purchase:'||p.id);

  select * into prod from public.products where id=p.product_id for update;
  if prod is null then raise exception 'Produto indisponível'; end if;

  if p.variation_id is not null or p.variation_name is not null then
    select value into variation from jsonb_array_elements(coalesce(prod.variations,'[]'::jsonb))
    where (p.variation_id is not null and value->>'id'=p.variation_id)
       or (p.variation_id is null and p.variation_name is not null and value->>'name'=p.variation_name)
    limit 1;
  end if;
  effective_delivery:=coalesce(nullif(variation->>'deliveryType',''),prod.delivery_type,'manual');
  next_messages:=coalesce(p.messages,'[]'::jsonb);

  if effective_delivery='auto' then
    if prod.inventory_mode='items' then delivery_text:=public.consume_purchase_inventory(p.id);
    else select delivery_content into delivery_text from public.product_delivery where product_id=p.product_id; end if;

    if coalesce(delivery_text,'')<>'' then
      next_status:='delivered_pending_confirmation';
      delivery_pending:=now();
      next_messages:=next_messages||jsonb_build_array(
        jsonb_build_object('from','System','text','📦 ENTREGA AUTOMÁTICA\n'||delivery_text,'date',now()),
        jsonb_build_object('from','System','text','Confirme o recebimento. Sem confirmação, o pedido será concluído automaticamente em 5 dias e depois começa o prazo de segurança da carteira.','date',now())
      );
    else
      next_messages:=next_messages||jsonb_build_array(jsonb_build_object('from','System','text','⚠️ Pagamento confirmado, mas a entrega automática ficou sem item disponível. O vendedor deve concluir a entrega manualmente.','date',now()));
      perform public.decrement_purchase_manual_stock(p.id);
    end if;
  else
    perform public.decrement_purchase_manual_stock(p.id);
  end if;

  update public.purchases
  set status=next_status,payment_status='paid',provider_payment_id='wallet:'||p.id,paid_at=now(),
      delivered_pending_at=delivery_pending,funds_available_at=null,seller_released=false,released_at=null,
      messages=next_messages,updated_at=now()
  where id=p.id;

  update public.products set sales=coalesce(sales,0)+1,updated_at=now() where id=p.product_id;
  return jsonb_build_object('success',true,'status',next_status,'balance',public.wallet_available_balance(auth.uid()));
end;
$$;

create or replace function public.get_my_app_dashboard()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid:=auth.uid();
  prof public.profiles%rowtype;
  merchant jsonb:='{}'::jsonb;
  marketplace_balance numeric:=0;
  gateway_balance numeric:=0;
begin
  if uid is null then raise exception 'Não autenticado' using errcode='42501'; end if;
  select * into prof from public.profiles where user_id=uid limit 1;
  if prof is null then raise exception 'Perfil não encontrado' using errcode='42501'; end if;
  select value into merchant from public.app_settings where key='merchant_gateway';
  marketplace_balance:=public.wallet_available_balance(uid);
  gateway_balance:=public.merchant_gateway_available_balance(uid);

  return jsonb_build_object(
    'balance',marketplace_balance+gateway_balance,
    'marketplaceBalance',marketplace_balance,
    'gatewayBalance',gateway_balance,
    'salesCount',(select count(*) from public.purchases where seller_id=uid and payment_status='paid' and status in ('paid','delivered_pending_confirmation','delivered')),
    'salesValue',(select coalesce(sum(coalesce(product_amount,greatest(amount-coalesce(buyer_fee,0),0))),0) from public.purchases where seller_id=uid and payment_status='paid' and status in ('paid','delivered_pending_confirmation','delivered')),
    'marketplacePending',(select coalesce(sum(coalesce(product_amount,greatest(amount-coalesce(buyer_fee,0),0))),0) from public.purchases where seller_id=uid and payment_status='paid' and seller_released=false and status in ('paid','delivered_pending_confirmation','delivered')),
    'pendingOrders',(select count(*) from public.purchases where seller_id=uid and status in ('paid','delivered_pending_confirmation')),
    'messageCount',(select count(*) from public.order_messages om join public.purchases p on p.id=om.order_id where p.seller_id=uid or p.buyer_id=uid),
    'questionCount',(select count(*) from public.product_questions q join public.products p on p.id=q.product_id where p.seller_id=uid and q.answer is null),
    'activeListings',(select count(*) from public.products where seller_id=uid and approved=true),
    'openTickets',(select count(*) from public.support_tickets where user_id=uid and status='open'),
    'ticketCount',(select count(*) from public.support_tickets where user_id=uid),
    'refundCount',(select count(*) from public.purchases where (buyer_id=uid or seller_id=uid) and status='refunded'),
    'documentVerified',prof.verification_status='approved',
    'gatewayGross',(select coalesce(sum(amount),0) from public.merchant_charges where owner_id=uid and status='paid'),
    'gatewayNet',(select coalesce(sum(coalesce(credited_amount,0)),0) from public.merchant_charges where owner_id=uid and status='paid'),
    'gatewaySettings',jsonb_build_object(
      'depositFeePercent',greatest(0,least(50,coalesce((merchant->>'depositFeePercent')::numeric,0))),
      'withdrawFee',greatest(0,coalesce((merchant->>'withdrawFee')::numeric,0)),
      'minWithdraw',greatest(1,coalesce((merchant->>'minWithdraw')::numeric,5))
    ),
    'recentSales',coalesce((
      select jsonb_agg(jsonb_build_object('id',x.id,'amount',x.amount,'status',x.status,'createdAt',x.created_at,'buyerPublicId',x.buyer_public_id,'fundsAvailableAt',x.funds_available_at) order by x.created_at desc)
      from (select id,amount,status,created_at,buyer_public_id,funds_available_at from public.purchases where seller_id=uid order by created_at desc limit 12) x
    ),'[]'::jsonb),
    'ledger',coalesce((
      select jsonb_agg(jsonb_build_object('id',x.id,'amount',x.amount,'kind',x.kind,'description',x.description,'createdAt',x.created_at,'availableAt',x.available_at) order by x.created_at desc)
      from (select id,amount,kind,description,created_at,available_at from public.wallet_ledger where user_id=uid order by created_at desc limit 40) x
    ),'[]'::jsonb),
    'withdrawals',coalesce((
      select jsonb_agg(jsonb_build_object('id',x.id,'amount',x.amount,'fee',x.fee,'netAmount',x.net_amount,'method',x.method,'status',x.status,'createdAt',x.created_at) order by x.created_at desc)
      from (select id,amount,fee,net_amount,method,status,created_at from public.withdrawals where user_id=uid order by created_at desc limit 20) x
    ),'[]'::jsonb),
    'charges',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',x.id,'amount',x.amount,'providerAmount',x.provider_amount,'providerNetAmount',x.provider_net_amount,
        'platformFee',x.platform_fee,'creditedAmount',x.credited_amount,'description',x.description,'status',x.status,
        'qrCode',x.pix_qr_code,'createdAt',x.created_at,'expiresAt',x.expires_at
      ) order by x.created_at desc)
      from (select id,amount,provider_amount,provider_net_amount,platform_fee,credited_amount,description,status,pix_qr_code,created_at,expires_at from public.merchant_charges where owner_id=uid order by created_at desc limit 30) x
    ),'[]'::jsonb),
    'refunds',coalesce((
      select jsonb_agg(jsonb_build_object('id',x.id,'amount',x.amount,'reason',x.refund_reason,'refundedAt',x.refunded_at,'asSeller',x.seller_id=uid) order by x.refunded_at desc)
      from (select id,amount,refund_reason,refunded_at,seller_id from public.purchases where (buyer_id=uid or seller_id=uid) and status='refunded' order by refunded_at desc nulls last limit 20) x
    ),'[]'::jsonb),
    'dailyRevenue',coalesce((
      select jsonb_agg(jsonb_build_object('day',d.day,'amount',d.amount) order by d.day)
      from (
        select gs::date as day,
          coalesce((select sum(coalesce(product_amount,greatest(amount-coalesce(buyer_fee,0),0))) from public.purchases where seller_id=uid and payment_status='paid' and paid_at::date=gs::date),0)
          +coalesce((select sum(coalesce(credited_amount,0)) from public.merchant_charges where owner_id=uid and status='paid' and paid_at::date=gs::date),0) as amount
        from generate_series(current_date-6,current_date,interval '1 day') gs
      ) d
    ),'[]'::jsonb)
  );
end;
$$;

grant execute on function public.merchant_gateway_available_balance(uuid) to authenticated;
grant execute on function public.request_gateway_withdrawal(numeric,text,text) to authenticated;
grant execute on function public.get_my_app_dashboard() to authenticated;
