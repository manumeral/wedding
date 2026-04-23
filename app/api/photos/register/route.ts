import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  makeFilePublic,
  DriveAuthError,
  DriveNotConnectedError,
} from '@/lib/google-drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RegisterBody {
  driveFileId?: unknown
  correlationId?: unknown
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let body: RegisterBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const driveFileId = typeof body.driveFileId === 'string' ? body.driveFileId.trim() : ''
  if (!driveFileId) {
    return NextResponse.json({ error: 'driveFileId is required.' }, { status: 400 })
  }

  try {
    await makeFilePublic(driveFileId)
  } catch (err: any) {
    console.error('[photos.register]', err)
    if (err instanceof DriveAuthError) {
      return NextResponse.json(
        { error: 'Google connection expired. An organizer needs to reconnect.' },
        { status: 503 },
      )
    }
    if (err instanceof DriveNotConnectedError) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    return NextResponse.json(
      { ok: true, warning: 'Upload stored, but public permission could not be set.' },
    )
  }

  revalidatePath('/photos')
  return NextResponse.json({ ok: true })
}
