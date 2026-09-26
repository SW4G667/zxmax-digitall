drop policy if exists "Public profiles expose only safe fields" on public.profiles_public;

create index if not exists product_questions_author_id_idx
  on public.product_questions(author_id);

create index if not exists user_capabilities_granted_by_idx
  on public.user_capabilities(granted_by);
