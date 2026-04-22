'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'

interface NavbarProps {
  isAdmin?: boolean
  transparent?: boolean
}

export function Navbar({ isAdmin = false, transparent = false }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

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
          <Link href="/requests" className={`${textColor} ${hoverColor} transition`}>Requests</Link>
          <Link href="/photos" className={`${textColor} ${hoverColor} transition`}>Gallery</Link>
          {isAdmin && (
            <Link href="/admin" className={`font-semibold ${scrolled ? 'text-gold-500' : 'text-gold-300'} hover:opacity-80 transition`}>
              Admin
            </Link>
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
            <Link href="/" onClick={() => setOpen(false)}>Home</Link>
            <Link href="/#itinerary" onClick={() => setOpen(false)}>Itinerary</Link>
            <Link href="/requests" onClick={() => setOpen(false)}>Requests</Link>
            <Link href="/photos" onClick={() => setOpen(false)}>Gallery</Link>
            {isAdmin && (
              <Link href="/admin" onClick={() => setOpen(false)} className="text-gold-500 font-semibold">
                Admin
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  )
}
