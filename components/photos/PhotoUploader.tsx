'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ImagePlus, Loader2, Check, AlertTriangle, X } from 'lucide-react'

interface QueueItem {
  id: string
  file: File
  status: 'queued' | 'uploading' | 'done' | 'error'
  progress: number
  error?: string
  previewUrl?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

async function initSession(file: File): Promise<{ sessionUrl: string; correlationId: string }> {
  const res = await fetch('/api/photos/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  })
  if (!res.ok) {
    let msg = `Could not start upload (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {}
    throw new Error(msg)
  }
  return res.json()
}

function putToDriveWithProgress(
  sessionUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', sessionUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')

    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.round((ev.loaded / ev.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText)
          if (body?.id) {
            resolve(body.id)
            return
          }
        } catch {}
        reject(new Error('Drive returned an unexpected response.'))
        return
      }
      reject(new Error(`Drive rejected the upload (${xhr.status}).`))
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled.')))

    xhr.send(file)
  })
}

async function registerUpload(driveFileId: string, correlationId: string): Promise<void> {
  const res = await fetch('/api/photos/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driveFileId, correlationId }),
  })
  if (!res.ok) {
    let msg = `Could not finalize upload (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) msg = body.error
    } catch {}
    throw new Error(msg)
  }
}

async function uploadWithProgress(
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  const { sessionUrl, correlationId } = await initSession(file)
  const driveFileId = await putToDriveWithProgress(sessionUrl, file, onProgress)
  await registerUpload(driveFileId, correlationId)
}

export function PhotoUploader({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter()
  const pickerRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const [queue, setQueue] = useState<QueueItem[]>([])
  const [busy, setBusy] = useState(false)

  const enqueue = (files: FileList | null) => {
    if (!files || files.length === 0) return
    const items: QueueItem[] = Array.from(files).map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file: f,
      status: 'queued',
      progress: 0,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }))
    setQueue((q) => [...items, ...q])
    void runQueue(items)
  }

  const runQueue = async (items: QueueItem[]) => {
    setBusy(true)
    let anySucceeded = false

    for (const item of items) {
      setQueue((q) =>
        q.map((x) => (x.id === item.id ? { ...x, status: 'uploading', progress: 0 } : x))
      )
      try {
        await uploadWithProgress(item.file, (pct) => {
          setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)))
        })
        setQueue((q) =>
          q.map((x) => (x.id === item.id ? { ...x, status: 'done', progress: 100 } : x))
        )
        anySucceeded = true
      } catch (e: any) {
        setQueue((q) =>
          q.map((x) =>
            x.id === item.id ? { ...x, status: 'error', error: e.message ?? 'Failed' } : x
          )
        )
      }
    }

    setBusy(false)
    if (anySucceeded) router.refresh()
  }

  const dismiss = (id: string) => {
    setQueue((q) => {
      const item = q.find((x) => x.id === id)
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return q.filter((x) => x.id !== id)
    })
  }

  const retry = (id: string) => {
    const item = queue.find((x) => x.id === id)
    if (!item) return
    void runQueue([item])
  }

  return (
    <div className="card p-6 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="font-serif text-2xl text-wine-700">Share a photo</h3>
          <p className="text-sm text-stone-500 mt-0.5">
            Your uploads go straight into the shared Drive album.
          </p>
        </div>
        {busy && (
          <span className="inline-flex items-center gap-2 text-sm text-wine-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading&hellip;
          </span>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={disabled}
          className="group card p-5 flex items-center gap-4 text-left hover:shadow-soft-lg hover:-translate-y-0.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-wine-600 to-wine-800 flex items-center justify-center text-gold-200">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <p className="font-serif text-lg text-wine-700">Take a photo</p>
            <p className="text-xs text-stone-500">Uses your phone&rsquo;s camera</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => pickerRef.current?.click()}
          disabled={disabled}
          className="group card p-5 flex items-center gap-4 text-left hover:shadow-soft-lg hover:-translate-y-0.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blush-200 to-blush-300 flex items-center justify-center text-wine-700">
            <ImagePlus className="w-6 h-6" />
          </div>
          <div>
            <p className="font-serif text-lg text-wine-700">Upload from device</p>
            <p className="text-xs text-stone-500">Photos or videos from your device</p>
          </div>
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          enqueue(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={pickerRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          enqueue(e.target.files)
          e.target.value = ''
        }}
      />

      {queue.length > 0 && (
        <ul className="mt-5 space-y-2">
          {queue.map((item) => (
            <li
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                item.status === 'done'
                  ? 'bg-green-50 border-green-200'
                  : item.status === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-cream border-blush-100'
              }`}
            >
              <div className="w-11 h-11 rounded-lg overflow-hidden bg-stone-100 flex items-center justify-center flex-none">
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImagePlus className="w-5 h-5 text-stone-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-wine-800 truncate">{item.file.name}</p>
                  <span className="text-xs text-stone-400 flex-none">
                    {formatBytes(item.file.size)}
                  </span>
                </div>
                {item.status === 'uploading' && (
                  <div className="mt-1.5 h-1 rounded-full bg-blush-100 overflow-hidden">
                    <div
                      className="h-full bg-wine-700 transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <p className="mt-0.5 text-xs text-red-700">{item.error}</p>
                )}
                {item.status === 'done' && (
                  <p className="mt-0.5 text-xs text-green-700">Uploaded to the album</p>
                )}
                {item.status === 'queued' && (
                  <p className="mt-0.5 text-xs text-stone-500">Waiting&hellip;</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {item.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => retry(item.id)}
                    className="text-xs font-medium text-wine-700 hover:text-wine-900 px-2 py-1"
                  >
                    Retry
                  </button>
                )}
                {item.status === 'uploading' && <Loader2 className="w-4 h-4 text-wine-700 animate-spin" />}
                {item.status === 'done' && <Check className="w-4 h-4 text-green-700" />}
                {item.status === 'error' && <AlertTriangle className="w-4 h-4 text-red-700" />}
                {item.status !== 'uploading' && (
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    className="p-1 rounded hover:bg-white/60 text-stone-400 hover:text-stone-700"
                    aria-label="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
