import { getUserProfile } from '@/app/actions/user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { Users, KeyRound } from 'lucide-react'

export default async function ProfilePage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin={!!profile.is_admin} user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream via-ivory to-ivory">
        <div className="container-page max-w-2xl">
          <p className="section-sub">your profile</p>
          <h1 className="section-title mb-2">A bit about you</h1>
          <p className="text-stone-600 max-w-xl">
            Add a photo and a short intro so other guests can say hi when they spot you.
          </p>
        </div>
      </section>

      <section className="container-page max-w-2xl mt-6 space-y-6">
        <ProfileForm
          userId={profile.id}
          initial={{
            fullName: profile.full_name ?? '',
            bio: profile.bio ?? null,
            avatarUrl: profile.avatar_url ?? null,
          }}
        />

        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            href="/guests"
            className="card p-5 flex items-center gap-4 hover:shadow-soft-lg hover:-translate-y-0.5 transition"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blush-100 to-blush-200 flex items-center justify-center text-wine-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="font-serif text-lg text-wine-700">Who&rsquo;s coming</p>
              <p className="text-sm text-stone-500">Browse the other guests</p>
            </div>
          </Link>

          {profile.room_number && (
            <div className="card p-5 flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-100 to-gold-200 flex items-center justify-center text-gold-500">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-stone-500">Your room</p>
                <p className="font-serif text-lg text-wine-700">Room {profile.room_number}</p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
