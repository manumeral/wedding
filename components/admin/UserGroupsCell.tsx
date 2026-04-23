'use client'

import { useState, useTransition, useEffect } from 'react'
import { setUserGroups } from '@/app/actions/groups'
import { ChevronDown, Loader2 } from 'lucide-react'
import Link from 'next/link'

type Group = { id: string; name: string }

export function UserGroupsCell({
  userId,
  allGroups,
  initialGroupIds,
}: {
  userId: string
  allGroups: Group[]
  initialGroupIds: string[]
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialGroupIds))
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelected(new Set(initialGroupIds))
  }, [initialGroupIds.join('|')])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      try {
        await setUserGroups(userId, Array.from(selected))
        setOpen(false)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to save groups')
      }
    })
  }

  if (allGroups.length === 0) {
    return (
      <td className="px-6 py-4 text-sm text-stone-400">
        <Link href="/admin/groups" className="text-wine-600 hover:underline">
          Create groups
        </Link>
      </td>
    )
  }

  const summary =
    allGroups
      .filter((g) => selected.has(g.id))
      .map((g) => g.name)
      .join(', ') || '—'

  return (
    <td className="px-6 py-4 align-top">
      <div className="relative max-w-[14rem]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm text-wine-800 hover:border-wine-300"
        >
          <span className="line-clamp-2">{summary}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <div className="absolute z-30 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-blush-100 bg-white p-3 shadow-soft">
            <p className="text-xs text-stone-500 mb-2">Select labels for this guest</p>
            <ul className="max-h-40 overflow-y-auto space-y-1.5 mb-3">
              {allGroups.map((g) => (
                <li key={g.id}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-wine-800">
                    <input
                      type="checkbox"
                      className="rounded border-stone-300 text-wine-700"
                      checked={selected.has(g.id)}
                      onChange={() => toggle(g.id)}
                      disabled={pending}
                    />
                    {g.name}
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  setSelected(new Set(initialGroupIds))
                  setError(null)
                }}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 rounded-lg"
                disabled={pending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-wine-700 text-ivory hover:bg-wine-800 disabled:opacity-50"
              >
                {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
        )}
      </div>
    </td>
  )
}
