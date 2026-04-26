import { getAllRequests } from '@/app/actions/requests'
import { getUserProfile } from '@/app/actions/user'
import { isStaffLevel, isSuperAdminLevel } from '@/lib/auth/roles'
import { isCabRequestsBetaEnabled } from '@/lib/cab-beta'
import { CabBetaToggle } from '@/components/admin/CabBetaToggle'
import { AdminRequestsPanel } from '@/components/admin/AdminRequestsPanel'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AdminTabs } from '@/components/AdminTabs'

export default async function AdminPage() {
  const profile = await getUserProfile()
  if (!isStaffLevel(profile?.admin_level)) redirect('/')
  if (!profile?.id) redirect('/')
  const isSuper = isSuperAdminLevel(profile?.admin_level)

  const [requests, cabBeta] = await Promise.all([getAllRequests(), isCabRequestsBetaEnabled()])

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream to-ivory">
        <div className="container-page">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="section-sub">organizer tools</p>
              <h1 className="section-title">Admin Dashboard</h1>
            </div>
            <AdminTabs isSuperAdmin={isSuper} />
          </div>

          {isSuper && (
            <div className="mb-6">
              <CabBetaToggle initialEnabled={cabBeta} />
            </div>
          )}
        </div>
      </section>

      <section className="container-page mt-6">
        <AdminRequestsPanel initialRequests={requests} myUserId={profile.id} />
      </section>
    </main>
  )
}
