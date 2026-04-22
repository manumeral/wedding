'use client'

import { useState, useTransition } from 'react'
import { testDriveConnection, DriveTestResult } from '@/app/actions/drive'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export function DriveTestButton() {
  const [result, setResult] = useState<DriveTestResult | null>(null)
  const [isPending, start] = useTransition()

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setResult(null)
          start(async () => {
            try {
              const r = await testDriveConnection()
              setResult(r)
            } catch (err: any) {
              setResult({
                ok: false,
                fileCount: 0,
                sampleNames: [],
                error: err?.message ?? 'Test failed',
                needsReconnect: false,
              })
            }
          })
        }}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white border border-blush-200 text-wine-700 hover:bg-cream disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CheckCircle2 className="w-4 h-4" />
        )}
        {isPending ? 'Testing…' : 'Test connection'}
      </button>

      {result && result.ok && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Success — saw {result.fileCount} file{result.fileCount === 1 ? '' : 's'} in the folder.
          </div>
          {result.sampleNames.length > 0 && (
            <p className="mt-2 text-xs text-green-700">
              e.g. {result.sampleNames.map((n) => `"${n}"`).join(', ')}
            </p>
          )}
        </div>
      )}

      {result && !result.ok && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2 font-medium">
            <XCircle className="w-4 h-4" />
            {result.needsReconnect ? 'Reconnect needed' : 'Connection failed'}
          </div>
          <p className="mt-1 text-xs text-red-700">{result.error}</p>
        </div>
      )}
    </div>
  )
}
