import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { AdminTabs } from '@/components/AdminTabs'
import { getUserProfile } from '@/app/actions/user'
import { isStaffLevel, isSuperAdminLevel } from '@/lib/auth/roles'
import {
  getConnectionStatus,
  folderUrl as getFolderUrl,
} from '@/lib/google-drive'
import { startDriveAuth, disconnectDrive } from '@/app/actions/drive'
import { DriveTestButton } from '@/components/admin/DriveTestButton'
import { formatDateTimeLongIST } from '@/lib/datetime'
import {
  Camera,
  Link2 as LinkIcon,
  Unplug,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'

interface PageProps {
  searchParams?: {
    connected?: string
    email?: string
    error?: string
  }
}

export default async function DriveAuthPage({ searchParams }: PageProps) {
  const profile = await getUserProfile()
  if (!isStaffLevel(profile?.admin_level)) redirect('/')
  const isSuper = isSuperAdminLevel(profile?.admin_level)

  const status = await getConnectionStatus()
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()
  const folderLink = folderId ? getFolderUrl(folderId) : null

  const urlError = searchParams?.error ?? null
  const justConnected = searchParams?.connected === '1'

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream to-ivory">
        <div className="container-page">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="section-sub">organizer tools</p>
              <h1 className="section-title">Shared Drive</h1>
              <p className="mt-2 text-stone-600 max-w-2xl">
                Connect a Google account once so guests can upload candid photos to a
                shared Drive folder. Only admins can see this screen.
              </p>
            </div>
            <AdminTabs isSuperAdmin={isSuper} />
          </div>
        </div>
      </section>

      <section className="container-page mt-4 space-y-6">
        {urlError && (
          <Banner tone="error" icon={AlertTriangle} title="Couldn't finish sign-in">
            {urlError}
          </Banner>
        )}

        {justConnected && !urlError && (
          <Banner tone="success" icon={CheckCircle2} title="Connected">
            Drive uploads are now live
            {searchParams?.email ? (
              <>
                {' '}— authorized as <strong>{searchParams.email}</strong>.
              </>
            ) : (
              '.'
            )}
          </Banner>
        )}

        <EnvSection status={status} folderLink={folderLink} />

        <div className="card p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blush-100 to-blush-200 flex items-center justify-center text-wine-700">
              <Camera className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="font-serif text-xl text-wine-700">Connection</h2>
              <StatusLine status={status} />
            </div>
          </div>

          {status.state === 'connected' ? (
            <div className="flex flex-wrap gap-3">
              <form action={startDriveAuth}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-wine-700 text-ivory hover:bg-wine-600"
                >
                  <LinkIcon className="w-4 h-4" />
                  Reconnect / switch account
                </button>
              </form>
              <form action={disconnectDrive}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white border border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Unplug className="w-4 h-4" />
                  Disconnect
                </button>
              </form>
              {folderLink && (
                <Link
                  href={folderLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white border border-blush-200 text-wine-700 hover:bg-cream"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open folder
                </Link>
              )}
            </div>
          ) : status.state === 'not_connected' ? (
            <form action={startDriveAuth}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-wine-700 text-ivory hover:bg-wine-600"
              >
                <LinkIcon className="w-4 h-4" />
                Connect Google Drive
              </button>
            </form>
          ) : (
            <p className="text-sm text-stone-500">
              Fill in the missing environment variables above, then restart the server
              to connect.
            </p>
          )}

          {status.state === 'connected' && (
            <div className="pt-4 border-t border-blush-100">
              <p className="text-xs uppercase tracking-wider text-stone-500 mb-3">
                Diagnostics
              </p>
              <DriveTestButton />
            </div>
          )}
        </div>

        <HowItWorks />
      </section>
    </main>
  )
}

function StatusLine({
  status,
}: {
  status: Awaited<ReturnType<typeof getConnectionStatus>>
}) {
  if (status.state === 'connected') {
    const when = status.connectedAt ? formatDateTimeLongIST(status.connectedAt) : null
    return (
      <p className="mt-1 text-sm text-stone-600">
        Authorized as{' '}
        <strong className="text-wine-700">
          {status.email ?? 'an organizer account'}
        </strong>
        {when && <span className="text-stone-400"> · since {when}</span>}
      </p>
    )
  }
  if (status.state === 'not_connected') {
    return (
      <p className="mt-1 text-sm text-stone-600">
        Not connected yet. Click below to sign in with the Google account that owns
        the target folder (your personal 15 GB quota).
      </p>
    )
  }
  return (
    <p className="mt-1 text-sm text-red-700">
      Missing environment variables: {status.missing.join(', ')}
    </p>
  )
}

function EnvSection({
  status,
  folderLink,
}: {
  status: Awaited<ReturnType<typeof getConnectionStatus>>
  folderLink: string | null
}) {
  const missing = status.state === 'env_missing' ? status.missing : []
  const isSet = (name: string) => !missing.includes(name)
  const rows = [
    { name: 'GOOGLE_OAUTH_CLIENT_ID', set: isSet('GOOGLE_OAUTH_CLIENT_ID') },
    { name: 'GOOGLE_OAUTH_CLIENT_SECRET', set: isSet('GOOGLE_OAUTH_CLIENT_SECRET') },
    { name: 'GOOGLE_OAUTH_REDIRECT_URI', set: isSet('GOOGLE_OAUTH_REDIRECT_URI') },
    { name: 'GOOGLE_DRIVE_FOLDER_ID', set: isSet('GOOGLE_DRIVE_FOLDER_ID') },
  ]

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-stone-500">Environment</p>
          <h3 className="font-serif text-lg text-wine-700">Server configuration</h3>
        </div>
        {folderLink && (
          <Link
            href={folderLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-wine-700 underline underline-offset-2"
          >
            Open target folder
          </Link>
        )}
      </div>
      <ul className="grid sm:grid-cols-2 gap-2 text-sm">
        {rows.map((r) => (
          <li
            key={r.name}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
              r.set
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {r.set ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            <code className="font-mono text-xs">{r.name}</code>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HowItWorks() {
  return (
    <div className="card p-6 sm:p-7 text-sm text-stone-600 space-y-3">
      <h3 className="font-serif text-lg text-wine-700">How it works</h3>
      <ol className="list-decimal list-inside space-y-1.5">
        <li>
          You click <em>Connect Google Drive</em> and sign in with the Google account
          that owns the shared folder (uses its 15 GB quota).
        </li>
        <li>
          Google returns a long-lived refresh token. We store it server-side in the{' '}
          <code className="font-mono text-xs bg-cream px-1.5 py-0.5 rounded">
            app_config
          </code>{' '}
          table (service-role only — not visible to guests).
        </li>
        <li>
          Every guest upload and gallery view uses that token server-side. Guests
          never see or touch Google credentials.
        </li>
        <li>
          If the token ever gets revoked (e.g. password change), you&apos;ll see a
          reconnect banner on <code>/photos</code> and can fix it here.
        </li>
      </ol>
    </div>
  )
}

function Banner({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'success' | 'error'
  icon: any
  title: string
  children: React.ReactNode
}) {
  const styles =
    tone === 'success'
      ? 'border-green-200 bg-green-50 text-green-800'
      : 'border-red-200 bg-red-50 text-red-800'
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${styles}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5" />
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm mt-1">{children}</p>
        </div>
      </div>
    </div>
  )
}
