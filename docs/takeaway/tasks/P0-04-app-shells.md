# P0-04 — App shells (storefront, merchant), design tokens, i18n, Playwright smoke

| Field | Value |
|---|---|
| Phase | P0 |
| Depends on | P0-01 |
| Mode | `standard` |
| Reasoning effort | `high` |
| Model | `glm-5.3` |
| Session budget | Two sessions on one branch `task/P0-04-app-shells`, ≤ 3 h each (plan: Spec → Sessions); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none |

## Goal

Two Vite + React + TypeScript SPAs, `@ppos/storefront` and `@ppos/merchant`, plus the shared presentational package `@ppos/ui` (base components and the CRM brand palette as Tailwind v4 theme tokens). Both apps build, render a routed placeholder page at 375 px width without horizontal scrolling, import their base components from `@ppos/ui`, pass automated WCAG checks (axe) and pass a Playwright smoke suite in CI using roles, labels and text only. The merchant UI switches between English and Simplified Chinese; the storefront is en-GB only. From P1-06 on, UI tasks add pages to these shells instead of setting up tooling.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §1 (incl. `packages/ui`), §2, §11 (last bullet: no cookies/trackers), §13a (`e2e` script), §14 (copy and i18n rules)
- `docs/takeaway/reference/approved-deps.json`
- `docs/takeaway/reference/versions.md`
- `.github/workflows/takeaway-ci.yml` (`e2e` job: installs Chromium only, sets dummy `VITE_*` env, runs `pnpm e2e`, no Supabase)
- `package.json`, `vitest.config.ts`, `eslint.config.js`, `tsconfig.base.json`
- `packages/core/package.json` (the source-export pattern `@ppos/ui` copies)

## Out of scope

- Supabase client, auth, login, data fetching (P1-06); real storefront routes (`/:shopSlug`, basket, checkout: P1-10); service-fee notice (P1-10); legal footer (P1-17).
- Persisting the merchant language (P1-06 adds localStorage key `ppos.merchant.lang`).
- PWA / service worker (`vite-plugin-pwa`); platform-admin routes.
- Anything in `@ppos/ui` beyond presentational components and tokens: no data fetching, router, dictionaries or business rules; `LanguageToggle` and pages stay in the apps.
- Web fonts, CDNs, analytics or any other third-party request; cookies.
- Screenshot or visual-diff tests; creating Vercel projects (human, P0-00 step F).

## Deliverables

`<app>` = `storefront` (Session 1) and `merchant` (Session 2). Column S = the session that creates the file.

| Path | Action | S |
|---|---|---|
| `packages/ui/package.json` | create: `"name": "@ppos/ui"`, `"private": true`, `"type": "module"`, `"exports": { ".": "./src/index.ts", "./theme.css": "./src/theme.css" }` (source export like `@ppos/core`, no build); scripts `"test": "vitest run"`, `"typecheck": "tsc --noEmit -p tsconfig.json"`; `peerDependencies` `react`, `react-dom` (the apps' exact version); exact `devDependencies` `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` | 1 |
| `packages/ui/tsconfig.json`, `packages/ui/vitest.config.ts` | create: tsconfig extends the base, `lib: ["ES2023", "DOM", "DOM.Iterable"]`, `jsx: "react-jsx"`, include `src`, `tests` (+ the config file); Vitest project `ui`, `environment: 'jsdom'`, `setupFiles: ['./tests/setup.ts']` | 1 |
| `packages/ui/src/theme.css`, `src/Button.tsx`, `src/Field.tsx`, `src/Card.tsx`, `src/Dialog.tsx`, `src/Spinner.tsx`, `src/index.ts` | create (Spec 2, 3, 7) | 1 |
| `packages/ui/tests/setup.ts`, `packages/ui/tests/ui.test.tsx` | create (component tests, Spec 9) | 1 |
| `apps/<app>/package.json` | create (`@ppos/<app>`; scripts `dev`, `build`, `preview`, `typecheck`, `test`; dependencies `"@ppos/core": "workspace:*"`, `"@ppos/ui": "workspace:*"`) | 1, 2 |
| `apps/<app>/index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `vercel.json` | create | 1, 2 |
| `apps/<app>/src/main.tsx`, `src/App.tsx`, `src/styles.css` | create | 1, 2 |
| `apps/<app>/src/routes/HomePage.tsx`, `src/routes/NotFoundPage.tsx` | create | 1, 2 |
| `apps/<app>/src/i18n/en-GB.ts`, `src/i18n/I18nProvider.tsx` | create | 1, 2 |
| `apps/merchant/src/i18n/zh-CN.ts`, `apps/merchant/src/components/LanguageToggle.tsx` | create | 2 |
| `apps/<app>/tests/setup.ts`, `tests/app.test.tsx` | create (app tests only; component tests live in `packages/ui`) | 1, 2 |
| `e2e/playwright.config.ts` | create with the `storefront` project and its `webServer` entry (S1); add the `merchant` project and its `webServer` entry (S2) | 1, 2 |
| `e2e/tsconfig.json`, `e2e/storefront.spec.ts` | create | 1 |
| `e2e/merchant.spec.ts` | create | 2 |
| `package.json` (root), `pnpm-lock.yaml` | edit: exact devDependencies `@playwright/test`, `@axe-core/playwright`; scripts `e2e` and `typecheck` (Spec 11) | 1 |
| `vitest.config.ts` (root) | edit: add the `apps/*` projects | 1 |
| `eslint.config.js` | edit only if the react-hooks rules do not yet cover `packages/ui/**/*.{ts,tsx}` as well as `apps/**` (or to add `eslint-plugin-react-refresh` for apps) | 1 |
| `docs/takeaway/reference/versions.md`, `docs/takeaway/PROGRESS.md` | edit | 1, 2 |

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR):
- **Session 1**: every Deliverables row with S = 1 (all of `packages/ui`, all of `apps/storefront`, the root files, `e2e/playwright.config.ts` with only the `storefront` project and its `webServer` entry, `e2e/tsconfig.json`, `e2e/storefront.spec.ts`). Gate, all exit 0: `pnpm verify && pnpm --filter @ppos/storefront build && pnpm exec playwright install chromium && pnpm e2e` → commit `feat(storefront): app shell and @ppos/ui [P0-04]` → `git push -u origin task/P0-04-app-shells` (no PR yet) → PROGRESS.md `## Current`: `P0-04 Session 1 done (<hash>); next: Session 2`, gate output in `## Done log`. Stop.
- **Session 2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): every row with S = 2 (all of `apps/merchant` incl. `zh-CN.ts` and `LanguageToggle.tsx`, the `merchant` project and `webServer` entry, `e2e/merchant.spec.ts`, the remaining `versions.md` rows). Change Session 1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

1. **Vite**: plugins `@vitejs/plugin-react` and `@tailwindcss/vite`. Dev ports: storefront `5173`, merchant `5174`, `strictPort: true`. `envDir: '../..'` so both apps read the human's root `.env.local` (Vite exposes only `VITE_*` variables to the bundle). `index.html`: `<meta name="viewport" content="width=device-width, initial-scale=1">`, storefront `<html lang="en-GB">`.
2. **Tailwind v4**: `packages/ui/src/theme.css` holds only `@theme { --color-brand-navy: #233749; --color-brand-orange: #ff8b3d; --color-brand-red: #fc5466; --color-brand-bg: #fcf6fa; --font-sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }`. Each app's `src/styles.css` is: `@import "tailwindcss";` then `@import "../../../packages/ui/src/theme.css";` then `@source "../../../packages/ui/src";`. This yields utilities such as `bg-brand-navy`, `text-brand-navy`, `border-brand-red`, `bg-brand-bg`. `body` uses `bg-brand-bg text-brand-navy`. No `tailwind.config.js`, no PostCSS config. [H] Tailwind v4 does not scan files outside the app folder (or under `node_modules`) by default, hence the `@source` line: verify on tailwindcss.com "Detecting classes in source files" and record the URL in `versions.md`. Spec 12 proves the `@ppos/ui` classes were generated.
3. **Contrast** (WCAG formula on these hex values; the axe scan re-checks text contrast): white on navy 12.3:1, navy on brand-bg 11.5:1 and navy on orange 5.3:1 pass. White on orange 2.3:1 and orange on brand-bg 2.2:1 FAIL: never `text-brand-orange` on a light background, never white text on orange. Red on brand-bg 3.0:1 and white on red 3.2:1 FAIL for normal text: never `text-brand-red` for text, never white text on a red fill. Hence: `primary` = white on navy; `secondary` = navy text on orange; `danger` = navy text on white with a 2 px red border (red on white 3.2:1 meets the 3:1 minimum for component boundaries); `Field` error = navy text with a red left border, linked by `aria-describedby`; `Badge` tones use only the passing pairs; the `focus-visible` ring is navy (never orange) with an offset. If you need a darker accessible red (e.g. #c8102e: white on it 5.9:1, on brand-bg 5.5:1), write a request in PROGRESS.md; do not add tokens yourself.
4. **Routing**: declarative mode from `react-router`: `BrowserRouter` in `main.tsx`; `App.tsx` exports the `Routes` (`/` → `HomePage`, `*` → `NotFoundPage`) so tests can wrap it in `MemoryRouter`. **TanStack Query**: one `QueryClient` in `main.tsx`, `QueryClientProvider` around the router; no queries yet.
5. **i18n**: dictionaries are `as const` objects with camelCase keys; `export type MessageKey = keyof typeof enGB`. `zhCN` is declared with `satisfies Record<MessageKey, string>` (a missing key is a type error). `I18nProvider` + `useT()` hook. Every visible string comes from a dictionary; components receive labels as props. Merchant: provider state `'en-GB' | 'zh-CN'` (default `en-GB`), an effect sets `document.documentElement.lang`. `LanguageToggle` is a `<button>` whose label is the **other** language's own name, read from that language's dictionary (`languageName` key), so the Chinese label lives only in `zh-CN.ts`.
6. **Pages**: storefront `HomePage` = `<main>` + `h1` + one paragraph + one `primary` `Button` with a dictionary label (no action yet; P1-10 replaces the page); `NotFoundPage` = `h1` ("Page not found") + link to `/`. Merchant `HomePage` = `<header>` (app name + `LanguageToggle`), `<main>` with `h1` (e.g. "Orders") and a `Button` labelled `helpButton` that opens a `Dialog` titled `helpTitle` with one paragraph (`helpBody`) and a close button (`close`), `<footer>` showing `Core {CORE_VERSION}` imported from `@ppos/core` (proves the workspace import). All four keys exist in both merchant dictionaries. Both apps readable at 375 px with no horizontal scroll.
7. **Base components** in `packages/ui/src`, exported from `index.ts`; apps import them from `@ppos/ui`. `@ppos/ui` holds no data fetching, no router, no dictionaries and no business rules; every label comes in through props:

| Component | Must |
|---|---|
| `Button` | native `<button>`, default `type="button"`; variants `primary` / `secondary` / `danger` (colours per Spec 3); `loading` → `disabled`, `aria-busy="true"`, shows `Spinner`; min height 44 px; visible navy `focus-visible` ring |
| `Field.tsx` → `Input`, `Select` | `<label htmlFor>` bound with `useId`; `hint` and `error` linked through `aria-describedby`; `error` sets `aria-invalid="true"`; native `<select>` |
| `Card.tsx` → `Card`, `Badge` | `Card` = `<section>` labelled by its optional heading (`aria-labelledby`); `Badge` = `<span>` with tone variants |
| `Dialog` (`variant="dialog" \| "sheet"`) | native `<dialog>` opened with `showModal()`; `aria-labelledby` its title; close button labelled from props; Escape closes; focus returns to the opener |
| `Spinner` | `role="status"` with a visually hidden label from props |

8. **`vercel.json`** (each app): `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }`.
9. **Vitest**: projects `ui` (`packages/ui`), `storefront` and `merchant` (apps), each `environment: 'jsdom'`, `setupFiles: ['./tests/setup.ts']` (imports `@testing-library/jest-dom/vitest`), include `tests/**/*.test.{ts,tsx}`. Root `vitest.config.ts` now covers `packages/*` and `apps/*`; it must never collect `e2e/**`. `packages/ui/tests/ui.test.tsx`: `Input` found by `getByLabelText`; `error` → `aria-invalid` and the description; `Button loading` → `aria-busy` and disabled; `Spinner` has role `status`. `apps/<app>/tests/app.test.tsx`: `App` at `/` renders an `h1`; merchant toggle switches the `h1` text and `document.documentElement.lang`.
10. **Playwright** `e2e/playwright.config.ts`: `testDir: '.'`; project `storefront`: `testMatch: /(^|[\\/])storefront(-[a-z0-9-]+)?\.spec\.ts$/`, `baseURL: 'http://localhost:5173'`; project `merchant` (Session 2): `testMatch: /(^|[\\/])merchant(-[a-z0-9-]+)?\.spec\.ts$/`, `baseURL: 'http://localhost:5174'`. Later cards add `e2e/storefront-<topic>.spec.ts` / `e2e/merchant-<topic>.spec.ts` without touching this file. Both projects use a Chromium device with `viewport: { width: 375, height: 812 }`; `webServer` array running `pnpm --filter @ppos/storefront dev` and `pnpm --filter @ppos/merchant dev` with matching `url`s and `reuseExistingServer: !process.env.CI`. Every `webServer` entry passes `env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_FUNCTIONS_URL` from `process.env`, defaulting to CI's dummy values (`http://127.0.0.1:54321`, `e2e-dummy-publishable-key`, `http://127.0.0.1:54321/functions/v1`) when unset, so local runs match CI and later e2e tests can stub those URLs with `page.route`. `forbidOnly: true`; `retries: 0`; `use.trace: 'retain-on-failure'`. `e2e/tsconfig.json` extends the base with `lib: ["ES2023", "DOM"]` and `types: ["node"]`.
11. **Root scripts**: `"e2e": "playwright test -c e2e/playwright.config.ts"`; `"typecheck": "pnpm -r run typecheck && tsc --noEmit -p e2e/tsconfig.json"`. Each app's `typecheck` is `tsc --noEmit -p tsconfig.json`, and that tsconfig must cover `src`, `tests` and the Vite/Vitest config files (if you split them into two tsconfigs, check both).
12. **Smoke specs** (roles, labels, text only): storefront `/` → `h1` visible, `html` has `lang="en-GB"`, `document.documentElement.scrollWidth <= 375`, the primary button (by role and name) `toHaveCSS('background-color', 'rgb(35, 55, 73)')` (proves Tailwind generated the `@ppos/ui` classes); unknown path → heading "Page not found" and its link returns to `/`. Merchant `/` → `h1` visible; click the help button → `getByRole('dialog', { name: <the en-GB helpTitle text> })` visible; press Escape → the dialog is hidden and `expect(helpButton).toBeFocused()`; click the language button (by role and accessible name) → `html` `lang="zh-CN"` and `h1` text differs from the English text; click again → `en-GB`; footer contains `Core `. Accessibility: on storefront `/`, the storefront unknown path, and merchant `/` in en-GB and again after switching to zh-CN, run `const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze(); expect(r.violations).toEqual([]);` with `import AxeBuilder from '@axe-core/playwright';` ([H] confirm the tag names in the installed axe-core README). Spec files contain no CJK characters.

## Acceptance

1. `pnpm install --frozen-lockfile` → exit 0
2. `pnpm verify:quick` → exit 0; Vitest reports projects `core`, `ui`, `storefront`, `merchant`, all passed
3. `pnpm lint` → exit 0
4. `pnpm --filter @ppos/storefront build && pnpm --filter @ppos/merchant build` → exit 0 (`dist/` stays untracked)
5. `pnpm exec playwright install chromium && pnpm e2e` → all tests passed in projects `storefront` and `merchant`
6. `pnpm exec playwright test -c e2e/playwright.config.ts --list` → `storefront.spec.ts` appears only under `[storefront]` and `merchant.spec.ts` only under `[merchant]`
7. `grep -c 'AxeBuilder' e2e/storefront.spec.ts e2e/merchant.spec.ts` → each ≥ 1
8. `ls apps/*/tailwind.config.* apps/*/postcss.config.* packages/ui/tailwind.config.* 2>/dev/null | wc -l` → `0`
9. `grep -rn 'react-router-dom' apps e2e packages/ui package.json --exclude-dir=node_modules --exclude-dir=dist` → no output
10. `grep -rnE "(src|href)=[\"']https?://|@import url\(|fetch\(" apps/*/index.html apps/*/src packages/ui/src` → no output (no third-party scripts, styles, fonts or requests)
11. `grep -rnE 'dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|document\.write\(|service_role|SERVICE_ROLE|STRIPE_SECRET_KEY' packages/ui/src apps/*/src` → no output (the guards scan only `apps/**`)
12. `grep -rnE "from '(react-router|@tanstack/react-query|@supabase/supabase-js|@ppos/core)'" packages/ui/src` → no output (`@ppos/ui` stays presentational)
13. `node scripts/guards/run-all.mjs` → `All guards passed.` (CJK only in `apps/merchant/src/i18n/zh-CN.ts`)
14. `pnpm verify` → exit 0
15. `git diff --stat main...HEAD` → only Deliverables paths

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] `versions.md` rows filled: vite / @vitejs/plugin-react, react / react-dom, react-router, tailwindcss / @tailwindcss/vite (+ the `@source` doc URL), @tanstack/react-query, @playwright/test, @axe-core/playwright (+ testing-library, jsdom rows)
- [ ] PROGRESS.md updated (done log for both sessions; follow-ups: ask the human to check both apps at 375 px on the Vercel preview once the projects exist; `## Proposed doc changes`: "scripts/guards/banned-patterns.mjs: add `packages/ui/**` to the `include` lists of `unsafe-html` and `service-role-in-browser` (protected; human edits)")
- [ ] PR opened with the template at the end of Session 2; CI `e2e` job ran (not skipped) and is green

## Stop and escalate if

- You need a package that is not approved (e.g. `react-router-dom`, `@testing-library/dom`, `@vitejs/plugin-react-swc`, a font package) → Dependency request in PROGRESS.md; stop.
- `@tailwindcss/vite` or `@vitejs/plugin-react` reports a peer conflict with the installed Vite major → BLOCKED with the message; do not downgrade silently.
- The CI `e2e` job fails while local runs pass, after 3 attempts → BLOCKED with the CI log excerpt.
- A component needs a browser API that jsdom lacks and the only fix would mock away real behaviour → cover it in Playwright instead; if that is impossible, escalate.
- Anything requires Supabase, the network, or an env value at app start.

## Hints (verified facts / pitfalls)

- Tailwind v4 is CSS-first: `@import "tailwindcss";` + `@theme` tokens; `--color-*` tokens create colour utilities. The v3 `@tailwind base/components/utilities` directives and `tailwind.config.js` do not apply.
- React Router: import `BrowserRouter`, `MemoryRouter`, `Routes`, `Route`, `Link` from `react-router`. `react-router-dom` is not approved.
- TanStack Query v5 uses the object form only (`useQuery({ queryKey, queryFn })`).
- React 19: `createRoot` from `react-dom/client`; keep `@types/react` and `@types/react-dom` on the same major as `react`.
- [H] `@testing-library/react` 16+ expects `@testing-library/dom` as a peer dependency, which is not approved. pnpm installs missing peers automatically by default; if tests cannot resolve it, write a Dependency request instead of adding it.
- [H] jsdom may not implement `HTMLDialogElement.showModal()`. Test the Dialog's open/close behaviour in Playwright (Spec 12, merchant help dialog) and keep jsdom tests to static roles and labels.
- Playwright `devices['iPhone …']` entries use WebKit, which CI does not install. Use a Chromium descriptor (e.g. `devices['Desktop Chrome']`) with the 375 × 812 viewport.
- `cjk-lint` scans `apps/`, `packages/` and `e2e/` and allows CJK only in `apps/merchant/src/i18n/zh-CN.ts`. Hence the toggle label and e2e assertions must not contain Chinese literals.
- `process.env.CI` is fine in `e2e/playwright.config.ts`; the `core-impure` guard applies only to `packages/core/src`.
- Playwright's `webServer.cwd` defaults to the config's folder; `pnpm --filter …` works from any folder in the workspace.
- Locally, stop any `pnpm dev` you started yourself before `pnpm e2e`: a reused server was started without the dummy `VITE_*` values and reads your `.env.local` instead.
- Banned in `apps/` and `packages/ui`: `dangerouslySetInnerHTML`, `.innerHTML =`, any service-role or Stripe secret name. The guards `unsafe-html` and `service-role-in-browser` scan only `apps/**`; Acceptance 11 covers `packages/ui` until the human extends them.
