'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteRequest } from '@/app/actions/requests'
import { Trash2 } from 'lucide-react'

export function DeleteRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border border-red-200 text-red-800 bg-red-50 hover:bg-red-100 transition disabled:opacity-50"
      onClick={() => {
        if (!confirm('Delete this request permanently? It will disappear for the guest too.')) return
        startTransition(async () => {
          try {
            await deleteRequest(requestId)
            router.refresh()
          } catch (e: unknown) {
            alert(e instanceof Error ? e.message : 'Could not delete')
          }
        })
      }}
    >
      <Trash2 className="w-3.5 h-3.5" />
      {pending ? '…' : 'Delete'}
    </button>
  )
}
