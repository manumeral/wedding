'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type UserProfile = {
  id: string
  email: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  admin_level: string
  room_number: string | null
  created_at: string
  profile_completed_at?: string | null
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error) console.error('[getUserProfile]', error.message)
  return profile as UserProfile | null
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function getEvents() {
  const supabase = createClient()
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .order('order_index', { ascending: true })
  
  return events || []
}