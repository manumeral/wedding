# Images (`public/images`)

These paths are referenced from **`lib/site.ts`** (`site.images.*`) and from **`components/Itinerary.tsx`** (by event name). Replace files while keeping the **same filenames** unless you also update `lib/site.ts`.

| File (path) | Typical use |
| ----------- | ----------- |
| `palace-couple-night.png` | Home background, story image, itinerary “wedding” card, footer |
| `couple-hero.png` | Login background, itinerary “reception” card |
| `haldi.png` | Requests/guests hero accents; itinerary “haldi” card |

**Tips**

- Use high-resolution sources (often **1600–2400px** on the long edge) for full-bleed backgrounds; Next.js `Image` will resize.  
- Prefer **compressed** PNG/WebP for web.  
- After swapping art, run **`npm run dev`** and check home, login, itinerary, requests, and guests pages.

For map links tied to event **names** (Tilak, reception, etc.), edit **`lib/site.ts`** → `site.maps`.
