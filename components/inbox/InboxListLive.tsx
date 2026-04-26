'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listMyInbox, markManyInboxRead, type InboxListItem } from '@/app/actions/broadcasts'
import { formatShortDateTimeChipsIST } from '@/lib/datetime'
import { Mail } from 'lucide-react'

export function InboxListLive({ initialItems }: { initialItems: InboxListItem[] }) {
  const [items, setItems] = useState<InboxListItem[]>(initialItems)

  const refresh = useCallback(() => {
    void listMyInbox()
      .then(setItems)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const chRef: { current: ReturnType<typeof supabase.channel> | null } = { current: null }
    void supabase.auth.getUser().then(({ data: { user } }): void => {
      if (!user) return
      chRef.current = supabase
        .channel(`inbox-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_inbox', filter: `user_id=eq.${user.id}` },
          () => {
            void refresh()
          },
        )
        .subscribe()
    })
    return () => {
      if (chRef.current) void supabase.removeChannel(chRef.current)
    }
  }, [refresh])

  useEffect(() => {
    const toMark = items.filter((i) => !i.read_at).map((i) => i.id)
    if (toMark.length === 0) return
    void markManyInboxRead(toMark)
      .then(() => void listMyInbox().then(setItems))
      .catch(() => {})
  }, [items])

  if (items.length === 0) {
    return (
      <div className="card p-12 text-center text-stone-500">
        <Mail className="w-12 h-12 mx-auto text-blush-300 mb-3" />
        <p>No messages yet.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {items.map((row) => {
        const b = row.broadcasts
        if (!b) return null
        const unread = !row.read_at
        return (
          <li
            key={row.id}
            className={`card p-6 border-l-4 ${unread ? 'border-l-gold-400 bg-cream/40' : 'border-l-transparent'}`}
          >
            <p className="text-xs text-stone-500 mb-1">
              {formatShortDateTimeChipsIST(b.created_at)}
              {b.audience === 'staff' && (
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Team</span>
              )}
              {b.targets_all_guests && b.audience !== 'staff' && (
                <span className="ml-2 rounded-full bg-blush-100 px-2 py-0.5 text-wine-700">All guests</span>
              )}
            </p>
            <h2 className="font-serif text-xl text-wine-800 mb-2">{b.title}</h2>
            <p className="text-stone-700 whitespace-pre-wrap">{b.body}</p>
          </li>
        )
      })}
    </ul>
  )
}
