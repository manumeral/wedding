'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  listAlbum,
  getConnectionStatus,
  DriveAuthError,
  deleteDriveFile,
  DriveNotConnectedError,
} from '@/lib/google-drive'
import type { AlbumFile, ConnectionStatus } from '@/lib/google-drive'
import { isStaffLevel } from '@/lib/auth/roles'

export interface AlbumState {
  /** True when an organizer has connected Google Drive. */
  connected: boolean
  /** True when env vars are missing — a "not even set up" state. */
  needsEnvSetup: boolean
  /** True when Google rejected the saved refresh token. */
  needsReconnect: boolean
  connectionStatus: ConnectionStatus
  folderUrl: string | null
  files: AlbumFile[]
  error: string | null
}

export async function getAlbumState(): Promise<AlbumState> {
  const status = await getConnectionStatus()

  if (status.state === 'env_missing') {
    return {
      connected: false,
      needsEnvSetup: true,
      needsReconnect: false,
      connectionStatus: status,
      folderUrl: null,
      files: [],
      error: null,
    }
  }

  if (status.state === 'not_connected') {
    return {
      connected: false,
      needsEnvSetup: false,
      needsReconnect: false,
      connectionStatus: status,
      folderUrl: null,
      files: [],
      error: null,
    }
  }

  try {
    const { files, folderUrl } = await listAlbum({ pageSize: 60 })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let visible = files

    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('admin_level')
        .eq('id', user.id)
        .single()
      const staff = isStaffLevel(profile?.admin_level)
      if (!staff) {
        const { data: rows } = await supabase.from('photo_uploads').select('drive_file_id')
        const allowed = new Set((rows ?? []).map((r) => r.drive_file_id))
        visible = files.filter((f) => allowed.has(f.id))
      }
    } else {
      visible = []
    }

    return {
      connected: true,
      needsEnvSetup: false,
      needsReconnect: false,
      connectionStatus: status,
      folderUrl,
      files: visible,
      error: null,
    }
  } catch (err: any) {
    console.error('[photos.getAlbumState]', err)
    const needsReconnect = err instanceof DriveAuthError
    return {
      connected: true,
      needsEnvSetup: false,
      needsReconnect,
      connectionStatus: status,
      folderUrl: null,
      files: [],
      error: err?.message ?? 'Could not reach Google Drive',
    }
  }
}

export async function deleteGalleryPhoto(
  driveFileId: string,
): Promise<{ ok: true } | { error: string }> {
  const trimmed = driveFileId?.trim()
  if (!trimmed) return { error: 'Missing file id.' }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in.' }

  const { data: profile } = await supabase
    .from('users')
    .select('admin_level')
    .eq('id', user.id)
    .single()
  if (!isStaffLevel(profile?.admin_level)) {
    return { error: 'Only organizers can remove photos from the shared album.' }
  }

  try {
    await deleteDriveFile(trimmed)
  } catch (err: any) {
    console.error('[photos.deleteGalleryPhoto] drive', err)
    if (err instanceof DriveAuthError) {
      return { error: 'Google connection expired. Reconnect Drive in admin settings.' }
    }
    if (err instanceof DriveNotConnectedError) {
      return { error: err.message }
    }
    return { error: err?.message ?? 'Could not delete file from Google Drive.' }
  }

  await supabase.from('photo_uploads').delete().eq('drive_file_id', trimmed)
  revalidatePath('/photos')
  return { ok: true }
}
