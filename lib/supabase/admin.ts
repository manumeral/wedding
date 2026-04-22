// Server-only service-role client. Bypasses RLS.
// NEVER import this from a client component. Never return the client
// (or any data it fetches) to the browser without sanitization.

import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Supabase admin client not configured: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  cached = createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return cached
}

export async function readConfig(key: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('app_config')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) {
    console.error('[supabase.admin.readConfig]', key, error)
    return null
  }
  return data?.value ?? null
}

export async function writeConfig(key: string, value: string | null): Promise<void> {
  const admin = createAdminClient()

  if (value === null) {
    const { error } = await admin.from('app_config').delete().eq('key', key)
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await admin
    .from('app_config')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
  if (error) throw new Error(error.message)
}
