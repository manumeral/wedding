import { getUserProfile } from '@/app/actions/user'
import { isStaffLevel } from '@/lib/auth/roles'
import { needsGuestProfileCompletion } from '@/lib/auth/profile-completion'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Navbar } from '@/components/Navbar'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { GuestProfileReadOnly } from '@/components/profile/GuestProfileReadOnly'
import { Users, KeyRound } from 'lucide-react'

export default async function ProfilePage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const staff = isStaffLevel(profile.admin_level)
  const incomplete = needsGuestProfileCompletion({
    admin_level: profile.admin_level,
    full_name: profile.full_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    profile_completed_at: profile.profile_completed_at ?? null,
  })
  if (!staff && incomplete) {
    redirect('/profile/complete')
  }

  const guestLocked = !staff && !incomplete

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin={staff} user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream via-ivory to-ivory">
        <div className="container-page max-w-2xl">
          <p className="section-sub">your profile</p>
          <h1 className="section-title mb-2">A bit about you</h1>
          <p className="text-stone-600 max-w-xl">
            {guestLocked
              ? 'How other guests see you in the list.'
              : 'Update your photo, name, or intro anytime.'}
          </p>
        </div>
      </section>

      <section className="container-page max-w-2xl mt-6 space-y-6">
        {guestLocked ? (
          <GuestProfileReadOnly
            fullName={profile.full_name}
            bio={profile.bio}
            avatarUrl={profile.avatar_url}
          />
        ) : (
          <ProfileForm
            userId={profile.id}
            initial={{
              fullName: profile.full_name ?? '',
              bio: profile.bio ?? null,
              avatarUrl: profile.avatar_url ?? null,
            }}
          />
        )}

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
