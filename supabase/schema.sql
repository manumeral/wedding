-- Create users profile table (extends auth.users)
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  full_name text,
  bio text,
  avatar_url text,
  admin_level text not null default 'none' check (admin_level in ('none', 'admin', 'super_admin')),
  room_number text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create requests table
create table public.requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade not null,
  type text not null check (type in ('cab', 'water', 'pickup', 'other')),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'resolved')),
  assigned_admin_id uuid references public.users on delete set null,
  details text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create events table
create table public.events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  live_status_message text,
  date timestamp with time zone not null,
  location text not null,
  order_index integer not null
);

-- Server-side key/value store (read/write via service_role key only).
create table public.app_config (
  key text primary key,
  value text,
  updated_at timestamptz default timezone('utc', now()) not null
);

-- Setup RLS
alter table public.users enable row level security;
alter table public.requests enable row level security;
alter table public.events enable row level security;
alter table public.app_config enable row level security;
-- app_config has no policies; only service_role (server) can access it.

-- Count-and-insert buckets for auth rate limiting (service-role only).
create table public.auth_rate_limits (
  id bigserial primary key,
  kind text not null,
  identifier text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index auth_rate_limits_lookup
  on public.auth_rate_limits (kind, identifier, created_at desc);

alter table public.auth_rate_limits enable row level security;

-- Helper that bypasses RLS to check admin status (avoids recursion when
-- admin policies reference the users table).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select admin_level in ('admin', 'super_admin') from public.users where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select admin_level = 'super_admin' from public.users where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_super_admin() to authenticated;

-- Users policies
create policy "Users can view own profile." on users for select using (auth.uid() = id);
create policy "Admins can view all profiles." on users for select using (public.is_admin());
create policy "Admins can update users." on users for update using (public.is_admin());

create or replace function public.enforce_admin_level_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.admin_level is distinct from old.admin_level then
    if auth.uid() is not null and not public.is_super_admin() then
      raise exception 'Only super-admins can change admin_level';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_users_admin_level
  before update on public.users
  for each row execute procedure public.enforce_admin_level_change();

-- Requests policies
create policy "Users can view own requests." on requests for select using (auth.uid() = user_id);
create policy "Users can insert own requests." on requests for insert with check (auth.uid() = user_id);
create policy "Admins can view all requests." on requests for select using (public.is_admin());
create policy "Admins can update requests." on requests for update using (public.is_admin());

-- Events policies
create policy "Anyone can view events." on events for select using (true);
create policy "Admins can update events." on events for update using (public.is_admin());

-- Self-service profile update (so guests can edit name/bio/avatar but not
-- admin_level / room_number, which would be unsafe to expose via UPDATE policy).
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

-- Sanitized guest directory: every authenticated user can see name/avatar/bio
-- for everyone else, but not email / room / admin_level.
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

-- Guest groups, broadcasts, inbox (fan-out via create_broadcast_and_fanout only).
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

-- Storage bucket for avatars.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar public read"
  on storage.objects for select to public
  using (bucket_id = 'avatars');
create policy "Avatar upload own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Avatar update own folder"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Avatar delete own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Function to handle new user signup
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();