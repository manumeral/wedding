'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { isCabRequestsBetaEnabled } from '@/lib/cab-beta'
import { buildRequestContentKey, findRecentDuplicateRequestId } from '@/lib/request-dedupe'

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

  const { data: before } = await supabase.from('requests').select('status').eq('id', requestId).single()

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
      old_status: before?.status ?? null,
      new_status: status,
    })
  } catch (e) {
    console.error('[requests.updateRequestStatus] audit log', e)
  }

  revalidatePath('/admin')
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