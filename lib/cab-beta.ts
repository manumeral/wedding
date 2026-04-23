import { readConfig } from '@/lib/supabase/admin'

export const CAB_REQUESTS_BETA_CONFIG_KEY = 'cab_requests_beta_enabled'

/** When true (app_config value "true"), guests may submit cab / airport-railway requests. */
export async function isCabRequestsBetaEnabled(): Promise<boolean> {
  const raw = await readConfig(CAB_REQUESTS_BETA_CONFIG_KEY)
  return raw?.trim().toLowerCase() === 'true'
}
