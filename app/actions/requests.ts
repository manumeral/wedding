'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { isCabRequestsBetaEnabled } from '@/lib/cab-beta'
import { buildRequestContentKey, findRecentDuplicateRequestId } from '@/lib/request-dedupe'
import { notifyStaffInboxAndPush, requestTypeLabel } from '@/lib/staff-inbox-notify'

function parseOptionalDateTime(raw: FormDataEntryValue | null): string | null {
  if (raw == null || typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export type SubmitRequestState = null | { error: string }

export async function submitRequest(
  _prev: SubmitRequestState,
  formData: FormData,
): Promise<SubmitRequestState> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not signed in.' }

  const type = formData.get('type') as string
  const detailsRaw = formData.get('details')
  const details =
    detailsRaw == null || typeof detailsRaw !== 'string' ? null : detailsRaw.trim() || null

  const row: Record<string, unknown> = {
    user_id: user.id,
    type,
    details,
    status: 'pending',
    pickup_at: null,
    pickup_location: null,
    dropoff_at: null,
    dropoff_location: null,
    hub_kind: null,
  }

  if (type === 'cab' || type === 'pickup') {
    if (!(await isCabRequestsBetaEnabled())) {
      return {
        error:
          'Cab and airport or railway pickup requests are not open yet. Choose another type or check back soon.',
      }
    }
    const pickupAt = parseOptionalDateTime(formData.get('pickup_at'))
    const pickupLoc = formData.get('pickup_location')
    const dropLoc = formData.get('dropoff_location')
    const dropAt = parseOptionalDateTime(formData.get('dropoff_at'))

    row.pickup_at = pickupAt
    row.pickup_location =
      pickupLoc == null || typeof pickupLoc !== 'string' ? null : pickupLoc.trim() || null
    row.dropoff_location =
      dropLoc == null || typeof dropLoc !== 'string' ? null : dropLoc.trim() || null
    row.dropoff_at = dropAt

    if (type === 'pickup') {
      const hub = formData.get('hub_kind')
      const h = hub == null || typeof hub !== 'string' ? '' : hub
      row.hub_kind = h === 'airport' || h === 'railway' ? h : null
    }

    if (!row.pickup_at) return { error: 'Please choose a pickup or arrival time.' }
    if (!row.pickup_location) {
      return { error: 'Please fill in the pickup / station or terminal details.' }
    }
    if (!row.dropoff_location) {
      return { error: 'Please fill in where you need to be dropped off.' }
    }
    if (type === 'pickup' && !row.hub_kind) {
      return { error: 'Choose airport or railway station.' }
    }
  }

  const dedupeKey = buildRequestContentKey({
    type: type as 'cab' | 'pickup' | 'water' | 'other',
    details: (row.details as string) ?? null,
    pickup_at: (row.pickup_at as string) ?? null,
    pickup_location: (row.pickup_location as string) ?? null,
    dropoff_location: (row.dropoff_location as string) ?? null,
    dropoff_at: (row.dropoff_at as string) ?? null,
    hub_kind: (row.hub_kind as string) ?? null,
  })
  const duplicateId = await findRecentDuplicateRequestId(supabase, user.id, dedupeKey)
  if (duplicateId) {
    return {
      error:
        'This request is already in your recent list. Scroll down to confirm — use “Request Help” only once unless something changes.',
    }
  }

  const { error } = await supabase.from('requests').insert(row)

  if (error) {
    return { error: error.message }
  }

  const { data: guestProfile } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const guestName = guestProfile?.full_name?.trim() || 'A guest'
  const label = requestTypeLabel(type)
  const title = `New request: ${label}`
  const bodyParts = [`${guestName} submitted a ${label} request.`]
  if (details) bodyParts.push('', details.length > 800 ? `${details.slice(0, 800)}…` : details)
  if (row.pickup_at) {
    const at = new Date(String(row.pickup_at)).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
    if (at) bodyParts.push('', `Scheduled pickup / arrival: ${at}`)
  }
  if (row.pickup_location) bodyParts.push(`From: ${String(row.pickup_location)}`)
  if (row.dropoff_location) bodyParts.push(`To: ${String(row.dropoff_location)}`)

  void notifyStaffInboxAndPush({
    title,
    body: bodyParts.join('\n'),
    createdByUserId: user.id,
  }).catch((e) => console.error('[submitRequest] staff notify', e))

  revalidatePath('/requests')
  revalidatePath('/admin')
  return null
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
  const { data: profile } = await supabase.from('users').select('admin_level').eq('id', user.id).single()
  if (profile?.admin_level !== 'admin' && profile?.admin_level !== 'super_admin') {
    throw new Error('Unauthorized')
  }

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

  const { data: profile } = await supabase.from('users').select('admin_level').eq('id', user.id).single()
  if (profile?.admin_level !== 'admin' && profile?.admin_level !== 'super_admin') {
    throw new Error('Unauthorized')
  }

  const { data: reqRow, error: loadErr } = await supabase
    .from('requests')
    .select('type, status, user_id, users!requests_user_id_fkey(full_name)')
    .eq('id', requestId)
    .single()

  if (loadErr || !reqRow) {
    throw new Error(loadErr?.message ?? 'Request not found')
  }

  const updates: Record<string, unknown> = { status }
  if (status === 'claimed') updates.assigned_admin_id = user.id

  const { error: upErr } = await supabase.from('requests').update(updates).eq('id', requestId)
  if (upErr) throw upErr

  try {
    const admin = createAdminClient()
    await admin.from('request_audit_log').insert({
      request_id: requestId,
      actor_id: user.id,
      action: 'status_change',
      old_status: reqRow.status,
      new_status: status,
    })
  } catch (e) {
    console.error('[requests.updateRequestStatus] audit log', e)
  }

  if (status === 'claimed' || status === 'resolved') {
    const u = reqRow.users as { full_name: string | null } | { full_name: string | null }[] | null
    const guestRow = Array.isArray(u) ? u[0] : u
    const guestName = guestRow?.full_name?.trim() || 'Guest'
    const { data: actor } = await supabase.from('users').select('full_name').eq('id', user.id).single()
    const actorName = actor?.full_name?.trim() || 'An organizer'
    const label = requestTypeLabel(String(reqRow.type))
    if (status === 'claimed') {
      void notifyStaffInboxAndPush({
        title: `On it: ${label} — ${guestName}`,
        body: `${actorName} is handling ${guestName}'s ${label} request.`,
        createdByUserId: user.id,
        skipUserIds: [user.id],
      }).catch((e) => console.error('[updateRequestStatus] staff notify', e))
    } else {
      void notifyStaffInboxAndPush({
        title: `Resolved: ${label} — ${guestName}`,
        body: `${actorName} marked ${guestName}'s ${label} request as done.`,
        createdByUserId: user.id,
        skipUserIds: [user.id],
      }).catch((e) => console.error('[updateRequestStatus] staff notify', e))
    }
  }

  revalidatePath('/admin')
  revalidatePath('/requests')
}

export type RequestCommentItem = {
  id: string
  body: string
  created_at: string
  user_id: string
  author_name: string | null
}

/**
 * For users who are either the request owner or an organizer. Uses the admin
 * client to resolve author names (guests may not be allowed to read staff profiles via RLS).
 */
export async function getRequestComments(requestId: string): Promise<RequestCommentItem[]> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: r } = await supabase
    .from('requests')
    .select('id, user_id')
    .eq('id', requestId)
    .maybeSingle()
  if (!r) return []

  const { data: prof } = await supabase.from('users').select('admin_level').eq('id', user.id).single()
  const isStaff = prof?.admin_level === 'admin' || prof?.admin_level === 'super_admin'
  if (r.user_id !== user.id && !isStaff) return []

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('request_comments')
    .select('id, body, created_at, user_id, users!request_comments_user_id_fkey(full_name)')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[getRequestComments]', error)
    return []
  }

  return (data ?? []).map((row: any) => {
    const u = row.users
    const g = Array.isArray(u) ? u[0] : u
    return {
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      user_id: row.user_id,
      author_name: (g as { full_name: string | null } | null)?.full_name?.trim() ?? null,
    }
  })
}

export async function addRequestComment(
  requestId: string,
  body: string,
): Promise<{ ok: true } | { error: string }> {
  const t = body.trim()
  if (!t) return { error: 'Message cannot be empty' }
  if (t.length > 4000) return { error: 'Message is too long' }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { error } = await supabase
    .from('request_comments')
    .insert({ request_id: requestId, user_id: user.id, body: t })

  if (error) return { error: error.message }
  return { ok: true }
}

export async function deleteRequest(requestId: string) {
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

  const { error } = await supabase.from('requests').delete().eq('id', requestId)
  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin')
  revalidatePath('/requests')
}