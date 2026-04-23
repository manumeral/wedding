-- Audit trail for request status changes (written via service role from server actions).
create table public.request_audit_log (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  old_status text,
  new_status text,
  details jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index request_audit_log_request_id_idx on public.request_audit_log (request_id);
create index request_audit_log_created_at_idx on public.request_audit_log (created_at desc);

alter table public.request_audit_log enable row level security;

create policy "request_audit_log_select_staff"
  on public.request_audit_log for select
  to authenticated
  using (public.is_admin());
