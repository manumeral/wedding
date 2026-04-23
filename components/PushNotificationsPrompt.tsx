'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export function PushNotificationsPrompt() {
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!VAPID_PUBLIC || typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      if (Notification.permission !== 'default') return
      try {
        if (sessionStorage.getItem('push_prompt_dismissed') === '1') return
      } catch {
        /* ignore */
      }
      setShow(true)
    })
  }, [])

  if (!VAPID_PUBLIC || !show || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] max-w-md mx-auto sm:left-auto sm:right-6 sm:mx-0">
      <div className="card shadow-soft-lg border border-blush-200 p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-100 to-blush-100 flex items-center justify-center text-wine-700 shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-wine-800 text-sm">Get live updates</p>
          <p className="text-xs text-stone-600 mt-1">
            Allow notifications for day-of itinerary changes and messages from the hosts.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              disabled={pending}
              className="btn-primary text-xs py-2 px-3"
              onClick={() => {
                startTransition(async () => {
                  try {
                    const perm = await Notification.requestPermission()
                    if (perm !== 'granted') {
                      setDismissed(true)
                      return
                    }
                    const reg = await navigator.serviceWorker.register('/sw.js')
                    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC)
                    const sub = await reg.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: applicationServerKey as unknown as BufferSource,
                    })
                    const json = sub.toJSON()
                    const res = await fetch('/api/push/subscribe', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify(json),
                    })
                    if (!res.ok) {
                      const j = await res.json().catch(() => ({}))
                      throw new Error(j?.error || `Subscribe failed (${res.status})`)
                    }
                  } catch (e: any) {
                    console.error(e)
                    alert(e?.message ?? 'Could not enable notifications.')
                  } finally {
                    setDismissed(true)
                    setShow(false)
                  }
                })
              }}
            >
              {pending ? 'Working…' : 'Enable'}
            </button>
            <button
              type="button"
              className="text-xs text-stone-500 hover:text-wine-800 py-2 px-2"
              onClick={() => {
                try {
                  sessionStorage.setItem('push_prompt_dismissed', '1')
                } catch {
                  /* ignore */
                }
                setDismissed(true)
                setShow(false)
              }}
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="p-1 rounded-lg text-stone-400 hover:text-wine-800 hover:bg-blush-50"
          onClick={() => {
            try {
              sessionStorage.setItem('push_prompt_dismissed', '1')
            } catch {
              /* ignore */
            }
            setDismissed(true)
            setShow(false)
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
