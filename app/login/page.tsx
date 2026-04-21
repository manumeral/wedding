'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'EMAIL' | 'TOKEN'>('EMAIL')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      setMessage(`Error: ${error.replace(/_/g, ' ')}`)
    }
  }, [searchParams])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/auth/confirm`,
      },
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Check your email! You can click the link, or enter the code below.')
      setStep('TOKEN')
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-md text-center">
      <h1 className="text-3xl font-serif text-rose-800 mb-2">Prachi & Mayank</h1>
      <p className="text-gray-600 mb-8">Welcome to our wedding portal</p>
      
      {step === 'EMAIL' ? (
        <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 border rounded-md border-gray-300 focus:ring-2 focus:ring-rose-500 outline-none"
            required
          />
          <Button 
            type="submit" 
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white p-3 rounded-md font-medium"
          >
            {loading ? 'Processing...' : 'Send Magic Link'}
          </Button>
          {message && <p className="text-sm mt-4 text-gray-700">{message}</p>}
        </form>
      ) : (
        <form action="/auth/verify" method="POST" className="flex flex-col gap-4">
          <input type="hidden" name="email" value={email} />
          <input
            type="text"
            name="token"
            placeholder="Enter the code from your email"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="p-3 border rounded-md border-gray-300 focus:ring-2 focus:ring-rose-500 outline-none tracking-widest text-center text-lg"
            required
          />
          <Button 
            type="submit" 
            className="bg-rose-600 hover:bg-rose-700 text-white p-3 rounded-md font-medium"
          >
            Verify Code
          </Button>
          {message && <p className="text-sm mt-4 text-gray-700">{message}</p>}
        </form>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-rose-50">
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
