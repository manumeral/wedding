import Image from 'next/image'
import { Carousel } from './Carousel'
import { Calendar, MapPin, Sparkles, Radio, BellRing, ExternalLink } from 'lucide-react'

const MAPS_TILAK = 'https://maps.app.goo.gl/PoxeAPXuQ2P6ozaR6'
const MAPS_CHANAKYA_CLUSTER = 'https://maps.app.goo.gl/frvz2VfDY37JNeCTA'
const MAPS_RECEPTION = 'https://maps.app.goo.gl/JbmDkeweu9CtZSCa8'

function mapsUrlForEvent(name: string): string | undefined {
  const n = name.toLowerCase()
  if (n.includes('tilak')) return MAPS_TILAK
  if (n.includes('haldi') || n.includes('sangeet') || n.includes('wedding') || n.includes('pheras')) {
    return MAPS_CHANAKYA_CLUSTER
  }
  if (n.includes('reception')) return MAPS_RECEPTION
  return undefined
}

interface Event {
  name: string
  date: string
  location: string
  live_status_message?: string | null
  order_index?: number
  mapsUrl?: string
}

// Visual treatment per event name
const eventTheme = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('haldi')) {
    return {
      image: '/images/haldi.png',
      bg: 'from-gold-100 via-gold-200 to-gold-300',
      accent: 'text-gold-500',
      imgFit: 'object-contain object-bottom',
    }
  }
  if (n.includes('wedding') || n.includes('pheras')) {
    return {
      image: '/images/wedding-illustration.png',
      bg: 'from-blush-100 via-blush-200 to-wine-500',
      accent: 'text-wine-700',
      imgFit: 'object-cover object-[center_30%]',
    }
  }
  if (n.includes('sangeet')) {
    return {
      image: null,
      bg: 'from-blush-200 via-wine-500 to-wine-700',
      accent: 'text-white',
      imgFit: '',
    }
  }
  if (n.includes('tilak')) {
    return {
      image: null,
      bg: 'from-gold-200 via-blush-200 to-blush-300',
      accent: 'text-wine-700',
      imgFit: '',
    }
  }
  if (n.includes('reception')) {
    return {
      image: '/images/couple-hero.png',
      bg: 'from-wine-700 via-wine-800 to-black',
      accent: 'text-white',
      imgFit: 'object-cover object-[center_20%]',
    }
  }
  return {
    image: null,
    bg: 'from-blush-100 via-blush-200 to-blush-300',
    accent: 'text-wine-700',
    imgFit: '',
  }
}

function EventCard({ event }: { event: Event }) {
  const theme = eventTheme(event.name)
  const hasImage = !!theme.image
  const darkText = !hasImage && !event.name.toLowerCase().includes('reception') && !event.name.toLowerCase().includes('sangeet')

  return (
    <article className="group relative h-[440px] rounded-3xl overflow-hidden shadow-soft hover:shadow-soft-lg transition-all duration-500 hover:-translate-y-1">
      <div className={`absolute inset-0 bg-gradient-to-br ${theme.bg}`} />

      {hasImage && theme.image && (
        <div className="absolute inset-0">
          <Image
            src={theme.image}
            alt={event.name}
            fill
            sizes="(max-width: 640px) 85vw, 38vw"
            className={`${theme.imgFit} transition-transform duration-700 group-hover:scale-105`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
        </div>
      )}

      <div className="relative z-10 h-full flex flex-col justify-between p-7">
        <div className="flex items-start justify-between">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-sm text-xs font-medium tracking-wider uppercase ${
            hasImage ? 'bg-white/20 text-white border border-white/30' : 'bg-white/70 text-wine-700 border border-wine-700/10'
          }`}>
            <Sparkles className="w-3 h-3" />
            Event {(event.order_index ?? 0) + 1}
          </div>
          {event.live_status_message && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/90 text-white text-xs font-semibold shadow-lg animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              Live
            </div>
          )}
        </div>

        <div className={hasImage ? 'text-white' : darkText ? 'text-wine-800' : 'text-white'}>
          <h3 className={`font-serif text-4xl leading-tight mb-3 ${hasImage ? 'text-shadow-strong' : ''}`}>
            {event.name}
          </h3>
          <div className="space-y-2 text-sm sm:text-base">
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 mt-0.5 flex-none" />
              <span className={hasImage ? 'text-shadow-soft' : ''}>{event.date}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 mt-0.5 flex-none" />
              <span className={hasImage ? 'text-shadow-soft' : ''}>{event.location}</span>
            </div>
            {event.mapsUrl && (
              <a
                href={event.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 mt-2 font-medium underline underline-offset-2 decoration-2 ${
                  hasImage || !darkText
                    ? 'text-gold-200 decoration-gold-200/60 hover:text-white'
                    : 'text-wine-700 decoration-wine-300 hover:text-wine-900'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden />
                Open venue in Google Maps
              </a>
            )}
          </div>
          {event.live_status_message && (
            <p className={`mt-4 text-sm italic ${hasImage ? 'text-gold-200 text-shadow-soft' : 'text-wine-600'}`}>
              &ldquo;{event.live_status_message}&rdquo;
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

export function Itinerary({ events }: { events: any[] }) {
  const displayEvents: Event[] = events.length > 0
    ? events.map((e, i) => ({
        name: e.name,
        date: typeof e.date === 'string' ? formatDate(e.date) : e.date,
        location: e.location,
        live_status_message: e.live_status_message,
        order_index: e.order_index ?? i,
        mapsUrl: mapsUrlForEvent(e.name),
      }))
    : [
        { name: "Tilak", date: "25 April '26 · Afternoon", location: "Vijaya Grand, Ashiana Nagar, Patna", order_index: 0, mapsUrl: MAPS_TILAK },
        { name: "Haldi", date: "26 April '26 · Afternoon", location: "Chanakya Hotel, R Block, Patna", order_index: 1, mapsUrl: MAPS_CHANAKYA_CLUSTER },
        { name: "Sangeet", date: "26 April '26 · Evening", location: "Chanakya Hotel, R Block, Patna", order_index: 2, mapsUrl: MAPS_CHANAKYA_CLUSTER },
        { name: "Wedding", date: "27 April '26 · Night", location: "Chanakya Hotel, R Block, Patna", order_index: 3, mapsUrl: MAPS_CHANAKYA_CLUSTER },
        { name: "Reception", date: "29 April '26 · Night", location: "Grand Ivory, Biscoman Bhavan, Patna", order_index: 4, mapsUrl: MAPS_RECEPTION },
      ]

  const liveEvents = displayEvents.filter(
    (e) => e.live_status_message && e.live_status_message.trim().length > 0
  )

  return (
    <section id="itinerary" className="py-20 scroll-mt-20">
      <div className="container-page">
        <div className="text-center mb-8">
          <p className="section-sub">save the dates</p>
          <h2 className="section-title">Wedding Itinerary</h2>
          <div className="divider-ornament">
            <span className="h-px w-16 bg-gold-300" />
            <span className="text-lg">❖</span>
            <span className="h-px w-16 bg-gold-300" />
          </div>
          <p className="text-stone-600 max-w-xl mx-auto">
            Five celebrations in Patna — swipe through the cards. Each venue has a Google Maps link so you can navigate straight there.
          </p>
        </div>

        <LiveTrackerBanner liveEvents={liveEvents} />

        <Carousel>
          {displayEvents.map((ev, i) => (
            <EventCard key={i} event={ev} />
          ))}
        </Carousel>
      </div>
    </section>
  )
}

function LiveTrackerBanner({ liveEvents }: { liveEvents: Event[] }) {
  const hasLive = liveEvents.length > 0

  if (hasLive) {
    return (
      <div className="relative mb-10 rounded-3xl overflow-hidden shadow-soft-lg border border-green-400/30">
        <div className="absolute inset-0 bg-gradient-to-br from-green-600 via-green-700 to-wine-800" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_50%)]" />

        <div className="relative px-6 sm:px-8 py-6 sm:py-7 text-white">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="relative inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 text-xs font-semibold uppercase tracking-wider">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-white opacity-75 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-white" />
              </span>
              Live now
            </span>
            <h3 className="font-serif text-2xl sm:text-3xl text-shadow-soft">
              Happening right now
            </h3>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {liveEvents.map((ev, i) => (
              <div
                key={i}
                className="rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-4"
              >
                <p className="font-serif text-xl mb-1">{ev.name}</p>
                <p className="text-sm italic text-white/90">
                  &ldquo;{ev.live_status_message}&rdquo;
                </p>
              </div>
            ))}
          </div>

          <p className="mt-5 text-sm text-white/80 text-shadow-soft">
            Stay on this page &mdash; we&rsquo;ll keep updating as the day unfolds. Pull to refresh on your phone to see the latest.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mb-10 rounded-3xl overflow-hidden shadow-soft border border-blush-200/60">
      <div className="absolute inset-0 bg-gradient-to-br from-cream via-ivory to-blush-50" />
      <div className="relative px-6 sm:px-8 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-none w-12 h-12 rounded-2xl bg-gradient-to-br from-wine-600 to-wine-800 flex items-center justify-center shadow-soft">
            <Radio className="w-5 h-5 text-gold-200" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-ivory animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="font-serif text-xl text-wine-700">Live event tracker</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 border border-green-500/30 text-[10px] font-semibold uppercase tracking-wider">
                On
              </span>
            </div>
            <p className="text-sm text-stone-600">
              We&rsquo;ll post real-time updates on each event here &mdash; delays, start times, where to go next.
              Check back through the day so you never miss a moment.
            </p>
          </div>
        </div>
        <div className="sm:text-right text-xs text-stone-500 sm:border-l sm:border-blush-200 sm:pl-4">
          <p className="inline-flex items-center gap-1.5 font-medium text-wine-700">
            <BellRing className="w-3.5 h-3.5" />
            Bookmark this page
          </p>
          <p className="mt-0.5 text-stone-500">Refresh to see the latest status</p>
        </div>
      </div>
    </div>
  )
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: '2-digit',
    }) + ' · ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  } catch {
    return iso
  }
}
