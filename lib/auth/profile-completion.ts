export type ProfileGateRow = {
  admin_level: string
  full_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  profile_completed_at?: string | null
} | null

export function isStaffProfileRow(row: { admin_level?: string | null } | null | undefined): boolean {
  const level = row?.admin_level
  return level === 'admin' || level === 'super_admin'
}

/**
 * Guests must have name, photo, and short bio before using the rest of the site.
 * Staff exempt. Uses field values (not only profile_completed_at) so users with a stale
 * completed flag are still forced through /profile/complete.
 */
export function needsGuestProfileCompletion(row: ProfileGateRow): boolean {
  if (!row) return false
  if (isStaffProfileRow(row)) return false
  const nameOk = (row.full_name?.trim() ?? '').length > 0
  const avatarOk = (row.avatar_url?.trim() ?? '').length > 0
  const bioOk = (row.bio?.trim() ?? '').length > 0
  return !nameOk || !avatarOk || !bioOk
}

/**
 * True when this session should be blocked from all app surfaces except login, auth, and
 * /profile/complete. Call only when `auth.getUser()` is non-null.
 * - Missing `public.users` row → must complete (after ensure RPC, row should exist).
 * - Staff → never blocked here.
 */
export function guestMustCompleteProfile(
  profileRow: ProfileGateRow | undefined | null,
): boolean {
  if (isStaffProfileRow(profileRow)) return false
  if (profileRow == null) return true
  return needsGuestProfileCompletion(profileRow)
}
