/**
 * Single place for couple-specific branding, copy, image paths, and map links.
 * Forks: edit this file and replace files under `public/images/` (see `public/images/README.md`).
 */
export const site = {
  meta: {
    title: 'Prachi & Mayank · 27 April 2026',
    description:
      'The wedding portal for Prachi & Mayank — itinerary, logistics, and memories.',
  },

  couple: {
    nameA: 'Prachi',
    nameB: 'Mayank',
    /** e.g. footer, login title */
    namesAmpersand: 'Prachi & Mayank',
    /** `alt` on story image */
    photoAlt: 'Prachi and Mayank',
  },

  hero: {
    tagline: "We're tying the knot",
    /** Shown under the names; use middle dots · for separators */
    dateLine: '27 · April · 2026',
  },

  story: {
    eyebrow: 'the happy couple',
    title: 'Our story, so far',
    paragraphs: [
      "Two people, one journey, and countless tiny moments that brought us here. From first hellos to planning a life together — it still feels a little unreal that the big day is just around the corner.",
      "We can't wait to share every laugh, every dance, and every plate of food with you. Thank you for making the trip and being part of our forever.",
    ],
  },

  footer: {
    dateLine: '27 · April · 2026',
    thanks:
      'Thank you for being part of our story. Safe travels, and see you on the dance floor.',
  },

  copy: {
    knowCouplePlaceholder:
      'How do you know Prachi or Mayank? Anything fun other guests should know?',
  },

  images: {
    palaceCoupleNight: '/images/palace-couple-night.png',
    coupleHero: '/images/couple-hero.png',
    haldi: '/images/haldi.png',
  },

  /** Optional: Google Maps short links for itinerary “Directions”. */
  maps: {
    tilak: 'https://maps.app.goo.gl/PoxeAPXuQ2P6ozaR6',
    venueCluster: 'https://maps.app.goo.gl/frvz2VfDY37JNeCTA',
    reception: 'https://maps.app.goo.gl/JbmDkeweu9CtZSCa8',
  },

  urls: {
    sampleLive: 'https://prachiwedsmayank.in',
    /** Set in repo `docs/_config.yml` for GitHub Pages */
    docsOnGithubPages: 'https://manumeral.github.io/wedding/',
  },
} as const
