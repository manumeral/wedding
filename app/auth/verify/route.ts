import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const formData = await request.formData()
  const email = formData.get('email') as string
  const token = formData.get('token') as string
  const origin = new URL(request.url).origin

  const cookieStore = cookies()
  const response = NextResponse.redirect(`${origin}/`, { status: 303 })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  let { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) {
    const fallback = await supabase.auth.verifyOtp({ email, token, type: 'magiclink' })
    error = fallback.error
  }

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
      { status: 303 }
    )
  }

  return response
}
