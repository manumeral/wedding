'use client'

import { useRef, useState, useEffect, ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CarouselProps {
  children: ReactNode[]
  className?: string
  slideClass?: string
  showDots?: boolean
  showArrows?: boolean
}

export function Carousel({
  children,
  className = '',
  slideClass = 'w-[85%] sm:w-[55%] lg:w-[38%]',
  showDots = true,
  showArrows = true,
}: CarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const count = children.length

  const updateState = () => {
    const el = scrollerRef.current
    if (!el) return
    const slideWidth = el.clientWidth / (el.children[0] as HTMLElement | undefined ? 1 : 1)
    const first = el.children[0] as HTMLElement | undefined
    const w = first?.offsetWidth ?? el.clientWidth
    const gap = 16
    const idx = Math.round(el.scrollLeft / (w + gap))
    setActiveIndex(Math.min(count - 1, Math.max(0, idx)))
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    updateState()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateState, { passive: true })
    window.addEventListener('resize', updateState)
    return () => {
      el.removeEventListener('scroll', updateState)
      window.removeEventListener('resize', updateState)
    }
  }, [count])

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    const first = el.children[0] as HTMLElement | undefined
    const w = first?.offsetWidth ?? el.clientWidth * 0.8
    el.scrollBy({ left: dir * (w + 16), behavior: 'smooth' })
  }

  const scrollTo = (i: number) => {
    const el = scrollerRef.current
    if (!el) return
    const first = el.children[0] as HTMLElement | undefined
    const w = first?.offsetWidth ?? el.clientWidth * 0.8
    el.scrollTo({ left: i * (w + 16), behavior: 'smooth' })
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory hide-scrollbar pb-4 pt-1"
      >
        {children.map((child, i) => (
          <div key={i} className={`shrink-0 snap-center ${slideClass}`}>
            {child}
          </div>
        ))}
      </div>

      {showArrows && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scrollBy(-1)}
            disabled={!canScrollLeft}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 w-11 h-11 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-soft text-wine-700 hover:bg-white transition disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollBy(1)}
            disabled={!canScrollRight}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 w-11 h-11 items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-soft text-wine-700 hover:bg-white transition disabled:opacity-0 disabled:pointer-events-none"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {showDots && count > 1 && (
        <div className="flex justify-center gap-2 mt-2">
          {children.map((_, i) => (
            <button
              type="button"
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => scrollTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === activeIndex ? 'bg-wine-700 w-6' : 'bg-blush-200 w-1.5 hover:bg-blush-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
