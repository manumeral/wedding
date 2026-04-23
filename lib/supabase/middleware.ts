import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { needsGuestProfileCompletion } from '@/lib/auth/profile-completion'

function profileGateExemptPath(pathname: string) {
  if (pathname.startsWith('/login')) return true
  if (pathname.startsWith('/auth')) return true
  if (pathname === '/profile/complete') return true
  return false
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (user) {
    const pathname = request.nextUrl.pathname
    const { data: profileRow } = await supabase
      .from('users')
      .select('admin_level, profile_completed_at, full_name, bio, avatar_url')
      .eq('id', user.id)
      .maybeSingle()

    if (profileRow && needsGuestProfileCompletion(profileRow)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Complete your guest profile first.' }, { status: 403 })
      }
      if (!profileGateExemptPath(pathname)) {
        const url = request.nextUrl.clone()
        url.pathname = '/profile/complete'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}
