-- Create users profile table (extends auth.users)
create table public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text not null,
  full_name text,
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

-- Setup RLS
alter table public.users enable row level security;
alter table public.requests enable row level security;
alter table public.events enable row level security;

-- Users policies
create policy "Users can view own profile." on users for select using (auth.uid() = id);
create policy "Admins can view all profiles." on users for select using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);
create policy "Admins can update users." on users for update using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);

-- Requests policies
create policy "Users can view own requests." on requests for select using (auth.uid() = user_id);
create policy "Users can insert own requests." on requests for insert with check (auth.uid() = user_id);
create policy "Admins can view all requests." on requests for select using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);
create policy "Admins can update requests." on requests for update using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);

-- Events policies
create policy "Anyone can view events." on events for select using (true);
create policy "Admins can update events." on events for update using (
  exists (select 1 from users where id = auth.uid() and is_admin = true)
);

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