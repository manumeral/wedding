'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  Image as ImageIcon,
  Trash2,
  X,
} from 'lucide-react'
import type { AlbumFile } from '@/lib/google-drive'
import { deleteGalleryPhoto } from '@/app/actions/photos'

interface Props {
  files: AlbumFile[]
  folderUrl: string | null
  isAdmin?: boolean
}

export function PhotoGallery({ files, folderUrl, isAdmin = false }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const close = useCallback(() => setActiveIndex(null), [])
  const prev = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i - 1 + files.length) % files.length))
  }, [files.length])
  const next = useCallback(() => {
    setActiveIndex((i) => (i === null ? null : (i + 1) % files.length))
  }, [files.length])

  useEffect(() => {
    if (activeIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [activeIndex, close, prev, next])

  const active = activeIndex !== null ? files[activeIndex] : null

  const removeFromAlbum = useCallback(
    (file: AlbumFile) => {
      if (!isAdmin) return
      if (!confirm(`Remove this from the shared album? This cannot be undone.\n\n${file.name}`)) {
        return
      }
      setDeletingId(file.id)
      startTransition(async () => {
        const res = await deleteGalleryPhoto(file.id)
        setDeletingId(null)
        if ('error' in res) {
          alert(res.error)
          return
        }
        setActiveIndex(null)
        router.refresh()
      })
    },
    [isAdmin, router],
  )

  if (files.length === 0) {
    return (
      <div className="card p-14 text-center text-stone-500">
        <ImageIcon className="w-12 h-12 mx-auto text-blush-300 mb-3" />
        <p className="font-serif text-xl text-wine-700 mb-1">Album&rsquo;s empty</p>
        <p className="text-sm">
          Be the first to post a memory &mdash; your photos will show up here instantly.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-stone-500">
          {files.length} {files.length === 1 ? 'memory' : 'memories'} in the album
        </p>
        {folderUrl && (
          <Link
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-wine-700 hover:text-wine-900 font-medium"
          >
            Open in Drive
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
        {files.map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveIndex(i)}
            className="group relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-stone-100 hover:shadow-soft-lg hover:-translate-y-0.5 transition"
            aria-label={f.name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.thumbnailUrl}
              alt={f.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                const el = e.currentTarget
                el.style.display = 'none'
                const fallback = el.nextElementSibling as HTMLElement | null
                if (fallback) fallback.style.display = 'flex'
              }}
            />
            <div
              className="absolute inset-0 hidden flex-col items-center justify-center gap-1 text-stone-400 bg-gradient-to-br from-cream to-blush-100"
              style={{ display: 'none' }}
            >
              {f.isVideo ? <Film className="w-7 h-7" /> : <ImageIcon className="w-7 h-7" />}
              <span className="text-[10px] uppercase tracking-wider">Open in Drive</span>
            </div>

            {f.isVideo && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="w-10 h-10 rounded-full bg-black/55 text-white flex items-center justify-center">
                  <Film className="w-5 h-5" />
                </span>
              </div>
            )}

            {f.uploaderName && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                <p className="text-[11px] text-white truncate">by {f.uploaderName}</p>
              </div>
            )}

            {isAdmin && (
              <button
                type="button"
                aria-label="Remove from album"
                disabled={pending && deletingId === f.id}
                onClick={(e) => {
                  e.stopPropagation()
                  removeFromAlbum(f)
                }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/55 text-white opacity-0 group-hover:opacity-100 hover:bg-red-700 transition disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={close}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              close()
            }}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
          >
            <X className="w-6 h-6" />
          </button>

          {files.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  prev()
                }}
                aria-label="Previous"
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <ChevronLeft className="w-7 h-7" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  next()
                }}
                aria-label="Next"
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition"
              >
                <ChevronRight className="w-7 h-7" />
              </button>
            </>
          )}

          <div
            className="relative max-w-5xl max-h-[88vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {active.isVideo ? (
              <iframe
                src={`https://drive.google.com/file/d/${active.id}/preview`}
                allow="autoplay"
                className="w-full aspect-video rounded-xl bg-black"
                title={active.name}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={active.fullUrl}
                alt={active.name}
                referrerPolicy="no-referrer"
                className="w-full max-h-[82vh] object-contain rounded-xl"
              />
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-white/80">
              <div className="min-w-0">
                <p className="truncate">{active.name}</p>
                {active.uploaderName && (
                  <p className="text-xs text-white/60">Shared by {active.uploaderName}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    disabled={pending && deletingId === active.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFromAlbum(active)
                    }}
                    className="inline-flex items-center gap-1.5 text-red-300 hover:text-red-200 font-medium disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove from album
                  </button>
                )}
                <Link
                  href={active.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-gold-300 hover:text-gold-200 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open in Drive
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
