-- Enforce the listing identity gate on the database side.
-- A new listing is only accepted shortly after the Discord membership endpoint
-- has revalidated the user against the currently configured guild.
create or replace function public.enforce_fresh_listing_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  admin_actor boolean := false;
  profile_row record;
  branding jsonb := '{}'::jsonb;
  configured_guild text := '';
  email_ok boolean := false;
begin
  if uid is null then
    return new;
  end if;

  admin_actor := public.has_role(uid, 'admin'::public.app_role);
  if admin_actor then
    return new;
  end if;

  if new.seller_id is distinct from uid then
    raise exception 'Vendedor inválido para este anúncio.' using errcode='42501';
  end if;

  select (email_confirmed_at is not null)
    into email_ok
  from auth.users
  where id = uid;

  if coalesce(email_ok, false) is false then
    raise exception 'Confirme seu e-mail antes de anunciar.' using errcode='42501';
  end if;

  select discord_user_id, discord_guild_id, discord_member_verified_at
    into profile_row
  from public.profiles
  where user_id = uid
  limit 1;

  select value into branding
  from public.app_settings
  where key = 'site_branding'
  limit 1;

  configured_guild := btrim(coalesce(branding->>'discordGuildId', ''));
  if configured_guild = '' then
    raise exception 'O servidor oficial do Discord ainda não está configurado.' using errcode='42501';
  end if;

  if profile_row.discord_user_id is null
     or btrim(coalesce(profile_row.discord_guild_id, '')) <> configured_guild
     or profile_row.discord_member_verified_at is null
     or profile_row.discord_member_verified_at < now() - interval '2 minutes' then
    raise exception 'Autorize o Discord novamente para confirmar que você ainda está no servidor oficial.' using errcode='42501';
  end if;

  return new;
end;
$$;

drop trigger if exists products_require_fresh_listing_membership on public.products;
create trigger products_require_fresh_listing_membership
before insert on public.products
for each row
execute function public.enforce_fresh_listing_membership();
