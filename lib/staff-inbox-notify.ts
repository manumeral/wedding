import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendWebPushToUserIds } from '@/lib/web-push'

export function requestTypeLabel(type: string): string {
  const m: Record<string, string> = {
    cab: 'Cab / transport',
    pickup: 'Airport or railway pickup',
    water: 'Water or refreshments',
    other: 'Other',
  }
  return m[type] ?? type
}

type NotifyStaffParams = {
  title: string
  body: string
  /** Any valid users.id; used as broadcasts.created_by (FK). */
  createdByUserId: string
  /** e.g. exclude the admin who just claimed/resolved so they are not self-notified. */
  skipUserIds?: string[]
}

/**
 * Inserts a staff-only broadcast, fans out to admin/super_admin inboxes, and best-effort Web Push to /inbox.
 */
export async function notifyStaffInboxAndPush(params: NotifyStaffParams): Promise<void> {
  const admin = createAdminClient()
  const { data: staff, error: staffErr } = await admin
    .from('users')
    .select('id')
    .in('admin_level', ['admin', 'super_admin'])

  if (staffErr) {
    console.error('[staff-inbox-notify] staff list', staffErr)
    return
  }

  const skip = new Set(params.skipUserIds ?? [])
  const recipientIds = (staff ?? [])
    .map((s) => s.id)
    .filter((id) => !skip.has(id))

  if (recipientIds.length === 0) return

  const { data: insB, error: bErr } = await admin
    .from('broadcasts')
    .insert({
      title: params.title,
      body: params.body,
      targets_all_guests: false,
      audience: 'staff',
      created_by: params.createdByUserId,
    })
    .select('id')
    .single()

  if (bErr || !insB) {
    console.error('[staff-inbox-notify] broadcast', bErr)
    return
  }

  const rows = recipientIds.map((user_id) => ({
    user_id,
    broadcast_id: insB.id,
  }))

  const { error: inErr } = await admin.from('user_inbox').insert(rows)
  if (inErr) {
    console.error('[staff-inbox-notify] user_inbox', inErr)
    await admin.from('broadcasts').delete().eq('id', insB.id)
    return
  }

  void sendWebPushToUserIds(recipientIds, {
    title: params.title,
    body: params.body,
    url: '/inbox',
  }).catch((e) => console.error('[staff-inbox-notify] push', e))

  revalidatePath('/inbox')
}
