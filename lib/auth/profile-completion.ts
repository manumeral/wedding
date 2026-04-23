export type ProfileGateRow = {
  admin_level: string
  full_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  profile_completed_at?: string | null
} | null

/**
 * Guests must have name, photo, and short bio before using the rest of the site.
 * Staff exempt. Uses field values (not only profile_completed_at) so users with a stale
 * completed flag are still forced through /profile/complete.
 */
export function needsGuestProfileCompletion(row: ProfileGateRow): boolean {
  if (!row) return false
  if (row.admin_level === 'admin' || row.admin_level === 'super_admin') return false
  const nameOk = (row.full_name?.trim() ?? '').length > 0
  const avatarOk = (row.avatar_url?.trim() ?? '').length > 0
  const bioOk = (row.bio?.trim() ?? '').length > 0
  return !nameOk || !avatarOk || !bioOk
}
