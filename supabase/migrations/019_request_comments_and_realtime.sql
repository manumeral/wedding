-- Threaded comments on guest requests (guest <-> organizers).
create table public.request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  check (char_length(body) between 1 and 4000)
);

create index request_comments_request_id_idx on public.request_comments (request_id);
create index request_comments_request_created_idx on public.request_comments (request_id, created_at);

alter table public.request_comments enable row level security;

create policy "request_comments_select_parties"
  on public.request_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.requests r
      where r.id = request_comments.request_id
        and (r.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "request_comments_insert_parties"
  on public.request_comments for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.requests r
      where r.id = request_id
        and (r.user_id = auth.uid() or public.is_admin())
    )
  );

-- Realtime: subscribe from the browser; RLS still applies to delivered rows.
do $pub$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'request_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.request_comments';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests'
  ) then
    execute 'alter publication supabase_realtime add table public.requests';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_inbox'
  ) then
    execute 'alter publication supabase_realtime add table public.user_inbox';
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    execute 'alter publication supabase_realtime add table public.events';
  end if;
end
$pub$;
