-- 007_guest_groups_inbox.sql
-- Guest groups, broadcasts, per-user inbox; fan-out only via create_broadcast_and_fanout (super-admin).

create table public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.users(id)
);

create table public.user_guest_groups (
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid not null references public.guest_groups(id) on delete cascade,
  primary key (user_id, group_id)
);

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  targets_all_guests boolean not null default false,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.broadcast_target_groups (
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  group_id uuid not null references public.guest_groups(id) on delete cascade,
  primary key (broadcast_id, group_id)
);

create table public.user_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, broadcast_id)
);

create index user_guest_groups_group_id_idx on public.user_guest_groups (group_id);
create index user_inbox_user_id_idx on public.user_inbox (user_id);
create index user_inbox_broadcast_id_idx on public.user_inbox (broadcast_id);

alter table public.guest_groups enable row level security;
alter table public.user_guest_groups enable row level security;
alter table public.broadcasts enable row level security;
alter table public.broadcast_target_groups enable row level security;
alter table public.user_inbox enable row level security;

-- guest_groups: staff see all; guests see groups they belong to; writes super-admin only
create policy "guest_groups_select_visible"
  on public.guest_groups for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.user_guest_groups ugg
      where ugg.group_id = guest_groups.id and ugg.user_id = auth.uid()
    )
  );

create policy "guest_groups_insert_super"
  on public.guest_groups for insert
  to authenticated
  with check (public.is_super_admin());

create policy "guest_groups_update_super"
  on public.guest_groups for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "guest_groups_delete_super"
  on public.guest_groups for delete
  to authenticated
  using (public.is_super_admin());

-- user_guest_groups: own row + staff read all; writes super-admin only
create policy "user_guest_groups_select_self_or_staff"
  on public.user_guest_groups for select
  to authenticated
  using (public.is_admin() or user_id = auth.uid());

create policy "user_guest_groups_insert_super"
  on public.user_guest_groups for insert
  to authenticated
  with check (public.is_super_admin());

create policy "user_guest_groups_update_super"
  on public.user_guest_groups for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy "user_guest_groups_delete_super"
  on public.user_guest_groups for delete
  to authenticated
  using (public.is_super_admin());

-- broadcasts: recipients (inbox row) or super-admin; no direct client writes
create policy "broadcasts_select_recipient_or_super"
  on public.broadcasts for select
  to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_inbox ui
      where ui.broadcast_id = broadcasts.id and ui.user_id = auth.uid()
    )
  );

create policy "broadcast_target_groups_select_visible"
  on public.broadcast_target_groups for select
  to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.user_inbox ui
      where ui.broadcast_id = broadcast_target_groups.broadcast_id
        and ui.user_id = auth.uid()
    )
  );

create policy "user_inbox_select_own"
  on public.user_inbox for select
  to authenticated
  using (user_id = auth.uid());

create policy "user_inbox_update_own"
  on public.user_inbox for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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

  insert into public.broadcasts (title, body, targets_all_guests, created_by)
  values (p_title, p_body, p_targets_all_guests, v_uid)
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

grant execute on function public.create_broadcast_and_fanout(text, text, boolean, uuid[]) to authenticated;
