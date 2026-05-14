---
layout: default
title: User guide
permalink: /user-guide/
---

For **installing** the app (Supabase, Vercel, Google), open the **[Setup guide](setup/)**. This page is for **running the wedding** and **editing data** day to day.

## 1. What guests see

1. **Login** — They enter their email; Supabase sends a **magic link** or code (no password).  
2. **Home** — Welcome, room (if assigned), **itinerary** from the database, “our story,” shortcuts.  
3. **Requests** — Cabs, pickups, water, etc. (some types may be gated until admins turn them on).  
4. **Photos** — Shared album backed by **Google Drive** (uploads need the gallery configured).  
5. **Inbox / notifications** — Optional web push for staff/guest alerts when enabled.

## 2. What you never paste in chat or email

- Anything from `.env` / `.env.local` (especially **`SUPABASE_SERVICE_ROLE_KEY`**, Google **client secret**, VAPID private key).  
- Refresh tokens or raw JSON from `app_config`.

If something breaks, rotate the credential at the provider; see **[SECURITY.md](https://github.com/manumeral/wedding/blob/main/SECURITY.md)** in the repo.

## 3. Supabase in one minute

Your **Supabase project** holds Postgres + Auth. In the Supabase **dashboard**:

- **Table Editor** — spreadsheet-style editing of rows.  
- **SQL Editor** — run one-off `SELECT` / `UPDATE` / `INSERT` as the database owner (no logged-in guest JWT).

Use **SQL Editor** for **promoting admins** (below); use either Table Editor or SQL for **events**.

## 4. Editing itinerary events

**Table:** `public.events`

| Column | Meaning |
| ------ | ------- |
| `name` | Label on cards (e.g. “Haldi”, “Reception”) — used for styling/matching. |
| `date` | **Timestamptz** — include timezone, e.g. India `+05:30`. |
| `location` | Address / venue text. |
| `order_index` | Sort order on the site (integer). |
| `live_status_message` | Optional short status line. |

**Easy path:** Table Editor → **events** → edit cells → save.

**SQL example** (adjust UUID / values):

```sql
update public.events
set
  date = timestamptz '2026-04-27 21:00:00+05:30',
  location = 'Venue name, City'
where id = 'YOUR-EVENT-UUID';
```

See also **`supabase/seed.sql`** in the repo for insert patterns.

## 5. Staff and admins (`public.users`)

Column **`admin_level`**: `none` (guest) | `admin` | `super_admin`.

**First super-admin (bootstrap)**  
1. Sign in once on the live site so a row exists in `public.users` for your email.  
2. In Supabase **SQL Editor** run (replace email):

```sql
update public.users
set admin_level = 'super_admin'
where email = 'organizer@example.com';
```

Dashboard SQL runs **without** an app user session, so this bypasses the in-app rule that only super-admins may change roles — same idea as the comment in migration `005_admin_levels.sql`.

**Promote another helper:** same pattern with `'admin'` or `'super_admin'`.

**Later changes in the app** may be restricted to super-admins; for bulk fixes, SQL Editor + the correct `email` is fine.

## 6. Optional app toggles (`app_config`)

Some features (e.g. **cab / pickup request beta**) use keys in **`app_config`**. Values are usually written by the **app** with the **service role** — do not paste secrets there manually. Use the **admin** UI when available.

## 7. When to open the Setup guide

- First deploy, new Supabase or Vercel project, custom domain, **Google Drive** not connecting, env var changes.

## 8. Screenshots

Optional images live under **`assets/`** on this docs site (see `assets/README.md`).
