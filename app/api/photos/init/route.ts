import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createResumableUploadSession,
  getConnectionStatus,
  DriveAuthError,
  DriveNotConnectedError,
} from '@/lib/google-drive'
import { checkAndRecord } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB; Drive's file limit is higher but we cap here
const ALLOWED_PREFIXES = ['image/', 'video/']

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\\/]/g, '').trim()
  return cleaned.length > 0 ? cleaned.slice(0, 180) : `upload-${Date.now()}`
}

interface InitBody {
  filename?: unknown
  mimeType?: unknown
  sizeBytes?: unknown
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const status = await getConnectionStatus()
  if (status.state === 'env_missing') {
    return NextResponse.json(
      { error: 'The photo album is not set up yet. Please check back soon.' },
      { status: 503 },
    )
  }
  if (status.state === 'not_connected') {
    return NextResponse.json(
      { error: 'The album is not connected yet. Ask an organizer to finish setup.' },
      { status: 503 },
    )
  }

  const rl = await checkAndRecord('photo_init', `user:${user.id}`, 15 * 60, 30)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'You are uploading very fast. Please wait a few minutes.' },
      { status: 429 },
    )
  }

  let body: InitBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const filenameRaw = typeof body.filename === 'string' ? body.filename : ''
  const mimeTypeRaw = typeof body.mimeType === 'string' ? body.mimeType : ''
  const sizeBytesRaw = typeof body.sizeBytes === 'number' ? body.sizeBytes : Number.NaN

  if (!filenameRaw || !mimeTypeRaw || !Number.isFinite(sizeBytesRaw) || sizeBytesRaw <= 0) {
    return NextResponse.json(
      { error: 'filename, mimeType, and sizeBytes are required.' },
      { status: 400 },
    )
  }

  if (!ALLOWED_PREFIXES.some((p) => mimeTypeRaw.startsWith(p))) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mimeTypeRaw}. Please upload an image or video.` },
      { status: 415 },
    )
  }

  if (sizeBytesRaw > MAX_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Keep each upload under ${MAX_BYTES / 1024 / 1024 / 1024} GB.` },
      { status: 413 },
    )
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const uploaderName = profile?.full_name?.trim() || user.email || 'Guest'

  const correlationId = crypto.randomUUID()

  try {
    const { sessionUrl } = await createResumableUploadSession({
      filename: sanitizeFilename(filenameRaw),
      mimeType: mimeTypeRaw,
      sizeBytes: Math.floor(sizeBytesRaw),
      uploaderId: user.id,
      uploaderName,
    })
    return NextResponse.json({ sessionUrl, correlationId })
  } catch (err: any) {
    console.error('[photos.init]', err)
    if (err instanceof DriveAuthError) {
      return NextResponse.json(
        { error: 'Google connection expired. An organizer needs to reconnect.' },
        { status: 503 },
      )
    }
    if (err instanceof DriveNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    return NextResponse.json({ error: err?.message ?? 'Could not start upload.' }, { status: 502 })
  }
}
