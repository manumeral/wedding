'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { assertSuperAdmin } from '@/lib/auth/roles'
import { sendWebPushToUserIds } from '@/lib/web-push'

export type InboxListItem = {
  id: string
  broadcast_id: string
  read_at: string | null
  created_at: string
  broadcasts: {
    title: string
    body: string
    created_at: string
    targets_all_guests: boolean
  } | null
}

export async function sendBroadcast(params: {
  title: string
  body: string
  targetsAllGuests: boolean
  groupIds: string[]
}) {
  await assertSuperAdmin()
  const supabase = createClient()
  const title = params.title.trim()
  const body = params.body.trim()
  if (!title) throw new Error('Title is required')
  if (!body) throw new Error('Message is required')

  const { data, error } = await supabase.rpc('create_broadcast_and_fanout', {
    p_title: title,
    p_body: body,
    p_targets_all_guests: params.targetsAllGuests,
    p_group_ids: params.targetsAllGuests ? [] : params.groupIds,
  })
  if (error) throw new Error(error.message)

  const broadcastId = data as string
  const admin = createAdminClient()
  const { data: inboxRows } = await admin
    .from('user_inbox')
    .select('user_id')
    .eq('broadcast_id', broadcastId)
  const recipientIds = Array.from(new Set((inboxRows ?? []).map((r) => r.user_id)))

  void sendWebPushToUserIds(recipientIds, {
    title,
    body,
    url: '/inbox',
  }).catch((e) => console.error('[broadcasts.sendBroadcast] push', e))

  revalidatePath('/admin/broadcast')
  revalidatePath('/inbox')
  return { broadcastId }
}

export async function listMyInbox(): Promise<InboxListItem[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_inbox')
    .select(`
      id,
      broadcast_id,
      read_at,
      created_at,
      broadcasts (
        title,
        body,
        created_at,
        targets_all_guests
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[broadcasts.listMyInbox]', error)
    return []
  }

  const rows = data ?? []
  return rows.map((row: any) => {
    const b = row.broadcasts
    const broadcast =
      Array.isArray(b) && b.length > 0 ? b[0] : b && typeof b === 'object' ? b : null
    return {
      id: row.id,
      broadcast_id: row.broadcast_id,
      read_at: row.read_at,
      created_at: row.created_at,
      broadcasts: broadcast,
    } as InboxListItem
  })
}

export async function markInboxRead(inboxId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('user_inbox')
    .update({ read_at: new Date().toISOString() })
    .eq('id', inboxId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  revalidatePath('/inbox')
}

export async function markManyInboxRead(inboxIds: string[]) {
  if (inboxIds.length === 0) return
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('user_inbox')
    .update({ read_at: now })
    .eq('user_id', user.id)
    .is('read_at', null)
    .in('id', inboxIds)
  if (error) throw new Error(error.message)
  revalidatePath('/inbox')
}

export async function countUnreadInbox(): Promise<number> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 0
  const { count, error } = await supabase
    .from('user_inbox')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)
  if (error) return 0
  return count ?? 0
}
