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

  let publicWarning: string | null = null
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
    publicWarning = 'Upload stored, but public permission could not be set.'
  }

  const { data: memberships } = await supabase
    .from('user_guest_groups')
    .select('group_id')
    .eq('user_id', user.id)
  const groupIds = (memberships ?? []).map((r) => r.group_id).filter(Boolean)

  const { error: insertErr } = await supabase.from('photo_uploads').insert({
    drive_file_id: driveFileId,
    uploaded_by: user.id,
    group_ids: groupIds,
  })
  if (insertErr && insertErr.code !== '23505') {
    console.error('[photos.register] photo_uploads insert', insertErr)
  }

  revalidatePath('/photos')
  if (publicWarning) {
    return NextResponse.json({ ok: true, warning: publicWarning })
  }
  return NextResponse.json({ ok: true })
}
