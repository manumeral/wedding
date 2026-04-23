import { getUserProfile } from '@/app/actions/user'
import { listMyInbox } from '@/app/actions/broadcasts'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { InboxMarkRead } from '@/components/inbox/InboxMarkRead'
import { isStaffLevel } from '@/lib/auth/roles'
import { Mail } from 'lucide-react'

export default async function InboxPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const items = await listMyInbox()
  const unreadIds = items.filter((i) => !i.read_at).map((i) => i.id)

  return (
    <main className="min-h-screen pb-24">
      <InboxMarkRead unreadIds={unreadIds} />
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
          <p className="text-stone-600 mt-2">Messages from the hosts. New items are marked read when you open this page.</p>
        </div>
      </section>

      <section className="container-page max-w-2xl">
        {items.length === 0 ? (
          <div className="card p-12 text-center text-stone-500">
            <Mail className="w-12 h-12 mx-auto text-blush-300 mb-3" />
            <p>No messages yet.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((row) => {
              const b = row.broadcasts
              if (!b) return null
              const unread = !row.read_at
              return (
                <li
                  key={row.id}
                  className={`card p-6 border-l-4 ${unread ? 'border-l-gold-400 bg-cream/40' : 'border-l-transparent'}`}
                >
                  <p className="text-xs text-stone-500 mb-1">
                    {new Date(b.created_at).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {b.targets_all_guests && (
                      <span className="ml-2 rounded-full bg-blush-100 px-2 py-0.5 text-wine-700">All guests</span>
                    )}
                  </p>
                  <h2 className="font-serif text-xl text-wine-800 mb-2">{b.title}</h2>
                  <p className="text-stone-700 whitespace-pre-wrap">{b.body}</p>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
