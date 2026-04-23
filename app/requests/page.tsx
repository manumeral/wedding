import { getMyRequests } from '@/app/actions/requests'
import { getUserProfile } from '@/app/actions/user'
import { isStaffLevel } from '@/lib/auth/roles'
import { isCabRequestsBetaEnabled } from '@/lib/cab-beta'
import { Navbar } from '@/components/Navbar'
import { RequestForm } from '@/components/requests/RequestForm'
import { Car, Plane, GlassWater, HelpCircle, Clock, CheckCircle2, UserCheck, MapPin } from 'lucide-react'
import Image from 'next/image'

const typeMeta: Record<string, { label: string; icon: any; color: string }> = {
  cab: { label: 'Cab / Transport', icon: Car, color: 'from-blush-200 to-blush-300' },
  pickup: { label: 'Airport / Railway', icon: Plane, color: 'from-gold-200 to-gold-400' },
  water: { label: 'Water / Refreshments', icon: GlassWater, color: 'from-cyan-100 to-cyan-200' },
  other: { label: 'Something else', icon: HelpCircle, color: 'from-stone-200 to-stone-300' },
}

const statusMeta: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: 'Pending', className: 'bg-gold-100 text-gold-500 border-gold-200', icon: Clock },
  claimed: { label: 'On it!', className: 'bg-blush-100 text-wine-700 border-blush-200', icon: UserCheck },
  resolved: { label: 'Done', className: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
}

export default async function RequestsPage() {
  const [requests, profile, cabBeta] = await Promise.all([
    getMyRequests(),
    getUserProfile(),
    isCabRequestsBetaEnabled(),
  ])

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
        <RequestForm cabBetaEnabled={cabBeta} />

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
                      {(req.type === 'cab' || req.type === 'pickup') &&
                        (req.pickup_at || req.pickup_location || req.dropoff_location) && (
                          <ul className="text-xs text-stone-600 mt-2 space-y-1 border-l-2 border-gold-300/80 pl-3">
                            {req.hub_kind && (
                              <li className="font-medium text-wine-700">
                                {req.hub_kind === 'airport' ? 'Airport' : 'Railway station'}
                              </li>
                            )}
                            {req.pickup_at && (
                              <li>
                                {req.type === 'cab' ? 'Pickup' : 'Arrival'}:{' '}
                                {new Date(req.pickup_at).toLocaleString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </li>
                            )}
                            {req.pickup_location && (
                              <li className="flex gap-1">
                                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                <span>From: {req.pickup_location}</span>
                              </li>
                            )}
                            {req.dropoff_location && (
                              <li>To: {req.dropoff_location}</li>
                            )}
                            {req.dropoff_at && (
                              <li>
                                Drop-off by:{' '}
                                {new Date(req.dropoff_at).toLocaleString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </li>
                            )}
                          </ul>
                        )}
                      {req.details && (
                        <p className="text-sm text-stone-600 mt-2 line-clamp-3">{req.details}</p>
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
