# P1-11 — create-checkout edge function (re-price, validate, hosted Checkout direct charge)

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-09, P1-10, P1-02, P1-07 (`isSoldOut` in `packages/core/src/menu.ts`); through them P1-01, P1-03, P1-04, P1-05, P1-06, P0-03, P0-04 |
| Mode | `tests-first` (session A writes test proposals, human freezes, session B implements) |
| Reasoning effort | `max` (money + Stripe; your training data predates this Stripe API version) |
| Model | `glm-5.3` (never Flash) |
| Session budget | Session A ≤ 3 h. Session B runs as two sittings (B1, B2; see Session steps) on one branch, ≤ 3 h each; one PR at the end of B2. If a sitting runs over: checkpoint commit, write handoff, stop. |
| Golden tests | proposals (tests-first) → after freeze: `docs/takeaway/acceptance/P1-11/` |

## Goal

`POST /functions/v1/create-checkout` turns a customer's basket into a `pending_payment` order and a Stripe-hosted Checkout Session on the shop's own connected account (direct charge, `application_fee_amount` = the service fee). The server trusts nothing from the browser except ids and quantities: it re-loads the shop, menu, zone and slot from the database, re-prices with core `priceOrder`, snapshots items and allergens, and only then talks to Stripe. The Stripe total, the pay-button amount and the stored order total are always the same number. Fulfilment happens later, only in the webhook (P1-12).

## Read first (and only these, plus what you find with grep)

- **`docs/takeaway/reference/stripe-endive.md` §1, §2 (all 17 rows), §3, §6, §13 — completely, BEFORE any code.** Where your memory disagrees, the file wins.
- `docs/takeaway/reference/architecture.md` §3, §4, §5, §7 (`orders`, `order_items`, Allergens), §8, §9, §11
- `docs/takeaway/reference/uk-compliance.md` UKC-PRICE-06, -07, UKC-NAME-01, UKC-ALG-05, UKC-DP-01, -02, -04, UKC-PAY-01, UKC-A11Y-04
- `docs/takeaway/tasks/P1-10-storefront-menu-basket.md` → `checkoutRequestSchema`, "Submit"
- `docs/takeaway/03-execution-handbook.md` §F.1 (tests-first protocol)
- `packages/core/src/index.ts` (APIs of P1-01 pricing, P1-02 state, P1-03 slots, P1-04 zones, P1-07 allergens/menu, P1-09 payments)
- `supabase/functions/_shared/{env,http,supabase,stripe,core}.ts`, `docs/takeaway/adr/0002-*.md`

## Out of scope

- Marking anything paid, outbox events, webhooks (P1-12); the order status page (P1-16); expiry of abandoned orders (P1-14).
- Discounts / promo codes (P2), customer accounts, saved cards, Stripe.js, `customer` objects, `payment_method_types` (removed in endive).
- Session A: any implementation, stub or dependency change. Session B: editing tests.

## Deliverables

| Path | Action | Session |
|---|---|---|
| `docs/takeaway/acceptance-proposals/P1-11/proposal.json` | create (shape below) | A |
| `docs/takeaway/acceptance-proposals/P1-11/{params.acceptance.test.ts,pipeline.acceptance.test.ts,fakes.ts,CASES.md}` | create | A |
| `supabase/functions/create-checkout/{params,pipeline}.ts` | create | B1 |
| `supabase/functions/_shared/http.ts` (+ test) | modify: `HttpError` gets optional `details` (plain JSON, never request values) | B1 |
| `packages/core/src/schemas/checkout.ts` (+ unit test) | modify: add required `expectedTotalPence` (int 0..1 000 000) | B1 |
| `apps/storefront/src/pages/CheckoutPage.tsx`, `src/i18n/en-GB.ts` (+ RTL test) | modify: send `expectedTotalPence` (the button total); handle `409 PRICE_CHANGED`, `429 RATE_LIMITED`, `404 SHOP_NOT_FOUND` | B1 |
| `supabase/functions/create-checkout/{index,handler,repo}.ts` + `handler.test.ts`, `repo.test.ts` | create (`index.ts` is only `Deno.serve(createHandler(realDeps))`) | B2 |
| `supabase/functions/_shared/{postcodes,rate-limit}.ts` + tests | create | B2 |
| `supabase/migrations/<ts>_p1_11_checkout.sql` | create (`pnpm exec supabase migration new p1_11_checkout`) | B2 |
| `supabase/tests/checkout/{rate_limit,create_pending_order}.test.sql` | create (pgTAP, outside `acceptance/`) | B2 |
| `supabase/config.toml` | modify: `[functions.create-checkout]` `verify_jwt = false` | B2 |
| `packages/core/src/db/database.types.ts` | regenerate | B2 |

`proposal.json`:
```json
{ "command": "cd supabase/functions && deno test --allow-env --allow-net --allow-read create-checkout/tests/acceptance/",
  "files": [
    { "file": "params.acceptance.test.ts", "dest": "supabase/functions/create-checkout/tests/acceptance/params.acceptance.test.ts" },
    { "file": "pipeline.acceptance.test.ts", "dest": "supabase/functions/create-checkout/tests/acceptance/pipeline.acceptance.test.ts" },
    { "file": "fakes.ts", "dest": "supabase/functions/create-checkout/tests/acceptance/fakes.ts" } ] }
```

## Spec

### Session steps
- **Session A** (branch `task/P1-11-tests`): write the proposal files only; tests import `../../params.ts`, `../../pipeline.ts`, `../../../_shared/stripe.ts`, `../../../_shared/http.ts` and `@std/assert`. Read `supabase/functions/deno.json` (P0-03) first: use the bare `@std/assert` specifier if it is mapped there, otherwise `jsr:@std/assert@<exact version from reference/versions.md>`. Never write an inline `jsr:`/`npm:` specifier without an exact version: `deps-allowlist.mjs` scans the installed copies under `supabase/functions/**`, and session B cannot edit them (your own guard run does not scan `docs/`, so nothing else catches this before the freeze). Run `pnpm acceptance:try P1-11` and paste the output into the PR: it must fail on missing modules, never on syntax. Commit `test(P1-11): propose acceptance tests`, PR "P1-11 acceptance proposals (for human review)", stop.
- **Human**: review CASES.md, `node scripts/acceptance/freeze.mjs P1-11`, commit, label `protected-change-approved`, merge.
- **Session B** (fresh, branch `task/P1-11-create-checkout`) runs in two sittings on the same branch (decision C20), each ending with a green checkpoint commit, a push and a PROGRESS.md handoff; one PR at the end of B2:
  - **B1**: `pnpm acceptance:install P1-11`, see it fail (paste the line), then `params.ts`, `pipeline.ts`, `_shared/http.ts` `details`, core `checkoutRequestSchema` + `expectedTotalPence`, storefront `CheckoutPage` (Session B Acceptance 1, the golden and own tests of these files from 2, and 4). Gate: golden + own deno tests green and `pnpm verify:quick` → commit `feat(checkout): params and pipeline [P1-11] (session 1/2)` → `git push -u origin task/P1-11-create-checkout` (no PR yet) → PROGRESS.md `## Current`: `P1-11 B1 done (<hash>); next: B2, first file supabase/migrations/<ts>_p1_11_checkout.sql`. Stop.
  - **B2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): migration + pgTAP, `_shared/{rate-limit,postcodes}.ts`, `repo.ts`, `handler.ts`, `index.ts`, `config.toml`, regenerated types, the agent part of the sandbox smoke (rest of Session B Acceptance 2, then 3, 5, 6). Change B1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

### 1. Pure param builder — `create-checkout/params.ts` (exactly stripe-endive §6)
`buildCheckoutSessionParams(order: CheckoutOrder, lines: CheckoutLine[], shop: CheckoutShop, now: Date, storefrontUrl: string): { params; options }` with `CHECKOUT_TTL_SECONDS = 35 * 60` (= 2100; architecture §9, decision A10: Stripe's minimum is 30 min, the 5-min margin absorbs clock skew). Field list (sorted `Object.keys(params)` must equal exactly this): `cancel_url, client_reference_id, customer_email, expires_at, line_items, metadata, mode, payment_intent_data, success_url, ui_mode`. `payment_intent_data` keys exactly `application_fee_amount, metadata`.

| Field | Value |
|---|---|
| `mode` / `ui_mode` | `'payment'` / `'hosted_page'` |
| `line_items` | one per basket line `{ quantity, price_data: { currency: 'gbp', unit_amount: unitAmountPence, product_data: { name } } }`; then `Delivery` (only if > 0), `Service fee` (always), `Tip` (only if > 0), all quantity 1. Σ unit_amount × quantity must equal `order.totalPence`, else throw. Each line: `unitAmountPence × quantity === lineTotalPence`, else throw |
| `payment_intent_data` | `{ application_fee_amount: order.applicationFeePence, metadata: { order_id, shop_id } }` |
| `metadata` / `client_reference_id` / `customer_email` | `{ order_id, shop_id }` / order id / customer email |
| `expires_at` | `Math.floor(now.getTime() / 1000) + CHECKOUT_TTL_SECONDS` (unix **seconds**) |
| `success_url` / `cancel_url` | `${storefrontUrl}/o/${publicToken}` / `${storefrontUrl}/${shop.slug}/basket` |
| `options` | `onAccount(shop.stripeAccountId, 'checkout-' + orderId + '-' + checkoutAttempt)` |

Line names (built by the pipeline): item name, plus ` (` + selected option names joined by `, ` + `)`; an option with quantity > 1 is written `2 x Garlic dip`. Cap at 120 characters (cut, then `...`).

Worked example (B02): lines 2 × `Cod & chips` 900 and 1 × `Meal (Sesame dip)` 2050, delivery 250, service 45, tip 100 → total 4245, five line items in that order, `application_fee_amount` 45; with `now = 2026-11-02T18:07:00Z` (= 1793642820) → `expires_at` 1793644920.

### 2. Pipeline — `create-checkout/pipeline.ts`
`createCheckout(body: unknown, ctx: { now: Date; storefrontUrl: string }, deps: CheckoutDeps): Promise<{ url: string; token: string }>`; every failure throws `HttpError(status, code, details?)`.

```ts
export interface CheckoutDeps {
  repo: {
    loadShop(slug: string): Promise<ShopForCheckout | null>;        // shop row + stripe_accounts row (or null) + hours, closures, zones
    loadItems(shopId: string, itemIds: string[]): Promise<ItemForCheckout[]>; // only this shop's rows, with groups+options, incl. unpublished/archived flags
    createPendingOrder(order: NewPendingOrder): Promise<{ id: string; number: number; publicToken: string; checkoutAttempt: number }>;
    saveCheckoutSession(orderId: string, sessionId: string, expiresAtUnix: number): Promise<void>;
  };
  postcodes: { lookup(postcode: string): Promise<{ lat: number; lng: number } | 'not_found' | 'unavailable'> };
  stripe: { createCheckoutSession(params: Stripe.Checkout.SessionCreateParams, options: Stripe.RequestOptions): Promise<{ id: string; url: string | null; expires_at: number }> };
}
```
Session A defines `ShopForCheckout`, `ItemForCheckout` (fields from architecture §7 in camelCase: shop `id, slug, status, orderingPaused, collectionEnabled, deliveryEnabled, prepTimeMinutes, busyExtraMinutes, serviceFeePence, lat, lng, sessions, closures, zones, stripe: { accountId, chargesEnabled, cardPaymentsStatus, deauthorizedAt } | null`; item `id, name, pricePence, vatCategory, isPublished, archivedAt, soldOutUntil, allergens, groups[{ id, name, minSelect, maxSelect, options[{ id, name, pricePence, isAvailable, allergens }] }]`) and `NewPendingOrder` (`shopId`, `fulfilment`, all `orders` pricing fields of §5 incl. `applicationFeePence`, `customerName`, `customerPhone`, `customerEmail`, `deliveryAddress`, `deliveryPostcode`, `notes`, `allergyNote`, `requestedTime`, `stripeAccountId`, `checkoutExpiresAt` = now + 35 min ISO (same instant as `expires_at`), `items[{ itemId, nameSnapshot, unitPricePence, quantity, lineTotalPence, vatCategorySnapshot, allergensSnapshot: { contains, mayContain }, modifiers[{ optionId, groupName, name, pricePence, quantity }] }]`) as **exported types in `pipeline.ts`**, written into this card's shapes; session B implements them unchanged.

Steps, in this order (the first failing step decides the error; nothing is written and Stripe is not called before step 9):

| # | Step | Failure |
|---|---|---|
| 1 | `checkoutRequestSchema.safeParse(body)` (`.strict()`; duplicate option ids in a line also fail) | `400 VALIDATION`, `details.paths` = issue paths only |
| 2 | `loadShop(slug)`; must exist with `status = 'live'` | `404 SHOP_NOT_FOUND` |
| 3 | stripe row present, not deauthorized, `isPaymentsReady` | `503 PAYMENTS_NOT_READY` |
| 4 | not `orderingPaused`; chosen fulfilment enabled | `409 SHOP_CLOSED` |
| 5 | every line: item found, published, not archived, not sold out (`isSoldOut(soldOutUntil, now.toISOString())`, P1-07); every option belongs to a group of that item and is available; every group's min/max holds (`validateGroupSelection`) | `409 ITEM_UNAVAILABLE`, `details.itemIds` |
| 6 | delivery only: `normalisePostcode` (invalid → `400 VALIDATION`); `postcodes.lookup` → coordinates, or `lat/lng = null` on `'unavailable'`; `'not_found'` or no `resolveZone` match | `409 OUT_OF_ZONE` |
| 7 | `getAvailability` for the fulfilment; `requestedTime = null`: needs `asapAvailable` (else `SHOP_CLOSED` when not `isOpenNow`, otherwise `SLOT_UNAVAILABLE`); a time: `isRequestedTimeAvailable` | `409 SHOP_CLOSED` / `409 SLOT_UNAVAILABLE` |
| 8 | `priceOrder` with **database** prices, the zone, `shop.serviceFeePence`, `tipPence`; `PricingError` → 400; `!meetsMinimumOrder` → 409; `expectedTotalPence !== totalPence` → 409 | `400 VALIDATION` / `409 BELOW_MINIMUM` (`details.shortfallPence`) / `409 PRICE_CHANGED` (`details.totalPence`) |
| 9 | `createPendingOrder` (allergen snapshot = `mergeAllergens` of item + selected options) | — |
| 10 | build params, `stripe.createCheckoutSession`; `url === null` → `502 STRIPE_NO_URL` (order created, no session saved) | see Stripe errors |
| 11 | `saveCheckoutSession(id, session.id, session.expires_at)` → return `{ url, token: publicToken }` | — |

Stripe errors (stripe-endive §6): `StripeIdempotencyError` → `409 IDEMPOTENCY_CONFLICT`; `StripePermissionError` → `503 PAYMENTS_NOT_READY`; `StripeConnectionError` / `StripeAPIError` / `StripeRateLimitError` → `503 STRIPE_UNAVAILABLE`; `StripeInvalidRequestError` → `502 STRIPE_REQUEST_INVALID` (log `err.code`, `err.param` only). The order stays `pending_payment` with `checkout_expires_at` = now + 35 min, so P1-14 expires it.

### 3. HTTP handler — `create-checkout/handler.ts` (session B's own tests)
`OPTIONS` → `preflight`; non-POST → `405`; CORS via `corsHeaders(origin, allowedOrigins())`; rate limit **before** parsing: bucket `checkout`, 10 requests per minute per IP hash → `429 RATE_LIMITED` + `retry-after` (seconds to the next minute); invalid JSON → `400 VALIDATION`; `ctx.now = new Date()`. Logs: order id and error codes only, never the body (UKC-DP-02, -04).

### 4. Migration `p1_11_checkout`
- `rate_limits (key text, window_start timestamptz, count int not null default 1, primary key (key, window_start))` (architecture §7 names: `key` = bucket + hashed IP, e.g. `checkout:<hex sha-256>`), RLS enabled, no policies, all privileges revoked from `anon, authenticated`.
- `rate_limit_hit(p_key text, p_window_start timestamptz, p_limit int) returns boolean`: upsert `count + 1`, return `count <= p_limit`. `set search_path = ''`; `EXECUTE` only for `service_role`.
- `cron.schedule('ppos-rate-limits-cleanup', '17 * * * *', $$delete from public.rate_limits where window_start < now() - interval '24 hours'$$)` (UKC-DP-07 suggestion).
- `create_pending_order(p_order jsonb, p_items jsonb) returns table (id uuid, number int, public_token uuid, checkout_attempt int)`: one transaction: `next_order_number`, insert `orders` (`pending_payment`/`unpaid`, `checkout_attempt 1`) and `order_items` (incl. `vat_category_snapshot`, NOT NULL since P1-05, decision A6). SECURITY INVOKER, `set search_path = ''`, `EXECUTE` only for `service_role`.
- IP hash (in `_shared/rate-limit.ts`): key = `checkout:` + hex SHA-256 of `ppos-rl-v1:` + client IP; no IP → `unknown`.
- IP source **[H], verify before writing `rate-limit.ts`**: read the Supabase Edge Runtime docs (web reader) for which header carries the client IP and whether the gateway overwrites or appends to a client-sent `X-Forwarded-For`. Use only the value the gateway itself sets (if it appends: the right-most entry); never a client-supplied left-most value, or rotating spoofed values bypass the limit and multiply Stripe and postcodes.io calls (P1-19 area 8). Record URL + finding in PROGRESS.md; if it cannot be verified, stop and escalate. Handler test: two requests whose client-supplied left-most `X-Forwarded-For` values differ, with the same gateway-set value, land in one bucket.

## Acceptance

Session A:
1. `git diff --name-only main...HEAD` → only `docs/takeaway/acceptance-proposals/P1-11/*` and `docs/takeaway/PROGRESS.md`
2. `node scripts/guards/run-all.mjs` → exit 0; `pnpm acceptance:try P1-11` → fails only with "Module not found" for `params.ts` / `pipeline.ts`
3. CASES.md has one row per case below; every expected value is a literal (pence integers, unix seconds, exact strings)
4. Guard traps in the installed copies (session B cannot fix them): `grep -nE "[\"'](jsr|npm):" docs/takeaway/acceptance-proposals/P1-11/*.ts | grep -vE "(jsr|npm):@?[^@\"'/]+(/[^@\"'/]+)?@[0-9]+\.[0-9]+\.[0-9]+"` → no output (no unpinned specifier); `grep -n payment_method_types docs/takeaway/acceptance-proposals/P1-11/*` → no output; `grep -nE 'stripe(Account|Context)\s*:' docs/takeaway/acceptance-proposals/P1-11/fakes.ts` → no output

Required cases (fixture: shop `demo-chippy`, DAILY 17:00–23:00 both fulfilments, prep 20, fee 45; items `Cod & chips` 900, `Meal` 2000 (contains milk) with group `Dip` min 0 max 1: `Sesame dip` 50 (contains sesame), `Garlic dip` 30; `Pie` sold out until `2026-11-03T04:00:00+00:00`; every item `vatCategory 'hot_standard'` (→ `vatCategorySnapshot`); zones district `M14` fee 250 min 1200 prio 1, radius 3000 m fee 350 min 1500 prio 2; shop at 53.4500, −2.2300; `now = 2026-11-02T18:07:00Z`):
- **B01–B09 (params):** exact sorted `Object.keys(params)` and `Object.keys(params.payment_intent_data)` lists (this proves there is no `customer`, `discounts` or removed param; stripe-endive §6). Never write the token `payment_method_types` in any proposal file (guard `stripe-payment-method-types` scans the installed tests), and write `stripeAccount` literals only inside `*.test.ts` files, never in `fakes.ts` (guard `stripe-account-option`); `ui_mode === 'hosted_page'`; B02 worked example line by line; collection + tip 0 → lines = items + `Service fee` only; fee 50 → `Service fee` line 50 and `application_fee_amount` 50 (UKC-PRICE-07); `expires_at` 1793644920; URLs with storefront `https://shop.example.test`; `options` deep-equal `{ stripeAccount: 'acct_test1', idempotencyKey: 'checkout-<id>-1' }` and `-2` for attempt 2; throws on a line-total mismatch and on a sum ≠ total.
- **P01–P23 (pipeline):** happy collection ASAP (exact `NewPendingOrder`, one Stripe call, `saveCheckoutSession(id, 'cs_test_1', <expires>)`, returns `{ url, token }`); delivery `m14 5aa` → zone fee 250, postcode stored `M14 5AA`; radius match from lookup coordinates → fee 350; lookup `'unavailable'` still matches `M14`; `'not_found'` → OUT_OF_ZONE; invalid postcode → 400; unknown key (`dob`, `unitPricePence`) → 400 (UKC-DP-01, price tampering); unknown/draft shop → 404; each payments-not-ready variant → 503; paused, fulfilment disabled → SHOP_CLOSED; `now 10:00Z` ASAP → SHOP_CLOSED; `now 22:41Z` ASAP → SLOT_UNAVAILABLE; slot `2026-11-02T19:00:00+00:00` ok, `19:05` → SLOT_UNAVAILABLE; foreign/unpublished/archived/sold-out item, unavailable or foreign option, `Dip` with 2 options → ITEM_UNAVAILABLE with ids; 1 × Cod & chips delivery → BELOW_MINIMUM `shortfallPence` 300; wrong `expectedTotalPence` → PRICE_CHANGED; for every 4xx/503 above: no order created, no Stripe call; each Stripe error class → its status/code with the order created but no session saved; `url: null` → `502 STRIPE_NO_URL`; Meal + Sesame dip → `allergensSnapshot { contains: ['milk', 'sesame'], mayContain: [] }` (UKC-ALG-05); tip 100 → `tipPence` 100, application fee still 45.

Session B:
1. `pnpm acceptance:install P1-11` → 3 files installed; first run fails on missing modules (paste the line into PROGRESS.md)
2. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts') && deno test --allow-env --allow-net --allow-read` → all green incl. golden; handler tests: preflight, 405, invalid JSON, 11th request in a minute → 429 with `retry-after`, a different spoofed left-most `X-Forwarded-For` with the same gateway-set IP → same bucket, foreign origin gets no `access-control-allow-origin`
3. `supabase db reset && supabase test db` → green incl. `rate_limit_hit` (10 true then false; per key), `create_pending_order` (numbers 1, 2; anon/authenticated execute → `42501`; total CHECK holds)
4. `pnpm --filter @ppos/core test && pnpm --filter @ppos/storefront test` → green (schema requires `expectedTotalPence`; PRICE_CHANGED message shown)
5. Sandbox smoke (the human keeps the sandbox key in the root `.env.local` and starts `supabase functions serve --env-file .env.local`; decision A2). **Agent:** create an order with `curl` against the local function, paste order id + session id (never the URL) into PROGRESS.md; this confirms Stripe accepts the 35-minute `expires_at` (stripe-endive former open question 1). **Human** (you cannot see a browser): opens the URL, confirms the `Service fee` line and that the total equals the pay button, pays with 4242, confirms the order stays `pending_payment` until P1-12 exists; write this request into the PR description
6. `git diff --exit-code main...HEAD -- docs/takeaway/acceptance` → exit 0 (three dots: only this branch's changes) (golden sources untouched); `node scripts/guards/run-all.mjs` → exit 0 (acceptance-integrity: installed copies byte-identical); `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths of the current session changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups, every Stripe/Supabase fact verified, with its URL)
- [ ] PR opened with the template (session A: then stop)

## Stop and escalate if

- `deno check` rejects a parameter shown in stripe-endive §6, or Stripe rejects `expires_at` = now + 35 min, or a line with `unit_amount: 0` (free item) is rejected: report the exact error; never change the TTL or drop a line.
- You need `stripeAccount:` outside `onAccount()`, a `customer`, `payment_method_types`, or a float.
- Session A: a test genuinely needs a banned token (`payment_method_types`, `stripeAccount:` outside a `*.test.ts` file): stop; the human must add an `allowlist.json` entry before the freeze.
- The client-IP header cannot be verified from the Supabase docs (see Spec §4).
- A frozen test contradicts this card or stripe-endive.md (session B), or the same failure survives 3 attempts.

## Hints (verified facts / pitfalls)

- Guards that fire on stale patterns: `stripe-payment-method-types`, `stripe-ui-mode-legacy`, `stripe-no-new`, `stripe-unpinned-import`, `money-float`, `secret-literal` (use `sk_test_fake`, never a realistic key).
- Stripe amounts are pence already: `unit_amount: 45` = £0.45. Never multiply or divide by 100.
- Same idempotency key + different params → `StripeIdempotencyError`; a retry of the same order must reuse attempt N.
- Constructing Stripe error instances in tests: read the constructor signature in the SDK's `esm/Error.d.ts` (stripe-endive §1 says where the cache lives); do not guess.
- Postcode lookup: `GET https://api.postcodes.io/postcodes/<encodeURIComponent(normalised)>`, fixed host, 3 s timeout (`AbortSignal.timeout`), non-200/404 or timeout → `'unavailable'`. Only the normalised postcode ever reaches the URL (no SSRF).
- [H] Which header carries the client IP in the Supabase Edge Runtime, and whether the gateway appends to a client-sent `X-Forwarded-For`: Spec §4 says how to verify it.

## Open questions for the planner

- Resolved (decision A10): `expectedTotalPence` + `409 PRICE_CHANGED`; the `Tip` line is included; `expires_at` = now + 35 min.
- Still open: the IP hash is unpeppered SHA-256 (rows deleted after 24 h). A secret pepper would need a new env var (architecture §3 change).
