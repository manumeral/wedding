# Design: Admin hierarchy, guest groups, photo isolation, phone auth, cab beta, live push

**Status:** Draft for implementation planning  
**Stack:** Next.js 14 App Router, Supabase Auth + Postgres + RLS, Google Drive (photos), existing `events.live_status_message` live tracker.

**Delivery order (locked):**

1. Admin levels + super-admin management of admins  
2. Guest group labels + broadcast to selective groups  
3. Photo grouping (aligned with guest groups; super-admin defines groups)  
4. Optional phone-number onboarding  
5. Cab pickup/drop beta (super-admin feature flag; structured fields + audit)  
6. Live tracker updates → device notifications (Web Push)

---

## Cross-cutting principles

- **RLS first:** Every new table gets policies; privileged operations use `SECURITY DEFINER` helpers only where necessary (same pattern as `public.is_admin()`).
- **No client trust:** Promotion/demotion, group assignment for others, feature flags, and audit-sensitive writes go through **server actions** or **route handlers** with explicit checks.
- **Migrate in order:** Each phase ships with SQL migrations + `schema.sql` updates + verification steps before the next phase.

---

## Phase 1 — Admin levels

### Goal

- **Super-admin:** Can add/remove **admins** and **super-admins** (with safeguards below).
- **Admin:** Same capabilities as today for guest/requests/events/Drive ops, **cannot** change admin roles.
- **Guest:** Unchanged.

### Data model

Replace boolean `is_admin` with a single column (recommended):

```text
admin_level text not null default 'none'
  check (admin_level in ('none', 'admin', 'super_admin'))
```

Migration: map `is_admin = true` → `admin_level = 'admin'` (or `super_admin` for a bootstrap list — see bootstrap).

Update `public.is_admin()` to return true when `admin_level in ('admin', 'super_admin')`.

Add `public.is_super_admin()` → `admin_level = 'super_admin'`.

### Bootstrap

- One-time: set known organizer user(s) to `super_admin` via SQL migration or documented manual SQL after deploy.
- **Invariant:** At least one `super_admin` must exist; optional DB trigger or app check prevents removing the last super-admin (app-level check in server action is enough for v1).

### Server actions (sketch)

- `promoteUser(userId, level)` — `super_admin` only; cannot demote self if last super-admin.
- `demoteUser(userId)` — `super_admin` only.
- `listAdmins()` — `super_admin` only for management UI; existing admins may keep seeing guest lists without role edit UI.

### UI

- New **Admin → Team** (or under existing admin tabs): list users with roles; promote/demote for super-admins only.
- Hide role controls entirely for non–super-admins.

---

## Phase 2 — Guest group labels + broadcast

### Goal

- Super-admins (and optionally admins — **default: super-admin only** for group CRUD) define **named groups** (e.g. `Bride family`, `Groom friends`, `Outstation`).
- Each guest belongs to **one or more** groups (many-to-many).
- **Broadcast:** send a message to **all members of selected groups** (and/or “all guests”).

### Data model

- `guest_groups`: `id`, `slug`, `name`, `created_at`, `created_by`
- `user_guest_groups`: `user_id`, `group_id`, primary key `(user_id, group_id)`

RLS:

- All authenticated users can read **names** of groups they belong to (or read all group names if we want directory clarity — **recommend:** guests see only their groups; admins see all).
- **Insert/update/delete** on `guest_groups` and membership rows for *other* users: **super_admin** only (or admin if you relax later).
- Users might update **their own** membership only if you want self-service — **default: no**; organizers assign groups.

### Broadcast

**v1 (recommended):** In-app only:

- `broadcasts` table: `id`, `title`, `body`, `created_by`, `created_at`
- `broadcast_recipients` or link to group list: store `broadcast_id` + `group_id` (multi-row) or JSON array of group ids (normalized is better).
- `broadcast_reads` optional (future).

**Email broadcast (optional v2):** Batch via Supabase Edge Function + Resend/SES or reuse SMTP; rate limits and unsubscribe — out of scope for v1 unless you explicitly want it in the same phase.

### UI

- Super-admin: manage groups, assign guests to groups (on `/admin/users` or dedicated screen).
- Guest: “Announcements” or home feed card listing broadcasts targeted at their groups.

---

## Phase 3 — Photo grouping (Drive alignment)

### Goal

- Photos uploaded by guests in group A are **not visible** in the gallery to guests in group B.
- **Super-admins** define groups (already from Phase 2); photo visibility follows **uploader’s group membership** or **explicit photo label** — pick one rule to avoid ambiguity.

### Recommended rule

- On `/api/photos/init`, server resolves the uploader’s **primary group** or **all group ids** and passes them into Drive `appProperties` e.g. `groupIds: "uuid1,uuid2"` (comma-separated, capped length) **and** stores a row in `photo_uploads` (see below) for authoritative filtering.

### Data model

- `photo_uploads`: `id`, `drive_file_id`, `uploaded_by`, `created_at`, `group_ids uuid[]` (or join table). RLS: guest can `select` rows where `group_ids` overlaps their `user_guest_groups`.

Gallery:

- Today: list from Drive. **Change:** either (a) list from `photo_uploads` + Drive thumbnails filtered by file ids, or (b) list Drive but filter client-side using `appProperties` — **prefer (a)** for security (server only returns allowed file ids).

Super-admin sees all photos (bypass RLS or `is_admin()` policy).

### Implementation notes

- `getAlbumState` / gallery server action: intersect Drive listing with allowed `drive_file_id` set from `photo_uploads` for current user.
- Migration: backfill optional — old uploads without `group_ids` → treat as “all groups” or “legacy visible to admins only” (document choice).

---

## Phase 4 — Optional phone-number onboarding

### Goal

- Guest may sign in with **phone OTP** in addition to email, or bind phone after email login — **product choice**.

### Recommended v1 flow

- **Email remains primary** for invites; optional “Add phone” in profile uses Supabase `updateUser` / `signInWithOtp` phone with verified SMS.
- **Alternate:** Phone-only login for specific regions — requires **Supabase Phone provider**, SMS costs, stricter rate limits (`auth_rate_limits` extended with `kind = 'phone_otp'`).

### Data model

- No duplicate of phone in `public.users` required if stored on `auth.users`; optional `phone_e164 text` on `users` for directory display with RLS restricted.

### Compliance

- Privacy note on profile; rate limit aggressively; consider **only super-admin can see guest phones** in admin UI.

---

## Phase 5 — Cab beta + structured pickup/drop + audit

### Goal

- **Super-admin** toggles **Cab requests beta** (global flag in `app_config`, e.g. `cab_requests_beta_enabled`).
- When off: hide cab request path or show “coming soon.”
- When on: guest can file cab request with **pickup** and **drop** each having **time** + **location** (free text or structured place name).

### Data model

**Option A — extend `requests`:**

- Add nullable columns: `pickup_at timestamptz`, `pickup_location text`, `dropoff_at timestamptz`, `dropoff_location text` (only meaningful when `type = 'cab'`).

**Option B — child table `cab_request_details`:** `request_id` PK/FK, same fields — cleaner if many cab-only fields.

**Audit:**

- `request_audit_log`: `id`, `request_id`, `actor_id`, `action text`, `old_values jsonb`, `new_values jsonb`, `created_at`.
- On admin/guest edit of cab fields, append row (server action only).

### UI

- Guest request form: conditional section when type cab and flag on.
- Admin: view timeline of changes.

---

## Phase 6 — Live tracker → device notifications (Web Push)

### Goal

When an organizer updates `events.live_status_message` (existing `updateEventLiveStatus`), **subscribed guests** receive a **push notification** on supported devices/browsers.

### Technology

- **Web Push** (VAPID). Library: `web-push` on server; `service worker` + `PushManager` in browser.
- **Not** native FCM app unless you later wrap in Capacitor/React Native — out of scope.

### Data model

- `push_subscriptions`: `id`, `user_id`, `endpoint text unique`, `p256dh text`, `auth text`, `user_agent text`, `created_at`, `last_seen_at`
- Optional: `notifications_enabled boolean` on `users` default true.

### Flow

1. Client: user opts in (“Notify me of live updates”) → permission → register SW → subscribe → POST subscription to `/api/push/subscribe` (authenticated).
2. Server: store subscription; dedupe by `endpoint`.
3. On `updateEventLiveStatus`: after DB update, call `sendLiveTrackerPush({ eventName, message, eventId })` which:
   - Loads all subscriptions (or only users in certain groups — **post Phase 2**, optionally restrict to guests who opted in and match broadcast rules).
   - Sends Web Push payload (title: event name, body: message, data: deep link to `/#itinerary` or `/`).

### Product rules (v1)

- **Audience:** all opted-in authenticated users who have a subscription, **or** filter by groups in a later iteration of this phase (hook: “same as broadcast” groups).
- **Rate limit:** coalesce rapid edits (debounce 30–60s) or max N notifications per event per hour to avoid spam — configurable constant.

### Platform limits (document for organizers)

- **Android Chrome:** generally works on HTTPS origin.
- **iOS Safari:** Web Push for web improved in recent versions; **recommend** testing on target devices; PWA “Add to Home Screen” may be required for best results.
- **Fallback:** in-app banner / email digest remains available (Phase 2 broadcast).

### Env

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:…)

---

## Dependency graph

```text
Phase 1 (admin levels)
    ↓
Phase 2 (groups + broadcast) — uses super-admin for group CRUD
    ↓
Phase 3 (photos by group) — depends on Phase 2 groups
    ↓
Phase 4 (phone) — largely independent; can parallelize after Phase 1 if desired
    ↓
Phase 5 (cab beta) — uses Phase 1 super-admin flag in app_config pattern
    ↓
Phase 6 (push) — best after Phase 2 for audience filtering; can ship MVP “all subscribers” after Phase 1 only
```

**Note:** You asked to process **strictly in order**; Phase 4 is the only one that could be parallelized after Phase 1 without blocking others — the doc keeps linear order unless you later reprioritize.

---

## Security checklist (all phases)

- Last super-admin protection.
- Rate limits extended for phone and push registration endpoints.
- Push: reject subscriptions for anonymous users; validate JSON body sizes.
- Drive `photo_uploads` RLS tested with two test users in disjoint groups.

---

## Out of scope (unless added later)

- Native iOS/Android apps.
- Email broadcast blast (Phase 2 v1 is in-app only).
- End-to-end encryption of broadcast content.

---

## Self-review

- [x] Phases match user-requested order; live push added as Phase 6.
- [x] Photo visibility tied to Phase 2 groups with a single clear rule (uploader groups + `photo_uploads`).
- [x] Cab beta gated by super-admin + audit trail specified.
- [x] Web Push limitations called out for iOS/Safari.
- [ ] **Open:** Exact broadcast UI surface (dedicated page vs home card) — decide during implementation plan.
- [ ] **Open:** Whether **admins** (non-super) may assign guests to groups — currently **super-admin only**; say if you want admins to assign read-only.
