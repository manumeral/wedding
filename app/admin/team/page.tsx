import { getAllUsers } from '@/app/actions/admin'
import { listGuestGroupAssignments, listGuestGroupsForStaff } from '@/app/actions/groups'
import { getUserProfile } from '@/app/actions/user'
import { isSuperAdminLevel, isStaffLevel } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AdminTabs } from '@/components/AdminTabs'
import { UserRow } from '@/components/admin/UserRow'
import { Users, Crown } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function AdminTeamPage() {
  const profile = await getUserProfile()
  if (!isStaffLevel(profile?.admin_level)) redirect('/')
  if (!isSuperAdminLevel(profile?.admin_level)) redirect('/admin/users')

  const [users, authResult, guestGroups, assignments] = await Promise.all([
    getAllUsers(),
    createClient().auth.getUser(),
    listGuestGroupsForStaff(),
    listGuestGroupAssignments(),
  ])
  const currentUserId = authResult.data.user?.id ?? ''
  const groupDefs = guestGroups.map((g) => ({ id: g.id, name: g.name }))

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} />

      <section className="pt-28 pb-10 bg-gradient-to-b from-cream to-ivory">
        <div className="container-page">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="section-sub">organizer tools</p>
              <h1 className="section-title flex items-center gap-2">
                <Crown className="w-8 h-8 text-gold-500" aria-hidden />
                Team &amp; roles
              </h1>
              <p className="text-sm text-stone-600 mt-2 max-w-xl">
                Only super-admins can change roles. Admins can still assign rooms on{' '}
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

      <section className="container-page mt-6">
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-blush-100">
            <h2 className="font-serif text-xl text-wine-700">Everyone</h2>
            <p className="text-sm text-stone-500 mt-1">Set Guest, Admin, or Super-admin per person.</p>
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
                    <th className="px-6 py-3 font-medium">
                      Group labels
                      <span className="block font-normal normal-case text-stone-400 text-[10px] tracking-normal mt-0.5">
                        Assign for broadcasts &amp; directory
                      </span>
                    </th>
                    <th className="px-6 py-3 font-medium">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blush-100">
                  {users.map((u) => {
                    const memberIds = assignments[u.id] ?? []
                    const chips = groupDefs.filter((g) => memberIds.includes(g.id))
                    return (
                      <UserRow
                        key={u.id}
                        user={u}
                        currentUserId={currentUserId}
                        canEditRoles
                        canAssignGroups
                        showGroupLabelsColumn
                        groupLabelChips={chips}
                        allGroups={groupDefs}
                        userGroupIds={memberIds}
                        canEditGuestProfile
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
