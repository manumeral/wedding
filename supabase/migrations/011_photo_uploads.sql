-- Group-scoped gallery index: Drive file ids + uploader + group_ids for RLS.
create table public.photo_uploads (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  uploaded_by uuid not null references public.users(id) on delete cascade,
  group_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now())
);

create index photo_uploads_drive_file_id_idx on public.photo_uploads (drive_file_id);
create index photo_uploads_uploaded_by_idx on public.photo_uploads (uploaded_by);

alter table public.photo_uploads enable row level security;

-- Guests: rows where their groups overlap, or empty group_ids (visible to all signed-in users).
-- Staff: all rows (for building allow-lists; Drive listing for staff still shows full folder).
create policy "photo_uploads_select"
  on public.photo_uploads for select
  to authenticated
  using (
    public.is_admin()
    or coalesce(array_length(group_ids, 1), 0) = 0
    or exists (
      select 1 from public.user_guest_groups ugg
      where ugg.user_id = auth.uid()
        and ugg.group_id = any (group_ids)
    )
  );

create policy "photo_uploads_insert_own"
  on public.photo_uploads for insert
  to authenticated
  with check (uploaded_by = auth.uid());

create policy "photo_uploads_delete_admin"
  on public.photo_uploads for delete
  to authenticated
  using (public.is_admin());
