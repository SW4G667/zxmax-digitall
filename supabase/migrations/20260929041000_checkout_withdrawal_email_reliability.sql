create table if not exists public.email_outbox (
  id bigserial primary key,
  event_key text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
create index if not exists email_outbox_pending_idx on public.email_outbox(status, created_at);

create or replace function public.notify_withdrawal_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    perform public.push_notification(new.user_id,'wallet','Saque solicitado',
      'Seu saque de R$ '||replace(to_char(new.amount,'FM999999990D00'),'.',',')||' foi enviado para análise.',
      '/sacar','orders','withdrawal:'||new.id||':pending',jsonb_build_object('withdrawalId',new.id,'amount',new.amount));
  elsif old.status is distinct from new.status and new.status='approved' then
    perform public.push_notification(new.user_id,'wallet','Saque aprovado',
      'Seu saque foi processado. Valor líquido: R$ '||replace(to_char(new.net_amount,'FM999999990D00'),'.',',')||'.',
      '/sacar','orders','withdrawal:'||new.id||':approved',jsonb_build_object('withdrawalId',new.id,'amount',new.amount,'netAmount',new.net_amount));
  elsif old.status is distinct from new.status and new.status='rejected' then
    perform public.push_notification(new.user_id,'wallet','Saque recusado',
      coalesce(nullif(new.rejection_reason,''),'Seu saque foi recusado. Confira os detalhes e tente novamente.'),
      '/sacar','orders','withdrawal:'||new.id||':rejected',jsonb_build_object('withdrawalId',new.id,'amount',new.amount));
  end if;
  return new;
end $$;

drop trigger if exists notify_withdrawal_change_trg on public.withdrawals;
create trigger notify_withdrawal_change_trg
after insert or update of status on public.withdrawals
for each row execute function public.notify_withdrawal_change();
