'use client'

import { useState, useTransition } from 'react'
import { updateUserRoom } from '@/app/actions/admin'
import { setUserAdminLevel } from '@/app/actions/super-admin'
import type { AdminLevel } from '@/lib/auth/roles'
import { Check, X, Loader2, Pencil, Shield, ShieldCheck, Crown } from 'lucide-react'

interface User {
  id: string
  email: string
  full_name: string | null
  room_number: string | null
  admin_level: AdminLevel | string
  created_at: string
}

interface Props {
  user: User
  currentUserId: string
  canEditRoles: boolean
}

function roleLabel(level: string): string {
  if (level === 'super_admin') return 'Super-admin'
  if (level === 'admin') return 'Admin'
  return 'Guest'
}

export function UserRow({ user, currentUserId, canEditRoles }: Props) {
  const [editing, setEditing] = useState(false)
  const [roomValue, setRoomValue] = useState(user.room_number ?? '')
  const [optimisticRoom, setOptimisticRoom] = useState(user.room_number)
  const [optimisticLevel, setOptimisticLevel] = useState<string>(user.admin_level ?? 'none')
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

  const onRoleChange = (next: AdminLevel) => {
    setError(null)
    startTransition(async () => {
      try {
        await setUserAdminLevel(user.id, next)
        setOptimisticLevel(next)
      } catch (e: any) {
        setError(e.message ?? 'Failed to update role')
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
        {canEditRoles ? (
          <div className="flex items-center gap-2">
            <select
              value={optimisticLevel}
              disabled={isPending}
              onChange={(e) => onRoleChange(e.target.value as AdminLevel)}
              className="text-xs font-medium rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-wine-800 focus:outline-none focus:ring-2 focus:ring-wine-500 disabled:opacity-50"
              aria-label="Change role"
            >
              <option value="none">Guest</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super-admin</option>
            </select>
            {optimisticLevel === 'super_admin' ? (
              <Crown className="w-4 h-4 text-gold-500 shrink-0" aria-hidden />
            ) : optimisticLevel === 'admin' ? (
              <ShieldCheck className="w-4 h-4 text-gold-600 shrink-0" aria-hidden />
            ) : (
              <Shield className="w-4 h-4 text-stone-300 shrink-0" aria-hidden />
            )}
          </div>
        ) : (
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              optimisticLevel === 'super_admin'
                ? 'bg-gold-100 text-gold-700 border-gold-200'
                : optimisticLevel === 'admin'
                  ? 'bg-gold-50 text-gold-600 border-gold-100'
                  : 'bg-white text-stone-500 border-stone-200'
            }`}
          >
            {optimisticLevel === 'super_admin' ? (
              <Crown className="w-3.5 h-3.5" />
            ) : optimisticLevel === 'admin' ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <Shield className="w-3.5 h-3.5" />
            )}
            {roleLabel(optimisticLevel)}
          </span>
        )}
      </td>

      <td className="px-6 py-4 text-xs text-stone-400 whitespace-nowrap">
        {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
      </td>
    </tr>
  )
}
