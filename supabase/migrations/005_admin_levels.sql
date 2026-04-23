-- 005_admin_levels.sql
-- Replace boolean is_admin with admin_level; enforce role changes super-admin-only.
-- After apply: run once in SQL editor to bootstrap at least one super-admin, e.g.:
--   update public.users set admin_level = 'super_admin' where email = 'organizer@example.com';

alter table public.users
  add column if not exists admin_level text;

update public.users
set admin_level = case when coalesce(is_admin, false) then 'admin' else 'none' end
where admin_level is null;

alter table public.users
  alter column admin_level set default 'none',
  alter column admin_level set not null;

alter table public.users
  add constraint users_admin_level_check
  check (admin_level in ('none', 'admin', 'super_admin'));

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

create or replace function public.enforce_admin_level_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.admin_level is distinct from old.admin_level then
    if not public.is_super_admin() then
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
