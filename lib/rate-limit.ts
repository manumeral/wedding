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
