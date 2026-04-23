-- One-time guest profile completion + lock. Staff exempt.
alter table public.users
  add column if not exists profile_completed_at timestamptz;

-- Guests who already have name, bio, and photo are treated as completed.
update public.users
set profile_completed_at = timezone('utc', now())
where admin_level = 'none'
  and profile_completed_at is null
  and full_name is not null and trim(full_name) <> ''
  and bio is not null and trim(bio) <> ''
  and avatar_url is not null and trim(avatar_url) <> '';

-- Staff may edit their own profile anytime; guests use complete_guest_profile once, then locked.
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

  if not public.is_admin() then
    raise exception 'Guest profiles are saved once via profile completion. Ask an organizer if you need changes.';
  end if;

  update public.users
  set
    full_name  = coalesce(nullif(trim(p_full_name), ''), full_name),
    avatar_url = p_avatar_url,
    bio        = p_bio
  where id = auth.uid();
end;
$$;

-- Guests call this once with all required fields; sets profile_completed_at.
create or replace function public.complete_guest_profile(
  p_full_name text,
  p_avatar_url text,
  p_bio text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_level text;
  v_done timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select admin_level, profile_completed_at into v_level, v_done
  from public.users
  where id = auth.uid();

  if v_level is null then
    raise exception 'Profile not found';
  end if;

  if v_level in ('admin', 'super_admin') then
    raise exception 'Staff should use the regular profile editor';
  end if;

  if v_done is not null then
    raise exception 'Profile already completed';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Name is required';
  end if;

  if nullif(trim(p_bio), '') is null then
    raise exception 'A short description is required';
  end if;

  if nullif(trim(p_avatar_url), '') is null then
    raise exception 'A profile photo is required';
  end if;

  update public.users
  set
    full_name = trim(p_full_name),
    bio = trim(p_bio),
    avatar_url = trim(p_avatar_url),
    profile_completed_at = timezone('utc', now())
  where id = auth.uid();
end;
$$;

grant execute on function public.complete_guest_profile(text, text, text) to authenticated;
