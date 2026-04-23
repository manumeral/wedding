-- Backfill public.users when auth exists but the signup trigger missed (race / legacy).
create or replace function public.ensure_auth_user_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.users (id, email, full_name, admin_level)
  select
    au.id,
    au.email,
    nullif(trim(coalesce(au.raw_user_meta_data->>'full_name', '')), ''),
    'none'
  from auth.users au
  where au.id = auth.uid()
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.ensure_auth_user_profile() to authenticated;
