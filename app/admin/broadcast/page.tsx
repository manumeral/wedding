import { listGroups } from '@/app/actions/groups'
import { getUserProfile } from '@/app/actions/user'
import { isStaffLevel, isSuperAdminLevel } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AdminTabs } from '@/components/AdminTabs'
import { BroadcastComposer } from '@/components/admin/BroadcastComposer'
import { Megaphone } from 'lucide-react'

export default async function AdminBroadcastPage() {
  const profile = await getUserProfile()
  if (!isStaffLevel(profile?.admin_level)) redirect('/')
  if (!isSuperAdminLevel(profile?.admin_level)) redirect('/admin/users')

  const groups = await listGroups()
  const groupOptions = groups.map((g) => ({ id: g.id, name: g.name }))

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream to-ivory">
        <div className="container-page">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="section-sub">organizer tools</p>
              <h1 className="section-title flex items-center gap-2">
                <Megaphone className="w-8 h-8 text-wine-600" aria-hidden />
                Broadcast
              </h1>
              <p className="text-sm text-stone-600 mt-2 max-w-xl">
                Sends an in-app message to selected groups or all guests. Only super-admins can send.
              </p>
            </div>
            <AdminTabs isSuperAdmin />
          </div>
        </div>
      </section>

      <section className="container-page">
        <BroadcastComposer groups={groupOptions} />
      </section>
    </main>
  )
}
