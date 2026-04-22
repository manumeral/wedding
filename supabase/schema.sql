-- Create users profile table (extends auth.users)
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  full_name text,
  bio text,
  avatar_url text,
  is_admin boolean default false not null,
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
    (select is_admin from public.users where id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_admin() to authenticated;

-- Users policies
create policy "Users can view own profile." on users for select using (auth.uid() = id);
create policy "Admins can view all profiles." on users for select using (public.is_admin());
create policy "Admins can update users." on users for update using (public.is_admin());

-- Requests policies
create policy "Users can view own requests." on requests for select using (auth.uid() = user_id);
create policy "Users can insert own requests." on requests for insert with check (auth.uid() = user_id);
create policy "Admins can view all requests." on requests for select using (public.is_admin());
create policy "Admins can update requests." on requests for update using (public.is_admin());

-- Events policies
create policy "Anyone can view events." on events for select using (true);
create policy "Admins can update events." on events for update using (public.is_admin());

-- Self-service profile update (so guests can edit name/bio/avatar but not
-- is_admin / room_number, which would be unsafe to expose via UPDATE policy).
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
-- for everyone else, but not email / room / admin flag.
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