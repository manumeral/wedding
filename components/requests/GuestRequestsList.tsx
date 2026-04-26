'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getMyRequests } from '@/app/actions/requests'
import { RequestCommentThread } from '@/components/requests/RequestCommentThread'
import { formatTransportDetailIST, formatGuestRequestMetaIST } from '@/lib/datetime'
import { Car, Plane, GlassWater, HelpCircle, Clock, CheckCircle2, UserCheck, MapPin } from 'lucide-react'

const typeMeta: Record<string, { label: string; icon: typeof Car; color: string }> = {
  cab: { label: 'Cab / Transport', icon: Car, color: 'from-blush-200 to-blush-300' },
  pickup: { label: 'Airport / Railway', icon: Plane, color: 'from-gold-200 to-gold-400' },
  water: { label: 'Water / Refreshments', icon: GlassWater, color: 'from-cyan-100 to-cyan-200' },
  other: { label: 'Something else', icon: HelpCircle, color: 'from-stone-200 to-stone-300' },
}

const statusMeta: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', className: 'bg-gold-100 text-gold-500 border-gold-200', icon: Clock },
  claimed: { label: 'On it!', className: 'bg-blush-100 text-wine-700 border-blush-200', icon: UserCheck },
  resolved: { label: 'Done', className: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
}

export function GuestRequestsList({ initialRows, myUserId }: { initialRows: any[]; myUserId: string }) {
  const [rows, setRows] = useState<any[]>(initialRows)

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])
  const sync = useCallback(() => {
    void getMyRequests()
      .then((data) => setRows(data || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const chRef: { current: ReturnType<typeof supabase.channel> | null } = { current: null }
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      chRef.current = supabase
        .channel(`guest-requests-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'requests', filter: `user_id=eq.${user.id}` },
          () => {
            void sync()
          },
        )
        .subscribe()
    })
    return () => {
      if (chRef.current) void supabase.removeChannel(chRef.current)
    }
  }, [sync])

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-stone-500">
        <HelpCircle className="w-10 h-10 mx-auto text-blush-300 mb-3" />
        <p className="italic">Nothing yet &mdash; submit your first request above.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((req: any) => {
        const meta = typeMeta[req.type] ?? typeMeta.other
        const status = statusMeta[req.status] ?? statusMeta.pending
        const Icon = meta.icon
        const StatusIcon = status.icon
        return (
          <div key={req.id} className="card p-5">
            <div className="flex items-start gap-4">
              <div
                className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-wine-700`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-serif text-lg text-wine-700">{meta.label}</p>
                  <span
                    className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${status.className}`}
                  >
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
                          {formatTransportDetailIST(req.pickup_at)}
                        </li>
                      )}
                      {req.pickup_location && (
                        <li className="flex gap-1">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>From: {req.pickup_location}</span>
                        </li>
                      )}
                      {req.dropoff_location && <li>To: {req.dropoff_location}</li>}
                      {req.dropoff_at && (
                        <li>
                          Drop-off by:{' '}
                          {formatTransportDetailIST(req.dropoff_at)}
                        </li>
                      )}
                    </ul>
                  )}
                {req.details && <p className="text-sm text-stone-600 mt-2 line-clamp-3">{req.details}</p>}
                <p className="text-xs text-stone-400 mt-2">
                  {formatGuestRequestMetaIST(req.created_at)}
                </p>
                <p className="text-xs font-medium text-wine-600 mt-4 mb-0">Message thread</p>
                <div className="mt-1.5 pl-0 border-t border-blush-100/80 pt-3">
                  <RequestCommentThread requestId={req.id} myUserId={myUserId} isStaff={false} />
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
