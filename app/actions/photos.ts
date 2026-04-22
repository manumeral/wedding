'use server'

import {
  listAlbum,
  getConnectionStatus,
  DriveAuthError,
} from '@/lib/google-drive'
import type { AlbumFile, ConnectionStatus } from '@/lib/google-drive'

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
    return {
      connected: true,
      needsEnvSetup: false,
      needsReconnect: false,
      connectionStatus: status,
      folderUrl,
      files,
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
