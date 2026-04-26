'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAllRequests, updateRequestStatus } from '@/app/actions/requests'
import { MessageCircle, Clock, UserCheck, CheckCircle2, Car, Plane, GlassWater, HelpCircle, Inbox, MapPin } from 'lucide-react'
import { RequestCommentThread } from '@/components/requests/RequestCommentThread'
import { DeleteRequestButton } from '@/components/admin/DeleteRequestButton'
import {
  formatRequestCreatedTimeIST,
  formatRequestCreatedDateLineIST,
  formatTransportDetailIST,
} from '@/lib/datetime'

const typeIcon: Record<string, any> = { cab: Car, pickup: Plane, water: GlassWater, other: HelpCircle }
const statusStyle: Record<string, string> = {
  pending: 'bg-gold-100 text-gold-500 border-gold-200',
  claimed: 'bg-blush-100 text-wine-700 border-blush-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
}

export function AdminRequestsPanel({
  initialRequests,
  myUserId,
}: {
  initialRequests: any[]
  myUserId: string
}) {
  const [requests, setRequests] = useState(initialRequests)
  const [expandComments, setExpandComments] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setRequests(initialRequests)
  }, [initialRequests])
  const sync = useCallback(() => {
    void getAllRequests()
      .then((data) => setRequests(data as any[]))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-requests-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests' }, () => {
        void sync()
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [sync])

  const pending = requests.filter((r: any) => r.status === 'pending').length
  const claimed = requests.filter((r: any) => r.status === 'claimed').length
  const resolved = requests.filter((r: any) => r.status === 'resolved').length

  return (
    <>
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={Clock} label="Pending" value={pending} tint="from-gold-100 to-gold-200" text="text-gold-500" />
        <StatCard
          icon={UserCheck}
          label="In Progress"
          value={claimed}
          tint="from-blush-100 to-blush-200"
          text="text-wine-700"
        />
        <StatCard
          icon={CheckCircle2}
          label="Resolved"
          value={resolved}
          tint="from-green-100 to-green-200"
          text="text-green-700"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-blush-100 flex items-center justify-between">
          <h2 className="font-serif text-xl text-wine-700">Guest requests</h2>
          <p className="text-sm text-stone-500">{requests.length} total</p>
        </div>

        {requests.length === 0 ? (
          <div className="p-14 text-center text-stone-500">
            <Inbox className="w-12 h-12 mx-auto text-blush-300 mb-3" />
            <p>No requests yet. You&apos;ll see guest pings here the moment they come in.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-cream text-stone-500 uppercase text-xs tracking-wider">
                  <th className="px-6 py-3 font-medium">Time</th>
                  <th className="px-6 py-3 font-medium">Guest</th>
                  <th className="px-6 py-3 font-medium">Room</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Details</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium w-[1%] whitespace-nowrap">Messages</th>
                  <th className="px-6 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blush-100">
                {requests.map((req: any) => {
                  const Icon = typeIcon[req.type] ?? HelpCircle
                  const isCommentOpen = expandComments[req.id] ?? false
                  return (
                    <Fragment key={req.id}>
                      <tr className="hover:bg-ivory transition align-top">
                        <td className="px-6 py-4 text-stone-500 whitespace-nowrap">
                          {formatRequestCreatedTimeIST(req.created_at)}
                          <div className="text-xs text-stone-400">
                            {formatRequestCreatedDateLineIST(req.created_at)}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-wine-700">{req.users?.full_name || '—'}</td>
                        <td className="px-6 py-4">
                          {req.users?.room_number ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blush-50 text-wine-700 text-xs font-mono font-medium">
                              {req.users.room_number}
                            </span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-2 text-stone-700">
                            <Icon className="w-4 h-4 text-blush-400" />
                            <span className="capitalize">{req.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-md">
                          {(req.type === 'cab' || req.type === 'pickup') &&
                          (req.pickup_at || req.pickup_location || req.dropoff_location) ? (
                            <div className="text-xs text-stone-600 space-y-1.5">
                              {req.hub_kind && (
                                <p className="font-semibold text-wine-700">
                                  {req.hub_kind === 'airport' ? 'Airport' : 'Railway'}
                                </p>
                              )}
                              {req.pickup_at && (
                                <p>
                                  <span className="text-stone-400">{req.type === 'cab' ? 'Pickup' : 'Arrival'}: </span>
                                  {formatTransportDetailIST(req.pickup_at)}
                                </p>
                              )}
                              {req.pickup_location && (
                                <p className="flex gap-1 items-start">
                                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span>From: {req.pickup_location}</span>
                                </p>
                              )}
                              {req.dropoff_location && <p>To: {req.dropoff_location}</p>}
                              {req.dropoff_at && (
                                <p>
                                  <span className="text-stone-400">Drop-off: </span>
                                  {formatTransportDetailIST(req.dropoff_at)}
                                </p>
                              )}
                              {req.details && (
                                <p className="text-stone-500 pt-1 mt-1 border-t border-blush-100">{req.details}</p>
                              )}
                            </div>
                          ) : (
                            <p className="truncate text-stone-600" title={req.details}>
                              {req.details || '—'}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${statusStyle[req.status]}`}
                          >
                            {req.status === 'claimed' ? 'On it' : req.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandComments((m) => ({ ...m, [req.id]: !isCommentOpen }))
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-wine-50 border border-wine-200 text-wine-800 hover:bg-wine-100 transition"
                          >
                            <MessageCircle className="w-4 h-4 shrink-0" aria-hidden />
                            {isCommentOpen ? 'Close thread' : 'Open thread'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            {req.status === 'pending' && (
                              <form action={updateRequestStatus.bind(null, req.id, 'claimed')} className="inline">
                                <button
                                  type="submit"
                                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-wine-700 text-ivory hover:bg-wine-800 transition"
                                >
                                  Claim
                                </button>
                              </form>
                            )}
                            {req.status === 'claimed' && (
                              <form action={updateRequestStatus.bind(null, req.id, 'resolved')} className="inline">
                                <button
                                  type="submit"
                                  className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition"
                                >
                                  Resolve
                                </button>
                              </form>
                            )}
                            <DeleteRequestButton requestId={req.id} />
                          </div>
                        </td>
                      </tr>
                      {isCommentOpen && (
                        <tr>
                          <td colSpan={8} className="px-6 py-3 bg-ivory/50 border-b border-blush-100">
                            <RequestCommentThread
                              requestId={req.id}
                              myUserId={myUserId}
                              isStaff
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

function StatCard({ icon: Icon, label, value, tint, text }: any) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tint} flex items-center justify-center ${text}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
        <p className="font-serif text-3xl text-wine-700">{value}</p>
      </div>
    </div>
  )
}
