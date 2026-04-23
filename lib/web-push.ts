import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

export function isWebPushConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
    process.env.VAPID_PRIVATE_KEY?.trim()
  )
}

let vapidInitialized = false

function ensureVapid(): boolean {
  if (vapidInitialized) return true
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:hello@example.com'
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidInitialized = true
  return true
}

export type WebPushPayload = {
  title: string
  body: string
  /** Path only (e.g. /inbox) or full URL */
  url?: string
}

function normalizeUrl(pathOrUrl: string | undefined): string {
  if (!pathOrUrl) return '/'
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || ''
  if (base && pathOrUrl.startsWith('/')) return `${base}${pathOrUrl}`
  return pathOrUrl
}

/**
 * Sends a Web Push to every stored subscription for the given users.
 * Best-effort: invalid subscriptions are deleted. No-op if VAPID is not configured.
 */
export async function sendWebPushToUserIds(
  userIds: string[],
  payload: WebPushPayload,
): Promise<void> {
  if (!isWebPushConfigured() || !ensureVapid()) return
  if (userIds.length === 0) return

  const admin = createAdminClient()
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (error) {
    console.error('[web-push] load subscriptions', error)
    return
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: normalizeUrl(payload.url),
  })

  for (const row of subs ?? []) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }
    try {
      await webpush.sendNotification(subscription, body, { TTL: 60 * 60 })
    } catch (err: any) {
      const status = err?.statusCode ?? err?.status
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('id', row.id)
      } else {
        console.warn('[web-push] send failed', status, err?.message)
      }
    }
  }
}

/** All non-staff users with at least one push subscription (resolved server-side). */
export async function guestUserIdsForPush(): Promise<string[]> {
  const admin = createAdminClient()
  const { data: guests, error: gErr } = await admin.from('users').select('id').eq('admin_level', 'none')
  if (gErr || !guests?.length) return []
  return guests.map((g) => g.id)
}
