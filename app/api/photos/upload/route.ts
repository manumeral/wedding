import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  uploadToAlbum,
  getConnectionStatus,
  DriveAuthError,
  DriveNotConnectedError,
} from '@/lib/google-drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Allow up to 60s on most hosts; Node runtime honors this on Vercel.
export const maxDuration = 60

const MAX_BYTES = 50 * 1024 * 1024 // 50 MB per file
const ALLOWED_PREFIXES = ['image/', 'video/']

function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\\/]/g, '').trim()
  return cleaned.length > 0 ? cleaned.slice(0, 180) : `upload-${Date.now()}`
}

export async function POST(req: Request) {
  const status = await getConnectionStatus()
  if (status.state === 'env_missing') {
    return NextResponse.json(
      { error: 'The photo album is not set up yet. Please check back soon.' },
      { status: 503 }
    )
  }
  if (status.state === 'not_connected') {
    return NextResponse.json(
      { error: 'The album is not connected to Google Drive yet. Ask an organizer to finish setup.' },
      { status: 503 }
    )
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const uploaderName = profile?.full_name?.trim() || user.email || 'Guest'

  let form: FormData
  try {
    form = await req.formData()
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not read upload body.' },
      { status: 400 }
    )
  }

  const fileEntry = form.get('file')
  if (!(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'No file attached.' }, { status: 400 })
  }

  const mime = fileEntry.type || 'application/octet-stream'
  const allowed = ALLOWED_PREFIXES.some((p) => mime.startsWith(p))
  if (!allowed) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mime}. Please upload an image or video.` },
      { status: 415 }
    )
  }

  if (fileEntry.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File is too large. Keep each upload under ${MAX_BYTES / 1024 / 1024} MB.` },
      { status: 413 }
    )
  }

  const buffer = Buffer.from(await fileEntry.arrayBuffer())
  const filename = sanitizeFilename(fileEntry.name || `photo-${Date.now()}.jpg`)

  try {
    const uploaded = await uploadToAlbum({
      filename,
      mimeType: mime,
      buffer,
      uploaderId: user.id,
      uploaderName,
    })
    return NextResponse.json({ file: uploaded })
  } catch (err: any) {
    console.error('[photos.upload]', err)
    if (err instanceof DriveAuthError) {
      return NextResponse.json(
        { error: 'Google connection expired. An organizer needs to reconnect the album.' },
        { status: 503 }
      )
    }
    if (err instanceof DriveNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    const message = err?.message ?? 'Upload failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
