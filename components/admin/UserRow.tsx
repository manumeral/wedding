'use client'

import { useState, useTransition } from 'react'
import { updateUserRoom, toggleUserAdmin } from '@/app/actions/admin'
import { Check, X, Loader2, Pencil, Shield, ShieldCheck } from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string | null
  room_number: string | null
  is_admin: boolean
  created_at: string
}

interface Props {
  user: User
  currentUserId: string
}

export function UserRow({ user, currentUserId }: Props) {
  const [editing, setEditing] = useState(false)
  const [roomValue, setRoomValue] = useState(user.room_number ?? '')
  const [optimisticRoom, setOptimisticRoom] = useState(user.room_number)
  const [optimisticAdmin, setOptimisticAdmin] = useState(user.is_admin)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const saveRoom = () => {
    const trimmed = roomValue.trim()
    setError(null)
    startTransition(async () => {
      try {
        await updateUserRoom(user.id, trimmed)
        setOptimisticRoom(trimmed || null)
        setEditing(false)
      } catch (e: any) {
        setError(e.message ?? 'Failed to save')
      }
    })
  }

  const cancelEdit = () => {
    setRoomValue(optimisticRoom ?? '')
    setEditing(false)
    setError(null)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') saveRoom()
    if (e.key === 'Escape') cancelEdit()
  }

  const toggleAdmin = () => {
    const next = !optimisticAdmin
    setError(null)
    startTransition(async () => {
      try {
        await toggleUserAdmin(user.id, next)
        setOptimisticAdmin(next)
      } catch (e: any) {
        setError(e.message ?? 'Failed to update')
      }
    })
  }

  const isSelf = user.id === currentUserId

  return (
    <tr className="hover:bg-ivory transition">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blush-200 to-wine-500 flex items-center justify-center text-ivory font-semibold text-sm">
            {(user.full_name ?? user.email)[0].toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-wine-700">
              {user.full_name ?? <span className="italic text-stone-400">Unnamed guest</span>}
              {isSelf && <span className="ml-2 text-xs text-gold-500">(you)</span>}
            </p>
            <p className="text-xs text-stone-500">{user.email}</p>
          </div>
        </div>
      </td>

      <td className="px-6 py-4">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={roomValue}
              onChange={(e) => setRoomValue(e.target.value)}
              onKeyDown={onKey}
              disabled={isPending}
              placeholder="e.g. 204"
              className="w-24 px-3 py-1.5 rounded-lg border border-wine-500 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-wine-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={saveRoom}
              disabled={isPending}
              aria-label="Save"
              className="w-8 h-8 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center justify-center disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isPending}
              aria-label="Cancel"
              className="w-8 h-8 rounded-lg bg-stone-200 text-stone-600 hover:bg-stone-300 flex items-center justify-center disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-blush-50 transition text-left"
          >
            {optimisticRoom ? (
              <span className="font-mono text-wine-700 font-semibold">Room {optimisticRoom}</span>
            ) : (
              <span className="italic text-stone-400">Not assigned</span>
            )}
            <Pencil className="w-3.5 h-3.5 text-stone-300 group-hover:text-wine-700 transition" />
          </button>
        )}
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </td>

      <td className="px-6 py-4">
        <button
          type="button"
          onClick={toggleAdmin}
          disabled={isPending || (isSelf && optimisticAdmin)}
          aria-label={optimisticAdmin ? 'Revoke admin' : 'Make admin'}
          title={isSelf && optimisticAdmin ? "You can't remove your own admin rights" : undefined}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
            optimisticAdmin
              ? 'bg-gold-100 text-gold-500 border-gold-200 hover:bg-gold-200'
              : 'bg-white text-stone-500 border-stone-200 hover:border-wine-500 hover:text-wine-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {optimisticAdmin ? <ShieldCheck className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
          {optimisticAdmin ? 'Admin' : 'Guest'}
        </button>
      </td>

      <td className="px-6 py-4 text-xs text-stone-400 whitespace-nowrap">
        {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </td>
    </tr>
  )
}
