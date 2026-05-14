import { site } from '@/lib/site'

interface HeroProps {
  name?: string | null
}

export function Hero({ name }: HeroProps) {
  return (
    <section className="relative w-full min-h-[88vh] flex items-center justify-center overflow-hidden">
      {/* Page-level fixed background shows through; darken for legibility */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-black/42 via-black/48 to-black/78" aria-hidden />

      <div className="relative z-10 text-center px-6 py-10 max-w-3xl animate-fade-up">
        <p className="font-script text-3xl sm:text-4xl text-gold-200 text-shadow-soft mb-3">
          {site.hero.tagline}
        </p>
        <h1 className="font-serif text-6xl sm:text-7xl lg:text-8xl text-white text-shadow-strong leading-none tracking-tight">
          {site.couple.nameA}{' '}
          <span className="font-script text-gold-300 text-5xl sm:text-6xl lg:text-7xl inline-block mx-2 align-middle">&amp;</span>{' '}
          {site.couple.nameB}
        </h1>

        <div className="flex items-center justify-center gap-3 mt-8">
          <span className="h-px w-10 sm:w-16 bg-gold-300" />
          <p className="text-gold-200 font-sans tracking-[0.3em] text-sm sm:text-base uppercase text-shadow-soft">
            {site.hero.dateLine}
          </p>
          <span className="h-px w-10 sm:w-16 bg-gold-300" />
        </div>

        <p className="mt-6 text-white/90 text-base sm:text-lg text-shadow-soft max-w-xl mx-auto">
          {name ? `Welcome, ${name}. ` : 'Welcome. '}
          We&apos;re so grateful to have you with us for this chapter.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
          <a href="#itinerary" className="btn-gold">
            View Itinerary
          </a>
          <a href="/requests" className="btn-secondary bg-white/10 text-white border-white/40 backdrop-blur-sm hover:bg-white/20">
            Need Help?
          </a>
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-float">
        <div className="w-6 h-10 border-2 border-white/60 rounded-full flex items-start justify-center p-1.5">
          <div className="w-1 h-2 bg-white/80 rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  )
}
