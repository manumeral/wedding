'use client'

import { useState, useTransition } from 'react'
import { setCabRequestsBeta } from '@/app/actions/super-admin'
import { Car } from 'lucide-react'

export function CabBetaToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [on, setOn] = useState(initialEnabled)
  const [pending, startTransition] = useTransition()

  return (
    <div className="card p-5 border border-gold-200/80 bg-gradient-to-br from-gold-50/80 to-ivory">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center text-wine-700 shrink-0">
          <Car className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-wine-800">Cab &amp; airport / railway requests</p>
          <p className="text-sm text-stone-600 mt-1">
            When off, guests only see water and general requests. Turn on when you are ready to collect
            transport details.
          </p>
          <label className="mt-3 inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-blush-300 text-wine-700 focus:ring-wine-500"
              checked={on}
              disabled={pending}
              onChange={() => {
                const next = !on
                setOn(next)
                startTransition(async () => {
                  try {
                    await setCabRequestsBeta(next)
                  } catch (e: any) {
                    setOn(!next)
                    alert(e?.message ?? 'Could not update setting.')
                  }
                })
              }}
            />
            <span className="text-sm font-medium text-stone-700">
              {on ? 'Open for guests' : 'Closed (hidden from request form)'}
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
