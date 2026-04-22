'use server'

import { createClient } from '@/lib/supabase/server'

export async function getUserProfile() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) console.error('[getUserProfile]', error.message)
  return profile
}

export async function getEvents() {
  const supabase = createClient()
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('order_index', { ascending: true })
  
  return events || []
}