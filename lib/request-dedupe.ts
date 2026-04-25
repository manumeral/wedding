/**
 * Normalized fingerprint for “same” guest request, used to block accidental double submits
 * within a short time window.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const DEDUPE_MINUTES = 20

function norm(s: string | null | undefined): string {
  return (s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Build a stable key for comparing two transport requests, or a non-transport one.
 * datetime strings compared at minute resolution.
 */
export function buildRequestContentKey(
  row: {
    type: string
    details: string | null
    pickup_at?: string | null
    pickup_location?: string | null
    dropoff_location?: string | null
    dropoff_at?: string | null
    hub_kind?: string | null
  },
): string {
  if (row.type === 'cab' || row.type === 'pickup') {
    const pa = row.pickup_at ? String(row.pickup_at).replace(/\.\d{3}Z$/, 'Z').slice(0, 16) : ''
    const da = row.dropoff_at ? String(row.dropoff_at).replace(/\.\d{3}Z$/, 'Z').slice(0, 16) : ''
    return [
      row.type,
      pa,
      norm(row.pickup_location as string | null | undefined),
      norm(row.dropoff_location as string | undefined),
      da,
      row.hub_kind ?? '',
      norm(row.details as string | null | undefined),
    ].join('\x1e')
  }
  return [row.type, norm(row.details as string | null | undefined)].join('\x1e')
}

type RequestRow = {
  id: string
  type: string
  details: string | null
  pickup_at: string | null
  pickup_location: string | null
  dropoff_location: string | null
  dropoff_at: string | null
  hub_kind: string | null
  status: string
}

/**
 * If the user has an equivalent pending/claimed request in the dedupe window, return its id.
 */
export async function findRecentDuplicateRequestId(
  supabase: SupabaseClient,
  userId: string,
  key: string,
): Promise<string | null> {
  const since = new Date(Date.now() - DEDUPE_MINUTES * 60 * 1000).toISOString()
  const { data: recent, error } = await supabase
    .from('requests')
    .select('id, type, details, pickup_at, pickup_location, dropoff_location, dropoff_at, hub_kind, status')
    .eq('user_id', userId)
    .in('status', ['pending', 'claimed'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(40)

  if (error) {
    console.error('[request-dedupe] query', error)
    return null
  }

  for (const r of (recent ?? []) as RequestRow[]) {
    if (buildRequestContentKey(r) === key) {
      return r.id
    }
  }
  return null
}
