-- ZXMAX: PIX limit + cross-language order chat metadata/cache.
alter table public.profiles add column if not exists locale text;
alter table public.profiles add column if not exists country_code text;

update public.profiles
set country_code = coalesce(country_code, 'BR'),
    locale = coalesce(locale, 'pt-BR')
where country_code is null
  and (cpf is not null or state is not null or city is not null);

create table if not exists public.message_translations (
  id bigserial primary key,
  message_id uuid not null references public.order_messages(id) on delete cascade,
  target_language text not null,
  translated_text text not null,
  detected_language text,
  created_at timestamptz not null default now(),
  unique(message_id, target_language)
);
alter table public.message_translations enable row level security;
revoke all on public.message_translations from anon, authenticated;
create index if not exists message_translations_lookup_idx
  on public.message_translations(message_id, target_language);

insert into public.app_settings(key,value)
values('magnuspay','{"maxPixAmount":5000}'::jsonb)
on conflict(key) do update
set value = coalesce(public.app_settings.value,'{}'::jsonb) || '{"maxPixAmount":5000}'::jsonb,
    updated_at = now();

update public.purchases
set status='cancelled',
    payment_status='failed',
    updated_at=now()
where status='pending'
  and payment_provider='magnuspay_pix'
  and provider_payment_id is null
  and amount > 5000
  and created_at > now()-interval '2 days';
