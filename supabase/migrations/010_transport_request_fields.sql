-- Structured pickup / cab fields (optional; used when type is cab or pickup).
alter table public.requests
  add column if not exists pickup_at timestamptz,
  add column if not exists pickup_location text,
  add column if not exists dropoff_at timestamptz,
  add column if not exists dropoff_location text,
  add column if not exists hub_kind text;

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public' and t.relname = 'requests' and c.conname = 'requests_hub_kind_check'
  ) then
    alter table public.requests
      add constraint requests_hub_kind_check
      check (hub_kind is null or hub_kind in ('airport', 'railway'));
  end if;
end $$;
