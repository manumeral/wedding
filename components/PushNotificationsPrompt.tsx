'use client'

import { useEffect, useState, useTransition, useCallback } from 'react'
import { Bell, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  getVapidPublicKey,
  browserSupportsWebPush,
  isPushPromptSnoozed,
  snoozePushPrompt,
  registerAndSavePushSubscription,
  getExistingPushSubscription,
} from '@/lib/push-client'

const VAPID_PUBLIC = getVapidPublicKey()

type PromptMode = 'off' | 'ask-permission' | 'complete-setup'

/**
 * Shown to signed-in users when we can use Web Push. Handles:
 * - permission still "default" — can snooze 72h
 * - permission "granted" but no push subscription (finish saving device to server)
 * Hidden when fully subscribed, unsupported, or no VAPID in build.
 */
export function PushNotificationsPrompt() {
  const [mode, setMode] = useState<PromptMode>('off')
  const [pending, startTransition] = useTransition()

  const detectMode = useCallback(async () => {
    if (!VAPID_PUBLIC || !browserSupportsWebPush()) {
      setMode('off')
      return
    }

    const {
      data: { session },
    } = await createClient().auth.getSession()
    if (!session) {
      setMode('off')
      return
    }

    if (Notification.permission === 'denied') {
      setMode('off')
      return
    }

    // Wait for service worker to be available so we can read subscription
    try {
      await navigator.serviceWorker.ready
    } catch {
      /* ignore */
    }

    const sub = await getExistingPushSubscription()
    if (sub) {
      setMode('off')
      return
    }

    if (Notification.permission === 'default') {
      if (isPushPromptSnoozed()) {
        setMode('off')
        return
      }
      setMode('ask-permission')
      return
    }

    if (Notification.permission === 'granted') {
      try {
        if (sessionStorage.getItem('push_setup_dismissed') === '1') {
          setMode('off')
          return
        }
      } catch {
        /* ignore */
      }
      setMode('complete-setup')
    }
  }, [])

  useEffect(() => {
    void detectMode()
    const id = setInterval(() => {
      void detectMode()
    }, 45_000)
    return () => clearInterval(id)
  }, [detectMode])

  if (!VAPID_PUBLIC || mode === 'off') return null

  const title = mode === 'complete-setup' ? 'Finish push setup' : 'Get live updates'
  const copy =
    mode === 'complete-setup'
      ? 'Notifications are allowed, but this device is not registered for push yet. Complete setup to receive system alerts when you use another tab or app.'
      : 'Allow browser notifications for itinerary changes, inbox messages, and request updates. They can appear in the background when you are on another site.'

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] max-w-md mx-auto sm:left-auto sm:right-6 sm:mx-0">
      <div className="card shadow-soft-lg border border-blush-200 p-4 flex gap-3 items-start">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-100 to-blush-100 flex items-center justify-center text-wine-700 shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-wine-800 text-sm">{title}</p>
          <p className="text-xs text-stone-600 mt-1">{copy}</p>
          <p className="text-[11px] text-stone-500 mt-1.5">
            iPhone/iPad: add this site to the Home Screen first; Apple only enables web push for add-to-Home web apps. macOS/Windows: check System Settings if alerts still do not show.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              disabled={pending}
              className="btn-primary text-xs py-2 px-3"
              onClick={() => {
                startTransition(async () => {
                  try {
                    await registerAndSavePushSubscription()
                    setMode('off')
                  } catch (e: unknown) {
                    console.error(e)
                    const msg = e instanceof Error ? e.message : 'Could not enable notifications.'
                    alert(msg)
                  }
                })
              }}
            >
              {pending ? 'Working…' : mode === 'complete-setup' ? 'Complete setup' : 'Enable'}
            </button>
            <button
              type="button"
              className="text-xs text-stone-500 hover:text-wine-800 py-2 px-2"
              onClick={() => {
                if (mode === 'ask-permission') {
                  snoozePushPrompt(72)
                } else {
                  try {
                    sessionStorage.setItem('push_setup_dismissed', '1')
                  } catch {
                    /* ignore */
                  }
                }
                setMode('off')
              }}
            >
              {mode === 'ask-permission' ? 'Not now' : 'Maybe later'}
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="p-1 rounded-lg text-stone-400 hover:text-wine-800 hover:bg-blush-50"
          onClick={() => {
            if (mode === 'ask-permission') {
              snoozePushPrompt(72)
            } else {
              try {
                sessionStorage.setItem('push_setup_dismissed', '1')
              } catch {
                /* ignore */
              }
            }
            setMode('off')
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
