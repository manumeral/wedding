import { Avatar } from '@/components/Avatar'
import { Lock } from 'lucide-react'

export function GuestProfileReadOnly({
  fullName,
  bio,
  avatarUrl,
}: {
  fullName: string | null
  bio: string | null
  avatarUrl: string | null
}) {
  return (
    <div className="card p-6 sm:p-8 space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-blush-100 bg-cream/60 px-4 py-3 text-sm text-stone-600">
        <Lock className="w-5 h-5 text-wine-600 shrink-0 mt-0.5" aria-hidden />
        <p>
          Your guest profile is set. To change your name, photo, or description, ask an organizer — they
          can update it from the admin guest list.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <Avatar name={fullName || 'Guest'} src={avatarUrl} size="xl" ring />
        <div className="flex-1 text-center sm:text-left space-y-1">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Name</p>
          <p className="font-serif text-2xl text-wine-800">{fullName || '—'}</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-2">About you</p>
        <p className="text-stone-700 whitespace-pre-wrap leading-relaxed">{bio?.trim() || '—'}</p>
      </div>
    </div>
  )
}
