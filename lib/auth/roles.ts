import { createClient } from '@/lib/supabase/server'

export type AdminLevel = 'none' | 'admin' | 'super_admin'

export function isStaffLevel(level: string | null | undefined): level is 'admin' | 'super_admin' {
  return level === 'admin' || level === 'super_admin'
}

export function isSuperAdminLevel(level: string | null | undefined): boolean {
  return level === 'super_admin'
}

export async function getMyAdminLevel(): Promise<AdminLevel | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('users')
    .select('admin_level')
    .eq('id', user.id)
    .single()
  const raw = data?.admin_level as string | undefined
  if (raw === 'admin' || raw === 'super_admin' || raw === 'none') return raw
  return 'none'
}

export async function assertStaff() {
  const level = await getMyAdminLevel()
  if (!isStaffLevel(level)) {
    throw new Error('Unauthorized')
  }
  return level
}

export async function assertSuperAdmin() {
  const level = await getMyAdminLevel()
  if (level !== 'super_admin') {
    throw new Error('Unauthorized')
  }
}
