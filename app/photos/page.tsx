import { getUserProfile } from '@/app/actions/user'
import { getAlbumState } from '@/app/actions/photos'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { PhotoUploader } from '@/components/photos/PhotoUploader'
import { PhotoGallery } from '@/components/photos/PhotoGallery'
import Image from 'next/image'
import Link from 'next/link'
import {
  Camera,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  Link2,
} from 'lucide-react'

export default async function PhotosPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const album = await getAlbumState()
  const isAdmin = !!profile.is_admin

  const canUpload = album.connected && !album.needsReconnect

  return (
    <main className="min-h-screen pb-24">
      <Navbar
        isAdmin={isAdmin}
        user={{ name: profile.full_name, avatarUrl: profile.avatar_url }}
      />

      {/* Hero */}
      <section className="relative pt-32 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-100 via-blush-100 to-cream" />
        <div className="absolute inset-0 opacity-10">
          <Image
            src="/images/wedding-illustration.png"
            alt=""
            fill
            className="object-cover object-center"
          />
        </div>
        <div className="container-page relative">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="section-sub">memory lane</p>
              <h1 className="section-title">The Wedding Gallery</h1>
              <p className="text-stone-600 max-w-xl mt-3">
                Candids, chaos, and quiet moments &mdash; all shared in one place so nothing gets
                lost in a thousand WhatsApp groups.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur border border-blush-100 text-sm text-wine-700">
                <Sparkles className="w-4 h-4 text-gold-500" />
                {canUpload ? `${album.files.length} uploaded` : 'Coming soon'}
              </span>
              {album.folderUrl && (
                <Link
                  href={album.folderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-wine-700 text-ivory text-sm font-medium hover:bg-wine-800 transition"
                >
                  Open full album
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="container-page space-y-8">
        {/* Connection state banners */}
        {album.needsReconnect && (
          <ConnectionBanner
            tone="error"
            title="The shared album needs reconnecting"
            body="Google rejected our saved sign-in. Uploads are paused until an organizer reconnects."
            isAdmin={isAdmin}
          />
        )}

        {!album.connected && !album.needsEnvSetup && (
          <ConnectionBanner
            tone="info"
            title="The album isn’t connected yet"
            body="An organizer needs to connect a Google Drive account before uploads start working."
            isAdmin={isAdmin}
          />
        )}

        {album.needsEnvSetup && (
          <ConnectionBanner
            tone="info"
            title="Shared album coming soon"
            body="The organizers are finishing the Drive setup."
            isAdmin={isAdmin}
          />
        )}

        {/* Upload */}
        {canUpload ? (
          <PhotoUploader />
        ) : (
          <div className="card p-8 text-center">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-100 to-gold-200 items-center justify-center text-gold-500 mb-3">
              <Camera className="w-7 h-7" />
            </div>
            <h2 className="font-serif text-2xl text-wine-700 mb-2">Uploads paused</h2>
            <p className="text-stone-600 max-w-lg mx-auto">
              The shared Drive isn&rsquo;t reachable right now. Your photos are safe &mdash; just
              hold onto them and we&rsquo;ll bring the album back online shortly.
            </p>
          </div>
        )}

        {/* Gallery */}
        {canUpload && (
          <section>
            <div className="mb-4">
              <h2 className="font-serif text-2xl text-wine-700">Everyone&rsquo;s moments</h2>
              <p className="text-sm text-stone-500">
                Tap any picture to see it full-size. New uploads appear here after a refresh.
              </p>
            </div>

            {album.error && (
              <div className="card p-5 mb-4 flex items-start gap-3 border border-red-200 bg-red-50">
                <AlertTriangle className="w-5 h-5 text-red-700 mt-0.5 flex-none" />
                <div>
                  <p className="font-medium text-red-800">Couldn&rsquo;t reach the album</p>
                  <p className="text-sm text-red-700">{album.error}</p>
                </div>
              </div>
            )}

            <PhotoGallery files={album.files} folderUrl={album.folderUrl} />
          </section>
        )}
      </div>
    </main>
  )
}

function ConnectionBanner({
  tone,
  title,
  body,
  isAdmin,
}: {
  tone: 'info' | 'error'
  title: string
  body: string
  isAdmin: boolean
}) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-blush-200 bg-blush-50 text-wine-700'
  return (
    <div className={`card border p-5 flex items-start gap-3 ${styles}`}>
      <AlertTriangle className="w-5 h-5 mt-0.5 flex-none" />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm mt-1 opacity-90">{body}</p>
        {isAdmin && (
          <Link
            href="/admin/drive-auth"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2"
          >
            <Link2 className="w-4 h-4" />
            Go to Drive settings
          </Link>
        )}
      </div>
    </div>
  )
}
