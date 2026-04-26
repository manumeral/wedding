'use client'

/** Web Push + Notification API helpers (browser only). */

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function getVapidPublicKey(): string {
  return typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() ?? '' : ''
}

export function browserSupportsWebPush(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window
}

const SNOOZE_KEY = 'wedding_push_prompt_snooze_until'

export function getPushSnoozeUntil(): number {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY)
    if (!raw) return 0
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export function isPushPromptSnoozed(): boolean {
  return Date.now() < getPushSnoozeUntil()
}

export function snoozePushPrompt(hours: number): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + hours * 60 * 60 * 1000))
  } catch {
    /* ignore */
  }
}

/**
 * Registers the app service worker and creates a push subscription, then POSTs to /api/push/subscribe.
 * Call when Notification.permission is 'granted', or after requestPermission() returns 'granted'.
 */
export async function registerAndSavePushSubscription(): Promise<void> {
  const vapid = getVapidPublicKey()
  if (!vapid) {
    throw new Error('Push is not configured (missing NEXT_PUBLIC_VAPID_PUBLIC_KEY).')
  }
  if (!browserSupportsWebPush()) {
    throw new Error('This browser does not support web push notifications.')
  }

  if (Notification.permission === 'denied') {
    throw new Error(
      'Notifications are blocked. Use the lock or site settings icon in your browser’s address bar to allow notifications for this site.',
    )
  }

  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') {
      throw new Error('Notification permission was not granted.')
    }
  }

  const reg = await navigator.serviceWorker.register('/sw.js')
  await reg.update()

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid) as unknown as BufferSource,
    })
  }

  const json = sub.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(json),
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j?.error || `Could not save subscription (${res.status})`)
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!browserSupportsWebPush()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}
