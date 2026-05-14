import { getGuests } from '@/app/actions/profile'
import { isStaffLevel } from '@/lib/auth/roles'
import { getUserProfile } from '@/app/actions/user'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Navbar } from '@/components/Navbar'
import { Avatar } from '@/components/Avatar'
import { Users, Pencil, Sparkles, Tag } from 'lucide-react'
import { site } from '@/lib/site'

export default async function GuestsPage() {
  const profile = await getUserProfile()
  if (!profile) redirect('/login')

  const guests = await getGuests()
  const withBio = guests.filter((g) => g.bio && g.bio.trim().length > 0).length

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin={isStaffLevel(profile.admin_level)} user={{ name: profile.full_name, avatarUrl: profile.avatar_url }} />

      <section className="relative pt-32 pb-14 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <Image src={site.images.haldi} alt="" fill priority sizes="100vw" className="object-cover object-bottom opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-b from-ivory via-ivory/80 to-ivory" />
        </div>
        <div className="container-page">
          <p className="section-sub">the guest list</p>
          <h1 className="section-title mb-2">Who&rsquo;s coming</h1>
          <p className="text-stone-600 max-w-xl">
            {guests.length} wonderful humans celebrating with us. Say hi if you spot someone new.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur border border-blush-100 text-sm text-wine-700">
              <Users className="w-4 h-4" />
              {guests.length} guests
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur border border-blush-100 text-sm text-wine-700">
              <Sparkles className="w-4 h-4 text-gold-500" />
              {withBio} with intros
            </span>
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-wine-700 text-ivory text-sm font-medium hover:bg-wine-800 transition"
            >
              <Pencil className="w-4 h-4" />
              Edit your profile
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page mt-4">
        {guests.length === 0 ? (
          <div className="card p-14 text-center text-stone-500">
            <Users className="w-12 h-12 mx-auto text-blush-300 mb-3" />
            <p className="font-serif text-xl text-wine-700 mb-1">No guests yet</p>
            <p className="text-sm">Once people sign in and fill out their profiles, they&rsquo;ll show up here.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guests.map((g) => {
              const isYou = g.id === profile.id
              return (
                <article
                  key={g.id}
                  className={`card p-6 flex gap-4 items-start transition hover:shadow-soft-lg hover:-translate-y-0.5 ${
                    isYou ? 'ring-2 ring-gold-300' : ''
                  }`}
                >
                  <Avatar name={g.full_name} src={g.avatar_url} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-serif text-xl text-wine-700 truncate">
                        {g.full_name ?? 'Guest'}
                      </h3>
                      {isYou && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-100 text-gold-500 border border-gold-200 text-[10px] font-semibold uppercase tracking-wider">
                          You
                        </span>
                      )}
                    </div>
                    {g.group_names.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" aria-hidden />
                        {g.group_names.map((label, i) => (
                          <span
                            key={`${g.id}-grp-${i}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blush-50 text-wine-800 border border-blush-100"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}
                    {g.bio ? (
                      <p className="text-sm text-stone-600 leading-relaxed">{g.bio}</p>
                    ) : (
                      <p className="text-sm italic text-stone-400">
                        {isYou ? (
                          <Link href="/profile" className="underline decoration-dotted hover:text-wine-700">
                            Add a short intro so others can say hi
                          </Link>
                        ) : (
                          'No intro yet.'
                        )}
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
