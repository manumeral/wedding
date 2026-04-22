-- 002_guest_profiles.sql
-- Adds bio + avatar to user profiles, a public storage bucket for avatars,
-- and two SECURITY DEFINER helpers that let guests safely update their own
-- non-privileged fields and browse a sanitized list of all guests.

-- 1. New columns on public.users
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists avatar_url text;

-- 2. Let an authenticated user update their own non-privileged fields.
--    We avoid granting direct UPDATE on the users table so a guest cannot
--    flip their own is_admin / room_number flags.
create or replace function public.update_my_profile(
  p_full_name text,
  p_avatar_url text,
  p_bio text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.users
  set
    full_name  = coalesce(nullif(trim(p_full_name), ''), full_name),
    avatar_url = p_avatar_url,
    bio        = p_bio
  where id = auth.uid();
end;
$$;

grant execute on function public.update_my_profile(text, text, text) to authenticated;

-- 3. A sanitized view of guests for the "Who's coming" page.
--    Excludes email, room_number, is_admin, created_at. Runs as definer so
--    it bypasses the users-table RLS (which only exposes own row).
create or replace function public.get_guests()
returns table (id uuid, full_name text, avatar_url text, bio text)
language sql
stable
security definer
set search_path = public
as $$
  select id, full_name, avatar_url, bio
  from public.users
  where full_name is not null and trim(full_name) <> ''
  order by full_name;
$$;

grant execute on function public.get_guests() to authenticated;

-- 4. Storage bucket for avatars (public read).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 5. Storage RLS: anyone can read, each authenticated user owns the folder
--    named after their user id.

-- Drop previous versions if they exist so this migration is idempotent.
drop policy if exists "Avatar public read"       on storage.objects;
drop policy if exists "Avatar upload own folder" on storage.objects;
drop policy if exists "Avatar update own folder" on storage.objects;
drop policy if exists "Avatar delete own folder" on storage.objects;

create policy "Avatar public read"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "Avatar upload own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Avatar update own folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Avatar delete own folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
