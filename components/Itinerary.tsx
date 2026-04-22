import Image from 'next/image'
import { Carousel } from './Carousel'
import { Calendar, MapPin, Sparkles } from 'lucide-react'

interface Event {
  name: string
  date: string
  location: string
  live_status_message?: string | null
  order_index?: number
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
      }))
    : [
        { name: "Tilak", date: "25 April '26 · Afternoon", location: "Vijaya Grand, Ashiana Nagar, Patna", order_index: 0 },
        { name: "Haldi", date: "26 April '26 · Afternoon", location: "Chanakya Hotel, R Block, Patna", order_index: 1 },
        { name: "Sangeet", date: "26 April '26 · Evening", location: "Chanakya Hotel, R Block, Patna", order_index: 2 },
        { name: "Wedding", date: "27 April '26 · Night", location: "Chanakya Hotel, R Block, Patna", order_index: 3 },
        { name: "Reception", date: "29 April '26 · Night", location: "Grand Ivory, Biscoman Bhavan, Patna", order_index: 4 },
        { name: "Reception", date: "2 May '26 · Night", location: "Bokaro Steel City", order_index: 5 },
      ]

  return (
    <section id="itinerary" className="py-20 scroll-mt-20">
      <div className="container-page">
        <div className="text-center mb-12">
          <p className="section-sub">save the dates</p>
          <h2 className="section-title">Wedding Itinerary</h2>
          <div className="divider-ornament">
            <span className="h-px w-16 bg-gold-300" />
            <span className="text-lg">❖</span>
            <span className="h-px w-16 bg-gold-300" />
          </div>
          <p className="text-stone-600 max-w-xl mx-auto">
            Six days of celebration across two cities. Swipe through to see everything we have in store.
          </p>
        </div>

        <Carousel>
          {displayEvents.map((ev, i) => (
            <EventCard key={i} event={ev} />
          ))}
        </Carousel>
      </div>
    </section>
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
