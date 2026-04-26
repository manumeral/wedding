-- Distinguish guest-targeted vs staff-only (organizer) inbox rows.
alter table public.broadcasts
  add column if not exists audience text not null default 'guests'
  check (audience in ('guests', 'staff'));

comment on column public.broadcasts.audience is 'guests = host messages to guests; staff = team alerts (e.g. new guest requests)';

-- Guest broadcasts from super-admin must stay audience = guests
create or replace function public.create_broadcast_and_fanout(
  p_title text,
  p_body text,
  p_targets_all_guests boolean,
  p_group_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_broadcast_id uuid;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_super_admin() then
    raise exception 'Only super-admins can create broadcasts';
  end if;

  if not p_targets_all_guests then
    if p_group_ids is null or coalesce(array_length(p_group_ids, 1), 0) = 0 then
      raise exception 'Select at least one group or use targets_all_guests';
    end if;
  end if;

  insert into public.broadcasts (title, body, targets_all_guests, created_by, audience)
  values (p_title, p_body, p_targets_all_guests, v_uid, 'guests')
  returning id into v_broadcast_id;

  if not p_targets_all_guests then
    insert into public.broadcast_target_groups (broadcast_id, group_id)
    select v_broadcast_id, gid
    from unnest(p_group_ids) as t(gid);
  end if;

  if p_targets_all_guests then
    insert into public.user_inbox (user_id, broadcast_id)
    select u.id, v_broadcast_id
    from public.users u
    where u.admin_level = 'none'
    on conflict (user_id, broadcast_id) do nothing;
  else
    insert into public.user_inbox (user_id, broadcast_id)
    select distinct ugg.user_id, v_broadcast_id
    from public.user_guest_groups ugg
    where ugg.group_id = any (p_group_ids)
    on conflict (user_id, broadcast_id) do nothing;
  end if;

  return v_broadcast_id;
end;
$$;
