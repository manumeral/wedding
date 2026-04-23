import { google, drive_v3 } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'
import { readConfig, writeConfig } from '@/lib/supabase/admin'

// ---------- Types ----------

export interface AlbumFile {
  id: string
  name: string
  mimeType: string
  createdTime: string
  isImage: boolean
  isVideo: boolean
  thumbnailUrl: string
  fullUrl: string
  viewUrl: string
  sizeBytes: number | null
  uploaderId: string | null
  uploaderName: string | null
}

export interface ListResult {
  files: AlbumFile[]
  nextPageToken: string | null
  folderUrl: string
}

export type ConnectionStatus =
  | { state: 'env_missing'; missing: string[] }
  | { state: 'not_connected' }
  | { state: 'connected'; email: string | null; connectedAt: string | null }

// ---------- Env / config helpers ----------

interface OAuthEnv {
  clientId: string
  clientSecret: string
  redirectUri: string
  folderId: string
}

const CONFIG_KEY_REFRESH = 'drive_refresh_token'
const CONFIG_KEY_EMAIL = 'drive_connected_email'
const CONFIG_KEY_CONNECTED_AT = 'drive_connected_at'
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
]

function readOAuthEnv(): { env: OAuthEnv | null; missing: string[] } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim()
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()

  const missing: string[] = []
  if (!clientId) missing.push('GOOGLE_OAUTH_CLIENT_ID')
  if (!clientSecret) missing.push('GOOGLE_OAUTH_CLIENT_SECRET')
  if (!redirectUri) missing.push('GOOGLE_OAUTH_REDIRECT_URI')
  if (!folderId) missing.push('GOOGLE_DRIVE_FOLDER_ID')

  if (missing.length > 0) return { env: null, missing }
  return {
    env: {
      clientId: clientId!,
      clientSecret: clientSecret!,
      redirectUri: redirectUri!,
      folderId: folderId!,
    },
    missing: [],
  }
}

function buildOAuthClient(env: OAuthEnv): OAuth2Client {
  return new google.auth.OAuth2({
    clientId: env.clientId,
    clientSecret: env.clientSecret,
    redirectUri: env.redirectUri,
  })
}

// ---------- Public: configuration ----------

export function folderUrl(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`
}

export async function getConnectionStatus(): Promise<ConnectionStatus> {
  const { env, missing } = readOAuthEnv()
  if (!env) return { state: 'env_missing', missing }

  const refreshToken = await readConfig(CONFIG_KEY_REFRESH)
  if (!refreshToken) return { state: 'not_connected' }

  const email = await readConfig(CONFIG_KEY_EMAIL)
  const connectedAt = await readConfig(CONFIG_KEY_CONNECTED_AT)
  return { state: 'connected', email, connectedAt }
}

export async function disconnect(): Promise<void> {
  const { env } = readOAuthEnv()
  const refreshToken = await readConfig(CONFIG_KEY_REFRESH)

  // Best-effort token revoke so stale tokens don't linger on Google's side.
  if (env && refreshToken) {
    try {
      const client = buildOAuthClient(env)
      client.setCredentials({ refresh_token: refreshToken })
      await client.revokeToken(refreshToken)
    } catch (err) {
      console.warn('[drive.disconnect] revoke failed (proceeding)', err)
    }
  }

  await writeConfig(CONFIG_KEY_REFRESH, null)
  await writeConfig(CONFIG_KEY_EMAIL, null)
  await writeConfig(CONFIG_KEY_CONNECTED_AT, null)
}

// ---------- OAuth flow helpers ----------

export function generateAuthUrl(state: string): string {
  const { env } = readOAuthEnv()
  if (!env) throw new Error('Drive OAuth env vars missing')

  const client = buildOAuthClient(env)
  return client.generateAuthUrl({
    access_type: 'offline',
    // force consent so Google always returns a refresh token, even if the
    // user has previously authorized this app.
    prompt: 'consent',
    scope: OAUTH_SCOPES,
    state,
    include_granted_scopes: true,
  })
}

export async function completeOAuthFlow(code: string): Promise<{ email: string | null }> {
  const { env } = readOAuthEnv()
  if (!env) throw new Error('Drive OAuth env vars missing')

  const client = buildOAuthClient(env)
  const { tokens } = await client.getToken(code)

  if (!tokens.refresh_token) {
    throw new Error(
      'Google did not return a refresh token. Revoke the app at https://myaccount.google.com/permissions and try again.'
    )
  }

  // Fetch the connected account's email so the admin UI can show who's
  // authorized. Uses the short-lived access token we just received.
  let email: string | null = null
  try {
    client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const userInfo = await oauth2.userinfo.get()
    email = userInfo.data.email ?? null
  } catch (err) {
    console.warn('[drive.completeOAuthFlow] could not fetch userinfo', err)
  }

  await writeConfig(CONFIG_KEY_REFRESH, tokens.refresh_token)
  await writeConfig(CONFIG_KEY_EMAIL, email)
  await writeConfig(CONFIG_KEY_CONNECTED_AT, new Date().toISOString())

  return { email }
}

// ---------- Drive client (OAuth) ----------

async function getDrive(): Promise<{ drive: drive_v3.Drive; env: OAuthEnv } | null> {
  const { env } = readOAuthEnv()
  if (!env) return null

  const refreshToken = await readConfig(CONFIG_KEY_REFRESH)
  if (!refreshToken) return null

  const client = buildOAuthClient(env)
  client.setCredentials({ refresh_token: refreshToken })
  const drive = google.drive({ version: 'v3', auth: client })
  return { drive, env }
}

function toAlbumFile(f: drive_v3.Schema$File): AlbumFile {
  const id = f.id!
  const mime = f.mimeType ?? 'application/octet-stream'
  const isImage = mime.startsWith('image/')
  const isVideo = mime.startsWith('video/')
  const thumbnailUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w800`
  const appProps = (f.appProperties ?? undefined) as Record<string, string> | undefined
  return {
    id,
    name: f.name ?? 'Untitled',
    mimeType: mime,
    createdTime: f.createdTime ?? new Date().toISOString(),
    isImage,
    isVideo,
    thumbnailUrl,
    fullUrl: `https://drive.google.com/uc?id=${id}`,
    viewUrl: f.webViewLink ?? `https://drive.google.com/file/d/${id}/view`,
    sizeBytes: f.size ? Number(f.size) : null,
    uploaderId: appProps?.uploaderUserId ?? null,
    uploaderName: appProps?.uploaderName ?? null,
  }
}

function isAuthError(err: any): boolean {
  const code = err?.code ?? err?.response?.status
  return code === 401 || code === 403 || /invalid_grant|invalid_token/i.test(err?.message ?? '')
}

// ---------- Public: list + upload ----------

export async function listAlbum({
  pageSize = 60,
  pageToken,
}: { pageSize?: number; pageToken?: string } = {}): Promise<ListResult> {
  const ctx = await getDrive()
  if (!ctx) return { files: [], nextPageToken: null, folderUrl: '' }

  const { drive, env } = ctx

  try {
    const res = await drive.files.list({
      q: `'${env.folderId}' in parents and trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')`,
      orderBy: 'createdTime desc',
      pageSize,
      pageToken,
      fields:
        'nextPageToken, files(id, name, mimeType, createdTime, size, thumbnailLink, webViewLink, appProperties)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    return {
      files: (res.data.files ?? []).map(toAlbumFile),
      nextPageToken: res.data.nextPageToken ?? null,
      folderUrl: folderUrl(env.folderId),
    }
  } catch (err) {
    if (isAuthError(err)) {
      throw new DriveAuthError('Google connection has expired. An organizer needs to reconnect.')
    }
    throw err
  }
}

// ---------- Public: client-direct resumable upload ----------

export interface ClientDirectUploadInitInput {
  filename: string
  mimeType: string
  uploaderId: string
  uploaderName: string
}

/**
 * Metadata for Drive `files.create` + a short-lived OAuth access token.
 * The browser must POST this JSON to the resumable init URL itself so
 * Google sees a matching `Origin`/`Host` pair (server-side fetch cannot
 * spoof Origin — see Google error "Origin doesn't match Host for XD3").
 *
 * The token is user-scoped Drive access (~1h). Only hand it to the
 * browser after auth + rate-limit checks on `/api/photos/init`.
 */
export interface ClientDirectUploadInit {
  accessToken: string
  metadata: {
    name: string
    mimeType: string
    parents: string[]
    appProperties: {
      uploaderUserId: string
      uploaderName: string
      app: string
    }
  }
}

export async function mintClientDirectUploadInit(
  input: ClientDirectUploadInitInput,
): Promise<ClientDirectUploadInit> {
  const { env } = readOAuthEnv()
  if (!env) {
    throw new DriveNotConnectedError('Google Drive environment variables are not set.')
  }

  const refreshToken = await readConfig(CONFIG_KEY_REFRESH)
  if (!refreshToken) {
    throw new DriveNotConnectedError('Google Drive is not connected yet. Ask an organizer to connect it.')
  }

  const client = buildOAuthClient(env)
  client.setCredentials({ refresh_token: refreshToken })

  let accessToken: string | null | undefined
  try {
    const tok = await client.getAccessToken()
    accessToken = tok.token
  } catch (err: any) {
    if (isAuthError(err)) {
      throw new DriveAuthError('Google connection has expired. An organizer needs to reconnect.')
    }
    throw err
  }
  if (!accessToken) {
    throw new DriveAuthError('Could not mint Google access token.')
  }

  return {
    accessToken,
    metadata: {
      name: input.filename,
      mimeType: input.mimeType,
      parents: [env.folderId],
      appProperties: {
        uploaderUserId: input.uploaderId,
        uploaderName: input.uploaderName.slice(0, 100),
        app: 'wedding',
      },
    },
  }
}

/**
 * Applies "anyone with link → reader" permission on a file so that
 * <img src="..drive thumbnail.."> renders without an auth header.
 * Safe to call multiple times; Drive dedups identical grants.
 */
export async function makeFilePublic(fileId: string): Promise<void> {
  const ctx = await getDrive()
  if (!ctx) {
    throw new DriveNotConnectedError('Google Drive is not connected.')
  }
  const { drive } = ctx
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    })
  } catch (err: any) {
    if (isAuthError(err)) {
      throw new DriveAuthError('Google connection has expired.')
    }
    throw err
  }
}

// ---------- Errors ----------

export class DriveNotConnectedError extends Error {
  readonly kind = 'not_connected' as const
  constructor(message: string) {
    super(message)
    this.name = 'DriveNotConnectedError'
  }
}

export class DriveAuthError extends Error {
  readonly kind = 'auth_expired' as const
  constructor(message: string) {
    super(message)
    this.name = 'DriveAuthError'
  }
}
