-- Fixes: "infinite recursion detected in policy for relation users"
--
-- Root cause:
--   The original admin policies use a subquery on `users` to check `is_admin`.
--   That subquery is itself governed by `users`' RLS policies, which evaluate
--   the same admin subquery again -> infinite recursion. Every read on
--   `users` fails, including each user's own profile lookup.
--
-- Fix:
--   Introduce a SECURITY DEFINER helper `public.is_admin()` that reads the
--   flag without triggering RLS, then rewrite every admin policy to use it.
--
-- Run this in Supabase Studio -> SQL Editor, then reload the app.

-- 1. Helper function bypasses RLS via SECURITY DEFINER
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

-- Let authenticated callers execute it (anon excluded on purpose)
grant execute on function public.is_admin() to authenticated;

-- 2. Replace recursive policies on public.users
drop policy if exists "Admins can view all profiles." on public.users;
drop policy if exists "Admins can update users." on public.users;

create policy "Admins can view all profiles."
  on public.users for select
  using (public.is_admin());

create policy "Admins can update users."
  on public.users for update
  using (public.is_admin());

-- 3. Replace recursive policies on public.requests
drop policy if exists "Admins can view all requests." on public.requests;
drop policy if exists "Admins can update requests." on public.requests;

create policy "Admins can view all requests."
  on public.requests for select
  using (public.is_admin());

create policy "Admins can update requests."
  on public.requests for update
  using (public.is_admin());

-- 4. Replace recursive policy on public.events
drop policy if exists "Admins can update events." on public.events;

create policy "Admins can update events."
  on public.events for update
  using (public.is_admin());
