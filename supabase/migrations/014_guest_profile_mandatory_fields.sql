-- Re-open onboarding for guests missing any mandatory profile field (name, bio, photo).
update public.users
set profile_completed_at = null
where admin_level = 'none'
  and (
    full_name is null or trim(full_name) = ''
    or bio is null or trim(bio) = ''
    or avatar_url is null or trim(avatar_url) = ''
  );

-- Allow complete_guest_profile when the row is incomplete, even if profile_completed_at was set incorrectly.
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
  v_full_name text;
  v_bio text;
  v_avatar text;
  v_satisfied boolean;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select
    u.admin_level,
    u.profile_completed_at,
    u.full_name,
    u.bio,
    u.avatar_url
  into v_level, v_done, v_full_name, v_bio, v_avatar
  from public.users u
  where u.id = auth.uid();

  if v_level is null then
    raise exception 'Profile not found';
  end if;

  if v_level in ('admin', 'super_admin') then
    raise exception 'Staff should use the regular profile editor';
  end if;

  v_satisfied :=
    nullif(trim(v_full_name), '') is not null
    and nullif(trim(v_bio), '') is not null
    and nullif(trim(v_avatar), '') is not null;

  if v_satisfied and v_done is not null then
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
