'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateUserGuestDetails } from '@/app/actions/admin'
import { UserCircle, Loader2, X } from 'lucide-react'

type User = {
  id: string
  full_name: string | null
  email: string
  bio?: string | null
  avatar_url?: string | null
}

export function GuestProfileOverride({ user }: { user: User }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [fullName, setFullName] = useState(user.full_name ?? '')
  const [bio, setBio] = useState(user.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url ?? '')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const openModal = () => {
    setFullName(user.full_name ?? '')
    setBio(user.bio ?? '')
    setAvatarUrl(user.avatar_url ?? '')
    setError(null)
    setOpen(true)
  }

  const save = () => {
    setError(null)
    startTransition(async () => {
      try {
        await updateUserGuestDetails(user.id, {
          fullName,
          bio: bio.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
        })
        setOpen(false)
        router.refresh()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not save')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-wine-600 hover:text-wine-800 hover:underline"
      >
        <UserCircle className="w-3.5 h-3.5" aria-hidden />
        Edit guest profile
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div
            className="absolute inset-0"
            aria-hidden
            onClick={() => !pending && setOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl bg-ivory shadow-soft-lg border border-blush-100 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <h3 className="font-serif text-lg text-wine-800">Guest directory profile</h3>
                <p className="text-xs text-stone-500 mt-0.5">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:bg-stone-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm"
                  maxLength={60}
                  disabled={pending}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Bio / description</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 text-sm resize-none"
                  disabled={pending}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Avatar image URL</label>
                <input
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full px-3 py-2 rounded-lg border border-stone-200 font-mono text-xs"
                  disabled={pending}
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Paste a public image URL (e.g. from storage). Guests normally upload from their own device.
                </p>
              </div>
            </div>

            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-wine-700 text-ivory hover:bg-wine-800 disabled:opacity-50"
              >
                {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
