import { getUserProfile } from '@/app/actions/user'
import { listMyInbox } from '@/app/actions/broadcasts'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { isStaffLevel } from '@/lib/auth/roles'
import { Mail } from 'lucide-react'
import { InboxListLive } from '@/components/inbox/InboxListLive'

export default async function InboxPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const items = await listMyInbox()

  return (
    <main className="min-h-screen pb-24">
      <Navbar
        isAdmin={isStaffLevel(profile.admin_level)}
        user={{ name: profile.full_name, avatarUrl: profile.avatar_url }}
      />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream to-ivory">
        <div className="container-page max-w-2xl">
          <p className="section-sub">updates</p>
          <h1 className="section-title flex items-center gap-3">
            <Mail className="w-9 h-9 text-wine-600" aria-hidden />
            Inbox
          </h1>
          <p className="text-stone-600 mt-2">
            {isStaffLevel(profile.admin_level) ? (
              <>Messages from the hosts, plus team alerts about guest requests. New items are marked read when you open this page.</>
            ) : (
              <>Messages from the hosts. New items are marked read when you open this page.</>
            )}
          </p>
        </div>
      </section>

      <section className="container-page max-w-2xl">
        <InboxListLive initialItems={items} />
      </section>
    </main>
  )
}
