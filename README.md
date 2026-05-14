# Wedding portal (Next.js + Supabase)

Open-source wedding website: guest login (magic link), itinerary, transport requests, shared photo gallery (Google Drive), admin tools, and optional web push.

**Live reference:** [prachiwedsmayank.in](https://prachiwedsmayank.in)

## Documentation (GitHub Pages)

Full guides for couples, deployers, and contributors:

**[→ Project documentation](https://manumeral.github.io/wedding/)**

If you fork the repo, update `docs/_config.yml` (`baseurl`, `url`) so links match your GitHub Pages URL, or host the `docs/` folder elsewhere.

## Quick start (developers)

1. Clone the repo and `npm install`.
2. Copy `.env.example` to `.env.local` and fill in values (see **Setup** in the docs).
3. Apply Supabase migrations (`supabase/migrations/`) and optional `supabase/seed.sql`.
4. `npm run dev` → [http://localhost:3000](http://localhost:3000)

## Customize branding

Edit `**lib/site.ts`** (names, dates, copy, image paths under `public/images/`) so your fork reflects your wedding. See `public/images/README.md` for asset hints.

## License

MIT — see [LICENSE](./LICENSE).