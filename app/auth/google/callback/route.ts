import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { completeOAuthFlow } from '@/lib/google-drive'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STATE_COOKIE = 'drive_oauth_state'

function errorRedirect(req: Request, message: string) {
  const url = new URL('/admin/drive-auth', req.url)
  url.searchParams.set('error', message)
  return NextResponse.redirect(url)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const googleError = url.searchParams.get('error')

  if (googleError) {
    return errorRedirect(req, `Google returned: ${googleError}`)
  }

  if (!code || !state) {
    return errorRedirect(req, 'Missing code or state in callback URL.')
  }

  // CSRF protection: verify the state matches the cookie we set when
  // generating the auth URL.
  const cookieStore = cookies()
  const savedState = cookieStore.get(STATE_COOKIE)?.value
  if (!savedState || savedState !== state) {
    return errorRedirect(req, 'State mismatch. Please try connecting again.')
  }

  // Only admins are allowed to complete this flow.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return errorRedirect(req, 'You must be signed in as an admin to connect Drive.')
  }
  const { data: profile } = await supabase
    .from('users')
    .select('admin_level')
    .eq('id', user.id)
    .single()
  if (profile?.admin_level !== 'admin' && profile?.admin_level !== 'super_admin') {
    return errorRedirect(req, 'Only admins can connect the shared Drive account.')
  }

  try {
    const { email } = await completeOAuthFlow(code)
    const redirect = new URL('/admin/drive-auth', req.url)
    redirect.searchParams.set('connected', '1')
    if (email) redirect.searchParams.set('email', email)
    const res = NextResponse.redirect(redirect)
    // Clean up the one-time state cookie.
    res.cookies.set(STATE_COOKIE, '', { path: '/', maxAge: 0 })
    return res
  } catch (err: any) {
    console.error('[auth.google.callback]', err)
    return errorRedirect(req, err?.message ?? 'Could not complete Google sign-in.')
  }
}
