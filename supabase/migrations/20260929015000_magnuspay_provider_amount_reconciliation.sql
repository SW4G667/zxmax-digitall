-- MagnusPay may force feeToCustomer on the active route.
-- Preserve the platform order amount for accounting, but also persist the
-- exact gateway amount returned when the PIX is created. Payment confirmation
-- must validate against the gateway amount, not against the pre-gateway amount.

alter table public.purchases
  add column if not exists provider_amount numeric,
  add column if not exists provider_fee numeric,
  add column if not exists provider_net_amount numeric,
  add column if not exists provider_checked_at timestamptz;

comment on column public.purchases.provider_amount is
  'Exact total charged by the external payment provider for this charge.';
comment on column public.purchases.provider_fee is
  'Provider/platform fee reported when the external charge was created.';
comment on column public.purchases.provider_net_amount is
  'Net amount reported by the external provider.';
comment on column public.purchases.provider_checked_at is
  'Last time the provider status was checked by the backend.';

with latest_create as (
  select distinct on (order_id)
    order_id,
    case when coalesce(payload->>'providerAmount','') ~ '^[0-9]+([.][0-9]+)?$'
      then (payload->>'providerAmount')::numeric end as provider_amount,
    case when coalesce(payload->>'platformFee','') ~ '^[0-9]+([.][0-9]+)?$'
      then (payload->>'platformFee')::numeric end as provider_fee,
    case when coalesce(payload->>'netAmount','') ~ '^[0-9]+([.][0-9]+)?$'
      then (payload->>'netAmount')::numeric end as provider_net_amount
  from public.webhook_logs
  where source = 'magnuspay'
    and event_type = 'CREATE_PIX'
    and status = 'created'
    and order_id is not null
  order by order_id, created_at desc
)
update public.purchases p
set provider_amount = coalesce(p.provider_amount, l.provider_amount),
    provider_fee = coalesce(p.provider_fee, l.provider_fee),
    provider_net_amount = coalesce(p.provider_net_amount, l.provider_net_amount)
from latest_create l
where p.id = l.order_id
  and p.payment_provider = 'magnuspay_pix';

create index if not exists purchases_pending_magnuspay_check_idx
  on public.purchases (created_at desc)
  where status = 'pending' and payment_provider = 'magnuspay_pix';

create or replace function public.apply_verified_payment_v2(
  _provider text,
  _event_key text,
  _event_type text,
  _purchase_id bigint,
  _charge_id text,
  _confirmed_amount numeric,
  _payload jsonb default '{}'::jsonb
)
returns table(applied boolean, resulting_status text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  purchase_row public.purchases%rowtype;
  product_row public.products%rowtype;
  variation jsonb;
  effective_delivery text;
  delivery_text text;
  next_status text := 'paid';
  next_messages jsonb;
  expected_charge text;
  expected_amount numeric;
  settings jsonb := '{}'::jsonb;
  release_days integer := 7;
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'server_only';
  end if;

  insert into public.payment_events(provider,event_key,event_type,purchase_id,charge_id,amount,payload)
  values (_provider,_event_key,_event_type,_purchase_id,_charge_id,_confirmed_amount,coalesce(_payload,'{}'::jsonb))
  on conflict (provider,event_key) do nothing;

  if not found then
    select p.status into resulting_status from public.purchases p where p.id=_purchase_id;
    applied:=false; return next; return;
  end if;

  select * into purchase_row from public.purchases where id=_purchase_id for update;
  if not found then raise exception 'purchase_not_found'; end if;
  if purchase_row.status <> 'pending' then
    resulting_status:=purchase_row.status; applied:=false; return next; return;
  end if;

  expected_charge:=coalesce(purchase_row.provider_payment_id,purchase_row.evopay_charge_id);
  if expected_charge is distinct from _charge_id then raise exception 'charge_mismatch'; end if;

  -- For providers that add/force a payer fee, provider_amount is the amount
  -- cryptographically bound to this specific charge. Other providers continue
  -- using purchases.amount as before.
  expected_amount:=coalesce(purchase_row.provider_amount,purchase_row.amount);
  if round(expected_amount*100) is distinct from round(_confirmed_amount*100) then
    raise exception 'amount_mismatch';
  end if;

  select * into product_row from public.products where id=purchase_row.product_id for update;
  if not found then raise exception 'product_not_found'; end if;

  if purchase_row.variation_id is not null or purchase_row.variation_name is not null then
    select value into variation
    from jsonb_array_elements(coalesce(product_row.variations, '[]'::jsonb))
    where
      (purchase_row.variation_id is not null and value->>'id' = purchase_row.variation_id)
      or
      (purchase_row.variation_id is null and purchase_row.variation_name is not null and value->>'name' = purchase_row.variation_name)
    limit 1;
  end if;

  effective_delivery := coalesce(nullif(variation->>'deliveryType',''), product_row.delivery_type, 'manual');

  select value into settings from public.app_settings where key='platform';
  release_days:=greatest(5,least(7,coalesce((settings->>'seller_release_days')::integer,7)));
  next_messages:=coalesce(purchase_row.messages,'[]'::jsonb);

  if effective_delivery='auto' then
    if product_row.inventory_mode='items' then
      delivery_text := public.consume_purchase_inventory(purchase_row.id);
    else
      select delivery_content into delivery_text
      from public.product_delivery
      where product_id=purchase_row.product_id;
    end if;

    if coalesce(delivery_text,'')<>'' then
      next_status:='delivered';
      next_messages:=next_messages||jsonb_build_array(jsonb_build_object(
        'from','System',
        'text','📦 ENTREGA AUTOMÁTICA\n'||delivery_text,
        'date',now()
      ));
    else
      next_messages:=next_messages||jsonb_build_array(jsonb_build_object(
        'from','System',
        'text','⚠️ Pagamento confirmado, mas a entrega automática ficou sem item disponível. O vendedor foi mantido responsável pela entrega manual neste pedido.',
        'date',now()
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
      funds_available_at=coalesce(funds_available_at,now() + make_interval(days=>release_days)),
      seller_released=false,
      provider_checked_at=now(),
      messages=next_messages,
      updated_at=now()
  where id=_purchase_id;

  update public.products
  set sales=coalesce(sales,0)+1,
      updated_at=now()
  where id=purchase_row.product_id;

  applied:=true; resulting_status:=next_status; return next;
end;
$function$;
