'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  generateAuthUrl,
  disconnect as driveDisconnect,
  listAlbum,
  getConnectionStatus,
  DriveAuthError,
} from '@/lib/google-drive'

const STATE_COOKIE = 'drive_oauth_state'

async function assertAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await supabase
    .from('users')
    .select('admin_level')
    .eq('id', user.id)
    .single()
  if (profile?.admin_level !== 'admin' && profile?.admin_level !== 'super_admin') {
    throw new Error('Unauthorized')
  }
}

export async function startDriveAuth() {
  await assertAdmin()

  const state = crypto.randomUUID()
  const url = generateAuthUrl(state)

  cookies().set(STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10, // 10 minutes is plenty for a Google consent flow
  })

  redirect(url)
}

export async function disconnectDrive() {
  await assertAdmin()
  await driveDisconnect()
  revalidatePath('/admin/drive-auth')
  revalidatePath('/photos')
}

export interface DriveTestResult {
  ok: boolean
  fileCount: number
  sampleNames: string[]
  error: string | null
  needsReconnect: boolean
}

export async function testDriveConnection(): Promise<DriveTestResult> {
  await assertAdmin()

  const status = await getConnectionStatus()
  if (status.state !== 'connected') {
    return {
      ok: false,
      fileCount: 0,
      sampleNames: [],
      error:
        status.state === 'env_missing'
          ? `Missing env vars: ${status.missing.join(', ')}`
          : 'Drive is not connected yet.',
      needsReconnect: false,
    }
  }

  try {
    const { files } = await listAlbum({ pageSize: 5 })
    return {
      ok: true,
      fileCount: files.length,
      sampleNames: files.slice(0, 3).map((f) => f.name),
      error: null,
      needsReconnect: false,
    }
  } catch (err: any) {
    console.error('[drive.test]', err)
    return {
      ok: false,
      fileCount: 0,
      sampleNames: [],
      error: err?.message ?? 'Could not reach Google Drive',
      needsReconnect: err instanceof DriveAuthError,
    }
  }
}
