-- 006_enforce_admin_level_auth_context.sql
-- The trigger must not block bootstrap in the Supabase SQL editor: there is no
-- JWT there, so auth.uid() is null and is_super_admin() is always false.

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
