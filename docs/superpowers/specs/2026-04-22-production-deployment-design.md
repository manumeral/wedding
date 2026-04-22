# Going Public: Production Deployment Design

**Date:** 2026-04-22
**Status:** Approved, ready for implementation planning
**Owner:** Mayank

## Goal

Make the wedding website publicly available at `https://prachiwedsmayank.in`, without compromising Drive photo uploads or flooding the Gmail SMTP rate limit.

## Constraints and decisions

| Area | Decision | Rationale |
|---|---|---|
| Hosting | Vercel Hobby | Already deployed; Next.js 14 first-class support; free |
| Domain | `prachiwedsmayank.in` registered at GoDaddy | Already purchased |
| DNS management | Stay on GoDaddy | Email already configured there; no CDN/DDoS needs for this scale |
| Transactional email | Keep Gmail SMTP | 500/day cap is sufficient; GoDaddy Pro Light would be *worse* (250/day, shared IP reputation) |
| Access control | Login-required only, no invite allowlist | User accepted residual risk of random sign-ups |
| Rate limiting | Layered: 3/email/15min + 30/IP/15min + Supabase backstop | IP-only is unsafe at shared-Wi-Fi venues; email-only lets an attacker loop arbitrary emails |
| Photo upload architecture | Client-direct resumable upload to Google Drive | Vercel's 4.5 MB request-body cap makes the current server-proxied flow unusable |
| Photo storage backend | Keep Google Drive (not Supabase Storage) | Free tier sufficient; family can browse Drive after the event |

## Out of scope

- Moving DNS to Cloudflare
- Switching SMTP to Resend / SES / GoDaddy
- Invite allowlist (can be added later if random sign-ups become a problem)
- Resumable upload with mid-stream resume-from-offset (v2; retry-whole-file is enough for v1)
- Post-event data export / archive automation

## Architecture overview

```
┌──────────────────────────────┐        ┌──────────────────────────┐
│   prachiwedsmayank.in        │        │  Google Drive (shared    │
│   (Vercel Hobby,             │        │  folder owned by the     │
│   Next.js 14 App Router)     │        │  organizer Google acct)  │
│                              │        │                          │
│  ┌────────────────────────┐  │        │  ┌────────────────────┐  │
│  │ /login                 │  │        │  │ Photos + metadata  │  │
│  │ /profile, /guests,     │  │        │  └────────────────────┘  │
│  │ /requests, /photos,    │  │        └──────────▲───────────────┘
│  │ /admin/*               │  │                   │ PUT bytes
│  └────────────────────────┘  │                   │ (browser → Google
│                              │                   │  direct, via
│  ┌────────────────────────┐  │                   │  session URL)
│  │ /api/photos/init       │  │ mint session URL  │
│  │ /api/photos/register   ├──┼───────────────────┘
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │        ┌──────────────────────────┐
│  │ /auth/google/callback  │  │        │  Supabase                │
│  │ /admin/drive-auth      │  │        │                          │
│  └────────────────────────┘  │        │  • auth (magic link)     │
│                              │◀──────▶│  • users, events, etc.   │
│  Middleware: session cookie  │        │  • app_config (refresh   │
│                              │        │    token, service-role   │
└──────────────────────────────┘        │    only)                 │
                                        │  • auth_rate_limits (new)│
                                        └──────────────────────────┘
```

New data flow for photo upload:

```
Browser                   /api/photos/init           Google Drive
  │                              │                         │
  │  POST {filename, mime, size} │                         │
  ├─────────────────────────────▶│                         │
  │                              │  Mint access token from │
  │                              │  stored refresh token   │
  │                              │                         │
  │                              │  POST upload session    │
  │                              ├────────────────────────▶│
  │                              │                         │
  │                              │◀──── sessionUrl ────────┤
  │  {sessionUrl, correlationId} │                         │
  │◀─────────────────────────────┤                         │
  │                              │                         │
  │  PUT file bytes (XHR)        │                         │
  ├──────────────────────────────┼────────────────────────▶│
  │  (no size limit, progress    │                         │
  │   events, 4G-friendly)       │                         │
  │                              │                         │
  │◀───── file {id, ...} ────────┼─────────────────────────┤
  │                              │                         │
  │  POST {correlationId,        │                         │
  │        driveFileId}          │                         │
  ├─────────────────────────────▶│                         │
  │                              │  Set anyone-with-link   │
  │                              │  reader permission      │
  │                              ├────────────────────────▶│
  │                              │                         │
  │◀────── ok ───────────────────┤                         │
```

## Components to build or change

### New

- `supabase/migrations/004_auth_rate_limits.sql`
  Table + index for rate-limit counting. RLS enabled, no policies (service-role only).
- `lib/rate-limit.ts`
  `checkAndRecord(kind, identifier, windowSec, max)` helper. Uses the existing admin Supabase client from `lib/supabase/admin.ts`.
- `app/api/photos/init/route.ts`
  Auth-checks the Supabase session, rate-limits (20/user/hour), mints a Google access token, opens a resumable upload session, returns `{ sessionUrl, correlationId }`.
- `app/api/photos/register/route.ts`
  Auth-checks, applies `anyone → reader` permission on the Drive file, returns ok.

### Changed

- `components/photos/PhotoUploader.tsx`
  Replace the single `fetch('/api/photos/upload', { body: formData })` with the three-phase init/PUT/register flow. Use `XMLHttpRequest` for PUT (native progress events, mobile-Safari-friendly). Keep all existing queue/preview/camera-input code untouched.
- `app/login/actions.ts` (or wherever `signInWithOtp` is currently called)
  Insert two `checkAndRecord` calls — email key first (3 per 15 min), then IP key (30 per 15 min) — before calling Supabase. Surface friendly errors when either limit is hit.
- `lib/google-drive.ts`
  Add `createResumableUploadSession` helper.

### Deleted (after new path is verified on prod)

- `app/api/photos/upload/route.ts` — replaced by `/init` + `/register`.
- `uploadToAlbum` export in `lib/google-drive.ts` — its only caller is the deleted route.

### Unchanged

- `lib/supabase/admin.ts` — already provides the service-role client we need for rate limiting
- `app/auth/google/callback/route.ts` — OAuth flow unchanged
- `app/admin/drive-auth/page.tsx` — admin surface unchanged
- Every non-photo page

## Rollout sequence

Five phases. Phase 1 happens locally and is fully tested before touching production.

**Phase 1 — Code (local)**

1. Migration: `auth_rate_limits` table.
2. Rate-limit helper + wire into login flow.
3. New init + register API routes + resumable session helper.
4. PhotoUploader refactor.
5. Local smoke test: 200 KB, 5 MB, 20 MB, 50 MB, 500 MB files.
6. Delete `/api/photos/upload` after verifying parity.

**Phase 2 — Deploy to Vercel (still on `*.vercel.app` URL)**

1. `git push` to main → Vercel auto-deploys.
2. Smoke-test every page on the vercel.app URL.
3. Upload a large photo (20 MB+) to confirm the 4.5 MB cap is bypassed.

**Phase 3 — Attach custom domain**

1. In Vercel project settings → Domains → add `prachiwedsmayank.in` and `www.prachiwedsmayank.in`.
2. In GoDaddy DNS:
   - Delete any existing `A @` record that points at a parking page.
   - Add `A @ 76.76.21.21` (value per Vercel's instructions at time of setup).
   - Add `CNAME www cname.vercel-dns.com`.
   - Leave MX records and SPF TXT untouched so `hello@prachiwedsmayank.in` keeps working.
3. Wait 5–60 min for DNS propagation. Vercel provisions TLS automatically.
4. Set apex as canonical; `www.` redirects to apex.

**Phase 4 — Reconfigure external services (order matters)**

1. Vercel env: update `GOOGLE_OAUTH_REDIRECT_URI` → `https://prachiwedsmayank.in/auth/google/callback`. Redeploy.
2. Google Cloud Console OAuth client:
   - Authorized redirect URIs: add `https://prachiwedsmayank.in/auth/google/callback` (keep localhost).
   - Authorized JavaScript origins: add `https://prachiwedsmayank.in` (keep localhost).
3. Supabase dashboard:
   - Site URL: `https://prachiwedsmayank.in`
   - Redirect URLs allowlist: add `https://prachiwedsmayank.in/**` (keep localhost).
   - SMTP sender name: `Prachi & Mayank`.
4. On prod, admin logs in → `/admin/drive-auth` → Connect Google Drive (overwrites the stored refresh token so it was minted against the prod redirect URI).

**Phase 5 — Validation**

1. End-to-end on a real phone over mobile data (not Wi-Fi), at the prod URL.
2. Rate-limit smoke test: request 4 magic links for the same email in 5 min, expect #4 blocked.
3. Large-file upload smoke test: 50 MB video.
4. All admin pages render.

## Error handling + edge cases

### Rate limiting

- Email normalization: `.trim().toLowerCase()` before building the key. Avoids `Mayank@X.com` vs `mayank@x.com` bucket split.
- Unknown IP (header missing): single shared "unknown" bucket. Benign.
- Concurrent races: two requests at count=2 can both insert; occasional one-over-limit. Acceptable for this scale.
- IP is `x-forwarded-for`'s first comma-separated token; Vercel always sets it.

### Upload

- Tab closed mid-upload: Drive orphans the session, auto-expires in ~1 week. No cleanup needed.
- `register` succeeds but `permissions.create` inside it fails: file exists but thumbnail won't render; log + inline warning; admin fixes manually. Non-fatal.
- Duplicate filename: Drive assigns distinct IDs. No collision.
- Access token expires mid-session: session URL carries its own short-lived auth; unaffected.
- Drive quota exceeded (15 GB on personal account): `/init` surfaces Drive's 403 as a friendly "album is full, please tell the organizer" message.
- Network failure mid-PUT: v1 retries whole file. No resume-from-offset.

### Domain / DNS

- GoDaddy leaves a parking `A` record in place: site load round-robins between parking page and Vercel. Fix: delete the parking `A` before adding Vercel's.
- TLS provisioning takes longer than DNS propagation: site briefly shows a cert warning. Wait 5–10 more min.
- Email breaks because SPF TXT was accidentally overwritten: revert from GoDaddy's DNS history.

### External service re-config

- Forgot to update `GOOGLE_OAUTH_REDIRECT_URI` on Vercel before re-authorizing Drive: Google returns `redirect_uri_mismatch`. Fix env var, redeploy, retry.
- Forgot to update Supabase Site URL: magic-link emails contain `localhost:3000` links. Symptoms visible immediately on the first test email from prod.

## Testing plan

| Test | Where | Pass criteria |
|---|---|---|
| Local: 200 KB JPG upload | `npm run dev` | Uploads, visible in Drive, visible in gallery |
| Local: 20 MB JPG | `npm run dev` | Same as above, progress bar ticks |
| Local: 500 MB video | `npm run dev` | Same; completes without OOM |
| Local: 4th magic-link request for same email within 15 min | `npm run dev` | Blocked with friendly message |
| Local: 31st request from one IP within 15 min | `npm run dev` | Blocked |
| Prod: full smoke test at `*.vercel.app` | Before DNS | All pages load, login works, uploads work |
| Prod: smoke test at `prachiwedsmayank.in` | After DNS + TLS | Same as above |
| Prod: magic link from mobile over 4G | Phone | Email arrives, link opens in-app browser, logs in |
| Prod: large-video upload from phone | Phone | Completes without 413 |
| Deliverability check | Gmail + one Outlook + one Yahoo inbox | Email lands in Inbox, not Spam |

## Time estimate

- Phase 1 (code): 3–4 hrs
- Phase 2 (deploy): 15 min (pushes trigger auto-deploy)
- Phase 3 (DNS): 15 min active + up to 60 min waiting
- Phase 4 (reconfig): 20 min
- Phase 5 (validation): 30 min

Total active time: ~5 hrs. Calendar time: ~1 evening + wait window.

## Open risks

1. **Gmail SMTP deliverability** on launch-day burst. Mitigation: send an early test email to a representative spread of inboxes before the real guest blast.
2. **Drive free quota** (15 GB) insufficient for all uploads. Mitigation: upgrade to Google One 200 GB plan (~$2/mo) if quota fills mid-event — it's live-toggleable and takes effect instantly.
3. **Custom-domain-branded `from` address** unattainable with Gmail SMTP — emails are still "from" `kumar.mayank98@gmail.com`. Mitigation: set sender display name to `Prachi & Mayank` so the human-readable name is wedding-appropriate even if the address isn't. Full branding requires switching to a transactional provider (Resend) — deferred.

## Success criteria

- Guests visiting `https://prachiwedsmayank.in` can request a magic link, receive it within 1 minute, and log in.
- At least 3 guests successfully upload a ≥10 MB photo from their phones and see it in the gallery.
- Rate limits block attempted abuse (verified via test).
- `hello@prachiwedsmayank.in` email address continues to receive and send normally throughout.
