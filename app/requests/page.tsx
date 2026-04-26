import { getMyRequests } from '@/app/actions/requests'
import { getUserProfile } from '@/app/actions/user'
import { isStaffLevel } from '@/lib/auth/roles'
import { isCabRequestsBetaEnabled } from '@/lib/cab-beta'
import { Navbar } from '@/components/Navbar'
import { RequestForm } from '@/components/requests/RequestForm'
import { GuestRequestsList } from '@/components/requests/GuestRequestsList'
import { HelpCircle } from 'lucide-react'
import Image from 'next/image'

export default async function RequestsPage() {
  const [requests, profile, cabBeta] = await Promise.all([
    getMyRequests(),
    getUserProfile(),
    isCabRequestsBetaEnabled(),
  ])

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin={isStaffLevel(profile?.admin_level)} user={profile ? { name: profile.full_name, avatarUrl: profile.avatar_url } : null} />

      {/* Hero strip */}
      <section className="relative pt-32 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blush-100 via-cream to-gold-100" />
        <div className="absolute inset-0 opacity-10">
          <Image src="/images/haldi.png" alt="" fill className="object-contain object-right" />
        </div>
        <div className="container-page relative text-center">
          <p className="section-sub">we&apos;re here for you</p>
          <h1 className="section-title">Request Help</h1>
          <p className="text-stone-600 max-w-xl mx-auto mt-3">
            Cab pickup, extra water bottles, station help &mdash; whatever you need,
            just let us know and someone from the family will be on it right away.
          </p>
        </div>
      </section>

      <div className="container-page max-w-2xl mt-10 space-y-10">
        <RequestForm cabBetaEnabled={cabBeta} />

        {/* History */}
        <section>
          <h2 className="font-serif text-2xl text-wine-700 mb-4">Your recent requests</h2>
          {!profile?.id ? (
            <div className="card p-8 text-center text-stone-500">
              <HelpCircle className="w-10 h-10 mx-auto text-blush-300 mb-3" />
              <p>Sign in to see your request history and message the hosts.</p>
            </div>
          ) : (
            <GuestRequestsList initialRows={requests} myUserId={profile.id} />
          )}
        </section>
      </div>
    </main>
  )
}
