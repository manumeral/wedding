'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { completeGuestProfile } from '@/app/actions/profile'
import { Avatar } from '@/components/Avatar'
import { Camera, Loader2, Check, AlertCircle } from 'lucide-react'

interface Props {
  userId: string
  initial: {
    fullName: string
    bio: string | null
    avatarUrl: string | null
  }
}

const MAX_BIO_LEN = 240
const MAX_FILE_MB = 5
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function ProfileCompleteForm({ userId, initial }: Props) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(initial.fullName)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl)

  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)

    if (!ACCEPTED.includes(file.type)) {
      setError('Please pick a JPEG, PNG, WebP or GIF image.')
      return
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Image is too large. Keep it under ${MAX_FILE_MB} MB.`)
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })

      if (upErr) throw new Error(upErr.message)

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const submit = () => {
    setError(null)

    if (fullName.trim().length === 0) {
      setError('Please add your full name.')
      return
    }
    if (bio.trim().length === 0) {
      setError('Please write a short description (how you know the couple, etc.).')
      return
    }
    if (!avatarUrl || avatarUrl.trim().length === 0) {
      setError('Please upload a profile photo.')
      return
    }

    startTransition(async () => {
      try {
        await completeGuestProfile({
          fullName: fullName.trim(),
          bio: bio.trim(),
          avatarUrl: avatarUrl.trim(),
        })
        router.push('/')
        router.refresh()
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Could not save')
      }
    })
  }

  return (
    <div className="card p-6 sm:p-8 space-y-6">
      <p className="text-sm text-stone-600 border border-gold-200/80 bg-gold-50/50 rounded-xl px-4 py-3">
        This is a one-time setup. After you continue, only organizers can change your name, photo, or
        description — contact them if anything needs updating.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="relative">
          <Avatar name={fullName || 'Guest'} src={avatarUrl} size="xl" ring />
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 text-center sm:text-left">
          <h3 className="font-serif text-xl text-wine-700 mb-1">Profile photo (required)</h3>
          <p className="text-sm text-stone-500 mb-3">
            A clear headshot helps other guests recognize you. JPG / PNG / WebP, up to {MAX_FILE_MB}{' '}
            MB.
          </p>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading || isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-wine-700 text-ivory text-sm font-medium hover:bg-wine-800 transition disabled:opacity-40"
          >
            <Camera className="w-4 h-4" />
            {avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
              e.target.value = ''
            }}
            className="hidden"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="complete-fullName" className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
          Full name
        </label>
        <input
          id="complete-fullName"
          type="text"
          value={fullName}
          maxLength={60}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 focus:border-wine-500 outline-none transition"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="complete-bio" className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
            About you (required)
          </label>
          <span className={`text-xs ${bio.length > MAX_BIO_LEN ? 'text-red-600' : 'text-stone-400'}`}>
            {bio.length} / {MAX_BIO_LEN}
          </span>
        </div>
        <textarea
          id="complete-bio"
          rows={4}
          value={bio}
          maxLength={MAX_BIO_LEN}
          onChange={(e) => setBio(e.target.value)}
          placeholder="How do you know Prachi or Mayank? Anything fun other guests should know?"
          className="w-full px-4 py-2.5 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 focus:border-wine-500 outline-none transition resize-none"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={uploading || isPending}
        className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2 disabled:opacity-40"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        Save and continue
      </button>
    </div>
  )
}
