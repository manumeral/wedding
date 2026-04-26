'use client'

import { useState, useTransition } from 'react'
import { updateEventLiveStatus } from '@/app/actions/admin'
import { formatEventDateTimeIST } from '@/lib/datetime'
import { Calendar, MapPin, Loader2, Sparkles, XCircle, Check } from 'lucide-react'

interface EventRow {
  id: string
  name: string
  date: string
  location: string
  live_status_message: string | null
  order_index: number
}

const PRESETS = [
  'Starting in 30 minutes',
  'Starting soon — please gather',
  'In progress',
  'Running a bit late',
  'Wrapping up',
  'Ended — thanks for coming!',
]

export function EventStatusCard({ event }: { event: EventRow }) {
  const [message, setMessage] = useState(event.live_status_message ?? '')
  const [saved, setSaved] = useState(event.live_status_message ?? '')
  const [error, setError] = useState<string | null>(null)
  const [okFlash, setOkFlash] = useState(false)
  const [isPending, startTransition] = useTransition()

  const isLive = saved.length > 0
  const dirty = message.trim() !== saved

  const save = (next: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await updateEventLiveStatus(event.id, next)
        setSaved(next.trim())
        setMessage(next.trim())
        setOkFlash(true)
        setTimeout(() => setOkFlash(false), 1500)
      } catch (e: any) {
        setError(e.message ?? 'Failed to update')
      }
    })
  }

  const clear = () => save('')
  const usePreset = (p: string) => save(p)

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-serif text-2xl text-wine-700">{event.name}</h3>
            {isLive && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/15 text-green-700 border border-green-500/30 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-sm text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formatEventDateTimeIST(event.date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {event.location}
            </span>
          </div>
        </div>

        <span className="text-xs uppercase tracking-wider text-stone-400">
          Event #{event.order_index + 1}
        </span>
      </div>

      <div className="space-y-3">
        <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
          Live status message
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blush-400" />
            <input
              type="text"
              value={message}
              maxLength={120}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) save(message)
                if (e.key === 'Escape') setMessage(saved)
              }}
              placeholder="e.g. Starting in 30 minutes"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 focus:border-wine-500 outline-none transition text-sm"
              disabled={isPending}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => save(message)}
              disabled={!dirty || isPending}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-wine-700 text-ivory text-sm font-medium hover:bg-wine-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save
            </button>
            {isLive && (
              <button
                type="button"
                onClick={clear}
                disabled={isPending}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-600 text-sm font-medium hover:border-wine-500 hover:text-wine-700 transition disabled:opacity-40"
              >
                <XCircle className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-xs text-stone-400 self-center mr-1">Quick:</span>
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => usePreset(p)}
              disabled={isPending}
              className="text-xs px-3 py-1.5 rounded-full bg-blush-50 border border-blush-100 text-wine-700 hover:bg-blush-100 hover:border-blush-200 transition disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {okFlash && !error && (
          <p className="text-xs text-green-700 inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Saved &mdash; guests will see this on their next load.
          </p>
        )}
      </div>
    </div>
  )
}
