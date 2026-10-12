# Takeaway Platform — Architecture Spec (agent-facing, canonical)

> Audience: the executing coding agent (GLM-5.3) and any human reviewer.
> Status: **FROZEN** unless a section says otherwise. Changing a frozen decision requires a human-approved ADR in `docs/takeaway/adr/`.
> Chinese rationale for humans lives in `docs/takeaway/02-tech-roadmap.md`. If the two ever disagree, **this file wins** and the disagreement must be reported in `PROGRESS.md`.

## 0. Product in one paragraph

A multi-tenant online-ordering platform for independent UK takeaways. Each shop gets a storefront (customers order collection or delivery and pay by card), and a merchant back office (menu, hours, zones, live orders, refunds, reports). Payments use **Stripe Connect direct charges** on the shop's own Stripe account; the platform takes a fixed **application fee** (default **45p**) per order, shown to the customer as a **service fee**. The shop pays Stripe's processing fee. Later phases add SaaS billing (£149 setup + £39/month), Star CloudPRNT printing, QR campaigns printed on Pocket Packet packaging, cross-shop loyalty and a city-level aggregator app.

## 1. Repository layout (FROZEN)

```
/                         existing legacy CRM lives here (index.html, *.sql) — DO NOT TOUCH unless a task says so
├── AGENTS.md             agent operating rules (canonical)
├── CLAUDE.md             imports AGENTS.md + Claude Code specifics
├── package.json          pnpm workspace root (scripts: see §13a)
├── pnpm-workspace.yaml   packages: apps/*, packages/*
├── .npmrc                save-exact=true
├── apps/
│   ├── storefront/       customer ordering site (Vite + React + TS + Tailwind v4)
│   └── merchant/         merchant back office + order tablet PWA (same stack); also hosts /platform-admin routes
├── packages/
│   ├── core/             pure TypeScript domain logic, NO I/O: money, pricing, order state machine, hours/slots, zones, allergens, validation schemas
│   │   ├── src/
│   │   └── tests/{unit,acceptance}/
│   └── ui/               `@ppos/ui`: shared presentational React components + design tokens only (no data fetching, no business rules)
├── supabase/
│   ├── config.toml
│   ├── migrations/       append-only, timestamped (Supabase CLI format)
│   ├── seed.sql          dev seed only (fake data)
│   ├── tests/            pgTAP tests (rls/, acceptance/)
│   └── functions/
│       ├── _shared/      stripe client, supabase clients, auth, http helpers, core bridge
│       └── <function>/index.ts (+ *.test.ts)
├── e2e/                  Playwright tests (DOM/ARIA assertions; no screenshots required)
├── scripts/
│   ├── guards/           CI + local guard scripts (PROTECTED)
│   └── acceptance/       acceptance install / try-proposal / freeze scripts (PROTECTED)
└── docs/takeaway/        plans, handbook, references, task cards, acceptance tests, ADRs, PROGRESS.md
```

The legacy CRM (`index.html`, `supabase_schema.sql`, `migration_*.sql`, `import_*.sql`, `3d-packaging.html`) is a separate product with a separate Supabase project. The platform never reads or writes the CRM database directly (see §12).

## 2. Stack (FROZEN; exact versions are pinned in `reference/versions.md` by task P0-01)

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true` | everywhere, including edge functions |
| Package manager | pnpm workspaces, exact versions (`save-exact=true`) | new dependencies must be in `reference/approved-deps.json` |
| Runtime (tooling) | Node.js 24 LTS (fallback 22 LTS) | `.nvmrc` |
| Frontend | Vite + React + React Router (declarative `BrowserRouter`/`Routes`) + Tailwind CSS v4 (`@tailwindcss/vite`, `@import "tailwindcss";`, no `tailwind.config.js`) + TanStack Query | two SPAs |
| Validation | zod (shared request/response schemas in `packages/core`) | |
| Dates/times | luxon, zone `Europe/London` | never `new Date()` arithmetic for business times |
| Backend | Supabase: Postgres + Auth + Storage + Realtime + Edge Functions (Deno) + pg_cron/pg_net | region London (eu-west-2) |
| Payments | Stripe, API version **`2026-09-30.endive`**, `npm:stripe@23.0.0` in edge functions only | see `reference/stripe-endive.md` — mandatory reading for any Stripe task |
| SMS / voice | Twilio REST via `fetch` (no SDK) | |
| Email | Resend REST via `fetch` (no SDK) | |
| Postcodes | postcodes.io REST via `fetch` (no key) | |
| Hosting | Vercel (two projects: storefront, merchant) with preview deployments per branch | humans review UI on previews |
| Tests | Vitest (+ Testing Library, jsdom), pgTAP via `supabase test db`, `deno test`, Playwright | |
| CI | GitHub Actions `.github/workflows/takeaway-ci.yml` | PROTECTED |

Not allowed without an ADR: Next.js/Remix/Astro, Redux/MobX, CSS-in-JS, ORMs (Prisma/Drizzle), GraphQL, any Stripe SDK in the browser for the MVP (hosted Checkout needs none), floating-point money.

## 3. Environments (FROZEN)

| Env | Supabase project | Stripe | Who can touch it |
|---|---|---|---|
| local | `supabase start` (Docker) | Stripe **sandbox** keys | agent |
| dev | `takeaway-dev` (London) | Stripe sandbox | agent may `supabase db push` / `functions deploy` here |
| prod | `takeaway-prod` (London) | Stripe **live** | **human or CI only**. The agent never receives prod keys, never links prod, never runs prod commands. |

Secrets live in Supabase function secrets / Vercel env / one git-ignored root `.env.local` (both Vite apps read it via `envDir: '../..'`; local functions via `supabase functions serve --env-file .env.local` — P0-03 verifies the flag). Never commit secrets. Never paste real customer data into prompts — use `supabase/seed.sql` fake data.

Isolation rules (FROZEN):
- `takeaway-prod` lives in a **separate Supabase organization**. The Supabase CLI on the agent machine is logged in with an account that is **not a member** of the prod organization (a CLI token can act on every project its account can see; the pre-bash hook blocks `--project-ref`/`--db-url`/`link`/`login`, but hooks are heuristic and only exist in Claude Code, so account separation is the real barrier).
- Vercel **production auto-deploy from `main` is disabled**. Release order is: database migrations → edge functions → frontend promotion, done by the human or a human-approved CI workflow (P1-20). Preview deployments use the **dev** backend; a Stripe test payment made on a preview returns to the dev storefront URL (`APP_STOREFRONT_URL`), which is acceptable.
- `docs/takeaway/reference/environments.md` records DEV identifiers only; PROD identifiers are not written in the repo.

### Env var names (FROZEN)

Edge functions: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET_CONNECT`, `STRIPE_WEBHOOK_SECRET_PLATFORM`, `APP_STOREFRONT_URL`, `APP_MERCHANT_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. Supabase-injected variables (URL, keys) are read through `_shared/env.ts` only and exposed as camelCase getters (`env.supabaseUrl`, `env.supabasePublicKey`, `env.supabaseServiceKey`) so code never depends on legacy vs new injected names; the frozen secrets above are exposed with their UPPER names (`env.STRIPE_SECRET_KEY`). P0-03 records the exact injected names for the current Supabase runtime in `reference/versions.md`.

Frontend (Vite): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_FUNCTIONS_URL`. The browser never sees a secret/service-role key.

## 4. Money (FROZEN)

- All amounts are **integer pence** (`number` in TS, `integer` in SQL; `bigint` for aggregates). Field and column names end in `_pence` / `Pence`.
- No floats for money anywhere. Percentages are **basis points** (1% = 100 bps).
- Rounding: percentage discounts use `Math.floor(subtotal * bps / 10000)`.
- Display only via `formatPence(pence)` from `packages/core` (`£18.45`, `45p` style is NOT used — always `£0.45`).
- Currency: GBP only.

## 5. Pricing rules (FROZEN — implemented once in `packages/core/src/pricing.ts`, used by storefront display AND by `create-checkout`)

`priceOrder(input: PricingInput): PricingResult` (exact types in the P1-01 golden tests):

1. `lineTotal = (unitPricePence + Σ(option.pricePence × option.quantity)) × quantity`; option quantity defaults to 1.
2. `itemsSubtotalPence = Σ lineTotal`.
3. Discount applies to items only: `percent` → `floor(itemsSubtotal × bps / 10000)`; `fixed` → `min(amount, itemsSubtotal)`; `free_delivery` → equals the delivery fee (delivery fee line itself is still reported). Only one discount per order.
4. Delivery fee is `0` for collection. For delivery it comes from the resolved zone; if the zone's `freeDeliveryThresholdPence` is set and `itemsSubtotal ≥ threshold`, the fee is `0`.
5. Service fee (`serviceFeePence`, default 45) applies to **every** order, collection and delivery, and is **never discounted**.
6. Tip is optional, integer ≥ 0, default 0, goes 100% to the shop.
7. `totalPence = itemsSubtotal − discount + deliveryFee + serviceFee + tip`.
8. `applicationFeePence = serviceFeePence` (the platform takes exactly the service fee, nothing from food, delivery or tips).
9. Minimum order compares **itemsSubtotal before discount** against the zone/shop minimum; result reports `meetsMinimumOrder` and `shortfallPence`.
10. Invalid input (non-integer, negative, quantity < 1 or > 99, empty basket, service fee < 0) throws `PricingError` with a `code`.

The server always re-prices from database prices; the client total is display only.

## 6. Order lifecycle (FROZEN — `packages/core/src/orderState.ts`)

`status` (fulfilment) and `payment_status` are separate fields.

```
pending_payment ──paid──▶ placed ──accept──▶ accepted ──ready──▶ ready_for_collection ──complete──▶ completed   (collection)
       │                    │                    │      ──dispatch──▶ out_for_delivery ──complete──▶ completed   (delivery)
       ├──expire──▶ expired │                    │
       └──cancel──▶ cancelled◀──cancel───────────┘ (accepted → cancelled allowed)
                            └──reject──▶ rejected
```

- Terminal: `completed`, `rejected`, `cancelled`, `expired`.
- `ready` only for collection orders, `dispatch` only for delivery orders.
- Leaving `placed`/`accepted` via `reject`/`cancel` when `payment_status` is `paid` or `partially_refunded` returns `requiresRefund: true` (refund the remaining amount; the application fee is refunded because the charge ends fully refunded — see §9).
- `payment_status`: `unpaid → paid → partially_refunded → refunded`; `dispute_status` is a separate nullable text column.
- Every transition is validated by `transition(order, event)` in core; the database stores the result; illegal transitions are rejected with an error, never coerced.

## 7. Database (FROZEN names; P1-05 writes the DDL)

Single Supabase project per environment, schema `public`. UUID primary keys (`gen_random_uuid()`), `timestamptz` everywhere, `created_at`/`updated_at` with trigger. Soft delete is NOT used for orders (immutable history); menu rows use `archived_at`.

| Table | Key columns (not exhaustive) |
|---|---|
| `platform_admins` | `user_id` PK → `auth.users` |
| `platform_settings` | `key` PK, `value jsonb` (e.g. `default_service_fee_pence`) |
| `shops` | `id`, `slug` unique, `name`, `status` (`draft`,`onboarding`,`live`,`paused`,`closed`), `timezone` default `Europe/London`, contact + address + `postcode`, `lat`, `lng`, `phone` (public, shown to customers), `alert_phone` (UK mobile for staff SMS/voice alerts; not public), `legal_name`, `legal_form` (`sole_trader`,`partnership`,`limited_company`,`llp`,`other`), `company_number`, `registered_office_address`, `registered_in` (`england_wales`,`scotland`,`northern_ireland`), `late_night_licence_confirmed_at` (UKC-AGE-03), `vat_number`, `fhrs_id`, `crm_customer_id text null`, `collection_enabled`, `delivery_enabled`, `prep_time_minutes`, `busy_extra_minutes`, `ordering_paused`, `auto_reject_after_minutes` default 8, `service_fee_pence` default 45. Only platform admins (or the service role) may change `status`, `service_fee_pence` and `crm_customer_id`; merchants pause via `ordering_paused`. Going `live` requires payments readiness (§9) and complete legal identity (UKC-ID rules) — enforced by the `shops_go_live_check` trigger, created in P1-05 |
| `shop_domains` (phase 2) | `hostname` unique, `shop_id`, `verified_at` |
| `shop_members` | PK (`shop_id`,`user_id`), `role` (`owner`,`manager`,`staff`) |
| `menu_categories` | `shop_id`, `name`, `description`, `sort_order`, `is_visible`, `archived_at` |
| `menu_items` | `shop_id`, `category_id`, `name`, `description`, `price_pence`, `image_path`, `is_published`, `sold_out_until`, `sort_order`, `dietary_tags text[]`, `vat_category` (`hot_standard`,`cold_zero`,`always_standard`), `allergens jsonb`, `archived_at` |
| `modifier_groups` | `shop_id`, `item_id`, `name`, `min_select`, `max_select`, `sort_order` |
| `modifier_options` | `shop_id`, `group_id`, `name`, `price_pence`, `allergens jsonb`, `is_available`, `sort_order` |
| `opening_hours` | `shop_id`, `fulfilment` (`collection`,`delivery`), `weekday` 1–7 (ISO, Mon=1), `opens_at time`, `closes_at time` (if `closes_at <= opens_at` the session ends the next day) |
| `closures` | `shop_id`, `starts_at`, `ends_at`, `reason` |
| `delivery_zones` | `shop_id`, `kind` (`postcode_districts`,`radius`), `postcode_districts text[]`, `radius_m`, `fee_pence`, `minimum_order_pence`, `free_delivery_threshold_pence null`, `priority` |
| `orders` | `shop_id`, `number int` (per-shop sequence), `public_token uuid` unique, `status`, `payment_status`, `dispute_status`, `fulfilment`, `requested_time null`(null = ASAP), `promised_time`, customer name/phone/email, `delivery_address jsonb`, `delivery_postcode`, `notes`, `allergy_note`, all pricing `_pence` fields from §5, `refunded_pence`, `stripe_account_id`, `checkout_session_id` unique, `payment_intent_id` unique, `application_fee_id`, `checkout_attempt int`, `checkout_expires_at`, timestamps `placed_at`,`accepted_at`,`rejected_at`,`completed_at`,`cancelled_at`, `reject_reason` |
| `order_items` | `order_id`, `shop_id`, `item_id`, `name_snapshot`, `unit_price_pence`, `quantity`, `line_total_pence`, `vat_category_snapshot`, `allergens_snapshot jsonb`, `modifiers jsonb` (snapshot) |
| `order_events` | outbox: `id bigserial`, `order_id`, `shop_id`, `type`, `payload jsonb`, `dedupe_key` unique, `created_at`, `next_attempt_at`, `processed_at`, `attempts`, `last_error` |
| `shop_counters` | `shop_id` PK, `last_order_number` (row-locked by `next_order_number(shop_id)`) |
| `rate_limits` | `key` (hashed IP + function), `window_start`, `count` (P1-11) |
| `stripe_accounts` | `shop_id` PK, `stripe_account_id` unique, `charges_enabled`, `payouts_enabled`, `details_submitted`, `card_payments_status`, `requirements_currently_due jsonb`, `disabled_reason`, `deauthorized_at`, `updated_from_event_id` |
| `stripe_events` | `event_id` PK, `type`, `account`, `livemode`, `api_version`, `received_at`, `processed_at`, `error` |
| `platform_fee_ledger` | `application_fee_id` unique, `order_id`, `shop_id`, `amount_pence`, `refunded_pence` |
| `refunds` | `stripe_refund_id` unique, `order_id`, `shop_id`, `amount_pence`, `refund_application_fee`, `reason`, `initiated_by` (`merchant_app`,`stripe_dashboard`,`auto_reject`,`platform`), `created_by` |
| `notifications_log` | `order_id`, `shop_id`, `channel` (`sms`,`voice`,`email`), `recipient`, `template`, `status`, `provider_id`; unique (`order_id`,`channel`,`template`) |
| `audit_log` | `shop_id`, `actor_user_id`, `action`, `entity`, `entity_id`, `before jsonb`, `after jsonb` — written for price changes, allergen changes, refunds and shop settings changes |
| `print_jobs` (P2) | `shop_id`, `order_id`, `printer_id`, `format`, `payload`, `status`, `claimed_at`, `printed_at` |

### Allergens (FROZEN)

14 keys: `celery, cereals_gluten, crustaceans, eggs, fish, lupin, milk, molluscs, mustard, tree_nuts, peanuts, sesame, soya, sulphites`. Value per key: `contains` | `may_contain` | `free`. An item (and every option of its modifier groups) cannot be published unless **all 14 keys are explicitly set**. Allergens are shown before purchase (item sheet + checkout review), snapshotted onto `order_items`, printed on the kitchen ticket and included in the confirmation email. The publish gate is enforced in the database in both directions: an item cannot become published with incomplete allergens on itself or any option, and an option with incomplete allergens cannot be added to (or edited inside) a group of a published item. Staff (not only managers) may mark items sold out through the `set_item_sold_out` RPC; all other menu writes need `manager` or above.

### Row Level Security (FROZEN principles)

- RLS **enabled on every table**, no exceptions. Default deny.
- `anon` may only `SELECT` menu/hours/zones/shop-public columns of shops with `status = 'live'` and items with `is_published`. `anon` can never read or write `orders`, `order_items`, `refunds`, ledgers, events, `notifications_log`, `audit_log` or `stripe_*`.
- Authenticated merchants access rows where `is_shop_member(shop_id, <min_role>)` (a `SECURITY DEFINER` SQL function with `set search_path = ''`).
- Customers read order status only through the `order-status` edge function with the unguessable `public_token`.
- Webhooks, cron and checkout write with the service-role client inside edge functions only.
- `order_events`, `notifications_log` and `platform_fee_ledger` are readable by platform admins only.
- Status columns we own use `text` + `CHECK`. Values that come from Stripe (`card_payments_status`, `dispute_status`, controller fields, `disabled_reason`) are plain `text` **without** CHECK constraints, because Stripe can add values at any time.
- Every policy has a pgTAP test proving both allow and deny.

## 8. Edge functions (FROZEN names)

| Function | Auth | Purpose |
|---|---|---|
| `create-checkout` | public (`verify_jwt = false`), zod-validated, rate-limited | re-price basket from DB, check shop open/slot/zone/minimum, compare with the client's `expectedTotalPence` (mismatch → `409 PRICE_CHANGED`, so the Stripe total always equals the pay button), insert `pending_payment` order, create Stripe Checkout Session (direct charge), return `{ url, token }` |
| `order-status` | public, `public_token` | return safe status fields |
| `connect-onboarding` | merchant JWT, role `owner` | create Stripe account if missing, return Account Link URL |
| `stripe-webhook-connect` | Stripe signature (`verify_jwt = false`) | connected-account events |
| `stripe-webhook-platform` | Stripe signature (`verify_jwt = false`) | platform-account events (application fees, later SaaS billing) |
| `merchant-order-action` | merchant JWT, role ≥ `staff` | accept (with ETA) / reject / ready / dispatch / complete via core `transition` |
| `refund-order` | merchant JWT, role ≥ `manager` | full/partial refunds |
| `cron-tick` | header `x-cron-secret` | every minute (pg_cron + pg_net): process outbox, SMS/voice escalation, auto-reject + refund, expire stale `pending_payment` |
| `platform-invite` | user JWT: platform admin (create shop + invite owner) or shop owner (invite staff) | wraps `auth.admin.inviteUserByEmail` and inserts `shop_members` |

Generated database types live in `packages/core/src/db/database.types.ts` (types only; regenerated with `supabase gen types typescript --local` after every migration task).

Rules: merchant functions verify the caller with the user's JWT (`auth.getUser`) and check membership in SQL; never trust a `shop_id` from the body without that check. Side effects (SMS, email, print) only happen in the outbox processor, never inline in a webhook. Every handler is idempotent.

System-initiated full refunds (late payment, merchant reject/cancel, auto-reject) all use `supabase/functions/_shared/refunds.ts` (created by P1-12): write a durable outbox row `order.refund_due` and make one immediate inline attempt; `cron-tick` (P1-14) retries failures. Merchant-initiated refunds go through `refund-order` (P1-15) and the same helper.

## 9. Stripe integration (FROZEN — details and verified snippets in `reference/stripe-endive.md`)

- Connected accounts: **Accounts v1 with controller properties** (Standard-equivalent: `fees.payer='account'`, `losses.payments='stripe'`, `requirement_collection='stripe'`, `stripe_dashboard.type='full'`). Never `type: 'standard'`. Not Accounts v2 (revisit by ADR in phase 3).
- Onboarding: Account Links (`account_onboarding`), refresh handled by an authenticated merchant route (never a public link minter). Ordering allowed only when `charges_enabled` and `card_payments` capability is `active`.
- Payments: **hosted Checkout** (`ui_mode: 'hosted_page'`), direct charge via request option `{ stripeAccount }` — produced only by the `onAccount()` helper in `supabase/functions/_shared/stripe.ts` (guarded), `payment_intent_data.application_fee_amount = order.application_fee_pence`, `expires_at` = now + **35 min** (Stripe's minimum is 30; the margin absorbs clock skew), idempotency key `checkout-<order_id>-<attempt>`. Line items: one per order item, `Delivery` when > 0, `Service fee`, and `Tip` when > 0, so the Stripe total equals `orders.total_pence`. No `payment_method_types` (removed in endive).
- Payment methods: cards + Apple Pay / Google Pay / Link only. Delayed methods (bank debits, transfers) are switched off in the Dashboard's Connect payment-method settings (P0-00 / P1-20), because hot food cannot wait for settlement. If `checkout.session.async_payment_failed` ever arrives, it maps to core `cancel` with reason `async_payment_failed`.
- Webhooks: two endpoints (connect / platform), two secrets, raw body + `constructEventAsync`, dedupe on `stripe_events.event_id`, fulfil only when `payment_status === 'paid'`.
- Refund policy (FROZEN): the 45p is returned exactly when the **charge ends up fully refunded**, by whatever route — a single full refund (`refund_application_fee: true`), several partial refunds that add up to the total, or refunds made in the merchant's own Stripe Dashboard (which never return the application fee by themselves). In the last two cases the `charge.refunded` handler refunds the remaining application fee via `applicationFees.createRefund` (idempotency key `appfee-refund-<order_id>`). A partial refund that leaves money on the charge uses `refund_application_fee: false`. Disputes: flag order + notify merchant; the platform keeps the fee (policy may change by ADR).
- Merchant refund idempotency: the client sends `expectedRefundCount` (refunds it has seen); the server uses key `refund-<order_id>-<expectedRefundCount + 1>` and answers `409 REFUND_STATE_CHANGED` if the count is stale.

## 10. Order notifications (FROZEN for phase 1)

1. New paid order → Supabase Realtime pushes to the merchant tablet (authenticated channel, RLS) → full-screen alarm that repeats until acknowledged; Screen Wake Lock while the orders screen is open. The board also refetches every 30 s and on `visibilitychange` / reconnect, so a silently dropped Realtime connection cannot hide an order.
2. Not acknowledged on the tablet within 60 s → one SMS to `shops.alert_phone` (SMS is the main per-order cost, so it is only sent when the tablet did not react).
3. Not accepted after 2 minutes → one automated voice call to `shops.alert_phone` (Twilio TTS).
4. Not accepted after `auto_reject_after_minutes` (default 8) → auto-reject + full refund + customer notified.
5. Customer notifications: **email** for placed (receipt with allergens), accepted (with ETA), rejected/cancelled (with refund info) and ready/out for delivery; **one SMS** (if a phone was given) only for accepted-with-ETA and for rejected/cancelled.
6. The customer status page polls `order-status` every 5 s until accepted, then every 30 s; it pauses while the tab is hidden and stops at a terminal state or after 3 hours.
7. Printing in P1 = browser print of a ticket view. Star CloudPRNT (pull endpoint backed by `print_jobs`, poll interval ≥ 10 s; see roadmap cost note) is **P2**.

## 11. UK compliance hooks in the product (launch-blocking; details in `reference/uk-compliance.md`)

- Service fee shown **up front** (exact en-GB strings, amount from `shops.service_fee_pence` via `formatPence`): persistent menu notice `A £0.45 service fee applies to every order.`; sticky basket bar from the first item `£X.XX incl. £0.45 service fee`; itemised breakdown at checkout (Items / Delivery / Service fee / Tip / Total). For delivery before a postcode has resolved, the bar shows items + service fee and the text `+ delivery from £Y.YY` (cheapest zone fee); checkout requires a resolved zone. Call it "service fee" — never "card fee", "card charge", "surcharge", "processing fee", "payment fee", "service charge" or "tax"; never claim "no fees" / "no hidden fees", "no refunds" or "non-refundable" (P1-17 tests this).
- Final button text: "Place order and pay £X.XX". Checkout states: `Once the shop accepts your order it can't be cancelled, because food is prepared fresh. If something is wrong with your order, contact the shop.` (lawyer may change the wording). Tip defaults to £0.
- Merchant identity in the storefront footer + legal page: legal name, geographic address, email, company number (if any), VAT number (if registered); for limited companies/LLPs also registered office address and part of the UK where registered.
- Allergens per §7. Customer allergy note field + "call the shop" link.
- No alcohol or other age-restricted items in phase 1 (feature not built; menu validation rejects `age_restricted`).
- No non-essential cookies or third-party trackers in phase 1.

## 12. Legacy CRM boundary (FROZEN)

- The CRM (`index.html`) uses its own Supabase project, which currently has **open anon RLS** (anyone can read/write). Until the CRM lockdown track (P0-B*) is done, the platform must not store any credentials for the CRM project and must not sync into it.
- Link between systems: `shops.crm_customer_id` (text, the CRM `customers.id`, e.g. `C-001`). Phase 2+ sync is a one-way server-side job (platform → CRM summary table) designed after the lockdown.
- Editing `index.html` is blocked by a hook unless the human starts the session with `PPOS_ALLOW_LEGACY=1`. Even then: ranged reads only (≤ 400 lines), surgical `Edit`s only, never a whole-file write (the file is ~220K tokens, larger than the model's 128K output cap).

## 13. Testing & verification contract (FROZEN)

- `pnpm verify:quick` — guards + typecheck + unit tests. Must pass before every commit.
- `pnpm verify` — `verify:quick` + lint + all acceptance tests + `deno check`/`deno test` for functions + `supabase test db` (requires local stack; prints `SKIPPED (no local supabase)` otherwise — CI always runs it).
- Acceptance tests are **golden**: source of truth in `docs/takeaway/acceptance/<TASK>/`, installed into packages by `pnpm acceptance:install <TASK>`, byte-identical (checked by `scripts/guards/acceptance-integrity.mjs`). Agents never edit them.
- A task is done only when CI is green on its branch. An agent's own statement "tests pass" is not evidence; pasted command output is.

## 13a. Workspace scripts contract (FROZEN; implemented by P0-01, used by AGENTS.md and the hooks)

| Script (root `package.json`) | Must do |
|---|---|
| `guards` | `node scripts/guards/run-all.mjs` |
| `typecheck` | `tsc -b` (or `tsc --noEmit -p` per package) across all workspace packages |
| `lint` | ESLint flat config over `apps/`, `packages/`, `e2e/` |
| `test` | Vitest across workspace packages (includes `tests/acceptance/**` once installed) |
| `verify:quick` | `guards` → `typecheck` → `test` (fail fast) |
| `verify` | `verify:quick` → `lint` → `deno check` + `deno test` for `supabase/functions` (if any) → `supabase test db` (or print `SKIPPED (no local supabase)` when the local stack is not running) |
| `acceptance:install` | `node scripts/acceptance/install.mjs` (task id passed as argument) |
| `acceptance:try` | `node scripts/acceptance/try-proposal.mjs` (tests-first session A: dry-run a proposal; copies are removed afterwards) |
| `test:acceptance` | Vitest restricted to `**/tests/acceptance/**` |
| `e2e` | `playwright test -c e2e/playwright.config.ts` (added by P0-04) |

Root `package.json` must declare `"packageManager": "pnpm@<exact version>"` (CI's `pnpm/action-setup` reads it) and commit `pnpm-lock.yaml` (CI installs with `--frozen-lockfile`). CI (`.github/workflows/takeaway-ci.yml`, protected) calls exactly: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm e2e`, `cd supabase/functions && deno check … && deno test --allow-env --allow-net --allow-read`, `supabase start`, `supabase test db`, `supabase db lint --level error`.

`packages/core` is the workspace package `@ppos/core`. It must expose its public API from `packages/core/src/index.ts`; acceptance tests import from `../../src/index` (relative), so no path alias is required. Workspace package names use the `@ppos/` scope (`@ppos/core`, `@ppos/storefront`, `@ppos/merchant`).

## 14. Naming conventions

- TS: camelCase values, PascalCase types/components, files `kebab-case.ts` (components `PascalCase.tsx`). Exception: `packages/core/src` module files named in this spec keep their camelCase names (`orderState.ts`).
- SQL: snake_case, plural table names, enum types `<name>_enum` is NOT used — use `text` + `CHECK` constraints for status fields we own (easier migrations); Stripe-sourced values are plain `text` (§7).
- Migrations: `supabase/migrations/<UTC timestamp>_<snake_description>.sql`, created with `supabase migration new`. Never edit an existing migration — add a new one.
- Branches: `task/<TASK-ID>-<slug>`; commits: Conventional Commits in English (`feat(core): add pricing engine [P1-01]`).
- Customer-facing copy: en-GB only, in `apps/storefront/src/i18n/en-GB.ts`. Merchant UI: `en-GB` + `zh-CN` dictionaries (many owners read Chinese). No CJK characters anywhere else in storefront/core/functions code (checked by `scripts/guards/cjk-lint.mjs`).

## 15. Phase map (what exists when)

| Phase | Adds |
|---|---|
| P0 Foundation | monorepo, CI, Supabase local, core↔Deno bridge, app shells; CRM lockdown track B |
| P1 Pilot MVP | everything in §4–§11 for one live shop (multi-tenant data model from day 1). Gate: CRM lockdown P0-B2…B4 merged before the pilot goes live (P1-20) |
| P2 Sellable SaaS | self-serve onboarding, SaaS billing, custom domains, discount codes, Star CloudPRNT, customer OTP accounts, platform admin, CRM summary sync, FHRS badge |
| P3 City density | QR campaigns tied to packaging orders, scan attribution, cross-shop loyalty, marketing consent |
| P4 Aggregator | city PWA in "picker" model, then one Expo app (single binary, all cities) |

## 16. Planner decision log

| Date | Decision |
|---|---|
| 2026-10-11 | Initial spec. |
| 2026-10-11 | After the first writing round: `packages/ui` added; env-file layout and Supabase org isolation; Vercel prod auto-deploy off; `requiresRefund` also for `partially_refunded`; extra `shops` identity/alert columns; `vat_category_snapshot`; `shop_counters`, `rate_limits`, outbox `dedupe_key`/`next_attempt_at`; Stripe-sourced statuses without CHECK; publish gate both directions + `set_item_sold_out` RPC for staff; `expectedTotalPence` + `409 PRICE_CHANGED`; Tip line item; `expires_at` now + 35 min; cards/wallets only; refund-policy wording ("charge ends fully refunded"); refund idempotency via `expectedRefundCount`; `_shared/refunds.ts` owned by P1-12; SMS only as escalation + one customer SMS; status-page polling rules; Realtime refetch fallback; CloudPRNT moved to P2; exact fee-notice strings and banned-wording list; CRM lockdown is a P1 go-live gate. |
| 2026-10-12 | Review round B rulings: go-live trigger owned by P1-05; explicit DST disambiguation in core (repeated time → earlier occurrence, missing time → shift forward), never luxon's implicit default; CI e2e uses dummy `VITE_*` env + `page.route` stubs; big cards run as two sessions; `shops.late_night_licence_confirmed_at` (UKC-AGE-03, owned by P1-08). |
