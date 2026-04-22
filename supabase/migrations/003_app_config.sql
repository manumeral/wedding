-- 003_app_config.sql
-- Key/value store for server-side configuration like the Google Drive
-- OAuth refresh token. The refresh token is a secret, so reads/writes
-- happen only through the service_role key on the server; regular
-- authenticated users have no access at all.

create table if not exists public.app_config (
  key text primary key,
  value text,
  updated_at timestamptz default timezone('utc', now()) not null
);

alter table public.app_config enable row level security;

-- No policies for authenticated/anon users. Only the service_role key
-- (used server-side) can read or write this table; all other roles
-- will see zero rows and get RLS errors on insert/update.
