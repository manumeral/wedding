'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { updateMyProfile } from '@/app/actions/profile'
import { Avatar } from '@/components/Avatar'
import { Camera, Loader2, Check, Trash2, AlertCircle } from 'lucide-react'
import { site } from '@/lib/site'

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

export function ProfileForm({ userId, initial }: Props) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(initial.fullName)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl)

  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setError(null)
    setFlash(null)

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

      if (upErr) {
        throw new Error(upErr.message)
      }

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const publicUrl = data.publicUrl

      setAvatarUrl(publicUrl)
      setFlash('Photo uploaded. Don\u2019t forget to save.')
    } catch (e: any) {
      setError(e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const removeAvatar = () => {
    setAvatarUrl(null)
    setFlash('Photo will be removed when you save.')
  }

  const save = () => {
    setError(null)
    setFlash(null)

    if (fullName.trim().length === 0) {
      setError('Name can\u2019t be empty.')
      return
    }

    startTransition(async () => {
      try {
        await updateMyProfile({
          fullName: fullName.trim(),
          bio: bio.trim().length === 0 ? null : bio.trim(),
          avatarUrl,
        })
        setFlash('Saved!')
        router.refresh()
        setTimeout(() => setFlash(null), 2500)
      } catch (e: any) {
        setError(e.message ?? 'Could not save')
      }
    })
  }

  const dirty =
    fullName.trim() !== initial.fullName.trim() ||
    (bio.trim() || null) !== (initial.bio?.trim() || null) ||
    avatarUrl !== initial.avatarUrl

  return (
    <div className="card p-6 sm:p-8 space-y-6">
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
          <h3 className="font-serif text-xl text-wine-700 mb-1">Profile photo</h3>
          <p className="text-sm text-stone-500 mb-3">
            A clear headshot helps other guests recognize you. JPG / PNG / WebP, up to {MAX_FILE_MB} MB.
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start gap-2">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading || isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-wine-700 text-ivory text-sm font-medium hover:bg-wine-800 transition disabled:opacity-40"
            >
              <Camera className="w-4 h-4" />
              {avatarUrl ? 'Change photo' : 'Upload photo'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={uploading || isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-stone-200 text-stone-600 text-sm font-medium hover:border-wine-500 hover:text-wine-700 transition disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            )}
          </div>
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
        <label htmlFor="fullName" className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
          Name
        </label>
        <input
          id="fullName"
          type="text"
          value={fullName}
          maxLength={60}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 focus:border-wine-500 outline-none transition"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="bio" className="block text-xs font-medium text-stone-500 uppercase tracking-wider">
            A little about you
          </label>
          <span className={`text-xs ${bio.length > MAX_BIO_LEN ? 'text-red-600' : 'text-stone-400'}`}>
            {bio.length} / {MAX_BIO_LEN}
          </span>
        </div>
        <textarea
          id="bio"
          rows={3}
          value={bio}
          maxLength={MAX_BIO_LEN}
          onChange={(e) => setBio(e.target.value)}
          placeholder={site.copy.knowCouplePlaceholder}
          className="w-full px-4 py-2.5 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 focus:border-wine-500 outline-none transition resize-none"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-none" />
          <span>{error}</span>
        </div>
      )}
      {flash && !error && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <Check className="w-4 h-4 flex-none" />
          <span>{flash}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || uploading || isPending}
          className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save changes
        </button>
      </div>
    </div>
  )
}
