'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { assertSuperAdmin, type AdminLevel } from '@/lib/auth/roles'

export async function setUserAdminLevel(userId: string, level: AdminLevel) {
  await assertSuperAdmin()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: target, error: tErr } = await supabase
    .from('users')
    .select('admin_level')
    .eq('id', userId)
    .single()
  if (tErr || !target) throw new Error('User not found')

  if (target.admin_level === 'super_admin' && level !== 'super_admin') {
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('admin_level', 'super_admin')
    if ((count ?? 0) <= 1) {
      throw new Error('Cannot demote the last super-admin')
    }
  }

  if (user.id === userId && level === 'none') {
    throw new Error('You cannot remove your own access')
  }

  const { error } = await supabase.from('users').update({ admin_level: level }).eq('id', userId)
  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
  revalidatePath('/admin/team')
  return { success: true }
}
