'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

interface UpdateMyProfileInput {
  fullName: string
  bio: string | null
  avatarUrl: string | null
}

export async function updateMyProfile({ fullName, bio, avatarUrl }: UpdateMyProfileInput) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.rpc('update_my_profile', {
    p_full_name: fullName,
    p_avatar_url: avatarUrl,
    p_bio: bio,
  })

  if (error) {
    console.error('[profile.updateMyProfile]', error)
    throw new Error(error.message)
  }

  revalidatePath('/')
  revalidatePath('/profile')
  revalidatePath('/guests')
  return { success: true }
}

export interface Guest {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
}

export async function getGuests(): Promise<Guest[]> {
  const supabase = createClient()

  const { data, error } = await supabase.rpc('get_guests')
  if (error) {
    console.error('[profile.getGuests]', error)
    return []
  }
  return (data ?? []) as Guest[]
}
