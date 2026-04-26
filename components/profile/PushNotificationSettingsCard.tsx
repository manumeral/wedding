'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Bell, BellOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getVapidPublicKey,
  browserSupportsWebPush,
  registerAndSavePushSubscription,
  getExistingPushSubscription,
} from '@/lib/push-client'

export function PushNotificationSettingsCard() {
  const vapid = getVapidPublicKey()
  const [loading, setLoading] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [perm, setPerm] = useState<NotificationPermission | 'unknown'>('unknown')
  const [hasSub, setHasSub] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPerm('denied')
      setLoading(false)
      return
    }
    setPerm(Notification.permission)
    try {
      await navigator.serviceWorker.ready
    } catch {
      /* ignore */
    }
    const sub = await getExistingPushSubscription()
    setHasSub(!!sub)
  }, [])

  useEffect(() => {
    void (async () => {
      if (!vapid || !browserSupportsWebPush()) {
        setLoading(false)
        return
      }
      const { data: { user } } = await createClient().auth.getUser()
      setSignedIn(!!user)
      if (user) {
        await refresh()
      }
      setLoading(false)
    })()
  }, [vapid, refresh])

  if (!vapid) {
    return (
      <div className="card p-5 border border-stone-200/80">
        <p className="text-sm text-stone-600">Browser notifications are not configured on this deployment (missing VAPID keys).</p>
      </div>
    )
  }

  if (!browserSupportsWebPush()) {
    return (
      <div className="card p-5 border border-stone-200/80">
        <p className="text-sm text-stone-600">This browser does not support web push. Try the latest Chrome, Edge, or Firefox. Safari on iOS needs the app added to the Home Screen.</p>
      </div>
    )
  }

  if (!signedIn) {
    return null
  }

  if (loading) {
    return (
      <div className="card p-5 border border-blush-100">
        <p className="text-sm text-stone-500">Loading notification settings…</p>
      </div>
    )
  }

  const allGood = perm === 'granted' && hasSub

  return (
    <div className="card p-5 border border-blush-100 space-y-3" id="notifications">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-100 to-blush-100 flex items-center justify-center text-wine-700 shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-serif text-lg text-wine-800">Background notifications</h2>
          <p className="text-sm text-stone-600 mt-0.5">
            Get system alerts (outside this tab) for inbox messages, itinerary updates, and guest request activity, even when the site is in the background.
          </p>
        </div>
      </div>

      {allGood && (
        <div className="flex items-center gap-2 text-sm text-green-800 bg-green-50 border border-green-200/60 rounded-xl px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Enabled on this device. You can still snooze the site in the browser if you do not need alerts.
        </div>
      )}

      {perm === 'denied' && (
        <div className="flex items-start gap-2 text-sm text-amber-900 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Notifications are blocked. Click the site settings or lock icon in the address bar, set Notifications to <strong>Allow</strong>, then return here and enable again.
          </span>
        </div>
      )}

      {perm === 'granted' && !hasSub && (
        <p className="text-sm text-wine-800 bg-wine-50/80 border border-wine-200/40 rounded-xl px-3 py-2">
          Permission is on, but this device is not registered. Complete setup so the server can send pushes to you.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {(!allGood && perm !== 'denied') && (
        <button
          type="button"
          disabled={pending}
          className="btn-primary text-sm"
          onClick={() => {
            setError(null)
            startTransition(async () => {
              try {
                await registerAndSavePushSubscription()
                await refresh()
              } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Something went wrong'
                setError(msg)
              }
            })
          }}
        >
          {pending ? 'Working…' : perm === 'default' ? 'Enable notifications' : 'Register this device for push'}
        </button>
      )}

      {perm === 'denied' && (
        <p className="text-xs text-stone-500 flex items-center gap-1.5">
          <BellOff className="w-3.5 h-3.5" />
          After you change site settings, refresh this page.
        </p>
      )}
    </div>
  )
}
