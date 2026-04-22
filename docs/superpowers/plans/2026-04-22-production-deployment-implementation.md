# Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the wedding website to production at `https://prachiwedsmayank.in`, with per-email + per-IP rate limiting on magic-link sign-in and a client-direct photo upload flow that bypasses Vercel's 4.5 MB request-body cap.

**Architecture:** Adds one Postgres rate-limit table + a tiny helper; rewrites photo upload to mint a Google Drive resumable-upload session URL server-side so the browser PUTs file bytes directly to Google. Supporting ops tasks: DNS, Supabase URL config, Google OAuth redirect URI, Drive re-auth on prod.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + Auth + service-role admin client), googleapis/google-auth-library, XMLHttpRequest (for upload progress events).

**Spec:** `docs/superpowers/specs/2026-04-22-production-deployment-design.md`

**Testing conventions:** This project has no automated test suite. Verification uses `npx tsc --noEmit`, `npx next build`, and real-service smoke tests (against the running `next dev` and the Vercel deploy). Every code task ends with both a typecheck and a concrete manual test before the commit step.

---

## Task 1: Rate-limit data model + helper

**Files:**
- Create: `supabase/migrations/004_auth_rate_limits.sql`
- Modify: `supabase/schema.sql` (append the new table near the other `enable row level security` statements)
- Create: `lib/rate-limit.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/004_auth_rate_limits.sql`:

```sql
-- 004_auth_rate_limits.sql
-- Count-and-insert rate-limit buckets for auth flows. Writes happen via
-- the service-role client (server-only). No RLS policies on purpose -
-- guest-facing clients have zero access.

create table if not exists public.auth_rate_limits (
  id bigserial primary key,
  kind text not null,
  identifier text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists auth_rate_limits_lookup
  on public.auth_rate_limits (kind, identifier, created_at desc);

alter table public.auth_rate_limits enable row level security;
```

- [ ] **Step 2: Append the same table to `supabase/schema.sql`**

Find the block in `supabase/schema.sql` that creates `public.app_config` (added by migration 003). Immediately after its `alter table ... enable row level security;` line, append:

```sql
-- Count-and-insert buckets for auth rate limiting (service-role only).
create table public.auth_rate_limits (
  id bigserial primary key,
  kind text not null,
  identifier text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index auth_rate_limits_lookup
  on public.auth_rate_limits (kind, identifier, created_at desc);

alter table public.auth_rate_limits enable row level security;
```

- [ ] **Step 3: Apply the migration against the Supabase project**

Run in the Supabase SQL editor (Dashboard → SQL Editor → New query):

```sql
-- paste the contents of supabase/migrations/004_auth_rate_limits.sql
```

Expected: "Success. No rows returned."

Verify the table exists:

```sql
select table_name from information_schema.tables where table_name = 'auth_rate_limits';
```

Expected: one row back.

- [ ] **Step 4: Write the rate-limit helper**

Create `lib/rate-limit.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/admin'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Count-and-insert rate limiter backed by `public.auth_rate_limits`.
 *
 * Counts how many rows for `(kind, identifier)` were created within
 * the last `windowSec` seconds. If under `max`, inserts a new row
 * and returns allowed=true. Otherwise returns allowed=false.
 *
 * Races between concurrent requests can let `max+1` through; that
 * is acceptable for this use case (magic-link throttling at wedding
 * scale).
 */
export async function checkAndRecord(
  kind: string,
  identifier: string,
  windowSec: number,
  max: number,
): Promise<RateLimitResult> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - windowSec * 1000).toISOString()

  const { count, error: countErr } = await admin
    .from('auth_rate_limits')
    .select('id', { count: 'exact', head: true })
    .eq('kind', kind)
    .eq('identifier', identifier)
    .gte('created_at', since)

  if (countErr) {
    console.error('[rate-limit] count failed', kind, identifier, countErr)
    // Fail open rather than lock users out of sign-in during a DB hiccup.
    return { allowed: true, remaining: max, retryAfterSeconds: 0 }
  }

  const current = count ?? 0
  if (current >= max) {
    return { allowed: false, remaining: 0, retryAfterSeconds: windowSec }
  }

  const { error: insertErr } = await admin
    .from('auth_rate_limits')
    .insert({ kind, identifier })

  if (insertErr) {
    console.error('[rate-limit] insert failed', kind, identifier, insertErr)
  }

  return {
    allowed: true,
    remaining: max - current - 1,
    retryAfterSeconds: 0,
  }
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual verification of helper**

Run this one-off in `npx tsx` or drop it into a scratch server action. In the Supabase SQL editor:

```sql
-- Simulate a rate-limit exhaustion.
insert into public.auth_rate_limits (kind, identifier) values
  ('test', 'x', now()), ('test', 'x', now()), ('test', 'x', now());

select count(*) from public.auth_rate_limits
  where kind = 'test' and identifier = 'x';
-- Expected: 3
```

Then clean up:

```sql
delete from public.auth_rate_limits where kind = 'test';
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/004_auth_rate_limits.sql supabase/schema.sql lib/rate-limit.ts
git commit -m "feat: add auth_rate_limits table + checkAndRecord helper"
```

---

## Task 2: Move magic-link request to a server action and rate-limit it

**Files:**
- Create: `app/login/actions.ts`
- Modify: `app/login/page.tsx` (replace the client-side `supabase.auth.signInWithOtp` call with a call to the new server action)

- [ ] **Step 1: Write the server action**

Create `app/login/actions.ts`:

```typescript
'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { checkAndRecord } from '@/lib/rate-limit'

export interface RequestMagicLinkResult {
  ok: boolean
  error?: string
}

function getClientIp(): string {
  const h = headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = h.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

export async function requestMagicLink(
  rawEmail: string,
  emailRedirectTo: string,
): Promise<RequestMagicLinkResult> {
  const email = rawEmail.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  const emailCheck = await checkAndRecord(
    'magic_link',
    `email:${email}`,
    15 * 60,
    3,
  )
  if (!emailCheck.allowed) {
    return {
      ok: false,
      error:
        "We've already sent a few links to that address. Please wait 15 minutes before trying again (and check your spam folder).",
    }
  }

  const ipCheck = await checkAndRecord(
    'magic_link',
    `ip:${getClientIp()}`,
    15 * 60,
    30,
  )
  if (!ipCheck.allowed) {
    return {
      ok: false,
      error:
        'Too many login attempts from this network. Please try again in a few minutes.',
    }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  })

  if (error) {
    console.error('[login.requestMagicLink]', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
```

- [ ] **Step 2: Wire the server action into `app/login/page.tsx`**

Open `app/login/page.tsx`. Change the import block at the top of the file (around lines 1-8):

Replace:
```typescript
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Mail, KeyRound, Loader2 } from 'lucide-react'
```

With:
```typescript
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Mail, KeyRound, Loader2 } from 'lucide-react'
import { requestMagicLink } from './actions'
```

- [ ] **Step 3: Replace the handler in `app/login/page.tsx`**

Still in `app/login/page.tsx`, inside `LoginForm()`: remove the line `const supabase = createClient()` (it's no longer used here).

Then replace the entire `handleEmailSubmit` function (the block starting `const handleEmailSubmit = async` through its closing `}`) with:

```typescript
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    const result = await requestMagicLink(email, `${location.origin}/auth/confirm`)

    if (!result.ok) {
      setMessage(result.error ?? 'Something went wrong. Please try again.')
      setIsError(true)
    } else {
      setMessage('Check your email! Click the magic link, or enter the code below.')
      setIsError(false)
      setStep('TOKEN')
    }
    setLoading(false)
  }
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Local smoke test the happy path**

Run: `npm run dev` (or reload if already running).

In the browser:
1. Navigate to `/login`.
2. Enter your email, click "Send Magic Link".
3. Expected: inline message "Check your email! ..." appears.
4. Check your inbox — the magic-link email should arrive.
5. Click the link or enter the 8-digit code — you should end up logged in and redirected to `/`.

- [ ] **Step 6: Local smoke test the rate-limit**

Still on `/login`, trigger the rate limit:

1. Enter the same email, click "Send Magic Link".
2. Click "Use a different email" to reset to the email step.
3. Enter the same email, click "Send Magic Link".
4. Repeat once more (3rd successful send).
5. On the 4th attempt, expect the inline error: *"We've already sent a few links to that address. Please wait 15 minutes before trying again..."*

Verify the bucket state:

```sql
-- In the Supabase SQL editor
select created_at, identifier from public.auth_rate_limits
  where kind = 'magic_link' and identifier like 'email:%'
  order by id desc limit 10;
```

Expected: 3 rows for your email within the last minute.

Clean up after the test:

```sql
delete from public.auth_rate_limits where kind = 'magic_link';
```

- [ ] **Step 7: Commit**

```bash
git add app/login/actions.ts app/login/page.tsx
git commit -m "feat: rate-limit magic-link requests (3/email + 30/ip per 15 min)"
```

---

## Task 3: Add Drive resumable-upload session helper

**Files:**
- Modify: `lib/google-drive.ts` (add one new exported function, leave the rest untouched)

- [ ] **Step 1: Add the helper to `lib/google-drive.ts`**

Open `lib/google-drive.ts`. At the bottom of the file — just before the final `// ---------- Errors ----------` section — insert:

```typescript
// ---------- Public: client-direct resumable upload ----------

export interface ResumableSessionInput {
  filename: string
  mimeType: string
  sizeBytes: number
  uploaderId: string
  uploaderName: string
}

export interface ResumableSessionOutput {
  sessionUrl: string
}

/**
 * Creates a Google Drive resumable upload session and returns the
 * session URL. The browser then PUTs the file bytes directly to that
 * URL, bypassing our server entirely.
 *
 * Session URLs are valid for ~1 week, single-use, and carry their
 * own auth — safe to hand to the browser.
 */
export async function createResumableUploadSession(
  input: ResumableSessionInput,
): Promise<ResumableSessionOutput> {
  const { env } = readOAuthEnv()
  if (!env) {
    throw new DriveNotConnectedError('Google Drive environment variables are not set.')
  }

  const refreshToken = await readConfig(CONFIG_KEY_REFRESH)
  if (!refreshToken) {
    throw new DriveNotConnectedError('Google Drive is not connected yet. Ask an organizer to connect it.')
  }

  const client = buildOAuthClient(env)
  client.setCredentials({ refresh_token: refreshToken })

  let accessToken: string | null | undefined
  try {
    const tok = await client.getAccessToken()
    accessToken = tok.token
  } catch (err: any) {
    if (isAuthError(err)) {
      throw new DriveAuthError('Google connection has expired. An organizer needs to reconnect.')
    }
    throw err
  }
  if (!accessToken) {
    throw new DriveAuthError('Could not mint Google access token.')
  }

  const metadata = {
    name: input.filename,
    mimeType: input.mimeType,
    parents: [env.folderId],
    appProperties: {
      uploaderUserId: input.uploaderId,
      uploaderName: input.uploaderName.slice(0, 100),
      app: 'wedding',
    },
  }

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': input.mimeType,
        'X-Upload-Content-Length': String(input.sizeBytes),
      },
      body: JSON.stringify(metadata),
    },
  )

  if (res.status === 401 || res.status === 403) {
    throw new DriveAuthError('Google rejected the upload session request.')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Drive refused session (${res.status}): ${text || 'no body'}`)
  }

  const sessionUrl = res.headers.get('Location')
  if (!sessionUrl) {
    throw new Error('Drive did not return a resumable session URL.')
  }

  return { sessionUrl }
}

/**
 * Applies "anyone with link → reader" permission on a file so that
 * <img src="..drive thumbnail.."> renders without an auth header.
 * Safe to call multiple times; Drive dedups identical grants.
 */
export async function makeFilePublic(fileId: string): Promise<void> {
  const ctx = await getDrive()
  if (!ctx) {
    throw new DriveNotConnectedError('Google Drive is not connected.')
  }
  const { drive } = ctx
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    })
  } catch (err: any) {
    if (isAuthError(err)) {
      throw new DriveAuthError('Google connection has expired.')
    }
    throw err
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify existing Drive behaviour still works**

With `npm run dev` running, navigate to `/admin/drive-auth` as an admin and hit the "Test connection" button.
Expected: green "Success — saw N file(s) in the folder."

(This verifies we did not accidentally break the existing `getDrive`/`listAlbum` path while editing the module.)

- [ ] **Step 4: Commit**

```bash
git add lib/google-drive.ts
git commit -m "feat: add Drive resumable-upload session + public-permission helpers"
```

---

## Task 4: `/api/photos/init` route

**Files:**
- Create: `app/api/photos/init/route.ts`

- [ ] **Step 1: Write the route handler**

Create `app/api/photos/init/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createResumableUploadSession,
  getConnectionStatus,
  DriveAuthError,
  DriveNotConnectedError,
} from '@/lib/google-drive'
import { checkAndRecord } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB; Drive's file limit is higher but we cap here
const ALLOWED_PREFIXES = ['image/', 'video/']

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\\/]/g, '').trim()
  return cleaned.length > 0 ? cleaned.slice(0, 180) : `upload-${Date.now()}`
}

interface InitBody {
  filename?: unknown
  mimeType?: unknown
  sizeBytes?: unknown
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const status = await getConnectionStatus()
  if (status.state === 'env_missing') {
    return NextResponse.json(
      { error: 'The photo album is not set up yet. Please check back soon.' },
      { status: 503 },
    )
  }
  if (status.state === 'not_connected') {
    return NextResponse.json(
      { error: 'The album is not connected yet. Ask an organizer to finish setup.' },
      { status: 503 },
    )
  }

  // Per-user init rate-limit: 30 uploads per 15 min.
  const rl = await checkAndRecord('photo_init', `user:${user.id}`, 15 * 60, 30)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'You are uploading very fast. Please wait a few minutes.' },
      { status: 429 },
    )
  }

  let body: InitBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const filenameRaw = typeof body.filename === 'string' ? body.filename : ''
  const mimeTypeRaw = typeof body.mimeType === 'string' ? body.mimeType : ''
  const sizeBytesRaw = typeof body.sizeBytes === 'number' ? body.sizeBytes : Number.NaN

  if (!filenameRaw || !mimeTypeRaw || !Number.isFinite(sizeBytesRaw) || sizeBytesRaw <= 0) {
    return NextResponse.json(
      { error: 'filename, mimeType, and sizeBytes are required.' },
      { status: 400 },
    )
  }

  if (!ALLOWED_PREFIXES.some((p) => mimeTypeRaw.startsWith(p))) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeTypeRaw}. Please upload an image or video.` },
      { status: 415 },
    )
  }

  if (sizeBytesRaw > MAX_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Keep each upload under ${MAX_BYTES / 1024 / 1024 / 1024} GB.` },
      { status: 413 },
    )
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const uploaderName = profile?.full_name?.trim() || user.email || 'Guest'

  const correlationId = crypto.randomUUID()

  try {
    const { sessionUrl } = await createResumableUploadSession({
      filename: sanitizeFilename(filenameRaw),
      mimeType: mimeTypeRaw,
      sizeBytes: Math.floor(sizeBytesRaw),
      uploaderId: user.id,
      uploaderName,
    })
    return NextResponse.json({ sessionUrl, correlationId })
  } catch (err: any) {
    console.error('[photos.init]', err)
    if (err instanceof DriveAuthError) {
      return NextResponse.json(
        { error: 'Google connection expired. An organizer needs to reconnect.' },
        { status: 503 },
      )
    }
    if (err instanceof DriveNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    return NextResponse.json({ error: err?.message ?? 'Could not start upload.' }, { status: 502 })
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test with curl**

Start `npm run dev`. Log in via the browser to obtain a session cookie. Then in Chrome DevTools → Application → Cookies, copy the `sb-*-auth-token` cookie value (or all `sb-*` cookies).

Alternative: use your browser. Open DevTools → Console on the logged-in app and run:

```javascript
fetch('/api/photos/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    filename: 'test.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 12345,
  }),
}).then(r => r.json()).then(console.log)
```

Expected: `{ sessionUrl: "https://...upload.googleapis.com/...", correlationId: "<uuid>" }`.

If Drive isn't connected yet you'll see a 503 with a friendly error — that's a valid alternative pass.

- [ ] **Step 4: Commit**

```bash
git add app/api/photos/init/route.ts
git commit -m "feat: /api/photos/init route mints Drive resumable session"
```

---

## Task 5: `/api/photos/register` route

**Files:**
- Create: `app/api/photos/register/route.ts`

- [ ] **Step 1: Write the route handler**

Create `app/api/photos/register/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  makeFilePublic,
  DriveAuthError,
  DriveNotConnectedError,
} from '@/lib/google-drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RegisterBody {
  driveFileId?: unknown
  correlationId?: unknown
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let body: RegisterBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const driveFileId = typeof body.driveFileId === 'string' ? body.driveFileId.trim() : ''
  if (!driveFileId) {
    return NextResponse.json({ error: 'driveFileId is required.' }, { status: 400 })
  }

  try {
    await makeFilePublic(driveFileId)
  } catch (err: any) {
    console.error('[photos.register]', err)
    if (err instanceof DriveAuthError) {
      return NextResponse.json(
        { error: 'Google connection expired. An organizer needs to reconnect.' },
        { status: 503 },
      )
    }
    if (err instanceof DriveNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    // Don't fail the whole upload just because permissions.create
    // flaked; the file exists in Drive regardless. Report soft-fail.
    return NextResponse.json(
      { ok: true, warning: 'Upload stored, but public permission could not be set.' },
    )
  }

  revalidatePath('/photos')
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test with curl/console**

This route is only useful after a successful Drive upload, so we'll exercise it end-to-end in Task 6. For now, confirm the route exists:

```bash
curl -i -X POST http://localhost:3000/api/photos/register \
  -H 'Content-Type: application/json' \
  -d '{}'
```

Expected: HTTP 401 with `{"error":"Not signed in."}`.

- [ ] **Step 4: Commit**

```bash
git add app/api/photos/register/route.ts
git commit -m "feat: /api/photos/register route marks uploaded file public"
```

---

## Task 6: Refactor PhotoUploader to three-phase flow

**Files:**
- Modify: `components/photos/PhotoUploader.tsx` (replace the `uploadWithProgress` helper and its one caller)

- [ ] **Step 1: Replace the upload helper and its caller**

Open `components/photos/PhotoUploader.tsx`.

Replace the entire `uploadWithProgress` function (currently the block starting `function uploadWithProgress(` through its closing `}` — roughly lines 22-57) with:

```typescript
async function initSession(file: File): Promise<{ sessionUrl: string; correlationId: string }> {
  const res = await fetch('/api/photos/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  })
  if (!res.ok) {
    let msg = `Could not start upload (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

function putToDriveWithProgress(
  sessionUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', sessionUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText)
          if (body?.id) {
            resolve(body.id)
            return
          }
        } catch {}
        reject(new Error('Drive returned an unexpected response.'))
        return
      }
      reject(new Error(`Drive rejected the upload (${xhr.status}).`))
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')))

    xhr.send(file)
  })
}

async function registerUpload(driveFileId: string, correlationId: string): Promise<void> {
  const res = await fetch('/api/photos/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driveFileId, correlationId }),
  })
  if (!res.ok) {
    let msg = `Could not finalize upload (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {}
    throw new Error(msg)
  }
}

async function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const { sessionUrl, correlationId } = await initSession(file)
  const driveFileId = await putToDriveWithProgress(sessionUrl, file, onProgress)
  await registerUpload(driveFileId, correlationId)
}
```

Everything else in `PhotoUploader.tsx` stays the same — the component still calls `uploadWithProgress(item.file, ...)`, so the public shape is preserved.

- [ ] **Step 2: Update the copy under "Upload from device"**

Still in `components/photos/PhotoUploader.tsx`, find the line that reads:

```tsx
            <p className="text-xs text-stone-500">Photos or videos, up to 50 MB each</p>
```

Replace with:

```tsx
            <p className="text-xs text-stone-500">Photos or videos from your device</p>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Local end-to-end upload test (small file)**

Run `npm run dev`. Log in, navigate to `/photos`. Upload a small image from your machine (< 1 MB).

Expected:
- Progress bar ticks smoothly.
- Row goes `Uploading` → `Uploaded to the album`.
- Refresh — the photo appears in the gallery below.
- In Google Drive (visit `folderUrl`), the file is present with your `uploaderName` in its `appProperties`.

- [ ] **Step 5: Local end-to-end upload test (large file)**

Upload a file ≥ 20 MB (any image/video) from your machine.

Expected: same behaviour as Step 4. This is the key proof that we are no longer bound by the 4.5 MB Vercel cap — it now runs through our local dev server but the *path* is identical to prod.

- [ ] **Step 6: Local rate-limit smoke test on init**

In the browser DevTools console on the logged-in `/photos` page:

```javascript
for (let i = 0; i < 32; i++) {
  fetch('/api/photos/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: `t${i}.jpg`, mimeType: 'image/jpeg', sizeBytes: 1000 }),
  }).then(r => r.json()).then(b => console.log(i, b.error ? 'ERR '+b.error : 'OK'))
}
```

Expected: first ~30 return `OK`, the rest return `ERR You are uploading very fast...`.

Clean up:

```sql
delete from public.auth_rate_limits where kind = 'photo_init';
```

- [ ] **Step 7: Commit**

```bash
git add components/photos/PhotoUploader.tsx
git commit -m "feat: client-direct resumable upload to Drive (bypasses Vercel 4.5 MB cap)"
```

---

## Task 7: Delete the old server-proxy upload path

**Files:**
- Delete: `app/api/photos/upload/route.ts`
- Modify: `lib/google-drive.ts` (remove the `uploadToAlbum` export + its internal `UploadInput` type)

- [ ] **Step 1: Delete the old route file**

Run:

```bash
rm app/api/photos/upload/route.ts
```

- [ ] **Step 2: Remove `uploadToAlbum` and its interface from `lib/google-drive.ts`**

Open `lib/google-drive.ts`. Remove:

1. The entire `export async function uploadToAlbum(...)` function (from its doc/signature line through its closing `}`).
2. The `interface UploadInput` declaration that sits right before it.
3. The `UploadedFile` interface, if no other code references it. **Check first:**

```bash
rg 'UploadedFile|UploadInput|uploadToAlbum' --glob '!node_modules' --glob '!.next'
```

Delete each symbol only if the check returns no hits outside `lib/google-drive.ts` itself.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If the compiler complains about a missing import somewhere, it likely means a file was still referencing `uploadToAlbum` — grep for it again and either update the caller or (if it's the deleted route) confirm the file is gone.

- [ ] **Step 4: Production build**

Run: `npx next build`
Expected: succeeds; in the route listing, `app/api/photos/upload` should no longer appear, but `/api/photos/init` and `/api/photos/register` should.

- [ ] **Step 5: One more local end-to-end upload**

With `npm run dev`, log in, go to `/photos`, and upload a small image. Verify it still works — this confirms nothing broke while deleting code.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove server-proxy upload path, now unused"
```

---

## Task 8: Ship to Vercel and smoke-test on the `*.vercel.app` URL

**Files:** none modified. This is a deploy + verification task.

**Preconditions:** the GitHub repo is already connected to the Vercel project (done earlier). Current URL: `https://wedding-khaki-nine.vercel.app/`.

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

Expected: Vercel auto-starts a deploy within ~30 seconds. Watch the Vercel dashboard → Deployments tab until status is **Ready**.

- [ ] **Step 2: Update Supabase URL config for the vercel.app URL**

In the Supabase dashboard → Authentication → URL Configuration:

- **Site URL**: `https://wedding-khaki-nine.vercel.app`
- **Redirect URLs** — ensure this list contains:
  ```
  http://localhost:3000/**
  https://wedding-khaki-nine.vercel.app/**
  ```

Save.

- [ ] **Step 3: Log in on production**

Open `https://wedding-khaki-nine.vercel.app/` in an incognito window. Request a magic link, click the link from the Gmail inbox, verify you end up logged in on the vercel.app URL (not localhost).

- [ ] **Step 4: Upload a large photo on production**

On the prod URL, navigate to `/photos`. Upload a ≥ 20 MB file.

Expected: upload succeeds, file shows in the gallery after a refresh.

**If it fails with 413:** the Drive OAuth hasn't been completed against the prod URL yet, or env vars are missing. Go to `/admin/drive-auth` on prod and click "Test connection" — the error message will point at the missing piece.

- [ ] **Step 5: Rate-limit smoke test on production**

On prod login, trigger 4 magic-link requests for your own email within 5 min. The 4th should be blocked. (Yes, this burns 3 real emails to your inbox — keep them to confirm deliverability.)

Clean up in SQL editor:

```sql
delete from public.auth_rate_limits where kind = 'magic_link';
```

- [ ] **Step 6: No commit**

No code changed in this task.

---

## Task 9: Attach custom domain `prachiwedsmayank.in`

**Files:** none modified. This is pure ops, inside the Vercel dashboard and the GoDaddy DNS panel.

- [ ] **Step 1: Add the domain in Vercel**

Vercel dashboard → your project → Settings → Domains → **Add**.

1. Enter `prachiwedsmayank.in` and click Add.
2. Vercel will prompt with two DNS records to set. Note the exact values it shows — the `A` record IP has historically been `76.76.21.21` but Vercel occasionally updates it.
3. Add `www.prachiwedsmayank.in` too. Vercel will show a `CNAME` record to set.

- [ ] **Step 2: Add the DNS records on GoDaddy**

GoDaddy → Domain Portfolio → `prachiwedsmayank.in` → **DNS** tab.

**Important preflight:** check for an existing `A @` record pointing at a GoDaddy parking page. If present, **delete it** first; otherwise half of production traffic will round-robin to the parked page.

Then add:

| Type | Name | Data (from Vercel's instructions) | TTL |
|---|---|---|---|
| `A` | `@` | e.g. `76.76.21.21` | 1 hour |
| `CNAME` | `www` | `cname.vercel-dns.com` | 1 hour |

**Do not** touch the existing `MX` records or the `v=spf1 include:secureserver.net -all` SPF `TXT` record — those keep your GoDaddy mailbox working.

- [ ] **Step 3: Wait for DNS propagation + TLS**

Back in Vercel's domain settings panel, both `prachiwedsmayank.in` and `www.prachiwedsmayank.in` will initially show a warning until DNS resolves and a Let's Encrypt certificate provisions. Typically 5–30 min.

Verify manually:

```bash
dig prachiwedsmayank.in A +short
# Expected: the IP Vercel gave you

dig www.prachiwedsmayank.in CNAME +short
# Expected: cname.vercel-dns.com.

dig prachiwedsmayank.in MX +short
# Expected: still your GoDaddy MX records, unchanged
```

- [ ] **Step 4: Configure redirect direction**

In Vercel's domain panel: set `prachiwedsmayank.in` as the **primary** (canonical) domain. Configure `www.prachiwedsmayank.in` to redirect to it.

- [ ] **Step 5: Sanity-check both URLs load**

```bash
curl -sI https://prachiwedsmayank.in/ | head -5
# Expected: HTTP/2 307 → /login, served by Vercel

curl -sI https://www.prachiwedsmayank.in/ | head -5
# Expected: HTTP/2 308 → https://prachiwedsmayank.in (redirect)
```

- [ ] **Step 6: No commit**

---

## Task 10: Reconfigure Supabase, Google OAuth, and re-authorize Drive on prod

**Files:** none. Pure dashboard work, in the strict order below.

- [ ] **Step 1: Update Vercel env var `GOOGLE_OAUTH_REDIRECT_URI`**

Vercel → Project → Settings → Environment Variables. Edit `GOOGLE_OAUTH_REDIRECT_URI` for the **Production** environment:

```
https://prachiwedsmayank.in/auth/google/callback
```

After saving, redeploy (Vercel dashboard → Deployments → the latest → "..." menu → **Redeploy**). Needed because env vars are baked at deploy time.

- [ ] **Step 2: Update Google Cloud Console OAuth client**

GCP Console → APIs & Services → Credentials → the OAuth 2.0 Client ID for this project → **Edit**.

Under **Authorized JavaScript origins**, add (keep existing entries):
```
https://prachiwedsmayank.in
```

Under **Authorized redirect URIs**, add (keep existing entries):
```
https://prachiwedsmayank.in/auth/google/callback
```

Save. Google applies within ~1 minute.

- [ ] **Step 3: Update Supabase URL config for the custom domain**

Supabase dashboard → Authentication → URL Configuration:

- **Site URL**: `https://prachiwedsmayank.in`
- **Redirect URLs** — ensure this list contains:
  ```
  http://localhost:3000/**
  https://wedding-khaki-nine.vercel.app/**
  https://prachiwedsmayank.in/**
  ```

Save.

- [ ] **Step 4: Update Supabase SMTP sender name**

Supabase dashboard → Authentication → SMTP Settings:

- **Sender name**: `Prachi & Mayank`

Leave Sender email, host, port, username, password untouched (still Gmail).

Save.

- [ ] **Step 5: Re-authorize Google Drive against the production URL**

Navigate to `https://prachiwedsmayank.in/admin/drive-auth` (admin-only). Click **Connect Google Drive**. Complete the Google consent flow using your wedding-folder-owner Google account.

Expected: redirect back to `/admin/drive-auth?connected=1&email=<your-gmail>`. Click **Test connection** — expect green "Success — saw N file(s)".

This overwrites the refresh token in `app_config` with one minted against the prod redirect URI. Local dev will continue to work because the refresh token is bound to the *account*, not the URL.

- [ ] **Step 6: No commit**

---

## Task 11: End-to-end validation on the production domain

**Files:** none. Real-world verification.

- [ ] **Step 1: Mobile, mobile data (not Wi-Fi), fresh browser**

On a real phone, turn off Wi-Fi, ensure you're on cellular data. Open a fresh/incognito tab and navigate to `https://prachiwedsmayank.in/`.

Expected: redirect to `/login`, full page renders.

- [ ] **Step 2: Magic-link deliverability check**

Request a magic link for an email on each of: Gmail, Outlook/Hotmail, one Yahoo address (borrow one if needed).

Expected: all three receive the email within 2 minutes, in the Primary/Inbox folder. If any land in Promotions/Spam, note it — we'll tell guests to check spam in the invite.

- [ ] **Step 3: End-to-end guest flow on the phone**

On the phone: complete the magic-link sign-in, then:

1. Edit the profile (name + bio + avatar) — should persist after refresh.
2. Submit a request (e.g. pickup) — should appear in `/admin` when you log in on desktop.
3. Tap "Take a photo" on `/photos`, capture a selfie, let it upload.
4. Verify the selfie appears in the gallery after a refresh and in the real Google Drive folder.

- [ ] **Step 4: Large-file upload from the phone**

Still on the phone, tap "Upload from device" and pick a large file (video > 50 MB if possible).

Expected: progress bar visible, upload completes, file shows in Drive.

- [ ] **Step 5: Admin surfaces**

Log in as the admin user on the phone or desktop:

- `/admin` (requests): renders
- `/admin/users` (guests & rooms): renders
- `/admin/events`: renders
- `/admin/drive-auth`: shows "Connected as …"

- [ ] **Step 6: Email footer confirms domain**

Open the latest magic-link email. Check:

- The **From** shows "Prachi & Mayank" (the display name), address still the Gmail one.
- The link inside points at `https://prachiwedsmayank.in/...`, not `localhost` and not `vercel.app`.

- [ ] **Step 7: No commit**

---

## Self-review checklist (post-implementation sanity)

After all tasks are done, run this once:

- [ ] `npx tsc --noEmit` — clean
- [ ] `npx next build` — clean, route listing includes `/api/photos/init` and `/api/photos/register`, does NOT include `/api/photos/upload`
- [ ] `dig prachiwedsmayank.in A +short` — returns the Vercel IP
- [ ] `dig prachiwedsmayank.in MX +short` — returns the GoDaddy MX records (unchanged from pre-deploy)
- [ ] Production magic-link flow works end-to-end
- [ ] Production photo upload works with a file > 20 MB
- [ ] `auth_rate_limits` table exists in Supabase
- [ ] Google OAuth redirect URI list contains both localhost and prod entries
- [ ] Git log shows one commit per Task 1, 2, 3, 4, 5, 6, 7 (Tasks 8–11 are ops-only)

---

## Out of scope for this plan (future work)

Captured here so they do not get folded into this plan:

- Switching SMTP to Resend / SES / GoDaddy (stays on Gmail for now).
- Invite allowlist / guest pre-seeding.
- Moving DNS to Cloudflare.
- Resumable-upload resume-from-offset on mid-stream network failures (v2).
- Post-event ZIP export of photos.
- Automated tests.
