'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitRequest(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) throw new Error('Not authenticated')

  const type = formData.get('type') as string
  const details = formData.get('details') as string

  const { error } = await supabase
    .from('requests')
    .insert({
      user_id: user.id,
      type,
      details,
      status: 'pending'
    })

  if (error) throw error
  
  revalidatePath('/requests')
  revalidatePath('/admin')
}

export async function getMyRequests() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data } = await supabase
    .from('requests')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return data || []
}

export async function getAllRequests() {
  const supabase = createClient()
  
  // Verify admin status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) throw new Error('Unauthorized')

  const { data } = await supabase
    .from('requests')
    .select('*, users!requests_user_id_fkey(full_name, room_number)')
    .order('created_at', { ascending: false })

  return data || []
}

export async function updateRequestStatus(requestId: string, status: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const updates: any = { status }
  if (status === 'claimed') updates.assigned_admin_id = user.id

  await supabase
    .from('requests')
    .update(updates)
    .eq('id', requestId)

  revalidatePath('/admin')
}