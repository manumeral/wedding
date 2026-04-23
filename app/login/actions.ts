'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { checkAndRecord } from '@/lib/rate-limit'

export interface RequestMagicLinkResult {
  ok: boolean
  error?: string
}

function getClientIp(): string {
  const h = headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = h.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

export async function requestMagicLink(
  rawEmail: string,
  emailRedirectTo: string,
): Promise<RequestMagicLinkResult> {
  const email = rawEmail.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Please enter a valid email address.' }
  }

  const emailCheck = await checkAndRecord(
    'magic_link',
    `email:${email}`,
    15 * 60,
    3,
  )
  if (!emailCheck.allowed) {
    return {
      ok: false,
      error:
        "We've already sent a few links to that address. Please wait 15 minutes before trying again (and check your spam folder).",
    }
  }

  const ipCheck = await checkAndRecord(
    'magic_link',
    `ip:${getClientIp()}`,
    15 * 60,
    30,
  )
  if (!ipCheck.allowed) {
    return {
      ok: false,
      error:
        'Too many login attempts from this network. Please try again in a few minutes.',
    }
  }

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo },
  })

  if (error) {
    console.error('[login.requestMagicLink]', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}
