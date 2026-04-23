'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createGroup, deleteGroup } from '@/app/actions/groups'
import type { GuestGroup } from '@/app/actions/groups'
import { Loader2, Plus, Trash2 } from 'lucide-react'

export function GroupsAdminPanel({ initialGroups }: { initialGroups: GuestGroup[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      try {
        await createGroup(name, slug.trim() || undefined)
        setName('')
        setSlug('')
        router.refresh()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to create group')
      }
    })
  }

  const onDelete = (id: string) => {
    if (!confirm('Delete this group? Members lose this label; past broadcasts are unchanged.')) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteGroup(id)
        router.refresh()
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete')
      }
    })
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onCreate} className="card p-6 md:p-8 max-w-xl space-y-4">
        <h2 className="font-serif text-lg text-wine-700">New group</h2>
        <div>
          <label htmlFor="g-name" className="block text-sm font-medium text-wine-800 mb-1">
            Display name
          </label>
          <input
            id="g-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-stone-200 px-4 py-2 text-wine-900 focus:outline-none focus:ring-2 focus:ring-wine-500"
            placeholder="e.g. Bride family"
            disabled={pending}
          />
        </div>
        <div>
          <label htmlFor="g-slug" className="block text-sm font-medium text-wine-800 mb-1">
            URL slug (optional)
          </label>
          <input
            id="g-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded-lg border border-stone-200 px-4 py-2 text-wine-900 focus:outline-none focus:ring-2 focus:ring-wine-500 font-mono text-sm"
            placeholder="auto from name if empty"
            disabled={pending}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-full bg-wine-700 text-ivory px-5 py-2.5 text-sm font-medium hover:bg-wine-800 disabled:opacity-50"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add group
        </button>
      </form>

      <div className="card overflow-hidden max-w-xl">
        <div className="px-6 py-4 border-b border-blush-100">
          <h2 className="font-serif text-lg text-wine-700">Existing groups</h2>
        </div>
        {initialGroups.length === 0 ? (
          <p className="p-8 text-sm text-stone-500">No groups yet. Add one above.</p>
        ) : (
          <ul className="divide-y divide-blush-100">
            {initialGroups.map((g) => (
              <li key={g.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-wine-800">{g.name}</p>
                  <p className="text-xs text-stone-500 font-mono">{g.slug}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(g.id)}
                  disabled={pending}
                  className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label={`Delete ${g.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
