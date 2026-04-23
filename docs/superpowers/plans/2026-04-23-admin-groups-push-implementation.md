# Admin levels, groups, inbox, photos, phone, cab beta, Web Push — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the six phases in `docs/superpowers/specs/2026-04-23-admin-groups-push-design.md` in order: admin hierarchy → guest groups + inbox (+ push hook in Phase 6) → photo isolation by group → optional phone auth → cab beta + audit → Web Push for live tracker + broadcasts.

**Architecture:** Supabase Postgres + RLS with `SECURITY DEFINER` helpers and triggers where column-level rules matter; Next.js server actions for all privileged writes; Web Push via `web-push` + service worker + `push_subscriptions` table; inbox fan-out via definer function or service-role batch insert.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase Auth/Postgres, `@supabase/ssr`, optional `web-push`, Google Drive (existing).

**Testing:** No automated test suite. Each task ends with `npx tsc --noEmit`; phase boundaries also run `npx next build`. Manual QA steps are listed per phase.

---

## File map (high level)

| Area | Create / modify |
|------|-----------------|
| Admin levels | `supabase/migrations/005_*.sql`, `supabase/schema.sql`, `lib/auth/roles.ts` (new), `app/actions/admin.ts`, `app/actions/super-admin.ts` (new), all `profile?.is_admin` call sites, `components/admin/UserRow.tsx`, `app/admin/**/page.tsx`, `app/auth/google/callback/route.ts`, `app/actions/drive.ts`, `app/actions/requests.ts` |
| Groups + inbox | `006_*.sql`, `app/actions/groups.ts`, `app/actions/broadcasts.ts`, `app/inbox/page.tsx`, nav badge component |
| Photos | `007_*.sql`, `app/api/photos/init/route.ts`, `app/actions/photos.ts`, gallery components |
| Phone | `app/login/*`, `lib/rate-limit` kinds, Supabase dashboard |
| Cab | `008_*.sql`, `app/actions/requests.ts`, request form UI, admin toggle |
| Web Push | `009_*.sql`, `public/sw.js` or `public/service-worker.js`, `app/api/push/subscribe/route.ts`, `lib/web-push.ts`, client registration component, hooks in `updateEventLiveStatus` + broadcast send |

---

## Phase 1 — Admin levels

### Task 1: Migration `005_admin_levels.sql` + trigger

**Files:**

- Create: `supabase/migrations/005_admin_levels.sql`
- Modify: `supabase/schema.sql` (replace `is_admin` column and functions to match)

- [ ] **Step 1: Add migration file** with:

```sql
-- 005_admin_levels.sql
-- Replace boolean is_admin with admin_level; enforce role changes super-admin-only.

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

-- After deploy: run ONCE in SQL editor to bootstrap at least one super-admin, then uncomment drop:
-- update public.users set admin_level = 'super_admin' where email = 'you@example.com';

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
  for each row execute function public.enforce_admin_level_change();
```

- [ ] **Step 2: Apply migration** in Supabase SQL Editor (paste file), then run bootstrap `update` for your organizer email to `super_admin`.

**Deploy note:** Dropping `is_admin` breaks the running app until Tasks 3–4 ship. Prefer **one release** that includes migration + app changes, or split into `005a` (add `admin_level`, backfill, keep `is_admin`) and `005b` (drop `is_admin`) after production code is deployed.

- [ ] **Step 3: Mirror changes in `supabase/schema.sql`** — replace the `users` table definition’s `is_admin` line with `admin_level text not null default 'none' check (...)`; append trigger + `is_super_admin` + updated `is_admin` function + `enforce_admin_level_change` to match migration.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_admin_levels.sql supabase/schema.sql
git commit -m "feat(db): admin_level + is_super_admin + role-change trigger"
```

**Postgres trigger syntax:** If `execute function` errors on your Supabase Postgres version, use `execute procedure public.enforce_admin_level_change();` instead.

---

### Task 2: Shared TS helpers for roles

**Files:**

- Create: `lib/auth/roles.ts`

- [ ] **Step 1: Create helpers**

```typescript
import { createClient } from '@/lib/supabase/server'

export type AdminLevel = 'none' | 'admin' | 'super_admin'

export async function getMyAdminLevel(): Promise<AdminLevel | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('admin_level')
    .eq('id', user.id)
    .single()
  return (data?.admin_level as AdminLevel) ?? 'none'
}

export async function assertStaff() {
  const level = await getMyAdminLevel()
  if (level !== 'admin' && level !== 'super_admin') {
    throw new Error('Unauthorized')
  }
  return level
}

export async function assertSuperAdmin() {
  const level = await getMyAdminLevel()
  if (level !== 'super_admin') throw new Error('Unauthorized')
}
```

- [ ] **Step 2:** `npx tsc --noEmit` — expect errors until Task 3 updates `users` selects (OK to proceed in same session).

- [ ] **Step 3: Commit**

```bash
git add lib/auth/roles.ts
git commit -m "feat: server helpers for admin_level"
```

---

### Task 3: Refactor `app/actions/admin.ts` and add `app/actions/super-admin.ts`

**Files:**

- Modify: `app/actions/admin.ts`
- Create: `app/actions/super-admin.ts`

- [ ] **Step 1: In `admin.ts`**, replace `assertAdmin` body to use `admin_level in ('admin','super_admin')`:

```typescript
async function assertAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('admin_level')
    .eq('id', user.id)
    .single()

  if (profile?.admin_level !== 'admin' && profile?.admin_level !== 'super_admin') {
    throw new Error('Unauthorized')
  }
  return { supabase, user }
}
```

- [ ] **Step 2:** Change `getAllUsers` select to `admin_level` instead of `is_admin`.

- [ ] **Step 3: Remove `toggleUserAdmin`** from `admin.ts` (moved to super-admin).

- [ ] **Step 4: Create `super-admin.ts`**

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { assertSuperAdmin } from '@/lib/auth/roles'
import type { AdminLevel } from '@/lib/auth/roles'

export async function setUserAdminLevel(userId: string, level: AdminLevel) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  await assertSuperAdmin()

  if (level === 'none' && user.id === userId) {
    throw new Error('You cannot remove your own access')
  }

  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('admin_level', 'super_admin')

  if (level !== 'super_admin' && user.id === userId) {
    const { data: me } = await supabase.from('users').select('admin_level').eq('id', userId).single()
    if (me?.admin_level === 'super_admin' && (count ?? 0) <= 1) {
      throw new Error('Cannot demote the last super-admin')
    }
  }

  const { error } = await supabase.from('users').update({ admin_level: level }).eq('id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
  revalidatePath('/admin/team')
  return { success: true }
}
```

- [ ] **Step 5:** `npx tsc --noEmit` — fix any remaining references to `is_admin` in this repo (grep).

- [ ] **Step 6: Commit**

```bash
git add app/actions/admin.ts app/actions/super-admin.ts
git commit -m "feat: super-admin-only setUserAdminLevel; admin uses admin_level"
```

---

### Task 4: Replace all UI and route checks (`is_admin` → `admin_level`)

**Files:** (grep-driven) e.g. `app/page.tsx`, `app/profile/page.tsx`, `app/guests/page.tsx`, `app/requests/page.tsx`, `app/photos/page.tsx`, `app/admin/**/*.tsx`, `components/admin/UserRow.tsx`, `app/actions/drive.ts`, `app/actions/requests.ts`, `app/auth/google/callback/route.ts`

- [ ] **Step 1:** Grep `is_admin` and replace:
  - **Navbar / redirect “is staff”:** `profile.admin_level === 'admin' || profile.admin_level === 'super_admin'`
  - **Super-admin-only pages:** `profile.admin_level !== 'super_admin'` → redirect

- [ ] **Step 2:** Update `UserRow.tsx` to show role badge and wire `setUserAdminLevel` only when current user is super-admin (fetch level via prop or small server wrapper).

- [ ] **Step 3:** Add `app/admin/team/page.tsx` — list users with `admin_level`, dropdown or buttons for super-admin only (uses `setUserAdminLevel`).

- [ ] **Step 4:** Add **Team** tab in `components/AdminTabs.tsx` linking `/admin/team`.

- [ ] **Step 5:** `npx tsc --noEmit` && `npx next build`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: UI and guards for admin_level + admin team page"
```

---

## Phase 2 — Guest groups + inbox (Web Push wired in Task 20)

### Task 5: Migration `006_guest_groups_inbox.sql`

**Files:**

- Create: `supabase/migrations/006_guest_groups_inbox.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create tables + RLS** (sketch — expand in migration file):

```sql
create table public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.users(id)
);

create table public.user_guest_groups (
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid not null references public.guest_groups(id) on delete cascade,
  primary key (user_id, group_id)
);

create table public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  targets_all_guests boolean not null default false,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.broadcast_target_groups (
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  group_id uuid not null references public.guest_groups(id) on delete cascade,
  primary key (broadcast_id, group_id)
);

create table public.user_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, broadcast_id)
);

alter table public.guest_groups enable row level security;
alter table public.user_guest_groups enable row level security;
alter table public.broadcasts enable row level security;
alter table public.broadcast_target_groups enable row level security;
alter table public.user_inbox enable row level security;
```

- [ ] **Step 2: Policies** — super-admin full CRUD on `guest_groups` / `user_guest_groups`; authenticated read groups they belong to; `user_inbox` select/update own rows; `broadcasts` select for recipients only (via join) or super-admin all; inserts for broadcasts/inbox only via `SECURITY DEFINER` function `public.create_broadcast_and_fanout(title, body, targets_all_guests, group_ids uuid[])`.

- [ ] **Step 3:** Implement `create_broadcast_and_fanout` in SQL: compute recipient ids; insert `broadcasts`; insert `broadcast_target_groups`; insert `user_inbox` rows; returns `broadcast_id`.

- [ ] **Step 4:** Apply in Supabase; sync `schema.sql`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/006_guest_groups_inbox.sql supabase/schema.sql
git commit -m "feat(db): guest groups, broadcasts, inbox + fanout function"
```

---

### Task 6: Server actions — groups + broadcast

**Files:**

- Create: `app/actions/groups.ts`
- Create: `app/actions/broadcasts.ts`

- [ ] **Step 1:** `groups.ts` — `listGroups`, `createGroup`, `deleteGroup`, `setUserGroups(userId, groupIds[])` all gated with `assertSuperAdmin()`.

- [ ] **Step 2:** `broadcasts.ts` — `sendBroadcast({ title, body, targetsAllGuests, groupIds })` calls RPC `create_broadcast_and_fanout` via `supabase.rpc(...)` (use service role client in `lib/supabase/admin.ts` if RPC is not granted to authenticated — prefer granting `execute` to `authenticated` only for super-admin by checking inside function: `if not is_super_admin() then raise`).

- [ ] **Step 3:** `listMyInbox`, `markInboxRead(id)` using normal `createClient()`.

- [ ] **Step 4:** `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add app/actions/groups.ts app/actions/broadcasts.ts
git commit -m "feat: super-admin group + broadcast + guest inbox actions"
```

---

### Task 7: Admin UI — groups, assignments, broadcast composer

**Files:**

- Create/modify under `app/admin/users/`, `app/admin/groups/page.tsx`, `app/admin/broadcast/page.tsx` (exact split your choice)
- Modify: `components/AdminTabs.tsx`

- [ ] **Step 1:** Super-admin-only group CRUD UI.

- [ ] **Step 2:** On `/admin/users`, multi-select groups per user (super-admin only).

- [ ] **Step 3:** Broadcast composer: title, body, multi-select groups, checkbox “all guests”, submit → `sendBroadcast`.

- [ ] **Step 4:** Manual test: two users in different groups; send to one group; only that user gets inbox row.

- [ ] **Step 5: Commit**

```bash
git add app/admin components/AdminTabs.tsx
git commit -m "feat: admin UI for groups, assignments, broadcasts"
```

---

### Task 8: Guest inbox page + nav

**Files:**

- Create: `app/inbox/page.tsx`
- Modify: `components/Navbar.tsx`

- [ ] **Step 1:** Inbox lists `user_inbox` joined with `broadcasts`, unread count for badge.

- [ ] **Step 2:** Mark read on open.

- [ ] **Step 3:** `npx next build`

- [ ] **Step 4: Commit**

```bash
git add app/inbox components/Navbar.tsx
git commit -m "feat: guest inbox + unread badge"
```

---

## Phase 3 — Photo grouping

### Task 9: Migration `007_photo_uploads.sql` + API/gallery

**Files:**

- Create: `supabase/migrations/007_photo_uploads.sql`
- Modify: `app/api/photos/init/route.ts`, `app/actions/photos.ts`, gallery component(s)

- [ ] **Step 1:** Table `photo_uploads (id, drive_file_id unique, uploaded_by, group_ids uuid[], created_at)` + RLS: user sees row if `group_ids &&` their groups OR `is_admin()`.

- [ ] **Step 2:** In **`/api/photos/init`**: resolve uploader’s `group_ids` from `user_guest_groups`; pass into Drive `appProperties` (e.g. `groupIds` comma-separated) as today. In **`/api/photos/register`**: after `makeFilePublic`, **insert `photo_uploads`** (`drive_file_id`, `uploaded_by`, `group_ids`) so the row is only written once the file exists.

- [ ] **Step 3:** Gallery: server loads allowed `drive_file_id` from `photo_uploads` intersect Drive list.

- [ ] **Step 4:** Manual test: two users, disjoint groups, confirm isolation.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/007_photo_uploads.sql app/api/photos/init/route.ts app/actions/photos.ts
git commit -m "feat: photo_uploads RLS + group-scoped gallery"
```

---

## Phase 4 — Optional phone onboarding

### Task 10: Phone OTP (minimal)

**Files:**

- Modify: `app/login/page.tsx`, `app/login/actions.ts`, `lib/rate-limit.ts` (new kinds)

- [ ] **Step 1:** Enable Phone provider in Supabase; document env.

- [ ] **Step 2:** Add optional “Use phone instead” flow: `signInWithOtp({ phone })` + verify — mirror existing email verify route pattern for phone token type.

- [ ] **Step 3:** Rate-limit `phone_otp` per number and per IP.

- [ ] **Step 4:** `npx tsc --noEmit` && manual SMS test.

- [ ] **Step 5: Commit**

```bash
git add app/login lib/rate-limit.ts
git commit -m "feat: optional phone OTP login + rate limits"
```

---

## Phase 5 — Cab beta + audit

### Task 11: Migration `008_cab_audit.sql` + UI

**Files:**

- Create: `supabase/migrations/008_cab_audit.sql`
- Modify: `app/actions/requests.ts`, request form, `app/admin/**` toggle

- [ ] **Step 1:** `app_config` key `cab_requests_beta_enabled`; super-admin-only setter.

- [ ] **Step 2:** Extend `requests` with `pickup_at`, `pickup_location`, `dropoff_at`, `dropoff_location` (nullable).

- [ ] **Step 3:** `request_audit_log` table + trigger or server action logging on update.

- [ ] **Step 4:** Guest UI: show cab fields when beta on + type cab.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/008_cab_audit.sql app/
git commit -m "feat: cab beta flag, structured fields, audit log"
```

---

## Phase 6 — Web Push (live tracker + broadcasts)

### Task 12: Dependencies + env

- [ ] **Step 1:** `npm install web-push` && add to `next.config.mjs` `serverExternalPackages` if needed (same pattern as `googleapis`).

- [ ] **Step 2:** Generate VAPID keys: `npx web-push generate-vapid-keys`; add `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` to `.env.example` and Vercel.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json next.config.mjs .env.example
git commit -m "chore: add web-push + VAPID env docs"
```

---

### Task 13: Migration `009_push_subscriptions.sql`

- [ ] **Step 1:** Table `push_subscriptions` + RLS (user manages own rows); optional `users.notifications_enabled`.

- [ ] **Step 2:** Sync `schema.sql`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_push_subscriptions.sql supabase/schema.sql
git commit -m "feat(db): push_subscriptions"
```

---

### Task 14: `lib/web-push.ts` + subscribe API

**Files:**

- Create: `lib/web-push.ts`
- Create: `app/api/push/subscribe/route.ts` (POST body: subscription JSON)

- [ ] **Step 1:** Configure `web-push` with VAPID; export `sendPushToUser(userId, payload)` and `sendPushToUsers(userIds, payload)`.

- [ ] **Step 2:** Subscribe route: auth required; upsert by `endpoint`.

- [ ] **Step 3:** `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add lib/web-push.ts app/api/push/subscribe/route.ts
git commit -m "feat: Web Push subscribe + send helper"
```

---

### Task 15: Service worker + client opt-in

**Files:**

- Create: `public/sw.js` (or `public/service-worker.js`)
- Create: `components/PushNotificationsPrompt.tsx` (or embed in layout)

- [ ] **Step 1:** Register SW in `app/layout.tsx` (client component wrapper); `PushManager.subscribe` with `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; POST to `/api/push/subscribe`.

- [ ] **Step 2:** Manual test: Chrome permission + subscription row in DB.

- [ ] **Step 3: Commit**

```bash
git add public/sw.js app/layout.tsx components/PushNotificationsPrompt.tsx
git commit -m "feat: service worker + push opt-in UI"
```

---

### Task 16: Hook live tracker + broadcast to push

**Files:**

- Modify: `app/actions/admin.ts` (`updateEventLiveStatus`)
- Modify: `app/actions/broadcasts.ts` (after fanout)

- [ ] **Step 1:** After successful `updateEventLiveStatus`, load all `push_subscriptions` (or filter by `notifications_enabled`); debounce 45s per `eventId` in memory or `app_config` last-push timestamp; `sendPushToUsers` with title = event name, body = message.

- [ ] **Step 2:** After `create_broadcast_and_fanout`, call `sendPushToUsers(recipientIds, { title, body, url: '/inbox' })`.

- [ ] **Step 3:** Manual test: broadcast + live update both show OS notification in Chrome.

- [ ] **Step 4: Commit**

```bash
git add app/actions/admin.ts app/actions/broadcasts.ts lib/web-push.ts
git commit -m "feat: Web Push for live tracker + broadcasts"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task(s) |
|------------------|---------|
| Super-admin / admin / guest | 1–4 |
| Super-admin only assigns groups | 5–7 + RLS + only `assertSuperAdmin` in `groups.ts` |
| Inbox by group targeting | 5–8 |
| Browser push for inbox + live tracker | 12–16 |
| Photos isolated by group | 9 |
| Phone optional | 10 |
| Cab beta + audit | 11 |

**Placeholder scan:** No TBD/TODO in executable steps; SQL policy details in Task 5 Step 2 must be fully written when implementing (expand sketch in migration file).

**Execution handoff:** Implement Task 1 → 16 in order unless a task is blocked on Supabase dashboard work.

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-23-admin-groups-push-implementation.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, spec + quality review between tasks.  
2. **Inline execution** — run tasks in this chat in order with checkpoints.

**Which approach do you want?**
