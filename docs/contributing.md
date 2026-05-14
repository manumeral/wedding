---
layout: page
title: Contributing
permalink: /contributing/
---

Thank you for helping improve this template.

## Workflow

1. **Fork** the repo and create a **feature branch**.  
2. Keep changes focused; match existing TypeScript and Tailwind style.  
3. Open a **PR** with a clear description of behavior and testing.

## Checks

```bash
npm install
npx tsc --noEmit
```

**ESLint:** `npm run lint` may prompt for first-time Next.js ESLint setup in a fresh clone — complete that once if you use lint locally.

## Security

Do not commit secrets. Follow **[SECURITY.md](https://github.com/manumeral/wedding/blob/main/SECURITY.md)**.

## Docs

Updates to user-facing behavior should usually include a short note in **`docs/`** (this site) when behavior or env vars change.
