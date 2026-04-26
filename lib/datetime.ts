/**
 * All guest-facing and admin schedule times use **India Standard Time (IST)** explicitly,
 * so Vercel (UTC) and every browser show the same wall-clock time for the Patna events.
 */
export const TIMEZONE_IST = 'Asia/Kolkata' as const

function toValidDate(input: string | number | Date | null | undefined): Date | null {
  if (input == null || input === '') return null
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/** e.g. "1:52 am" line in admin request TIME column */
export function formatRequestCreatedTimeIST(iso: string | number | Date) {
  const d = toValidDate(iso)
  if (!d) return '—'
  return d.toLocaleTimeString('en-IN', {
    timeZone: TIMEZONE_IST,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** e.g. "26 Apr" */
export function formatRequestCreatedDateLineIST(iso: string | number | Date) {
  const d = toValidDate(iso)
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', {
    timeZone: TIMEZONE_IST,
    day: 'numeric',
    month: 'short',
  })
}

/** Pickup / arrival / drop-off lines: "26 Apr, 5:35 pm" */
export function formatTransportDetailIST(iso: string | number | Date) {
  const d = toValidDate(iso)
  if (!d) return '—'
  return d.toLocaleString('en-IN', {
    timeZone: TIMEZONE_IST,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Itinerary cards & admin event list: "27 Apr '26 · 6:30 pm" */
export function formatEventDateTimeIST(iso: string) {
  const d = toValidDate(iso)
  if (!d) return iso
  return (
    d.toLocaleDateString('en-IN', {
      timeZone: TIMEZONE_IST,
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    }) +
    ' · ' +
    d.toLocaleTimeString('en-IN', { timeZone: TIMEZONE_IST, hour: 'numeric', minute: '2-digit' })
  )
}

/** Inbox + comment thread chips (hour: 2-digit) */
export function formatShortDateTimeChipsIST(iso: string) {
  const d = toValidDate(iso)
  if (!d) return '—'
  return d.toLocaleString('en-IN', {
    timeZone: TIMEZONE_IST,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Guest "Your recent requests" created line */
export function formatGuestRequestMetaIST(iso: string) {
  return formatTransportDetailIST(iso)
}

/** User table join date: "25 Apr" */
export function formatUserDateShortIST(iso: string) {
  const d = toValidDate(iso)
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', {
    timeZone: TIMEZONE_IST,
    day: 'numeric',
    month: 'short',
  })
}

/** Drive / generic: datetime in IST */
export function formatDateTimeLongIST(iso: string) {
  const d = toValidDate(iso)
  if (!d) return '—'
  return d.toLocaleString('en-IN', { timeZone: TIMEZONE_IST, dateStyle: 'medium', timeStyle: 'short' })
}
