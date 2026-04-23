import { submitRequest, getMyRequests } from '@/app/actions/requests'
import { getUserProfile } from '@/app/actions/user'
import { isStaffLevel } from '@/lib/auth/roles'
import { Navbar } from '@/components/Navbar'
import { Car, Plane, GlassWater, HelpCircle, Clock, CheckCircle2, UserCheck } from 'lucide-react'
import Image from 'next/image'

const typeMeta: Record<string, { label: string; icon: any; color: string }> = {
  cab: { label: 'Cab / Transport', icon: Car, color: 'from-blush-200 to-blush-300' },
  pickup: { label: 'Airport / Station', icon: Plane, color: 'from-gold-200 to-gold-400' },
  water: { label: 'Water / Refreshments', icon: GlassWater, color: 'from-cyan-100 to-cyan-200' },
  other: { label: 'Something else', icon: HelpCircle, color: 'from-stone-200 to-stone-300' },
}

const statusMeta: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: 'Pending', className: 'bg-gold-100 text-gold-500 border-gold-200', icon: Clock },
  claimed: { label: 'On it!', className: 'bg-blush-100 text-wine-700 border-blush-200', icon: UserCheck },
  resolved: { label: 'Done', className: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
}

export default async function RequestsPage() {
  const [requests, profile] = await Promise.all([getMyRequests(), getUserProfile()])

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin={isStaffLevel(profile?.admin_level)} user={profile ? { name: profile.full_name, avatarUrl: profile.avatar_url } : null} />

      {/* Hero strip */}
      <section className="relative pt-32 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blush-100 via-cream to-gold-100" />
        <div className="absolute inset-0 opacity-10">
          <Image src="/images/haldi.png" alt="" fill className="object-contain object-right" />
        </div>
        <div className="container-page relative text-center">
          <p className="section-sub">we&apos;re here for you</p>
          <h1 className="section-title">Request Help</h1>
          <p className="text-stone-600 max-w-xl mx-auto mt-3">
            Cab pickup, extra water bottles, station help &mdash; whatever you need,
            just let us know and someone from the family will be on it right away.
          </p>
        </div>
      </section>

      <div className="container-page max-w-2xl mt-10 space-y-10">
        {/* New request form */}
        <section className="card p-8">
          <h2 className="font-serif text-2xl text-wine-700 mb-6">Need something?</h2>
          <form action={submitRequest} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                Type of request
              </label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(typeMeta).map(([key, meta]) => {
                  const Icon = meta.icon
                  return (
                    <label
                      key={key}
                      className="group relative flex items-center gap-3 p-3.5 rounded-xl border-2 border-blush-100 hover:border-wine-500 cursor-pointer transition bg-ivory has-[:checked]:border-wine-700 has-[:checked]:bg-blush-50"
                    >
                      <input type="radio" name="type" value={key} defaultChecked={key === 'cab'} className="sr-only peer" required />
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center text-wine-700`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-stone-700 peer-checked:text-wine-700">{meta.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <label htmlFor="details" className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">
                Additional details
              </label>
              <textarea
                id="details"
                name="details"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 focus:border-wine-500 outline-none transition resize-none"
                placeholder="E.g., I'm at Patna Junction platform 1, family of 4, arriving at 3pm."
              />
            </div>

            <button type="submit" className="btn-primary w-full">
              Send Request
            </button>
          </form>
        </section>

        {/* History */}
        <section>
          <h2 className="font-serif text-2xl text-wine-700 mb-4">Your recent requests</h2>
          {requests.length === 0 ? (
            <div className="card p-8 text-center text-stone-500">
              <HelpCircle className="w-10 h-10 mx-auto text-blush-300 mb-3" />
              <p className="italic">Nothing yet &mdash; submit your first request above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req: any) => {
                const meta = typeMeta[req.type] ?? typeMeta.other
                const status = statusMeta[req.status] ?? statusMeta.pending
                const Icon = meta.icon
                const StatusIcon = status.icon
                return (
                  <div key={req.id} className="card p-5 flex items-start gap-4">
                    <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-wine-700`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-serif text-lg text-wine-700">{meta.label}</p>
                        <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${status.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>
                      {req.details && (
                        <p className="text-sm text-stone-600 mt-1 line-clamp-2">{req.details}</p>
                      )}
                      <p className="text-xs text-stone-400 mt-2">
                        {new Date(req.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
