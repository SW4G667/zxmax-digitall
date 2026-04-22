-- Criar buckets se nao existirem
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('chat-attachments', 'chat-attachments', true)
on conflict (id) do nothing;

-- RLS para bucket 'documentos' (Privado: apenas o dono e admins podem ver)
create policy "Dono pode ver seus documentos"
on storage.objects for select
using ( bucket_id = 'documentos' and auth.uid() = owner );

create policy "Admins podem ver todos os documentos"
on storage.objects for select
using ( bucket_id = 'documentos' and (select role from public.users where id = auth.uid()) = 'admin' );

create policy "Dono pode subir seus documentos"
on storage.objects for insert
with check ( bucket_id = 'documentos' and auth.uid() = owner );

-- RLS para bucket 'chat-attachments' (Publico para leitura, privado para escrita)
create policy "Qualquer um pode ver anexos de chat"
on storage.objects for select
using ( bucket_id = 'chat-attachments' );

create policy "Usuarios autenticados podem subir anexos"
on storage.objects for insert
with check ( bucket_id = 'chat-attachments' and auth.role() = 'authenticated' );
