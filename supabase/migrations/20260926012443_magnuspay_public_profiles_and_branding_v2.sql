-- Aligns the public marketplace identity projection and MagnusPay-ready purchases
-- with the migration already applied to the active Supabase project.

alter table public.profiles_public
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles_public enable row level security;

revoke all on table public.profiles_public from anon, authenticated;
grant select on table public.profiles_public to anon, authenticated;
grant all on table public.profiles_public to service_role;

drop policy if exists "Public profiles are readable" on public.profiles_public;
create policy "Public profiles are readable"
on public.profiles_public
for select
to anon, authenticated
using (true);

create schema if not exists private;

create or replace function private.sync_profile_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.profiles_public where user_id = old.user_id;
    return old;
  end if;

  insert into public.profiles_public (
    user_id,
    public_id,
    display_name,
    avatar_url,
    is_verified_seller,
    created_at,
    updated_at
  )
  values (
    new.user_id,
    new.public_id,
    coalesce(new.display_name, ''),
    nullif(new.avatar_url, ''),
    coalesce(new.is_verified_seller, false),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (user_id) do update set
    public_id = excluded.public_id,
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    is_verified_seller = excluded.is_verified_seller,
    updated_at = now();

  return new;
end;
$$;

revoke all on function private.sync_profile_public() from public, anon, authenticated;

drop trigger if exists profiles_public_sync on public.profiles;
create trigger profiles_public_sync
after insert or update of public_id, display_name, avatar_url, is_verified_seller or delete
on public.profiles
for each row execute function private.sync_profile_public();

insert into public.profiles_public (
  user_id,
  public_id,
  display_name,
  avatar_url,
  is_verified_seller,
  created_at,
  updated_at
)
select
  user_id,
  public_id,
  coalesce(display_name, ''),
  nullif(avatar_url, ''),
  coalesce(is_verified_seller, false),
  created_at,
  now()
from public.profiles
where user_id is not null and public_id is not null
on conflict (user_id) do update set
  public_id = excluded.public_id,
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url,
  is_verified_seller = excluded.is_verified_seller,
  updated_at = now();

alter table public.purchases
  add column if not exists provider_payment_id text,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists paid_at timestamptz;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.purchases'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%payment_provider%'
  loop
    execute format('alter table public.purchases drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.purchases
  add constraint purchases_payment_provider_check
  check (
    payment_provider is null
    or payment_provider = any (
      array[
        'magnuspay_pix'::text,
        'zennith_pix'::text,
        'vexopay_pix'::text,
        'crypto'::text,
        'card'::text,
        'boleto'::text
      ]
    )
  ) not valid;

alter table public.purchases validate constraint purchases_payment_provider_check;

alter table public.purchases
  drop constraint if exists purchases_payment_status_check;

alter table public.purchases
  add constraint purchases_payment_status_check
  check (payment_status = any (array['pending'::text,'paid'::text,'failed'::text,'expired'::text,'cancelled'::text]))
  not valid;

alter table public.purchases validate constraint purchases_payment_status_check;

create unique index if not exists idx_purchases_provider_payment
  on public.purchases(payment_provider, provider_payment_id)
  where provider_payment_id is not null;

insert into public.app_settings(key, value)
values ('magnuspay', '{"pixEnabled":true,"pixFee":0}'::jsonb)
on conflict (key) do nothing;

insert into public.app_settings(key, value)
values (
  'site_branding',
  jsonb_build_object(
    'siteName','ZXMAX',
    'logoUrl','',
    'faviconUrl','',
    'heroTitle','Compre e venda produtos digitais com segurança',
    'heroSubtitle','Marketplace para produtos, serviços e itens digitais.',
    'supportUrl','https://discord.gg/zxmax'
  )
)
on conflict (key) do nothing;
