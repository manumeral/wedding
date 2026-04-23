export type ProfileGateRow = {
  admin_level: string
  profile_completed_at?: string | null
} | null

/** Guests must finish /profile/complete until profile_completed_at is set. Staff exempt. */
export function needsGuestProfileCompletion(row: ProfileGateRow): boolean {
  if (!row) return false
  if (row.admin_level === 'admin' || row.admin_level === 'super_admin') return false
  return (row.profile_completed_at ?? null) == null
}
