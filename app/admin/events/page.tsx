import { getAllEventsAdmin } from '@/app/actions/admin'
import { getUserProfile } from '@/app/actions/user'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AdminTabs } from '@/components/AdminTabs'
import { EventStatusCard } from '@/components/admin/EventStatusCard'
import { CalendarDays, Radio, CheckCircle2 } from 'lucide-react'

export default async function AdminEventsPage() {
  const profile = await getUserProfile()
  if (!profile?.is_admin) redirect('/')

  const events = await getAllEventsAdmin()

  const total = events.length
  const live = events.filter((e) => e.live_status_message && e.live_status_message.length > 0).length
  const idle = total - live

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream to-ivory">
        <div className="container-page">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="section-sub">organizer tools</p>
              <h1 className="section-title">Live Event Status</h1>
            </div>
            <AdminTabs />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Stat icon={CalendarDays} label="Total events" value={total} tint="from-blush-100 to-blush-200" text="text-wine-700" />
            <Stat icon={Radio} label="Currently live" value={live} tint="from-green-100 to-green-200" text="text-green-700" />
            <Stat icon={CheckCircle2} label="Idle" value={idle} tint="from-gold-100 to-gold-200" text="text-gold-500" />
          </div>
        </div>
      </section>

      <section className="container-page mt-6">
        {events.length === 0 ? (
          <div className="card p-14 text-center text-stone-500">
            <CalendarDays className="w-12 h-12 mx-auto text-blush-300 mb-3" />
            <p className="font-serif text-xl text-wine-700 mb-1">No events found</p>
            <p className="text-sm">
              Run <code className="px-2 py-0.5 rounded bg-cream text-wine-700 font-mono text-xs">supabase/seed.sql</code> in the Supabase SQL editor to populate the default events.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-stone-500 px-1">
              Updates appear on every guest&apos;s home screen the next time they load the page.
              Clear the message to stop showing the &ldquo;Live&rdquo; pill.
            </p>
            {events.map((ev) => (
              <EventStatusCard key={ev.id} event={ev} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function Stat({ icon: Icon, label, value, tint, text }: any) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tint} flex items-center justify-center ${text}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
        <p className="font-serif text-3xl text-wine-700">{value}</p>
      </div>
    </div>
  )
}
