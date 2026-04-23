'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { markManyInboxRead } from '@/app/actions/broadcasts'

export function InboxMarkRead({ unreadIds }: { unreadIds: string[] }) {
  const router = useRouter()
  const done = useRef(false)

  useEffect(() => {
    if (unreadIds.length === 0 || done.current) return
    done.current = true
    markManyInboxRead(unreadIds).then(() => router.refresh())
  }, [unreadIds, router])

  return null
}
