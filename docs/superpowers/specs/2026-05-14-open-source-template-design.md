# Open Source Wedding Portal: Template, Docs & Hygiene

**Date:** 2026-05-14  
**Status:** Approved for implementation planning  
**Owner:** Mayank  

## 1. Goal

Publish this repository as an **open-source template** so other couples can fork it, configure branding and credentials, deploy to **Vercel + Supabase**, and run a wedding portal similar to the reference site **https://prachiwedsmayank.in** (which remains live as the sample).

Non-goals for this effort: rewriting core architecture, replacing Supabase, or hosting the full dynamic app on GitHub Pages.

## 2. Principles (agreed with product owner)

| Topic | Decision |
| ----- | -------- |
| Personal names / wedding copy in repo | **Keep** Prachi & Mayank as the **default reference implementation** in code and docs. No requirement to anonymize. |
| Live sample | Public site stays up; docs may link to it. |
| Git history | **Option A:** retain normal history on `main`; fix **current tree** + add **scanning guardrails**. **Rewrite history only if** a real credential leak is found in past commits—then rotate keys and use `git filter-repo` / BFG before/after as appropriate. |
| GitHub Pages | Host **documentation** (user guide, setup guide, contributing) plus **static screenshots** (and optionally short recordings); not the full Next.js app. |

## 3. Templating model (for fork authors)

**Recommended approach:** central **`site` module** (e.g. `lib/site.ts` or `config/site.ts`) exporting typed constants: couple names, wedding date display strings, taglines, important URLs, and **paths** to assets under `public/images/`. The reference values remain the project’s current branding so the repo runs unchanged for maintainers.

**Secondary:** add `public/images/README.md` listing expected image files (hero, story, itinerary card art where applicable) and rough aspect ratio / size hints so swaps are mechanical.

**Credentials:** remain **only** in environment variables; `.env.example` stays the single source of truth for variable names and comments (Supabase, Google OAuth/Drive, optional VAPID).

**Database content:** itinerary rows, guest groups, and admin-toggled flags stay **data plane**—fork authors apply migrations and use admin UI, **Supabase Table Editor**, or **SQL Editor** as documented; no requirement to JSON-ify the whole itinerary in v1.

## 4. Documentation (GitHub Pages)

**Source layout:** Markdown under repository **`docs/`** (or GitHub Pages–compatible subtree), deployed from **`main`** via **“Deploy from branch” → `/docs`** (or equivalent Settings).

Writing style for all guides: **short paragraphs, numbered steps where it helps**, one idea per bullet, cross-links instead of duplication. Prefer **“do X, then Y”** over prose.

**Pages:**

| Document | Audience | Role |
| -------- | -------- | ---- |
| `index.md` | Everyone | Landing: what the project is, feature list, link to live sample, links to all guides. |
| `user-guide.md` | Couples / organizers (incl. “spreadsheet-comfortable” readers) | **Day-to-day operations**: portal features for guests + how to change **events**, **staff roles**, and toggles **using Supabase** (Table Editor + copy-paste SQL). Links to **setup** for first-time Vercel/Supabase/connect. |
| `setup.md` | Whoever deploys (often a technical friend) | **First-time host**: Supabase project, schema + seed, env vars, Vercel deploy & domain, Google Drive OAuth wiring, optional web push. Granular substeps below. |
| `contributing.md` | Contributors | Branch/PR expectations, `npx tsc --noEmit`, note that `npm run lint` may prompt first-time ESLint setup in Next.js; issue conventions. |

### 4.1 `user-guide.md` — required sections (succinct but granular)

1. **What guests see** — One screen each: login (magic link), home / itinerary, requests, photos gallery, inbox / notifications (high level only).  
2. **What you never put in chat or email** — Service role key, `.env` contents, Google client secret; point to **SECURITY.md**.  
3. **Supabase in one minute** — Project = database + auth; you **log into the Supabase dashboard** for your project; two tools used here: **Table Editor** (spreadsheet-like) and **SQL Editor** (run one-off commands).  
4. **Editing itinerary events**  
   - **Table:** `public.events`. Columns that matter: `name`, `date` (**timestamptz** — use your timezone, e.g. `+05:30` for India), `location`, `order_index` (sort order on the site), `live_status_message` (optional short line for “live” UI).  
   - **Easy path:** Table Editor → `events` → edit rows inline.  
   - **SQL path (examples in the doc):** `UPDATE` a single event’s time/name/location; remind that `id` is UUID if targeting one row; link to `supabase/seed.sql` as a pattern for `timestamptz '... +05:30'`.  
5. **Staff and admins (`public.users`)**  
   - **Roles:** `admin_level` is one of `none` | `admin` | `super_admin`.  
   - **Bootstrap first super-admin:** After the user has **signed in once** (so a `public.users` row exists), run in **SQL Editor**: `update public.users set admin_level = 'super_admin' where email = 'organizer@example.com';` — note that dashboard SQL runs **without** a user JWT, so this bypasses the in-app “only super_admin may edit roles” rule (see migration comment in repo).  
   - **Promote another organizer:** same pattern with `'admin'` or `'super_admin'`.  
   - **Caveat:** In-app role changes afterward follow RLS/trigger rules; doc should say “for bulk fixes, SQL Editor + correct email.”  
6. **Optional app toggles (`app_config`)** — Mention that keys like **cab request beta** may exist; **reads** can be shown in Table Editor if RLS allows (or “ask your dev” — `app_config` is service-role-only for writes from the app). Keep **one line**: don’t manually paste secrets into `app_config`; use the admin UI where provided.  
7. **When to open `setup.md`** — New project, broken deploy, new domain, first-time Google Drive.  
8. **Screenshots** — Link to `docs/assets/` examples from the live sample where useful.

### 4.2 `setup.md` — required sections (Supabase + Vercel + Drive)

**A. Supabase (host the database & auth)**  
1. Create a project (region choice, DB password safe storage).  
2. **Auth:** note magic-link / email provider is used; URL configuration: **Site URL** and **Redirect URLs** must include production and localhost (exact paths as in Supabase auth docs + app `/auth/*` routes — implementation plan will lift from existing deployment doc).  
3. **Schema:** apply migrations in order from `supabase/migrations/` **or** link Supabase CLI `db push`; confirm `schema.sql` is not the only source if migrations diverge (doc: **migrations win**).  
4. **Seed:** run `supabase/seed.sql` once in SQL Editor (idempotent) for sample `events`.  
5. **Keys:** where to copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (service role **server-only**).  

**B. Vercel (publish the Next.js app)**  
1. Import Git repo (fork); framework Next.js.  
2. **Environment variables:** mirror **every** row from `.env.example` the deployment needs (group “build” vs “runtime” if any differ).  
3. First deploy; fix build logs if env missing.  
4. **Domain:** add custom domain in Vercel; DNS records (A/ALIAS/CNAME) as Vercel shows; then update Supabase Auth redirect URLs to the **final** HTTPS origin.  
5. **Smoke test:** magic link from production URL, one admin login, open itinerary.  

**C. Google Drive & photos (granular)**  
1. **Google Cloud:** create project; enable **Google Drive API**; OAuth consent screen (External or Internal as applicable); add scope for Drive (path used by app — implementation references `lib/google-drive.ts` / `/admin/drive-auth`).  
2. **OAuth client (Web):** Client ID + Client Secret; **Authorized redirect URIs** — `https://<prod>/auth/google/callback` and `http://localhost:3000/auth/google/callback`.  
3. **Env:** `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` (per environment), `GOOGLE_DRIVE_FOLDER_ID` (folder **owned by** the Google account that will authorize).  
4. **One-time organizer flow:** deploy app with env set → sign in as organizer → open **`/admin/drive-auth`**, complete Google sign-in; confirm refresh token lands in `app_config` (server-side; **do not** paste token in docs).  
5. **Guest uploads / gallery:** short note: uploads go to that folder; gallery reads use stored token; if auth fails, re-run drive-auth flow.  

**D. Optional web push** — Pointer to `.env.example` VAPID vars and profile toggle; one paragraph.  

### 4.3 `contributing.md` & `index.md`

Unchanged intent; `index.md` should tease the three pillars: **User guide** (operate data + guest experience), **Setup** (Supabase + Vercel + Drive), **Contributing**.

**Visual assets:** `docs/assets/` (or similar) for **screenshots** captured from **prachiwedsmayank.in**; **crop or use guest-safe views** so guest PII (names, emails, rooms, threads) does not appear in pixels. Short screen recordings optional.

**Root README:** short elevator pitch + badges optional + **prominent link** to the GitHub Pages site for full guides.

## 5. Repository hygiene & security

- **LICENSE:** add (MIT unless owner chooses otherwise).  
- **SECURITY.md:** how to report vulnerabilities; remind not to file secrets in public issues.  
- **`.gitignore`:** confirm `.env.local` and any Supabase local secret paths (e.g. `supabase/.env.local` if used) are ignored; document in setup.  
- **Pre-public audit:** run **gitleaks** and/or **trufflehog** (including **git history**). Supplement with targeted manual searches if needed.  
- **If leaks found:** rotate **all** affected credentials first; then history rewrite + force-push per policy; announce impact on forks.  
- **CI (post–open source):** optional **secret scan on PR** (e.g. gitleaks-action) to prevent regressions.

Tracked files today should remain limited to **`.env.example`** / **`.env.local.example`** (placeholders only)—verify before first public push.

## 6. Out of scope (this design)

- Replacing Next.js or moving the dynamic app to GitHub Pages.  
- Full i18n or multi-tenant SaaS.  
- Migrating all prose to CMS; optional later enhancement only.  
- Mandatory anonymization of the reference wedding.

## 7. Implementation outline (for planning phase)

1. Add LICENSE, SECURITY.md, expand root README with Pages links.  
2. Introduce `site` module; thread key strings/paths from Hero, `layout` metadata, and other obvious single-source branding touchpoints without changing visible behavior for the reference deploy.  
3. Add `public/images/README.md`.  
4. Author `docs/` Markdown following **§4.1–4.3** (user guide incl. Supabase Table/SQL for events & admins; setup with Supabase + Vercel + Drive substeps) + embed screenshot assets; enable GitHub Pages.  
5. Run secret audit; add CI scan if desired.  
6. Tag a **v1 template** release when stable.

## 8. Spec self-review

**2026-05-14 (initial):** Git history policy (A); Pages = docs only; scope = template + guides.  
**2026-05-14 (amendment):** User guide explicitly includes **Supabase-operational** content (events + `users.admin_level` SQL); setup guide split into **granular Supabase, Vercel, Google Drive** substeps; writing style = succinct + stepwise.  
- **Placeholders:** Auth redirect URL literals to be copied from existing deployment spec during implementation—not duplicated here.  
- **Consistency:** `app_config` described as server-managed for secrets; aligns with schema.  
- **Ambiguity:** “Migrations win” over raw `schema.sql` if drift—call out in setup doc body when writing.
