# P1-09 — Stripe Connect onboarding + webhook skeleton (account.updated)

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-05, P1-06, P0-03 |
| Mode | `standard` |
| Reasoning effort | `max` (Stripe; your training data predates this API version) |
| Model | `glm-5.3` (never Flash) |
| Session budget | Two sessions on one branch `task/P1-09-stripe-onboarding`, ≤ 3 h each (plan: Spec → Sessions); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none |

## Goal

A shop owner connects the shop's own Stripe account from the back office: the platform creates a connected account (Accounts v1 with controller properties, Standard-equivalent), sends the owner through Stripe-hosted onboarding, and keeps the account's readiness in `stripe_accounts` from `account.updated` webhooks. The Payments page shows the status and what Stripe still needs. A shop can only go live when payments are ready and its legal identity is complete; P1-05's `shops_go_live_check` trigger enforces that, and this card adds the platform-admin "Go live" button that shows the trigger's reasons. The webhook endpoint built here (signature check, dedupe, routing) is the skeleton P1-12 extends.

## Read first (and only these, plus what you find with grep)

- **`docs/takeaway/reference/stripe-endive.md` — read §1–§5, §7, §10 and §13 completely (and the "Error mapping" list at the end of §6) BEFORE writing any code.** It is the only Stripe knowledge you may rely on; where your memory disagrees, the file wins.
- `docs/takeaway/reference/architecture.md` §3 (env vars), §7 `stripe_accounts` / `stripe_events`, §8, §9
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` → RLS matrix, `shops_go_live_check` row
- `supabase/functions/_shared/{env,http,supabase,stripe}.ts` (P0-03), `docs/takeaway/adr/0002-core-deno-bridge.md`, `packages/ui/src/index.ts` (P0-04)
- `docs/takeaway/reference/uk-compliance.md` UKC-PAY-03, UKC-PAY-04, UKC-ID-02

## Out of scope

- Checkout, payments, refunds, disputes and their events (P1-11, P1-12). `stripe-webhook-platform` (P1-12).
- Accounts v2, embedded onboarding (`@stripe/connect-js`), `account_update` links, requesting capabilities, any Stripe code in the browser.
- Creating webhook endpoints or secrets (human), anything against live mode or the prod project.
- The `shops_go_live_check` trigger and its pgTAP tests (P1-05 owns them, decision C17): no migration in this card; never create, replace or alter the trigger.
- Running `stripe login` or `stripe listen` yourself (human, Acceptance 5).

## Deliverables

| Path | Action |
|---|---|
| `packages/core/src/payments.ts` (+ index, unit test) | create: `isPaymentsReady`, `needsStripeAttention` |
| `packages/core/src/schemas/payments.ts` | create: `connectOnboardingRequestSchema` = `{ shopId: uuid, action: 'link' \| 'sync' }`, strict |
| `supabase/functions/_shared/stripe-accounts.ts` (+ test) | create: pure `accountSnapshot(account)` + repository write |
| `supabase/functions/_shared/stripe-events.ts` (+ test) | create: `begin` / `markProcessed` / `markFailed` (stripe-endive §7 dedupe), reused by P1-12 |
| `supabase/functions/connect-onboarding/{index,handler,handler.test}.ts` | create |
| `supabase/functions/stripe-webhook-connect/{index,handler,account-events,handler.test}.ts`, `fixtures/*.json` | create |
| `supabase/config.toml` | modify: `[functions.stripe-webhook-connect] verify_jwt = false` |
| `apps/merchant/src/pages/settings/{Payments,PaymentsRefresh,PaymentsReturn}Page.tsx`, platform-admin shops page "Go live" button, i18n `en-GB.ts` + `zh-CN.ts`, RTL tests | create / modify |

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR):
- **Session 1**: core `payments.ts` + schema, `_shared/stripe-accounts.ts`, `_shared/stripe-events.ts`, `connect-onboarding`, `stripe-webhook-connect`, `config.toml`, deno and core unit tests (Acceptance 1, 2). Gate: those items + `pnpm verify:quick` → checkpoint commit `feat(payments): onboarding and connect webhook [P1-09] (session 1/2)` → `git push -u origin task/P1-09-stripe-onboarding` (no PR yet) → PROGRESS.md `## Current`: `P1-09 Session 1 done (<hash>); next: Session 2, first file apps/merchant/src/pages/settings/PaymentsPage.tsx`. Stop.
- **Session 2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): merchant pages, the "Go live" button, i18n, RTL tests (Acceptance 3, 4), the human smoke steps in the PR description (Acceptance 5), `pnpm verify` (Acceptance 6). Change Session 1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

**Readiness (FROZEN, stripe-endive §5):** `isPaymentsReady = chargesEnabled === true && cardPaymentsStatus === 'active'`. `needsStripeAttention` = `requirementsCurrentlyDue.length > 0 || disabledReason !== null || !chargesEnabled`.

**`connect-onboarding`** (POST, merchant JWT; keep `verify_jwt` default):
1. Validate the body; get the caller with `auth.getUser`; check `is_shop_member(shopId, 'owner')` for **that** `shopId` with the caller's JWT in SQL → else `403 FORBIDDEN` (no Stripe call).
2. `action: 'link'`: read `stripe_accounts` for the shop (service client). If `deauthorized_at` is set → `409 ACCOUNT_DEAUTHORIZED`. If no row: `accounts.create` **exactly as stripe-endive §4** (`country: 'GB'`, caller's email, `business_profile`, the four `controller` properties, `metadata.shop_id`, `onPlatform('acct-create-<shopId>')`, no `type`), then insert the row with `accountSnapshot` (`on conflict (shop_id) do nothing`). Then `accountLinks.create` exactly as §5 (`type: 'account_onboarding'`, `refresh_url = ${APP_MERCHANT_URL}/settings/payments/refresh`, `return_url = ${APP_MERCHANT_URL}/settings/payments/return`) → `200 { url }`.
3. `action: 'sync'`: no row → `404 NO_ACCOUNT`; else `accounts.retrieve(acct)` (platform call, no `onAccount`), write the snapshot → `200 { status: { chargesEnabled, payoutsEnabled, detailsSubmitted, cardPaymentsStatus, requirementsCurrentlyDue, disabledReason, ready } }`.
4. Errors (through `_shared/http.ts` `HttpError` + `errorResponse`; caller via `requireUser(req)`; core imported only through `../_shared/core.ts`): `StripeIdempotencyError` → `409 IDEMPOTENCY_CONFLICT`; `StripePermissionError` → `409 ACCOUNT_DEAUTHORIZED`; `StripeConnectionError` / `StripeAPIError` / `StripeRateLimitError` → `503 STRIPE_UNAVAILABLE` (the classes listed in stripe-endive §2 item 13 and the §6 "Error mapping" list); `StripeInvalidRequestError` → `502 STRIPE_REQUEST_INVALID` (log `err.code` and `err.param` only). Never store, log or return the link anywhere except this one response.

**`accountSnapshot(account)`** maps exactly the stripe-endive §4 table: `charges_enabled`, `payouts_enabled`, `details_submitted`, `card_payments_status = capabilities?.card_payments ?? null`, `requirements_currently_due = requirements?.currently_due ?? []`, `disabled_reason = requirements?.disabled_reason ?? null`. Always write the full snapshot.

**`stripe-webhook-connect`** (shape mandatory: stripe-endive §7 skeleton): POST only; `stripe-signature` header required; raw `req.text()`; `constructEventAsync(raw, sig, env.STRIPE_WEBHOOK_SECRET_CONNECT, undefined, webhookCryptoProvider)`; bad signature → 400; `events.begin` → `'duplicate'` returns 200 untouched; handler errors → `markFailed` + 500 (Stripe retries); success → `markProcessed` + 200. `index.ts` is only `Deno.serve(createWebhookHandler(realDeps))`.

| Event | Action |
|---|---|
| `account.updated` | `accounts.retrieve(event.account)` (platform call); find `stripe_accounts` by `stripe_account_id`. If none and the re-fetched `metadata.shop_id` names an existing shop → insert the row. If still unknown → record "unknown account", 200. Write the snapshot + `updated_from_event_id = event.id` |
| `account.application.deauthorized` | `data.object` is an Application, not the Account. By `event.account`: `deauthorized_at = now()`, `charges_enabled = false`; no Stripe calls |
| missing `event.account`, any other type | record and mark processed, 200 (P1-12 adds handlers) |

Log only `event.id`, `event.type`, `event.account`.

**Go live (P1-05 trigger, decision C17).** The database check already exists: P1-05's `shops_go_live_check` raises `23514` with the message `shop not ready to go live: <codes joined by ', '>`. The codes, in order: `LEGAL_NAME_MISSING`, `LEGAL_FORM_MISSING`, `ADDRESS_MISSING`, `CITY_MISSING`, `POSTCODE_MISSING`, `EMAIL_MISSING`, `PHONE_MISSING`, `COMPANY_NUMBER_MISSING`, `REGISTERED_OFFICE_MISSING`, `REGISTERED_IN_MISSING` (the last three only for `limited_company` / `llp`), `PAYMENTS_NOT_READY`. This card writes no migration. The "Go live" button runs `update shops set status = 'live' where id = <shop>` with the platform admin's client; on a `23514` error it splits the codes after the colon and shows one translated line per code (an unknown code is shown as-is); on success it shows the new status.

**Merchant UI** (en-GB + zh-CN; build pages from `@ppos/ui` components; RTL tests reference Chinese only through the zh-CN dictionary object, never CJK literals):
- `/settings/payments` (manager+ can view; reads `stripe_accounts` via RLS): states "Not connected" / "Stripe needs more information" / "Ready to take payments". Banner when `needsStripeAttention` with "Continue Stripe setup" (owner only → `link` → `window.location.assign(url)`) and "Open your Stripe Dashboard" (`https://dashboard.stripe.com/`). Fees: one sentence linking `https://stripe.com/gb/pricing`; never quote a rate (UKC-PAY-04).
- `/settings/payments/refresh` (owner): calls `link` again and redirects; error → message + retry button.
- `/settings/payments/return` (owner): calls `sync` and shows the result, with the note that finishing the Stripe pages does not by itself mean setup is complete.
- Platform admin shops page: "Go live" button as specified under **Go live**.

## Acceptance

1. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts') && deno test --allow-env --allow-net --allow-read` → green, including: non-owner → 403; owner of shop B calling `link` or `sync` with shop A's id → 403 and no Stripe call (the fake membership check answers per `(callerId, shopId)`); no `Authorization` header → 401; first `link` calls `accounts.create` once with the exact §4 params (assert `'type' in params === false` and the idempotency key `acct-create-<shopId>`), inserts the row, then `accountLinks.create` with `type: 'account_onboarding'` and both URLs; second `link` does not create; `sync` writes the snapshot; `StripeIdempotencyError` → 409; webhook tests 1, 2, 3 and 7 from stripe-endive §10 (signed with `generateTestHeaderStringAsync`, secret `whsec_test`); `account.updated` fixture → snapshot written with the exact mapping; unknown account without `metadata.shop_id` → 200 and no write; deauthorized → `charges_enabled false` and no Stripe call
2. `pnpm --filter @ppos/core test` → `isPaymentsReady` truth table (`true/'active'` only), `needsStripeAttention` cases
3. `pnpm exec supabase db reset && pnpm exec supabase test db` → green (no new migration; P1-05's go-live tests and the seed's draft → stripe row → live order still pass)
4. `pnpm --filter @ppos/merchant test` → banner shown for each attention condition; "Continue Stripe setup" visible to owner, hidden for manager; the page never renders an onboarding URL as text; "Go live" with a stubbed `23514` error `shop not ready to go live: LEGAL_FORM_MISSING, PAYMENTS_NOT_READY` → both reasons shown as translated lines; a stubbed success → the new status shown
5. HUMAN-run sandbox smoke. The agent writes these steps into the PR description and leaves this item unchecked: (a) the human puts the sandbox `STRIPE_SECRET_KEY`, `APP_MERCHANT_URL=http://localhost:5174` and the `stripe listen` secret (as `STRIPE_WEBHOOK_SECRET_CONNECT`) into the root `.env.local`; (b) in their own terminals the human runs `stripe listen --latest --forward-connect-to http://127.0.0.1:54321/functions/v1/stripe-webhook-connect` and `pnpm exec supabase functions serve --env-file .env.local`; (c) the human logs in as `owner@demo.test`, clicks "Continue Stripe setup", completes test onboarding and returns. Afterwards the agent may run `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select charges_enabled, card_payments_status, updated_from_event_id from stripe_accounts"` and paste the rows (no payloads) into PROGRESS.md. Never report the smoke as passed without that output. The agent never runs `stripe login` or `stripe listen` and never reads `.env.local`
6. `node scripts/guards/run-all.mjs` → exit 0; `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md); item 5 is listed in the PR description for the human, unchecked unless its `psql` output is pasted
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups, every Stripe fact you verified with its URL)
- [ ] PR opened with the template

## Stop and escalate if

- `deno check` rejects a parameter that stripe-endive.md shows: report the exact error; do not "fix" it from memory.
- `card_payments` is missing from the capabilities after test onboarding, Stripe refuses an `account_onboarding` link for an onboarded account, or a `v2.` event type appears.
- You need `stripeAccount:` outside `onAccount()`, a `type:` on `accounts.create`, or any secret value.
- P1-05's `shops_go_live_check` is missing, or its error message differs from `shop not ready to go live: <codes>`: do not write your own trigger.

## Hints (verified facts / pitfalls)

- Guards that will fire on stale patterns: `stripe-account-type`, `stripe-no-new`, `stripe-sync-construct-event`, `stripe-unpinned-import`, `stripe-api-version`, `stripe-tolerance-zero`, `secret-literal` (keep test secrets short: `whsec_test`).
- `stripe-account-type` has no test exclusion: never write `type: 'standard'`, `'express'` or `'custom'` anywhere under `supabase/functions`, tests included. Assert `'type' in params === false` instead.
- Put routing in `handler.ts` and take `stripe`, the repository and the clock as parameters, so deno tests run with fakes and no network (CI's deno job has no Supabase and no Stripe).
- `business_profile.url` with `localhost` may be rejected [H]: in local dev omit `url` if it fails and note it.
- Hand-written fixtures contain only the fields the handler reads (stripe-endive §10); use fake ids like `acct_test123`, `evt_test1`.
