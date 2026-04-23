'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('users')
    .select('admin_level')
    .eq('id', user.id)
    .single()

  if (profile?.admin_level !== 'admin' && profile?.admin_level !== 'super_admin') {
    throw new Error('Unauthorized')
  }
  return { supabase, user }
}

export async function getAllUsers() {
  const { supabase } = await assertAdmin()

  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, room_number, admin_level, created_at')
    .order('full_name', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('[admin.getAllUsers]', error)
    return []
  }
  return data ?? []
}

export async function updateUserRoom(userId: string, roomNumber: string) {
  await assertAdmin()
  const supabase = createClient()

  const value = roomNumber.trim() === '' ? null : roomNumber.trim()

  const { error } = await supabase
    .from('users')
    .update({ room_number: value })
    .eq('id', userId)

  if (error) {
    console.error('[admin.updateUserRoom]', error)
    throw new Error(error.message)
  }

  revalidatePath('/admin/users')
  revalidatePath('/')
  return { success: true }
}

export async function updateUserName(userId: string, fullName: string) {
  await assertAdmin()
  const supabase = createClient()

  const value = fullName.trim() === '' ? null : fullName.trim()

  const { error } = await supabase
    .from('users')
    .update({ full_name: value })
    .eq('id', userId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
  return { success: true }
}

export async function getAllEventsAdmin() {
  await assertAdmin()
  const supabase = createClient()

  const { data, error } = await supabase
    .from('events')
    .select('id, name, date, location, live_status_message, order_index')
    .order('order_index', { ascending: true })

  if (error) {
    console.error('[admin.getAllEventsAdmin]', error)
    return []
  }
  return data ?? []
}

export async function updateEventLiveStatus(eventId: string, message: string) {
  await assertAdmin()
  const supabase = createClient()

  const trimmed = message.trim()
  const value = trimmed === '' ? null : trimmed

  const { error } = await supabase
    .from('events')
    .update({ live_status_message: value })
    .eq('id', eventId)

  if (error) {
    console.error('[admin.updateEventLiveStatus]', error)
    throw new Error(error.message)
  }

  revalidatePath('/admin/events')
  revalidatePath('/')
  return { success: true }
}
