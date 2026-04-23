-- 004_auth_rate_limits.sql
-- Count-and-insert rate-limit buckets for auth flows. Writes happen via
-- the service-role client (server-only). No RLS policies on purpose -
-- guest-facing clients have zero access.

create table if not exists public.auth_rate_limits (
  id bigserial primary key,
  kind text not null,
  identifier text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists auth_rate_limits_lookup
  on public.auth_rate_limits (kind, identifier, created_at desc);

alter table public.auth_rate_limits enable row level security;
