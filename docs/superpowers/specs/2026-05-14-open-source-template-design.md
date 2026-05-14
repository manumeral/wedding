# Open Source Wedding Portal: Template, Docs & Hygiene

**Date:** 2026-05-14  
**Status:** Approved for implementation planning  
**Owner:** Mayank  

## 1. Goal

Publish this repository as an **open-source template** so other couples can fork it, configure branding and credentials, deploy to **Vercel + Supabase**, and run a wedding portal similar to the reference site **https://prachiwedsmayank.in** (which remains live as the sample).

Non-goals for this effort: rewriting core architecture, replacing Supabase, or hosting the full dynamic app on GitHub Pages.

## 2. Principles (agreed with product owner)

| Topic | Decision |
| ----- | -------- |
| Personal names / wedding copy in repo | **Keep** Prachi & Mayank as the **default reference implementation** in code and docs. No requirement to anonymize. |
| Live sample | Public site stays up; docs may link to it. |
| Git history | **Option A:** retain normal history on `main`; fix **current tree** + add **scanning guardrails**. **Rewrite history only if** a real credential leak is found in past commits—then rotate keys and use `git filter-repo` / BFG before/after as appropriate. |
| GitHub Pages | Host **documentation** (user guide, setup guide, contributing) plus **static screenshots** (and optionally short recordings); not the full Next.js app. |

## 3. Templating model (for fork authors)

**Recommended approach:** central **`site` module** (e.g. `lib/site.ts` or `config/site.ts`) exporting typed constants: couple names, wedding date display strings, taglines, important URLs, and **paths** to assets under `public/images/`. The reference values remain the project’s current branding so the repo runs unchanged for maintainers.

**Secondary:** add `public/images/README.md` listing expected image files (hero, story, itinerary card art where applicable) and rough aspect ratio / size hints so swaps are mechanical.

**Credentials:** remain **only** in environment variables; `.env.example` stays the single source of truth for variable names and comments (Supabase, Google OAuth/Drive, optional VAPID).

**Database content:** itinerary rows, guest groups, and admin-toggled flags stay **data plane**—fork authors apply migrations and use admin / seed flows as documented; no requirement to JSON-ify the whole itinerary in v1.

## 4. Documentation (GitHub Pages)

**Source layout:** Markdown under repository **`docs/`** (or GitHub Pages–compatible subtree), deployed from **`main`** via **“Deploy from branch” → `/docs`** (or equivalent Settings).

**Pages:**

| Document | Audience | Contents (summary) |
| -------- | -------- | ------------------ |
| `index.md` | Everyone | What the project is, feature list, link to live sample, link to other pages. |
| `user-guide.md` | Couples / non-developers | Plain-language overview: magic-link guest login, itinerary, requests, photos, inbox/push at a high level; **never commit `.env` or paste secrets**; when to ask a technical friend; pointer to setup guide for deployment. |
| `setup.md` | Developers | Clone, Node, `npm install`, `.env.local` from `.env.example`, create Supabase project, run migrations (`supabase` CLI or SQL as today), create Vercel project and env vars, custom domain, Google OAuth + Drive folder + `/admin/drive-auth` flow summary, optional web push keys. |
| `contributing.md` | Contributors | Branch/PR expectations, `npx tsc --noEmit`, note that `npm run lint` may prompt first-time ESLint setup in Next.js; issue conventions. |

**Visual assets:** `docs/assets/` (or similar) for **screenshots** captured from **prachiwedsmayank.in**; **crop or use guest-safe views** so guest PII (names, emails, rooms, threads) does not appear in pixels. Short screen recordings optional.

**Root README:** short elevator pitch + badges optional + **prominent link** to the GitHub Pages site for full guides.

## 5. Repository hygiene & security

- **LICENSE:** add (MIT unless owner chooses otherwise).  
- **SECURITY.md:** how to report vulnerabilities; remind not to file secrets in public issues.  
- **`.gitignore`:** confirm `.env.local` and any Supabase local secret paths (e.g. `supabase/.env.local` if used) are ignored; document in setup.  
- **Pre-public audit:** run **gitleaks** and/or **trufflehog** (including **git history**). Supplement with targeted manual searches if needed.  
- **If leaks found:** rotate **all** affected credentials first; then history rewrite + force-push per policy; announce impact on forks.  
- **CI (post–open source):** optional **secret scan on PR** (e.g. gitleaks-action) to prevent regressions.

Tracked files today should remain limited to **`.env.example`** / **`.env.local.example`** (placeholders only)—verify before first public push.

## 6. Out of scope (this design)

- Replacing Next.js or moving the dynamic app to GitHub Pages.  
- Full i18n or multi-tenant SaaS.  
- Migrating all prose to CMS; optional later enhancement only.  
- Mandatory anonymization of the reference wedding.

## 7. Implementation outline (for planning phase)

1. Add LICENSE, SECURITY.md, expand root README with Pages links.  
2. Introduce `site` module; thread key strings/paths from Hero, `layout` metadata, and other obvious single-source branding touchpoints without changing visible behavior for the reference deploy.  
3. Add `public/images/README.md`.  
4. Author `docs/` Markdown + embed screenshot assets; enable GitHub Pages.  
5. Run secret audit; add CI scan if desired.  
6. Tag a **v1 template** release when stable.

## 8. Spec self-review (2026-05-14)

- **Placeholders:** None intentional; owner name left as Mayank per prior specs.  
- **Consistency:** Git history policy matches conversation (A); Pages scope matches “docs only.”  
- **Scope:** Single OSS/template + docs track; implementation details (exact `site` export shape) left to implementation plan.  
- **Ambiguity:** Fork authors may still edit components for deep customization—acceptable; v1 focuses on module + checklist. Live sample domain spelled as agreed.
