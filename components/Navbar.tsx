'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X, LogOut, Mail } from 'lucide-react'
import { Avatar } from './Avatar'
import { signOut } from '@/app/actions/user'
import { countUnreadInbox } from '@/app/actions/broadcasts'

interface NavbarProps {
  isAdmin?: boolean
  transparent?: boolean
  user?: {
    name?: string | null
    avatarUrl?: string | null
  } | null
}

export function Navbar({ isAdmin = false, transparent = false, user = null }: NavbarProps) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [inboxUnread, setInboxUnread] = useState(0)

  useEffect(() => {
    if (!transparent) {
      setScrolled(true)
      return
    }
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [transparent])

  useEffect(() => {
    let cancelled = false
    if (!user) {
      setInboxUnread(0)
      return
    }
    countUnreadInbox().then((n) => {
      if (!cancelled) setInboxUnread(n)
    })
    return () => {
      cancelled = true
    }
  }, [user, pathname])

  const textColor = scrolled ? 'text-wine-800' : 'text-white'
  const hoverColor = scrolled ? 'hover:text-wine-600' : 'hover:text-gold-200'

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'bg-ivory/85 backdrop-blur-md shadow-soft border-b border-blush-100/60'
          : 'bg-transparent'
      }`}
    >
      <div className="container-page flex items-center justify-between py-4">
        <Link href="/" className={`font-script text-2xl sm:text-3xl ${textColor} transition`}>
          P <span className="text-gold-400">&amp;</span> M
        </Link>

        <nav className="hidden sm:flex items-center gap-7 text-sm font-medium tracking-wide">
          <Link href="/" className={`${textColor} ${hoverColor} transition`}>Home</Link>
          <Link href="/#itinerary" className={`${textColor} ${hoverColor} transition`}>Itinerary</Link>
          <Link href="/guests" className={`${textColor} ${hoverColor} transition`}>Guests</Link>
          <Link href="/requests" className={`${textColor} ${hoverColor} transition`}>Requests</Link>
          {user && (
            <Link
              href="/inbox"
              className={`inline-flex items-center gap-1.5 ${textColor} ${hoverColor} transition`}
            >
              <Mail className="w-4 h-4 opacity-90 shrink-0" aria-hidden />
              Inbox
              {inboxUnread > 0 && (
                <span className="min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center rounded-full bg-gold-500 text-[10px] font-bold text-wine-900 tabular-nums">
                  {inboxUnread > 9 ? '9+' : inboxUnread}
                </span>
              )}
            </Link>
          )}
          <Link href="/photos" className={`${textColor} ${hoverColor} transition`}>Gallery</Link>
          {isAdmin && (
            <Link href="/admin" className={`font-semibold ${scrolled ? 'text-gold-500' : 'text-gold-300'} hover:opacity-80 transition`}>
              Admin
            </Link>
          )}
          {user && (
            <div className="ml-1 flex items-center gap-2">
              <Link
                href="/profile"
                aria-label="Your profile"
                className={`rounded-full transition hover:opacity-85 ${
                  scrolled ? 'ring-2 ring-blush-200' : 'ring-2 ring-white/40'
                }`}
              >
                <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition ${
                    scrolled
                      ? 'text-wine-700 hover:bg-blush-100'
                      : 'text-white/90 hover:bg-white/15'
                  }`}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </nav>

        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className={`sm:hidden ${textColor}`}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="sm:hidden bg-ivory border-t border-blush-100">
          <nav className="container-page flex flex-col py-4 gap-4 text-wine-800 font-medium">
            {user && (
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 pb-3 mb-1 border-b border-blush-100"
              >
                <Avatar name={user.name} src={user.avatarUrl} size="md" />
                <div>
                  <p className="font-serif text-lg text-wine-700">{user.name ?? 'Your profile'}</p>
                  <p className="text-xs text-stone-500">Edit profile</p>
                </div>
              </Link>
            )}
            <Link href="/" onClick={() => setOpen(false)}>Home</Link>
            <Link href="/#itinerary" onClick={() => setOpen(false)}>Itinerary</Link>
            <Link href="/guests" onClick={() => setOpen(false)}>Guests</Link>
            <Link href="/requests" onClick={() => setOpen(false)}>Requests</Link>
            {user && (
              <Link href="/inbox" onClick={() => setOpen(false)} className="inline-flex items-center gap-2">
                <Mail className="w-4 h-4" aria-hidden />
                Inbox
                {inboxUnread > 0 && (
                  <span className="text-xs font-semibold text-gold-600">({inboxUnread})</span>
                )}
              </Link>
            )}
            <Link href="/photos" onClick={() => setOpen(false)}>Gallery</Link>
            {isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className="text-gold-500 font-semibold">
                Admin
              </Link>
            )}
            {user && (
              <form action={signOut} className="pt-3 mt-1 border-t border-blush-100">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 text-wine-700 hover:text-wine-800"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </form>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
