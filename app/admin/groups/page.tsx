import { listGroups } from '@/app/actions/groups'
import { getUserProfile } from '@/app/actions/user'
import { isStaffLevel, isSuperAdminLevel } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AdminTabs } from '@/components/AdminTabs'
import { GroupsAdminPanel } from '@/components/admin/GroupsAdminPanel'
import { Tags } from 'lucide-react'

export default async function AdminGroupsPage() {
  const profile = await getUserProfile()
  if (!isStaffLevel(profile?.admin_level)) redirect('/')
  if (!isSuperAdminLevel(profile?.admin_level)) redirect('/admin/users')

  const groups = await listGroups()

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream to-ivory">
        <div className="container-page">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="section-sub">organizer tools</p>
              <h1 className="section-title flex items-center gap-2">
                <Tags className="w-8 h-8 text-wine-600" aria-hidden />
                Guest groups
              </h1>
              <p className="text-sm text-stone-600 mt-2 max-w-xl">
                Labels for targeting broadcasts (e.g. family, outstation). Assign people on{' '}
                <a href="/admin/users" className="text-wine-700 underline">
                  Guests &amp; Rooms
                </a>
                .
              </p>
            </div>
            <AdminTabs isSuperAdmin />
          </div>
        </div>
      </section>

      <section className="container-page">
        <GroupsAdminPanel initialGroups={groups} />
      </section>
    </main>
  )
}
