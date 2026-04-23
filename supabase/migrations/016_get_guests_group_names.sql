-- Guest directory: include assigned guest-group names per user.
create or replace function public.get_guests()
returns table (id uuid, full_name text, avatar_url text, bio text, group_names text[])
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id,
    u.full_name,
    u.avatar_url,
    u.bio,
    coalesce(
      array_agg(gg.name order by gg.name) filter (where gg.id is not null),
      array[]::text[]
    ) as group_names
  from public.users u
  left join public.user_guest_groups ugg on ugg.user_id = u.id
  left join public.guest_groups gg on gg.id = ugg.group_id
  where u.full_name is not null and trim(u.full_name) <> ''
  group by u.id, u.full_name, u.avatar_url, u.bio
  order by u.full_name;
$$;
