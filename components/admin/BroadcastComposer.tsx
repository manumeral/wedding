'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendBroadcast } from '@/app/actions/broadcasts'
import { Loader2, Send } from 'lucide-react'

type Group = { id: string; name: string }

export function BroadcastComposer({ groups }: { groups: Group[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [allGuests, setAllGuests] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  const toggleGroup = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (!allGuests && selected.size === 0) {
      setMessage('Choose at least one group, or check “All guests”.')
      return
    }
    startTransition(async () => {
      try {
        await sendBroadcast({
          title,
          body,
          targetsAllGuests: allGuests,
          groupIds: Array.from(selected),
        })
        setTitle('')
        setBody('')
        setAllGuests(false)
        setSelected(new Set())
        setMessage('Broadcast sent.')
        router.refresh()
      } catch (err: unknown) {
        setMessage(err instanceof Error ? err.message : 'Something went wrong')
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 md:p-8 space-y-6 max-w-2xl">
      <div>
        <label htmlFor="bc-title" className="block text-sm font-medium text-wine-800 mb-1.5">
          Title
        </label>
        <input
          id="bc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-wine-900 focus:outline-none focus:ring-2 focus:ring-wine-500"
          placeholder="e.g. Shuttle update"
          disabled={pending}
        />
      </div>
      <div>
        <label htmlFor="bc-body" className="block text-sm font-medium text-wine-800 mb-1.5">
          Message
        </label>
        <textarea
          id="bc-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          rows={6}
          className="w-full rounded-lg border border-stone-200 px-4 py-2.5 text-wine-900 focus:outline-none focus:ring-2 focus:ring-wine-500 resize-y min-h-[8rem]"
          placeholder="What guests should know…"
          disabled={pending}
        />
      </div>

      <div className="rounded-xl border border-blush-100 bg-cream/50 p-4 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-wine-800">
          <input
            type="checkbox"
            checked={allGuests}
            onChange={(e) => setAllGuests(e.target.checked)}
            disabled={pending}
            className="rounded border-stone-300 text-wine-700"
          />
          All guests (everyone with guest access)
        </label>
        {!allGuests && (
          <div>
            <p className="text-xs text-stone-500 mb-2">Send to everyone in any of these groups:</p>
            {groups.length === 0 ? (
              <p className="text-sm text-stone-500">
                Create groups first on the{' '}
                <a href="/admin/groups" className="text-wine-700 underline">
                  Groups
                </a>{' '}
                tab.
              </p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto">
                {groups.map((g) => (
                  <li key={g.id}>
                    <label className="flex items-center gap-2 text-sm text-wine-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(g.id)}
                        onChange={() => toggleGroup(g.id)}
                        disabled={pending}
                        className="rounded border-stone-300 text-wine-700"
                      />
                      {g.name}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {message && (
        <p
          className={`text-sm ${message.startsWith('Broadcast sent') ? 'text-green-700' : 'text-red-600'}`}
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || (!allGuests && groups.length === 0)}
        className="inline-flex items-center gap-2 rounded-full bg-wine-700 text-ivory px-6 py-3 text-sm font-medium hover:bg-wine-800 disabled:opacity-50"
      >
        {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Send broadcast
      </button>
    </form>
  )
}
