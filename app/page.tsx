import { getUserProfile, getEvents } from '@/app/actions/user'
import { Itinerary } from '@/components/Itinerary'
import { Hero } from '@/components/Hero'
import { Navbar } from '@/components/Navbar'
import Image from 'next/image'
import Link from 'next/link'
import { KeyRound, MessageCircleHeart, ImagePlus, ArrowRight, Users } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { getGuests } from '@/app/actions/profile'
import { isStaffLevel } from '@/lib/auth/roles'

export default async function Home() {
  const profile = await getUserProfile()
  const events = await getEvents()
  const guests = profile ? await getGuests() : []

  const firstName = profile?.full_name?.split(' ')[0] ?? null
  const profileIncomplete = profile
    ? !profile.avatar_url || !profile.bio || profile.bio.trim().length === 0
    : false
  const previewGuests = guests.filter((g) => g.id !== profile?.id).slice(0, 4)

  return (
    <main className="min-h-screen relative">
      <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
        <Image
          src="/images/palace-couple-night.png"
          alt=""
          fill
          priority
          sizes="100vw"
          quality={90}
          className="object-cover object-[center_25%] sm:object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ivory/45 via-ivory/60 to-ivory/78" />
      </div>

      <div className="relative z-10">
      <Navbar
        isAdmin={isStaffLevel(profile?.admin_level)}
        transparent
        user={profile ? { name: profile.full_name, avatarUrl: profile.avatar_url } : null}
      />

      <Hero name={firstName} />

      {/* Welcome + Room Allocation */}
      <section className="relative py-20 bg-ivory/68 backdrop-blur-[2px] border-t border-white/30">
        <div className="container-page relative">
          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            <div className="card p-8 md:p-10 animate-fade-up">
              <p className="section-sub">a warm welcome</p>
              <h2 className="font-serif text-3xl sm:text-4xl text-wine-700 mb-4">
                {firstName ? `Hello, ${firstName}!` : 'Hello!'}
              </h2>
              <p className="text-stone-600 leading-relaxed mb-6">
                We&apos;re over the moon that you&apos;ll be part of our celebrations.
                This little portal is your home base for the week &mdash; itineraries, room details,
                and a way to ping the organizers if you need anything at all.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="#itinerary" className="btn-primary">
                  See the schedule <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
                <Link href="/requests" className="btn-secondary">
                  Request something
                </Link>
              </div>

              {profileIncomplete && (
                <Link
                  href="/profile"
                  className="mt-6 flex items-center gap-3 p-3 pr-4 rounded-2xl bg-gradient-to-r from-blush-50 to-gold-50 border border-blush-100 hover:border-wine-300 transition group"
                >
                  <Avatar name={profile?.full_name} src={profile?.avatar_url} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-wine-700">
                      Add a photo &amp; intro
                    </p>
                    <p className="text-xs text-stone-500 truncate">
                      Help other guests recognise you on the day
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-wine-700 group-hover:translate-x-0.5 transition" />
                </Link>
              )}
            </div>

            <div className="relative rounded-3xl overflow-hidden shadow-soft-lg animate-fade-up">
              <div className="absolute inset-0 bg-gradient-to-br from-wine-700 via-wine-800 to-wine-800" />
              <div className="absolute inset-0 opacity-35">
                <Image
                  src="/images/palace-couple-night.png"
                  alt=""
                  fill
                  className="object-cover object-[center_20%] mask-fade-b"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <div className="relative p-8 md:p-10 text-ivory h-full flex flex-col justify-between min-h-[240px]">
                <div className="flex items-center gap-2 text-gold-300">
                  <KeyRound className="w-5 h-5" />
                  <span className="uppercase tracking-[0.25em] text-xs font-medium">Your stay</span>
                </div>
                {profile?.room_number ? (
                  <div>
                    <p className="text-sm text-ivory/70 mb-1">Room allocation</p>
                    <p className="font-serif text-5xl sm:text-6xl text-gold-200">
                      #{profile.room_number}
                    </p>
                    <p className="text-ivory/80 mt-3 text-sm">
                      Swing by the reception desk with your ID to collect your key. We&apos;ll see you there!
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-ivory/70 mb-2">Room allocation</p>
                    <p className="font-serif text-2xl sm:text-3xl text-gold-200 mb-3">Coming soon</p>
                    <p className="text-ivory/80 text-sm">
                      Your room will appear here once the organizers assign it. Need it urgently?
                      <Link href="/requests" className="underline ml-1 decoration-gold-300 underline-offset-4">Let us know</Link>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <Itinerary events={events} />

      {/* Our Story */}
      <section className="relative py-20 bg-gradient-to-br from-blush-50/85 via-cream/80 to-gold-100/85 backdrop-blur-sm overflow-hidden border-y border-white/35">
        <div className="container-page relative">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-soft-lg ring-1 ring-white/50">
              <Image
                src="/images/palace-couple-night.png"
                alt="Prachi and Mayank"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-[center_30%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-wine-800/40 via-transparent to-transparent" />
            </div>
            <div className="animate-fade-up">
              <p className="section-sub">the happy couple</p>
              <h2 className="section-title mb-6">Our story, so far</h2>
              <p className="text-stone-700 leading-relaxed mb-4">
                Two people, one journey, and countless tiny moments that brought us here.
                From first hellos to planning a life together &mdash; it still feels a little
                unreal that the big day is just around the corner.
              </p>
              <p className="text-stone-700 leading-relaxed mb-6">
                We can&apos;t wait to share every laugh, every dance, and every plate of food with you.
                Thank you for making the trip and being part of our forever.
              </p>
              <div className="flex items-center gap-3 text-wine-700">
                <span className="h-px w-12 bg-gold-400" />
                <span className="font-script text-3xl">Prachi &amp; Mayank</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick actions carousel (mobile-first) */}
      <section className="py-16 bg-ivory/70 backdrop-blur-sm border-t border-white/25">
        <div className="container-page">
          <div className="text-center mb-10">
            <p className="section-sub">before you go</p>
            <h2 className="section-title">Everything you might need</h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <Link href="/requests" className="group card p-7 flex items-start gap-5 hover:shadow-soft-lg transition-all hover:-translate-y-0.5">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-blush-200 to-blush-300 flex items-center justify-center text-wine-700">
                <MessageCircleHeart className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-serif text-2xl text-wine-700 mb-1">Request Help</h3>
                <p className="text-stone-600 text-sm">Cab, airport pickup, water bottles, or anything else &mdash; we&apos;ve got you.</p>
                <p className="mt-3 text-wine-700 text-sm inline-flex items-center font-medium group-hover:gap-2 gap-1.5 transition-all">
                  Send a request <ArrowRight className="w-3.5 h-3.5" />
                </p>
              </div>
            </Link>

            <Link href="/guests" className="group card p-7 flex items-start gap-5 hover:shadow-soft-lg transition-all hover:-translate-y-0.5">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-wine-600 to-wine-800 flex items-center justify-center text-gold-200">
                <Users className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-2xl text-wine-700 mb-1">Who&rsquo;s Coming</h3>
                <p className="text-stone-600 text-sm">Meet the rest of the {guests.length || ''} crew before you arrive.</p>
                {previewGuests.length > 0 && (
                  <div className="mt-3 flex items-center -space-x-2">
                    {previewGuests.map((g) => (
                      <div key={g.id} className="ring-2 ring-ivory rounded-full">
                        <Avatar name={g.full_name} src={g.avatar_url} size="sm" />
                      </div>
                    ))}
                    {guests.length > previewGuests.length + 1 && (
                      <span className="ml-3 text-xs text-stone-500 font-medium">
                        +{guests.length - previewGuests.length - 1} more
                      </span>
                    )}
                  </div>
                )}
                <p className="mt-3 text-wine-700 text-sm inline-flex items-center font-medium group-hover:gap-2 gap-1.5 transition-all">
                  See guest list <ArrowRight className="w-3.5 h-3.5" />
                </p>
              </div>
            </Link>

            <Link href="/photos" className="group card p-7 flex items-start gap-5 hover:shadow-soft-lg transition-all hover:-translate-y-0.5">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-gold-200 to-gold-400 flex items-center justify-center text-wine-800">
                <ImagePlus className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-serif text-2xl text-wine-700 mb-1">Share Memories</h3>
                <p className="text-stone-600 text-sm">Upload your candid shots to our shared album so nothing gets lost.</p>
                <p className="mt-3 text-wine-700 text-sm inline-flex items-center font-medium group-hover:gap-2 gap-1.5 transition-all">
                  Open gallery <ArrowRight className="w-3.5 h-3.5" />
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-wine-800 text-ivory py-14 overflow-hidden">
        <div className="absolute inset-0 opacity-25">
          <Image
            src="/images/palace-couple-night.png"
            alt=""
            fill
            className="object-cover object-[center_20%]"
            sizes="100vw"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-wine-800 via-wine-800/90 to-wine-800/70" />
        <div className="container-page relative text-center">
          <p className="font-script text-5xl sm:text-6xl text-gold-200 mb-2">Prachi &amp; Mayank</p>
          <p className="uppercase tracking-[0.35em] text-xs text-ivory/70">27 · April · 2026</p>
          <div className="divider-ornament">
            <span className="h-px w-16 bg-gold-300/50" />
            <span className="text-lg text-gold-300">❖</span>
            <span className="h-px w-16 bg-gold-300/50" />
          </div>
          <p className="text-ivory/70 text-sm max-w-md mx-auto">
            Thank you for being part of our story. Safe travels, and see you on the dance floor.
          </p>
        </div>
      </footer>
      </div>
    </main>
  )
}
