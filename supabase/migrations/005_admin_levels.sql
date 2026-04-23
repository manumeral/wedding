-- 005_admin_levels.sql
-- Replace boolean is_admin with admin_level; enforce role changes (super-admin only in-app).
-- Safe to re-run: skips constraint/trigger steps if already applied.
--
-- After apply, bootstrap in SQL editor (no JWT — trigger allows this):
--   update public.users set admin_level = 'super_admin' where email = 'you@example.com';

alter table public.users
  add column if not exists admin_level text;

-- Backfill: use legacy is_admin if that column still exists; otherwise default to 'none'.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'users'
      and column_name = 'is_admin'
  ) then
    execute $u$
      update public.users
      set admin_level = case when coalesce(is_admin, false) then 'admin' else 'none' end
      where admin_level is null
    $u$;
  else
    update public.users
    set admin_level = coalesce(admin_level, 'none')
    where admin_level is null;
  end if;
end $$;

alter table public.users
  alter column admin_level set default 'none';

alter table public.users
  alter column admin_level set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'users'
      and c.conname = 'users_admin_level_check'
  ) then
    alter table public.users
      add constraint users_admin_level_check
      check (admin_level in ('none', 'admin', 'super_admin'));
  end if;
end $$;

alter table public.users drop column if exists is_admin;

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

-- In SQL editor / service_role, auth.uid() is null — allow bootstrap updates.
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

drop trigger if exists trg_users_admin_level on public.users;
create trigger trg_users_admin_level
  before update on public.users
  for each row execute procedure public.enforce_admin_level_change();
