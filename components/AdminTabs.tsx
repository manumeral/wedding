'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users } from 'lucide-react'

const tabs = [
  { href: '/admin', label: 'Requests', icon: LayoutDashboard, matches: (p: string) => p === '/admin' },
  { href: '/admin/users', label: 'Guests & Rooms', icon: Users, matches: (p: string) => p.startsWith('/admin/users') },
]

export function AdminTabs() {
  const pathname = usePathname()
  return (
    <div className="inline-flex bg-white rounded-full p-1.5 border border-blush-100 shadow-soft">
      {tabs.map(({ href, label, icon: Icon, matches }) => {
        const active = matches(pathname)
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-sm font-medium transition ${
              active
                ? 'bg-wine-700 text-ivory shadow-soft'
                : 'text-stone-600 hover:text-wine-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </Link>
        )
      })}
    </div>
  )
}
