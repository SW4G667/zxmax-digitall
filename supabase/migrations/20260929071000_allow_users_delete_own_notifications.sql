drop policy if exists "Own notifications delete" on public.notifications;
create policy "Own notifications delete" on public.notifications
for delete to authenticated using (user_id = (select auth.uid()));
