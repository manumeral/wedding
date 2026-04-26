'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getRequestComments,
  addRequestComment,
  type RequestCommentItem,
} from '@/app/actions/requests'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatShortDateTimeChipsIST } from '@/lib/datetime'

type Props = {
  requestId: string
  myUserId: string
  isStaff: boolean
}

export function RequestCommentThread({ requestId, myUserId, isStaff }: Props) {
  const [comments, setComments] = useState<RequestCommentItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getRequestComments(requestId)
      .then((rows) => {
        if (!cancelled) {
          setComments(rows)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setComments([])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [requestId])

  const ready = !loading

  useEffect(() => {
    if (!ready) return
    const supabase = createClient()
    const channel = supabase
      .channel(`request_comments:${requestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'request_comments',
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          void getRequestComments(requestId).then(setComments)
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [requestId, ready])

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setError(null)
    const res = await addRequestComment(requestId, text)
    setSending(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setDraft('')
    const rows = await getRequestComments(requestId)
    setComments(rows)
  }

  return (
    <div className="space-y-3">
      {loading && <p className="text-xs text-stone-400">Loading messages…</p>}

      {!loading && comments && (
        <ul className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <li className="text-xs text-stone-500 italic">No messages yet. Say hi below.</li>
          ) : (
            comments.map((c) => {
              const mine = c.user_id === myUserId
              const who = mine ? 'You' : c.author_name || 'Host'
              return (
                <li
                  key={c.id}
                  className={cn(
                    'text-sm rounded-2xl px-3.5 py-2 max-w-[95%] whitespace-pre-wrap',
                    mine
                      ? 'ml-auto bg-wine-700/10 text-wine-900 border border-wine-200/40'
                      : 'mr-auto bg-cream/90 text-stone-800 border border-blush-100',
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 mb-0.5">
                    {who}
                    <span className="ml-2 font-normal normal-case text-stone-400">
                      {formatShortDateTimeChipsIST(c.created_at)}
                    </span>
                  </p>
                  {c.body}
                </li>
              )
            })
          )}
        </ul>
      )}

      <form onSubmit={onSend} className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <label className="sr-only" htmlFor={`msg-${requestId}`}>
          {isStaff ? 'Message the guest' : 'Message the hosts'}
        </label>
        <textarea
          id={`msg-${requestId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
          rows={2}
          placeholder={isStaff ? 'Reply to the guest…' : 'Add a message for the team…'}
          className="flex-1 rounded-xl border border-blush-200/80 bg-white/90 px-3 py-2 text-sm text-wine-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-gold-300/50 resize-y min-h-[2.5rem]"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-wine-700 text-ivory text-sm font-medium px-4 py-2.5 disabled:opacity-50 hover:bg-wine-800 transition shrink-0"
        >
          <Send className="w-4 h-4" />
          Send
        </button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
