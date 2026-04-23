'use client'

import { useMemo, useState } from 'react'
import { submitRequest } from '@/app/actions/requests'
import { Car, Plane, GlassWater, HelpCircle, MapPin, CalendarClock, Building2 } from 'lucide-react'

const typeMeta: Record<string, { label: string; icon: typeof Car; color: string }> = {
  cab: { label: 'Cab / Transport', icon: Car, color: 'from-blush-200 to-blush-300' },
  pickup: { label: 'Airport / Railway', icon: Plane, color: 'from-gold-200 to-gold-400' },
  water: { label: 'Water / Refreshments', icon: GlassWater, color: 'from-cyan-100 to-cyan-200' },
  other: { label: 'Something else', icon: HelpCircle, color: 'from-stone-200 to-stone-300' },
}

export function RequestForm({ cabBetaEnabled }: { cabBetaEnabled: boolean }) {
  const visibleTypes = useMemo(() => {
    if (cabBetaEnabled) return typeMeta
    return Object.fromEntries(
      Object.entries(typeMeta).filter(([k]) => k !== 'cab' && k !== 'pickup'),
    ) as typeof typeMeta
  }, [cabBetaEnabled])

  const [type, setType] = useState<string>(() => (cabBetaEnabled ? 'cab' : 'water'))
  const transport = type === 'cab' || type === 'pickup'

  return (
    <section className="card p-8">
      <h2 className="font-serif text-2xl text-wine-700 mb-2">Need something?</h2>
      <p className="text-sm text-stone-600 mb-6">
        {cabBetaEnabled ? (
          <>
            For cabs and station/airport pickups, fill in times and places so we can coordinate without
            back-and-forth.
          </>
        ) : (
          <>
            Transport requests will open when the hosts turn them on. For now you can ask for water,
            refreshments, or anything else.
          </>
        )}
      </p>

      <form action={submitRequest} className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            Type of request
          </label>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(visibleTypes).map(([key, meta]) => {
              const Icon = meta.icon
              return (
                <label
                  key={key}
                  className="group relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-blush-100 hover:border-wine-500 cursor-pointer transition bg-ivory has-[:checked]:border-wine-700 has-[:checked]:bg-blush-50"
                >
                  <input
                    type="radio"
                    name="type"
                    value={key}
                    checked={type === key}
                    onChange={() => setType(key)}
                    className="sr-only peer"
                    required
                  />
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center text-wine-700`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-stone-700 peer-checked:text-wine-700">
                    {meta.label}
                  </span>
                </label>
              )
            })}
          </div>
        </div>

        {transport && type === 'pickup' && (
          <div>
            <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
              Hub type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 p-3 rounded-xl border-2 border-blush-100 has-[:checked]:border-wine-700 has-[:checked]:bg-blush-50 cursor-pointer">
                <input type="radio" name="hub_kind" value="airport" className="text-wine-700" required />
                <Building2 className="w-4 h-4 text-wine-600" />
                <span className="text-sm font-medium">Airport</span>
              </label>
              <label className="flex items-center gap-2 p-3 rounded-xl border-2 border-blush-100 has-[:checked]:border-wine-700 has-[:checked]:bg-blush-50 cursor-pointer">
                <input type="radio" name="hub_kind" value="railway" className="text-wine-700" />
                <MapPin className="w-4 h-4 text-wine-600" />
                <span className="text-sm font-medium">Railway station</span>
              </label>
            </div>
          </div>
        )}

        {transport && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="pickup_at"
                  className="flex items-center gap-1.5 text-xs font-medium text-stone-500 uppercase tracking-wider mb-2"
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  {type === 'cab' ? 'When do you need pickup?' : 'Train / flight arrival time'}
                </label>
                <input
                  id="pickup_at"
                  name="pickup_at"
                  type="datetime-local"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 outline-none text-sm"
                />
              </div>
              <div>
                <label htmlFor="dropoff_at" className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2 block">
                  Drop-off time <span className="font-normal normal-case text-stone-400">(optional)</span>
                </label>
                <input
                  id="dropoff_at"
                  name="dropoff_at"
                  type="datetime-local"
                  className="w-full px-4 py-2.5 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="pickup_location"
                className="flex items-center gap-1.5 text-xs font-medium text-stone-500 uppercase tracking-wider mb-2"
              >
                <MapPin className="w-3.5 h-3.5" />
                {type === 'cab'
                  ? 'Pickup address or landmark'
                  : 'Station / terminal (name, platform if known)'}
              </label>
              <input
                id="pickup_location"
                name="pickup_location"
                type="text"
                required
                placeholder={
                  type === 'cab'
                    ? 'e.g. Chanakya Hotel lobby'
                    : 'e.g. Patna Junction Platform 2, or JPNI Airport arrivals'
                }
                className="w-full px-4 py-2.5 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 outline-none text-sm"
              />
            </div>

            <div>
              <label htmlFor="dropoff_location" className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2 block">
                Drop-off destination
              </label>
              <input
                id="dropoff_location"
                name="dropoff_location"
                type="text"
                required
                placeholder="e.g. Grand Ivory Biscoman Bhavan, or your hotel name"
                className="w-full px-4 py-2.5 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 outline-none text-sm"
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="details" className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
            {transport ? 'Party size, luggage, flight/train number, contact…' : 'What do you need?'}
          </label>
          <textarea
            id="details"
            name="details"
            rows={transport ? 3 : 4}
            className="w-full px-4 py-3 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 focus:border-wine-500 outline-none transition resize-none"
            placeholder={
              transport
                ? 'e.g. 3 adults, 4 bags, IndiGo 6E 1234'
                : 'Describe what would help — we read everything.'
            }
          />
        </div>

        <button type="submit" className="btn-primary w-full">
          Send request
        </button>
      </form>
    </section>
  )
}
