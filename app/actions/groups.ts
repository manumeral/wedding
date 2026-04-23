'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { assertSuperAdmin } from '@/lib/auth/roles'

export type GuestGroup = {
  id: string
  slug: string
  name: string
  created_at: string
}

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'group'
}

export async function listGroups(): Promise<GuestGroup[]> {
  await assertSuperAdmin()
  const supabase = createClient()
  const { data, error } = await supabase
    .from('guest_groups')
    .select('id, slug, name, created_at')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as GuestGroup[]
}

export async function createGroup(name: string, slug?: string) {
  await assertSuperAdmin()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Name is required')
  const finalSlug = slug?.trim() ? slugify(slug) : slugify(trimmed)
  const { error } = await supabase.from('guest_groups').insert({
    name: trimmed,
    slug: finalSlug,
    created_by: user.id,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/groups')
  revalidatePath('/admin/users')
  revalidatePath('/admin/broadcast')
  return { success: true }
}

export async function deleteGroup(groupId: string) {
  await assertSuperAdmin()
  const supabase = createClient()
  const { error } = await supabase.from('guest_groups').delete().eq('id', groupId)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/groups')
  revalidatePath('/admin/users')
  revalidatePath('/admin/broadcast')
  return { success: true }
}

export async function setUserGroups(userId: string, groupIds: string[]) {
  await assertSuperAdmin()
  const supabase = createClient()
  const ids = Array.from(new Set(groupIds))
  const { error: delErr } = await supabase.from('user_guest_groups').delete().eq('user_id', userId)
  if (delErr) throw new Error(delErr.message)
  if (ids.length > 0) {
    const rows = ids.map((group_id) => ({ user_id: userId, group_id }))
    const { error: insErr } = await supabase.from('user_guest_groups').insert(rows)
    if (insErr) throw new Error(insErr.message)
  }
  revalidatePath('/admin/users')
  revalidatePath('/admin/team')
  return { success: true }
}

/** user_id -> group_id[] for super-admin guest table */
export async function listGuestGroupAssignments(): Promise<Record<string, string[]>> {
  await assertSuperAdmin()
  const supabase = createClient()
  const { data, error } = await supabase.from('user_guest_groups').select('user_id, group_id')
  if (error) throw new Error(error.message)
  const map: Record<string, string[]> = {}
  for (const row of data ?? []) {
    const uid = row.user_id as string
    const gid = row.group_id as string
    if (!map[uid]) map[uid] = []
    map[uid].push(gid)
  }
  return map
}
