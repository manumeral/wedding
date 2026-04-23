import { getUserProfile } from '@/app/actions/user'
import { isStaffLevel } from '@/lib/auth/roles'
import { needsGuestProfileCompletion } from '@/lib/auth/profile-completion'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { ProfileCompleteForm } from '@/components/profile/ProfileCompleteForm'

export default async function ProfileCompletePage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  if (isStaffLevel(profile.admin_level)) redirect('/')

  if (
    !needsGuestProfileCompletion({
      admin_level: profile.admin_level,
      full_name: profile.full_name,
      bio: profile.bio,
      avatar_url: profile.avatar_url,
      profile_completed_at: profile.profile_completed_at,
    })
  ) {
    redirect('/')
  }

  return (
    <main className="min-h-screen pb-24">
      <Navbar
        minimalNav
        user={{ name: profile.full_name, avatarUrl: profile.avatar_url }}
      />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream via-ivory to-ivory">
        <div className="container-page max-w-2xl">
          <p className="section-sub">welcome</p>
          <h1 className="section-title mb-2">Finish your guest profile</h1>
          <p className="text-stone-600 max-w-xl">
            Add your name, a short intro, and a photo so everyone can spot you in the guest list. You only
            do this once.
          </p>
        </div>
      </section>

      <section className="container-page max-w-2xl mt-6">
        <ProfileCompleteForm
          userId={profile.id}
          initial={{
            fullName: profile.full_name ?? '',
            bio: profile.bio ?? null,
            avatarUrl: profile.avatar_url ?? null,
          }}
        />
      </section>
    </main>
  )
}
