import { getAllUsers } from '@/app/actions/admin'
import { getUserProfile } from '@/app/actions/user'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AdminTabs } from '@/components/AdminTabs'
import { UserRow } from '@/components/admin/UserRow'
import { Users, KeyRound, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function AdminUsersPage() {
  const profile = await getUserProfile()
  if (!profile?.is_admin) redirect('/')

  const [users, authResult] = await Promise.all([
    getAllUsers(),
    createClient().auth.getUser(),
  ])
  const currentUserId = authResult.data.user?.id ?? ''

  const totalGuests = users.length
  const assigned = users.filter((u) => u.room_number).length
  const admins = users.filter((u) => u.is_admin).length

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream to-ivory">
        <div className="container-page">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="section-sub">organizer tools</p>
              <h1 className="section-title">Guests &amp; Rooms</h1>
            </div>
            <AdminTabs />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <Stat icon={Users} label="Total guests" value={totalGuests} tint="from-blush-100 to-blush-200" text="text-wine-700" />
            <Stat icon={KeyRound} label="Rooms assigned" value={`${assigned} / ${totalGuests}`} tint="from-gold-100 to-gold-200" text="text-gold-500" />
            <Stat icon={UserCheck} label="Admins" value={admins} tint="from-green-100 to-green-200" text="text-green-700" />
          </div>
        </div>
      </section>

      <section className="container-page mt-6">
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-blush-100 flex items-center justify-between">
            <h2 className="font-serif text-xl text-wine-700">All guests</h2>
            <p className="text-sm text-stone-500">Click on a room number to edit it</p>
          </div>

          {users.length === 0 ? (
            <div className="p-14 text-center text-stone-500">
              <Users className="w-12 h-12 mx-auto text-blush-300 mb-3" />
              <p>No guests have signed in yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-cream text-stone-500 uppercase text-xs tracking-wider">
                    <th className="px-6 py-3 font-medium">Guest</th>
                    <th className="px-6 py-3 font-medium">Room</th>
                    <th className="px-6 py-3 font-medium">Role</th>
                    <th className="px-6 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blush-100">
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} currentUserId={currentUserId} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
