# Pinned versions

> Agent-writable record (task P0-01 fills the TBD rows using `npm view <pkg> version` / `--version`; later tasks append).
> Rule: pin exact versions. A version listed as **FROZEN** may only change through a human-approved ADR.
> When an installed major version is newer than what you know, read its migration guide via the web-reader tool before writing code against it, and note the URL here.

| Package / tool | Version | Status | Verified how / notes |
|---|---|---|---|
| Stripe API version | `2026-09-30.endive` | FROZEN | stripe/openapi spec + stripe-node 23.0.0 `apiVersion.js` (checked 2026-10-11) |
| `stripe` (npm, Deno via `npm:stripe@23.0.0`) | `23.0.0` | FROZEN | npm dist-tag latest, published 2026-10-01 |
| `@stripe/stripe-js` | `10.0.0` | reserved (not used in MVP: hosted Checkout) | release train `endive` |
| `@stripe/connect-js` | `3.4.6` | reserved (embedded onboarding, phase 2+) | npm |
| Stripe CLI | latest | dev only | use `stripe listen --latest` |
| Node.js | TBD (24 LTS preferred) | P0-01 | `node -v` |
| pnpm | TBD | P0-01 | `pnpm -v`; also in root `packageManager` |
| typescript | TBD | P0-01 | |
| vitest | TBD (5.x seen on npm 2026-10-11) | P0-01 | |
| vite / @vitejs/plugin-react | TBD | P0-04 | |
| react / react-dom | TBD | P0-04 | |
| react-router | TBD | P0-04 | declarative mode only |
| tailwindcss / @tailwindcss/vite | TBD (v4 line) | P0-04 | no `tailwind.config.js` in v4 |
| @tanstack/react-query | TBD | P0-04 | |
| @supabase/supabase-js | TBD | P0-02 | |
| zod | TBD | P1-01 | |
| luxon | TBD | P1-03 | |
| Supabase CLI | TBD | P0-02 | `supabase --version` |
| Deno | TBD (2.x) | P0-03 | match the Supabase Edge Runtime's Deno major |
| Supabase-injected env var names | TBD | P0-03 | record the exact names available inside Edge Functions |
| @playwright/test | TBD | P0-04 | |
