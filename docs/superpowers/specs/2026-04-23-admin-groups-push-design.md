# Design: Admin hierarchy, guest groups, photo isolation, phone auth, cab beta, live push

**Status:** Draft for implementation planning  
**Stack:** Next.js 14 App Router, Supabase Auth + Postgres + RLS, Google Drive (photos), existing `events.live_status_message` live tracker.

### User-visible notification requirement (browser / OS)

Organizer-facing messages must reach guests on their **devices via the browser’s push channel**, not only inside the web app:

- **Broadcasts (Phase 2 inbox):** When a super-admin sends a broadcast to selected guest groups, each recipient gets (1) a **durable inbox row** in the app and (2) a **Web Push notification** shown by the **browser/OS** (e.g. Chrome, Safari, Edge, Firefox) wherever **Web Push + notification permission** are supported — the same mechanism as the live tracker.
- **Live tracker (Phase 6):** When an organizer updates an event’s live status, subscribed guests receive the same kind of **browser/OS Web Push** (plus existing on-page UI).

Implementation uses the **Web Push API** (VAPID keys, service worker, `PushManager`). This is **not** a separate native app; it is the standard way sites deliver “Chrome/Safari notifications.” **iOS Safari** has stricter rules (often requires HTTPS, user gesture for permission, and sometimes home-screen PWA); limitations stay documented for organizers.

**Super-admins only** may create/edit guest groups and **assign guests to groups**; regular admins cannot.

**Delivery order (locked):**

1. Admin levels + super-admin management of admins  
2. Guest group labels + broadcast to selective groups  
3. Photo grouping (aligned with guest groups; super-admin defines groups)  
4. Optional phone-number onboarding  
5. Cab pickup/drop beta (super-admin feature flag; structured fields + audit)  
6. Web Push infrastructure + live tracker **and** broadcast inbox triggers (browser notifications)

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

## Phase 2 — Guest group labels + broadcast (inbox)

### Goal

- **Super-admins only** create and manage **named groups** (e.g. `Bride family`, `Groom friends`, `Outstation`) and **assign guests to groups** (many-to-many). Regular **admins** do **not** assign groups or edit group definitions.
- Each guest belongs to **zero or more** groups (many-to-many).
- **Broadcast v1:** When a super-admin sends a broadcast, **each targeted guest gets an inbox notification** — one row per user, scoped by **that user’s group membership**. Only users who belong to **at least one** of the selected target groups receive an item (union of members across selected groups). Optional “all guests” target = all non-admin users with `admin_level = 'none'`.

### Data model

- `guest_groups`: `id`, `slug`, `name`, `created_at`, `created_by` (super-admin only for writes)
- `user_guest_groups`: `user_id`, `group_id`, primary key `(user_id, group_id)` — **only super-admins** may insert/update/delete rows (including assigning other users to groups)

RLS:

- Guests: read **only the groups they belong to** (for labels in UI). Admins (`is_admin()`): read all groups for operational visibility.
- **All writes** to `guest_groups` and `user_guest_groups`: **`is_super_admin()` only.**

### Broadcast + inbox (v1)

**Authoring (normalized):**

- `broadcasts`: `id`, `title`, `body`, `created_by`, `created_at`
- `broadcast_target_groups`: `broadcast_id`, `group_id` (multi-row) — empty set with a dedicated “all guests” flag is **not** needed if we use a nullable sentinel or a separate boolean on `broadcasts` (`targets_all_guests boolean default false`). If `targets_all_guests`, ignore group rows and fan out to every guest.

**Delivery (per-user inbox):**

- `user_inbox` (or `broadcast_inbox`): `id`, `user_id`, `broadcast_id`, `read_at timestamptz null`, `created_at`
- On **send** (server action, super-admin only): compute recipient `user_id` set = union of all users in selected groups (or all guests if `targets_all_guests`), **dedupe**, insert one `user_inbox` row per recipient pointing at `broadcasts.id`.
- RLS: `select/update` own rows only (`user_id = auth.uid()`); **insert** only via service role or `SECURITY DEFINER` function called from server action (recommended: server uses service role or a definer function `create_broadcast_and_fanout(...)` to avoid huge RLS on insert).

**Reads:** Guest marks read (`read_at = now()`), optional “mark all read.”

**Browser notification (Web Push) — wired in Phase 6, audience matches inbox:**

- The **same recipient set** as the inbox fan-out (union of users in selected groups, or all guests when `targets_all_guests`) should receive a **Web Push** payload: title = broadcast title, body = short preview or full body (length-capped), `data` URL = deep link to `/inbox` (or the specific message).
- Guests only receive the push if they have **granted notification permission** and registered a **push subscription** (Phase 6). No push is sent to users without a subscription; the **inbox row remains the source of truth** they can always open in-app.

**Email (optional v2):** out of scope for v1.

### UI

- **Super-admin:** manage groups, assign guests to groups (`/admin/users` or dedicated), **compose broadcast** (title, body, multi-select groups and/or “all guests”), send → fan-out creates inbox rows.
- **Guest:** dedicated **Inbox** page listing notifications (newest first), unread badge in nav; opening an item shows title/body and sets read.

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

## Phase 6 — Web Push (Chrome / Safari / Edge / Firefox) for live tracker **and** broadcasts

### Goal

1. **Live tracker:** When an organizer updates `events.live_status_message` (`updateEventLiveStatus`), **subscribed guests** get a **browser/OS notification** (Web Push) with event name + status text, deep-linking to the itinerary/home.
2. **Broadcasts:** The super-admin **send broadcast** action (Phase 2) is extended to call the **same push helper** after inbox fan-out, so recipients with subscriptions get a **browser/OS notification** matching their new inbox item.

### Technology

- **Web Push** (VAPID). Server: `web-push` (or equivalent); client: **service worker** + `PushManager.subscribe()`.
- These are the notifications users associate with **Chrome, Safari, Edge, Firefox** — delivered through the browser’s integration with the OS notification center where supported.
- **Not** a separate native FCM **mobile app** unless you later wrap the site — out of scope.

### Data model

- `push_subscriptions`: `id`, `user_id`, `endpoint text unique`, `p256dh text`, `auth text`, `user_agent text`, `created_at`, `last_seen_at`
- Optional: `notifications_enabled boolean` on `users` default true.

### Flow

1. Client: user opts in (“Notify me of live updates”) → permission → register SW → subscribe → POST subscription to `/api/push/subscribe` (authenticated).
2. Server: store subscription; dedupe by `endpoint`.
3. On `updateEventLiveStatus`: after DB update, call `sendLiveTrackerPush({ eventName, message, eventId })` which loads subscriptions for the chosen audience and sends Web Push (title: event name, body: message, data: deep link to itinerary anchor).
4. On **broadcast send** (server action from Phase 2): after inserting `user_inbox` rows, call `sendBroadcastPush({ broadcastId, title, body, recipientUserIds })` (or equivalent) so each recipient with a stored subscription gets one browser notification.

### Product rules (v1)

- **Live tracker audience:** default **all guests** with `notifications_enabled` + active `push_subscription`, or the same **group-scoped** rule as broadcasts if you add organizer-only “notify only these groups” later — document the chosen default in the implementation plan.
- **Broadcast audience:** **exactly** the inbox fan-out set (union of selected groups or all guests); push must not go to users who did not get an inbox row.
- **Rate limit:** coalesce rapid live-status edits (debounce 30–60s) or cap notifications per event per hour; broadcasts are typically low volume.

### Platform limits (document for organizers)

- **Desktop:** Chrome, Edge, Firefox — Web Push broadly supported on HTTPS.
- **Android:** Chrome — generally reliable.
- **iOS Safari:** Web Push support is **conditional** (version, user gesture, sometimes **Add to Home Screen**); test on real devices. Guests who cannot receive Web Push still have **in-app inbox** and the on-site live tracker UI.

### Env

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:…)

---

## Dependency graph

```text
Phase 1 (admin levels)
    ↓
Phase 2 (groups + inbox broadcast) — super-admin only for groups, assignment, and sends
    ↓
Phase 3 (photos by group) — depends on Phase 2 groups
    ↓
Phase 4 (phone) — largely independent; can parallelize after Phase 1 if desired
    ↓
Phase 5 (cab beta) — uses Phase 1 super-admin flag in app_config pattern
    ↓
Phase 6 (Web Push) — implements subscription UI + sender; hooks **live tracker** and **broadcast send** (inbox) for browser/OS notifications
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
- Email as a channel for Phase 2 broadcasts (v1 is **in-app inbox** only).
- End-to-end encryption of broadcast content.

---

## Self-review

- [x] Phases match user-requested order; live push added as Phase 6.
- [x] Photo visibility tied to Phase 2 groups with a single clear rule (uploader groups + `photo_uploads`).
- [x] Cab beta gated by super-admin + audit trail specified.
- [x] Web Push limitations called out for iOS/Safari.
- [x] **Broadcast v1:** per-user **inbox** rows targeted by guest group; **browser Web Push** to the same recipients once Phase 6 ships; **super-admins only** create broadcasts and assign groups.
- [x] **Group assignment:** **super-admins only** (admins cannot assign groups or edit `guest_groups`).
- [x] **Browser notifications:** Spec explicitly ties **inbox broadcasts** and **live tracker** to Chrome/Safari/Edge/Firefox Web Push (OS notification tray where supported).
