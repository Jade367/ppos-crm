# P1-06 — Merchant auth, shop membership & back-office shell

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-05, P0-04 |
| Mode | `standard` |
| Reasoning effort | `high` |
| Model | `glm-5.3` (never Flash: auth) |
| Session budget | Two sessions on one branch `task/P1-06-merchant-auth`, ≤ 3 h each (plan: Spec → Sessions); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none |

## Goal

Merchants log in to the back office with email and password (Supabase Auth). A platform admin creates a shop and invites its owner; an owner invites managers and staff; both go through the `platform-invite` edge function, because `auth.admin.inviteUserByEmail` needs the service role. The shell guards every route by role, lets a user with several shops switch between them, remembers the language choice, and logs out. Every later merchant card plugs its pages into this shell.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §3 (env var names), §7 `shop_members` / `platform_admins` + RLS principles, §8 (`platform-invite` row and the rules under the table), §14
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` → "RLS matrix" (what each role can read)
- `supabase/functions/_shared/{env,http,supabase,core}.ts` (P0-03), `apps/merchant/src/` router + i18n (P0-04), `packages/ui/src/index.ts` (P0-04), `e2e/playwright.config.ts` (read only)
- `docs/takeaway/reference/uk-compliance.md` UKC-COOKIE-03, UKC-DP-04

## Out of scope

- Password reset, MFA, removing members, changing roles, customer accounts (follow-ups).
- Pages owned by later cards: menu (P1-07), settings (P1-08), payments (P1-09), orders (P1-13). Add only placeholders with nav links.
- Any RLS or schema change (escalate instead).

## Deliverables

| Path | Action |
|---|---|
| `packages/core/src/schemas/invite.ts` + `packages/core/src/index.ts` | create / modify: `platformInviteRequestSchema` |
| `supabase/functions/platform-invite/index.ts` | create: only `Deno.serve(createHandler(realDeps))` |
| `supabase/functions/platform-invite/handler.ts`, `handler.test.ts` | create: logic with injected deps; deno tests with fakes |
| `supabase/config.toml` | modify: `[auth]` site URL / redirect URLs for the merchant dev URL; disable public sign-up (see Hints) |
| `supabase/seed.sql` | modify: three fake auth users (below) |
| `apps/merchant/src/auth/*` | create: `AuthProvider`, `RequireAuth`, `RequireRole`, `RequirePlatformAdmin`, `useMemberships` |
| `apps/merchant/src/layout/AppShell.tsx` | create: nav, shop switcher, language toggle, logout |
| `apps/merchant/src/pages/{LoginPage,AcceptInvitePage,NoAccessPage,TeamPage}.tsx`, `apps/merchant/src/pages/platform-admin/ShopsPage.tsx` | create |
| `apps/merchant/src/i18n/en-GB.ts`, `zh-CN.ts`, `I18nProvider.tsx` (persist the language), router file | modify |
| `apps/merchant/src/**/*.test.tsx` | create (RTL) |
| `e2e/merchant-auth.spec.ts`, `e2e/fixtures/merchant-auth/*.json` | create |

`e2e/playwright.config.ts` is **not** a deliverable: P0-04's `merchant` project already matches `merchant-*.spec.ts` (regex `testMatch`, decision C3) and its `webServer` entries forward the dummy `VITE_*` values CI sets (decision C19). If either is not true, stop and escalate.

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR):
- **Session 1**: `schemas/invite.ts` + `index.ts`, the `platform-invite` function and its deno tests (Acceptance 1), `config.toml`, the seed users (Acceptance 4, agent part). Gate: Acceptance 1 and 4 (agent part) + `pnpm verify:quick` → checkpoint commit `feat(functions): platform-invite and seed users [P1-06] (session 1/2)` → `git push -u origin task/P1-06-merchant-auth` (no PR yet) → PROGRESS.md `## Current`: `P1-06 Session 1 done (<hash>); next: Session 2, first file apps/merchant/src/auth/roles.ts`. Stop.
- **Session 2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): `apps/merchant/src/auth/*`, `AppShell`, the pages, i18n, RTL tests, the e2e spec and fixtures (Acceptance 2, 3). Change Session 1 files only to fix a failing check. Gate: every Acceptance item, `pnpm verify` → commit → push → open the PR.

Build every page from `@ppos/ui` components (`Button`, `Input`, `Select`, `Card`, `Badge`, `Dialog`, `Spinner`); create no base components in `apps/merchant`.

**Routes**

| Route | Access | Content |
|---|---|---|
| `/login` | public | email + password form (`signInWithPassword`); on success go to `next` or `/` |
| `/auth/accept` | public | invite landing: establish the session from the link, then a "Choose a password" form (`updateUser({ password })`, min 10 chars) |
| `/` | any member | dashboard placeholder showing the current shop name as the page heading |
| `/team` | owner | member list (email, role) from `list_members` + invite form (email, role `manager`/`staff`) |
| `/platform-admin/shops` | platform admin | shop list (name, slug, status) + "Create shop and invite owner" form |
| everything else | `RequireAuth` + `RequireRole min="staff"` by default | later cards set their own minimum |

- No session → redirect to `/login?next=<path>`. Logged in but no membership and not a platform admin → `NoAccessPage` with a logout button. A platform admin with no membership: `/` redirects to `/platform-admin/shops`. Role too low → "You don't have access to this page" (no redirect loop).
- Memberships: `select role, shop:shops(id, name, slug, status) from shop_members` (RLS returns the caller's own rows). Platform admin: `rpc('is_platform_admin')`. Role order owner > manager > staff, defined once (`apps/merchant/src/auth/roles.ts`).
- Current shop: `localStorage['ppos.merchant.shop']` = shop id; ignored if not in the memberships (fallback: first membership by shop name). The switcher is shown only with ≥ 2 shops.
- Language: `localStorage['ppos.merchant.lang']` ∈ `en-GB` | `zh-CN`, default `en-GB`; P0-04's `LanguageToggle` and `I18nProvider` already switch the language and `<html lang>`; this card adds persistence. Every string comes from the dictionaries; Chinese text only in `zh-CN.ts`. Wrap every `localStorage` access in try/catch (private mode).
- Logout: `signOut()` then `/login`; clear `ppos.merchant.shop`, keep the language.

**`platform-invite` (POST, JWT required: keep `verify_jwt` default)** — request validated by `platformInviteRequestSchema` (`.strict()`, discriminated on `action`):

| `action` | Body | Caller check (with the caller's JWT, in SQL) | Effect |
|---|---|---|---|
| `create_shop` | `shop.name` 1..100 chars, `shop.slug` 3..60 chars matching `^[a-z0-9]+(-[a-z0-9]+)*$`, `ownerEmail` | `is_platform_admin()` | insert `shops` (status `draft`) with the service client → invite owner → insert `shop_members` role `owner`. If the invite fails, delete the new shop |
| `invite_member` | `shopId (uuid), email, role: 'manager' \| 'staff'` | `is_shop_member(shopId, 'owner')` | invite → insert `shop_members` |
| `list_members` | `shopId (uuid)` | `is_shop_member(shopId, 'owner')` or `is_platform_admin()` | return `{ members: [{ userId, email, role }] }` (emails via `auth.admin.getUserById`; the browser cannot read `auth.users`) |

- Invite: ``auth.admin.inviteUserByEmail(email, { redirectTo: `${env.APP_MERCHANT_URL}/auth/accept` })`` on the service client.
- Responses: `200 { shopId, userId }` (`list_members`: `200 { members }`); errors via `_shared/http.ts` `HttpError` + `errorResponse` (body `{ error: { code, message } }`): `400 VALIDATION`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `409 SLUG_TAKEN | ALREADY_REGISTERED | ALREADY_MEMBER`, `500 INTERNAL`. Map an "already registered" invite error to `409 ALREADY_REGISTERED` (record the exact error code you observed in PROGRESS.md; adding existing users to a shop is a follow-up).
- Get the caller with `requireUser(req)` from `_shared/supabase.ts` (P0-03); use `createServiceClient()` only for the privileged writes. Import core schemas only through `../_shared/core.ts`.
- Never trust a role or shop from the body without the SQL check. Log ids only, never emails (UKC-DP-04).

**Seed users** (local only, fake): `admin@demo.test` (row in `platform_admins`), `owner@demo.test` (owner of `demo-chippy`), `staff@demo.test` (staff of `demo-chippy`), password `demo-password-1` for all, email confirmed.

**E2E in CI:** the CI `e2e` job does not run `supabase start`; it sets dummy env (`VITE_SUPABASE_URL=http://127.0.0.1:54321`, `VITE_SUPABASE_PUBLISHABLE_KEY=e2e-dummy-publishable-key`, `VITE_FUNCTIONS_URL=http://127.0.0.1:54321/functions/v1`), which P0-04's `webServer` forwards (and uses as the local default). The app must render with these values. `e2e/merchant-auth.spec.ts` stubs every request to `127.0.0.1:54321` with `page.route` (`**/auth/v1/**`, `**/rest/v1/shop_members*`, `**/rest/v1/rpc/is_platform_admin`, `**/functions/v1/platform-invite`) using JSON fixtures that mirror the seed. Scenario: owner logs in → heading "Demo Chippy" visible → `/team` reachable → logout → `/login`. A second scenario: staff session → `/team` shows the no-access message. Run `pnpm e2e` with no dev server of your own running: `reuseExistingServer` would reuse it with your real `.env.local` values instead of the dummy ones.

## Acceptance

1. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts') && deno test --allow-env --allow-net --allow-read` → green, including platform-invite tests: non-admin `create_shop` → 403; admin `create_shop` → 200 and member row inserted as owner; owner `invite_member` → 200; manager `invite_member` → 403; staff `list_members` → 403; unknown key in body → 400; duplicate slug → 409 `SLUG_TAKEN`; invite failure → shop deleted (fake records the call); owner of shop A `invite_member` with shop B's `shopId` → 403 and no invite call recorded; owner of A `list_members` for B → 403; `invite_member` with `role: 'owner'` → 400 `VALIDATION`; no `Authorization` header → 401 `UNAUTHORIZED`; platform admin `list_members` for any shop → 200; inviting an already-registered email → 409 `ALREADY_REGISTERED` (decision C10). The fake membership check takes `(callerId, shopId, minRole)` and answers per shop, so a check that ignores `shopId` fails these tests
2. `pnpm --filter @ppos/merchant test` → green: login form found by label; `RequireRole` blocks staff from an owner route; switcher writes `ppos.merchant.shop`; toggle writes `ppos.merchant.lang` and changes visible text; `zh-CN.ts` still `satisfies Record<MessageKey, string>` (P0-04 pattern)
3. `pnpm e2e` → `merchant-auth.spec.ts` green
4. Agent part: `pnpm exec supabase db reset` → seed applies; then `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select email, email_confirmed_at is not null as confirmed, encrypted_password = extensions.crypt('demo-password-1', encrypted_password) as pw_ok from auth.users where email like '%@demo.test' order by email"` → 3 rows, each `t | t` (if `psql` is not installed, run the same query through `docker exec -i <the supabase_db container> psql -U postgres`); paste the output into PROGRESS.md. Human part (the agent never claims it): the human starts `pnpm exec supabase functions serve --env-file .env.local` (`APP_MERCHANT_URL` must be in the root `.env.local`) and the merchant dev server, logs in as `admin@demo.test`, creates a shop and sees the invite in the local mail UI (URL from `pnpm exec supabase status`). The agent writes these steps into the PR description and leaves this part unchecked
5. `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md); the human part of item 4 is listed in the PR description, unchecked
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template

## Stop and escalate if

- You need an RLS or schema change, or a new dependency.
- `e2e/playwright.config.ts` does not match `merchant-auth.spec.ts` or does not forward the dummy `VITE_*` env (a P0-04 gap; do not edit the file in this card).
- Invites do not work locally with public sign-up disabled.
- The invite link cannot establish a session with the installed supabase-js (record the URL shape you received, never the token).

## Hints (verified facts / pitfalls)

- The service-role key never reaches `apps/` (guard `service-role-in-browser`). The browser uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` only.
- [H] Seeding `auth.users` directly: set `instance_id`, `aud`/`role` = `authenticated`, `encrypted_password = extensions.crypt('demo-password-1', extensions.gen_salt('bf'))`, `email_confirmed_at`, and set the token columns (`confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`) to `''`, because NULLs there are known to break GoTrue sign-in. Also insert the matching `auth.identities` row. Check the columns with `\d auth.users` locally before writing the seed.
- [H] Confirm the `config.toml` key that disables public sign-up for the installed CLI (`supabase init` template) instead of guessing.
- Which auth flow the invite link uses (token in the URL hash vs a `code` to exchange) depends on the supabase-js version and settings. Read the installed version's docs; do not guess.
- RTL tests assert Chinese text through the dictionary (`import { zhCN } from '../i18n/zh-CN'`; `getByText(zhCN.<key>)`), never with CJK literals: `cjk-lint` scans every file under `apps/` (tests included) except `zh-CN.ts`.
- e2e auth fixtures: make `access_token` JWT-shaped (base64url `header.payload.signature`, payload with a fake `sub`, `role: 'authenticated'` and `exp: 4102444800`) and use fake ids only. [H] supabase-js may decode the token client-side; a non-JWT string can break the session.
