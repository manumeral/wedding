import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isWebPushConfigured } from '@/lib/web-push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface SubscribeBody {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

export async function POST(req: Request) {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: 'Push is not configured on this server.' }, { status: 503 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let body: SubscribeBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth.trim() : ''

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'endpoint and keys.p256dh, keys.auth are required.' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
    },
    { onConflict: 'user_id,endpoint' },
  )

  if (error) {
    console.error('[push/subscribe]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
