# Security

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

Instead, contact the maintainers privately (for example via GitHub Security Advisories for this repository, if enabled, or email the repo owner). Include steps to reproduce and impact if you can.

## Secrets and configuration

Never commit or paste the following into issues, discussions, or pull requests:

- Contents of `.env`, `.env.local`, or `supabase/.env` files
- `SUPABASE_SERVICE_ROLE_KEY` or any **service role** key
- `GOOGLE_OAUTH_CLIENT_SECRET` or refresh tokens
- VAPID private keys

Use placeholders and refer to `.env.example` for variable **names** only.

## After a leak

If you accidentally committed a secret:

1. **Rotate** the credential at the provider (Supabase, Google Cloud, etc.) immediately.
2. Remove it from the **current** tree and follow your team’s process for scrubbing **git history** if the secret reached a shared remote.
