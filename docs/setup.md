---
layout: page
title: Setup
permalink: /setup/
---

Clone and install the app locally: **`git clone`** → **`npm install`** → copy **`.env.example`** to **`.env.local`** and fill values. Apply **database migrations** before first run.

**Source of truth for env names:** [`.env.example`](https://github.com/manumeral/wedding/blob/main/.env.example) on GitHub.

---

## A. Supabase (database + auth)

1. **Create a project** in [Supabase](https://supabase.com); save the database password securely.  
2. **Auth URLs** — Under Authentication → URL configuration:  
   - **Site URL:** your production origin (e.g. `https://your-domain.com`), and use `http://localhost:3000` while developing.  
   - **Redirect URLs:** add both production and `http://localhost:3000/**` (and any preview URLs you use). Magic links must not point at the wrong host after you go live.  
3. **Schema** — Apply SQL from **`supabase/migrations/`** in **numeric order** (or use Supabase CLI `db push` / link project). If **`schema.sql`** and migrations ever disagree, **trust migrations** for a fresh project.  
4. **Seed sample events** — In SQL Editor, run **`supabase/seed.sql`** once (idempotent).  
5. **API keys** — Project Settings → API:  
   - `NEXT_PUBLIC_SUPABASE_URL`  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
   - `SUPABASE_SERVICE_ROLE_KEY` — **server only**, never in client bundles.

6. **Ignore local secrets** — `.env.local` and `supabase/.env.local` are gitignored (see repo `.gitignore`).

---

## B. Vercel (host the Next.js app)

1. **Import** your GitHub repo; framework **Next.js**.  
2. **Environment variables** — Add every key your deployment needs from **`.env.example`** (at minimum Supabase three + Google vars if using photos).  
3. **Deploy** — Fix any build errors (missing env).  
4. **Custom domain** — In Vercel → Domains; set DNS (A/CNAME) as Vercel instructs. Then update Supabase **Site URL** and **Redirect URLs** to the **final HTTPS** site.  
5. **Smoke test** — Request a magic link from production; log in; open home and itinerary.

---

## C. Google Drive & photos

The app uses **OAuth** to store a **refresh token** server-side (`app_config`) and read/write a shared **folder**.

1. **Google Cloud** — New project; enable **Google Drive API**; configure **OAuth consent screen**; add OAuth scope equivalent to full Drive access for the folder workflow used by the app (see code: `https://www.googleapis.com/auth/drive` and `userinfo.email`).  
2. **OAuth client (Web)** — Create credentials; **Authorized redirect URIs:**  
   - `http://localhost:3000/auth/google/callback`  
   - `https://<your-production-domain>/auth/google/callback`  
   **Authorized JavaScript origins:** `http://localhost:3000` and your production origin.  
3. **Environment variables** — `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` (must match the callback URL for that environment), `GOOGLE_DRIVE_FOLDER_ID` (folder owned by the Google account that will connect).  
4. **Organizer connect flow** — Deploy with env set → sign in as staff → open **`/admin/drive-auth`** → complete Google consent. Do **not** paste refresh tokens into docs or issues.  
5. **If `redirect_uri_mismatch`** — Align Google Console, **`GOOGLE_OAUTH_REDIRECT_URI`**, and redeploy; then reconnect.  
6. **Gallery / uploads** — Files go to the configured folder; if tokens expire or are revoked, run **drive-auth** again.

---

## D. Optional web push

If you use browser notifications, generate VAPID keys (`npx web-push generate-vapid-keys`), set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` per **`.env.example`**.

---

## Branding

Edit **`lib/site.ts`** and images under **`public/images/`** — see **`public/images/README.md`**.
