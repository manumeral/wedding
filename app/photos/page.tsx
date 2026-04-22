import { getUserProfile } from '@/app/actions/user'
import { Navbar } from '@/components/Navbar'
import { Carousel } from '@/components/Carousel'
import Image from 'next/image'
import Link from 'next/link'
import { Camera, Upload, Heart } from 'lucide-react'

export default async function PhotosPage() {
  const profile = await getUserProfile()
  // TODO: replace with the actual shared album URL
  const GOOGLE_PHOTOS_URL = 'https://photos.google.com/album/placeholder'

  const highlights = [
    { src: '/images/couple-hero.png', caption: 'The big moment', fit: 'object-cover object-[center_20%]', bg: '' },
    { src: '/images/wedding-illustration.png', caption: 'Little memories', fit: 'object-cover object-top', bg: '' },
    { src: '/images/haldi.png', caption: 'Haldi day', fit: 'object-contain object-bottom', bg: 'bg-gradient-to-br from-gold-100 to-gold-300' },
  ]

  return (
    <main className="min-h-screen pb-24">
      <Navbar isAdmin={!!profile?.is_admin} />

      {/* Hero */}
      <section className="relative pt-32 pb-14 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gold-100 via-blush-100 to-cream" />
        <div className="absolute inset-0 opacity-10">
          <Image src="/images/wedding-illustration.png" alt="" fill className="object-cover object-center" />
        </div>
        <div className="container-page relative text-center">
          <p className="section-sub">memory lane</p>
          <h1 className="section-title">The Wedding Gallery</h1>
          <p className="text-stone-600 max-w-xl mx-auto mt-3">
            Candids, chaos, and quiet moments &mdash; all shared in one place so nothing gets lost in a thousand WhatsApp groups.
          </p>
        </div>
      </section>

      {/* Highlights carousel */}
      <section className="py-10">
        <div className="container-page">
          <Carousel slideClass="w-[80%] sm:w-[45%] lg:w-[32%]">
            {highlights.map((h, i) => (
              <figure key={i} className={`relative h-[420px] rounded-3xl overflow-hidden shadow-soft group ${h.bg}`}>
                <Image src={h.src} alt={h.caption} fill sizes="(max-width: 640px) 80vw, 32vw" className={`${h.fit} transition-transform duration-700 group-hover:scale-105`} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-wine-800/80 via-wine-800/40 to-transparent p-6">
                  <p className="font-serif text-2xl text-white text-shadow-soft">{h.caption}</p>
                </div>
              </figure>
            ))}
          </Carousel>
        </div>
      </section>

      {/* Upload CTA */}
      <section className="container-page mt-10">
        <div className="relative rounded-3xl overflow-hidden shadow-soft-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-wine-700 via-wine-800 to-black" />
          <div className="absolute inset-0 opacity-25">
            <Image src="/images/couple-hero.png" alt="" fill className="object-cover object-top" />
          </div>
          <div className="relative p-8 sm:p-12 text-ivory">
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-8 justify-between">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-300/15 border border-gold-300/30 text-gold-200 text-xs font-medium uppercase tracking-wider mb-4">
                  <Camera className="w-3.5 h-3.5" />
                  Shared album
                </div>
                <h2 className="font-serif text-3xl sm:text-4xl mb-3">Send us your pictures!</h2>
                <p className="text-ivory/80 leading-relaxed">
                  We&apos;ve set up a shared Google Photos album for everyone &mdash; the dance floor moments,
                  the in-between smiles, the food closeups. Upload whatever you&apos;ve got, and we&apos;ll
                  be able to relive every bit together.
                </p>
              </div>
              <a href={GOOGLE_PHOTOS_URL} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <span className="btn-gold text-base px-8 py-4">
                  <Upload className="w-5 h-5 mr-2" />
                  Open the album
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-4 text-center">
          {[
            { icon: Camera, title: 'No limits', body: 'Upload as many as you\'d like — photos and videos both welcome.' },
            { icon: Heart, title: 'Tag your favourites', body: 'Drop a heart on the ones that made your week.' },
            { icon: Upload, title: 'Everyone shares', body: 'Every guest with the link can contribute to the album.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="card p-6">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blush-100 to-blush-200 flex items-center justify-center text-wine-700 mx-auto mb-3">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl text-wine-700 mb-1">{title}</h3>
              <p className="text-sm text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
