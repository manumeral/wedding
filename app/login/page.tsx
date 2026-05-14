'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Mail, KeyRound, Loader2 } from 'lucide-react'
import { requestMagicLink } from './actions'
import { site } from '@/lib/site'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'EMAIL' | 'TOKEN'>('EMAIL')
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get('error')
    if (error) {
      setMessage(error.replace(/_/g, ' '))
      setIsError(true)
    }
  }, [searchParams])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setIsError(false)

    const result = await requestMagicLink(email, `${location.origin}/auth/confirm`)

    if (!result.ok) {
      setMessage(result.error ?? 'Something went wrong. Please try again.')
      setIsError(true)
    } else {
      setMessage('Check your email! Click the magic link, or enter the code below.')
      setIsError(false)
      setStep('TOKEN')
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-md">
      <div className="card p-8 sm:p-10 backdrop-blur-sm bg-white/95 animate-fade-up">
        <div className="text-center mb-8">
          <p className="font-script text-3xl text-blush-400 mb-1">welcome</p>
          <h1 className="font-serif text-4xl text-wine-700">{site.couple.namesAmpersand}</h1>
          <div className="divider-ornament my-4">
            <span className="h-px w-12 bg-gold-300" />
            <span className="text-sm">❖</span>
            <span className="h-px w-12 bg-gold-300" />
          </div>
          <p className="text-stone-600 text-sm">
            {step === 'EMAIL'
              ? "Sign in with the email your invite was sent to"
              : `We sent a code to ${email}`}
          </p>
        </div>

        {step === 'EMAIL' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Email</span>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-blush-400" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 focus:border-wine-500 outline-none transition"
                  required
                />
              </div>
            </label>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending magic link...
                </>
              ) : (
                'Send Magic Link'
              )}
            </button>
          </form>
        ) : (
          <form action="/auth/verify" method="POST" className="space-y-4">
            <input type="hidden" name="email" value={email} />
            <label className="block">
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Code from email</span>
              <div className="relative mt-1.5">
                <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-blush-400" />
                <input
                  type="text"
                  name="token"
                  inputMode="numeric"
                  placeholder="00000000"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-blush-200 bg-white focus:ring-2 focus:ring-wine-500 focus:border-wine-500 outline-none transition tracking-[0.5em] text-center text-lg font-mono"
                  required
                />
              </div>
            </label>
            <button type="submit" className="btn-primary w-full">
              Verify &amp; Enter
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('EMAIL')
                setMessage('')
                setIsError(false)
                setToken('')
              }}
              className="w-full text-sm text-stone-500 hover:text-wine-700 transition"
            >
              Use a different email
            </button>
          </form>
        )}

        {message && (
          <p className={`text-sm mt-5 text-center ${isError ? 'text-red-700' : 'text-green-700'}`}>
            {message}
          </p>
        )}
      </div>

      <p className="text-center text-ivory/70 text-xs mt-6 text-shadow-soft">{site.footer.dateLine}</p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src={site.images.coupleHero}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-wine-800/70 via-wine-700/60 to-black/70" />
      </div>
      <div className="relative z-10 w-full flex flex-col items-center">
        <Suspense fallback={<div className="text-ivory">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
