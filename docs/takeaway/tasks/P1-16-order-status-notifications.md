# P1-16 — Customer order status page & notifications

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-12, P1-14 (registry, providers), P1-10 (storefront shell) |
| Mode | `standard` |
| Reasoning effort | `high` |
| Model | `glm-5.3` (never Flash: public endpoint + customer data) |
| Session budget | Two sessions on one branch `task/P1-16-order-status`, ≤ 4 h each (plan: Spec → Sessions; decision C20); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none (UK-compliance checks below are launch-blocking acceptance items) |

## Goal

After paying, the customer lands on `/o/<token>` and watches their order move from "waiting for payment confirmation" to placed, accepted (with a ready time), ready or out for delivery, and completed, or sees a clear rejection with refund information. The page reads only through the public `order-status` function, which returns safe fields for an unguessable token and nothing personal. In parallel the customer gets a confirmation email that satisfies the durable-medium and allergen duties, plus short email updates and one SMS only when the order is accepted (with its ready time) or rejected/cancelled, all sent by outbox handlers registered in the P1-14 registry, with HTML that can never be injected.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §5, §6, §7 (`orders`, `order_items`, `notifications_log`), §8 (`order-status`), §10 items 5–6, §11
- `docs/takeaway/reference/uk-compliance.md` UKC-CCR-03, -06, UKC-CRA-02, UKC-ALG-07, UKC-ID-05, UKC-NAME-01, -02, -03, UKC-VAT-03, UKC-MKT-01, UKC-DP-04, -05
- `docs/takeaway/tasks/P1-14-cron-tick-escalation.md` → registry, `notifications.claim/finish`, providers; `P1-13` → outbox types and reject reasons
- `docs/takeaway/tasks/P1-11-create-checkout.md` → `rate_limit_hit`, `_shared/rate-limit.ts`
- `supabase/functions/cron-tick/registry.ts`, `supabase/functions/_shared/providers/*`, `supabase/functions/deno.json` (P0-03 import map), `apps/storefront/src/pages/OrderStatusPlaceholderPage.tsx` (P1-10), `packages/ui/src/index.ts` (P0-04)

## Out of scope

- Customer accounts, order history, cancel/modify buttons, live maps, push or web push notifications, review requests, any marketing (UKC-MKT-01).
- Footer and legal pages (P1-17 adds the footer to this page using the `shop` fields returned here).
- Merchant notifications (P1-14), VAT receipts (UKC-VAT-03: never call anything a "VAT receipt").

## Deliverables

| Path | Action |
|---|---|
| `packages/core/src/schemas/order-status.ts`, `packages/core/src/index.ts` | create / modify: `orderStatusRequestSchema`, `OrderStatusResponse` type |
| `supabase/functions/order-status/{index,handler,handler.test}.ts`, `supabase/config.toml` (`verify_jwt = false`) | create / modify |
| `supabase/functions/_shared/notifications/{escape,templates,data,customer-handlers}.ts` (+ tests, `__snapshots__/`) | create |
| `supabase/functions/cron-tick/registry.ts` | modify: register the customer handlers |
| `supabase/functions/deno.json`, `docs/takeaway/reference/versions.md` | modify: add `"@std/testing": "jsr:@std/testing@<exact version>"` if it is not mapped yet (`jsr:@std/testing` is approved in the `deno` section of `approved-deps.json`); record the version in `versions.md` |
| `apps/storefront/src/pages/OrderStatusPage.tsx`, `src/order-status/{useOrderStatus,StatusTimeline}.ts(x)` (+ RTL tests), router, `src/i18n/en-GB.ts` | create / modify (replace the P1-10 placeholder) |

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR):
- **Session 1** (Deno): core `schemas/order-status.ts` + `index.ts` + unit test; the `order-status` function + tests + `config.toml`; `_shared/notifications/*` + tests + snapshots; registry wiring; the `deno.json` entry and `versions.md` row (Acceptance 1, 3). Gate: those items + `pnpm verify:quick` → checkpoint commit `feat(functions): order-status and customer notifications [P1-16] (session 1/2)` → `git push -u origin task/P1-16-order-status` (no PR yet) → PROGRESS.md `## Current`: `P1-16 Session 1 done (<hash>); next: Session 2, first file apps/storefront/src/order-status/useOrderStatus.ts`. Stop.
- **Session 2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): `OrderStatusPage`, `useOrderStatus` (polling rules below), `StatusTimeline`, RTL tests, router, `en-GB.ts` (Acceptance 2, then 4–5). Change Session 1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

**`order-status`** (POST JSON `{ token }`, public, CORS for the storefront origin): `token` must be a UUID → else `400 VALIDATION`; rate limit 60/min per IP hash (bucket `order-status`, reuse P1-11) → `429`; unknown token → `404 NOT_FOUND` (same body for every miss). Service client, explicit column lists. Response (`OrderStatusResponse`, keys exactly these; test asserts the key set):

| Key | Content |
|---|---|
| `number`, `status`, `paymentStatus`, `fulfilment` | order fields |
| `requestedTime`, `promisedTime`, `placedAt`, `acceptedAt` | ISO or null |
| `rejectReason` | one of P1-13 `REJECT_REASONS`, P1-13 `CANCEL_REASONS`, `'auto_timeout'` (P1-14), `'async_payment_failed'` (P1-12), or null (codes, not free text); any other stored value → `'other'` |
| `lines` | `[{ name, quantity, lineTotalPence, modifiers: [{ name, quantity }], allergens: { contains, mayContain } }]` from the snapshots |
| `totals` | `{ itemsSubtotalPence, discountPence, deliveryFeePence, serviceFeePence, tipPence, totalPence, refundedPence, cancelRefundPence }` |
| `shop` | `{ slug, name, legalName, legalForm, phone, email, addressLine1, addressLine2, city, postcode, companyNumber, vatNumber, registeredOfficeAddress, registeredIn }` (public anon-readable columns, P1-05 grants; P1-17 renders the footer from them, incl. UKC-ID-05 for limited companies and LLPs) |

`cancelRefundPence` (the amount the customer is told is coming back after a reject, cancel or late payment): `null` unless `status` is `rejected`, `cancelled` or `expired` **and** `paymentStatus` is `paid`, `partially_refunded` or `refunded`; otherwise `totalPence − Σ refunds.amount_pence` of the order's `refunds` rows (any `initiated_by`) created before `rejected_at` / `cancelled_at` (`expired` orders have no earlier refunds: `totalPence`); a result of `0` → `null`. One pure helper `cancelRefundPence(...)` exported from `_shared/notifications/data.ts`, used by `order-status` and the templates. Unpaid orders (e.g. `async_payment_failed`) never get a refund line.

Never returned (UKC-DP-05): customer name, phone, email, delivery address or postcode, notes, allergy note, Stripe ids, `public_token`, `shop_id`, internal ids, `alert_phone`, `crm_customer_id`.

**Status page** `/o/:token` (architecture §10 item 6, decision A16): calls `order-status` immediately; then polls every 5 s while `status` is `pending_payment` or `placed`, and every 30 s from `accepted` onwards; pauses while `document.visibilityState === 'hidden'` and fetches once when visible again; stops at a terminal status (`isTerminal`) or after 3 hours. Shows: shop name, "Order #12", a timeline (`Waiting for payment confirmation` → `Order received` → `Accepted — ready about HH:mm` / `Out for delivery` / `Ready to collect` → `Completed`; or `Rejected` / `Cancelled` with the reason text; or, for `expired`, "This order was not completed because payment was not received. You have not been charged." when `paymentStatus` is `unpaid`, else "This order was not completed because your payment arrived too late."), the refund line "A refund of £X.XX is on its way to your card." (X = `formatPence(cancelRefundPence)`) only when `cancelRefundPence` is not null, the lines with options and allergens (UKC-ALG-07), totals with a `Service fee` row (from the response, via `formatPence`), and "Something wrong or missing? Call {shopName} on {phone}" with a `tel:` link (UKC-CRA-02). When `paymentStatus !== 'unpaid'`, remove `sessionStorage['ppos.basket.<slug>']` (P1-10 left it for the `cancel_url` return). `pending_payment` for longer than 2 minutes adds "Still waiting? If you were charged, call the shop." Times shown as `HH:mm` Europe/London. Customer copy only in `en-GB.ts`. Build the page from `@ppos/ui` components (decision A1); create no base components in `apps/storefront`.

**Templates** (`_shared/notifications/templates.ts`, pure): `renderEmail(kind, data) → { subject, html, text }` and `renderSms(kind, data) → string`. Email for every `kind` ∈ `placed`, `accepted`, `rejected`, `cancelled`, `ready`, `out_for_delivery`; SMS only for `accepted`, `rejected`, `cancelled` (architecture §10 item 5, decision A15: one customer SMS, only for accepted-with-ETA and for rejected/cancelled). `placed`, `ready` and `out_for_delivery` are email only. `data` comes from `data.ts` (`loadNotificationData(orderId)`: order, lines, shop identity, status URL `${APP_STOREFRONT_URL}/o/<token>`). Every interpolated value in HTML goes through `escapeHtml` (`&` `<` `>` `"` `'`); attributes only for the status URL and `tel:` link, both escaped. No external images, scripts, tracking pixels or fonts.

| Kind | Must contain |
|---|---|
| `placed` (subject "Your order #12 at Demo Chippy") | UKC-CCR-06: shop legal name, geographic address, phone and email; order number; every line with options and "Contains: …"/"May contain: …" (UKC-ALG-07); Items, Delivery (if any), `Service fee`, Tip (if any), Total; fulfilment and time; the exact no-cancellation sentence (decision A19, UKC-CCR-03; the edge function cannot import the storefront dictionary, so copy it byte for byte into `templates.ts`): `Once the shop accepts your order it can't be cancelled, because food is prepared fresh. If something is wrong with your order, contact the shop.`; "Something wrong or missing? Call …" (UKC-CRA-02); for `legalForm` `limited_company` or `llp` also "Company number …", "Registered office: …" and "Registered in England and Wales" / "Scotland" / "Northern Ireland" (from `registeredIn`, UKC-ID-05); status link |
| `accepted` | "accepted", ready/delivery time `HH:mm`, status link |
| `rejected` / `cancelled` | plain reason text from the code (`too_busy` → "the shop is too busy right now", `auto_timeout` → "the shop didn't confirm your order in time", `cannot_fulfil` → "the shop can't make your order", `customer_request` → "you asked the shop to cancel it", `async_payment_failed` → "your payment did not go through" (status page only: P1-12 queues no notification for it), `other` → no reason sentence, …; the status page uses the same code → text list in `en-GB.ts`); the refund line "A refund of £X.XX is on its way to your card." only when `cancelRefundPence` is not null (same helper and rule as the status page); shop phone |
| `ready` / `out_for_delivery` | "ready to collect" / "on its way", status link |

SMS (≤ 2 segments, no customer personal data): e.g. `Demo Chippy: order #12 accepted, ready about 18:45. Track: <url>`. Never: `VAT receipt`, `VAT invoice` (UKC-VAT-03); any banned fee wording of decision A19 / UKC-NAME-02: `card fee`, `card charge`, `surcharge`, `processing fee`, `payment fee`, `service charge`, `no fees`, `no hidden fees`, `no refunds`, `non-refundable`, or "tax" as the fee's name (UKC-NAME-03); offers or discounts (UKC-MKT-01). Copy is a draft for the lawyer: each template file starts with the comment `// LAWYER REVIEW REQUIRED`.

**Handlers** (`customer-handlers.ts`, registered in `cron-tick/registry.ts` next to P1-14's): `order.placed`, `order.ready`, `order.out_for_delivery` → email only; `order.accepted`, `order.rejected`, `order.cancelled` → email then SMS (decision A15). Each send: `notifications.claim({ channel, template: '<kind>_<channel>', recipient })` → provider → `finish`. Email `from` = `env.EMAIL_FROM`, reply-to = shop email, idempotency key `<orderId>-<template>`. SMS to the customer phone in E.164 (`ukPhoneToE164`); a non-UK or invalid number → `finish(skipped, …, 'INVALID_PHONE')`. A provider error throws (the outbox row retries; `claim` stops duplicates of the sends that already worked).

## Acceptance

1. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts') && deno test --allow-env --allow-net --allow-read` → green, including:
   - UKC-DP-05: `order-status` response key set equals the table exactly (recursively for `lines`, `totals`, `shop`); a fixture order with customer name `Alice Example` → the serialized response does not contain `Alice`, the phone, the email or the postcode
   - non-UUID → 400; unknown → 404; 61st request in a minute → 429; `pending_payment` order → 200 with `status 'pending_payment'`
   - escaping: item name `<script>alert(1)</script> & "Fish"` → HTML contains `&lt;script&gt;` and `&amp;`, no `<script`; text version contains the raw name
   - UKC-CCR-06 / UKC-ALG-07 / UKC-CRA-02: `placed` HTML **and** text each contain the legal name, address, phone, shop email, `#12`, every line, `Contains: Milk, Sesame`, `Service fee`, `£0.45`, `Total`, the exact no-cancellation sentence of decision A19 and `Call Demo Chippy on`
   - UKC-ID-05: a `limited_company` fixture's `placed` HTML and text contain `Registered office` and `Registered in England and Wales`; the `sole_trader` fixture's contain neither
   - UKC-NAME-02 / UKC-NAME-03 / UKC-VAT-03 / UKC-MKT-01: no rendered template (all kinds, email + SMS) matches `/card fee|card charge|surcharge|processing fee|payment fee|service charge|no fees|no hidden fees|no refunds|non-refundable|vat receipt|vat invoice|% off|discount|\boffer|promo/i` or `/service fee[^.\n]{0,40}\btax\b|\btax\b[^.\n]{0,40}service fee/i` (the fee is never called tax)
   - refund line: `cancelled` with `paymentStatus 'unpaid'` → no refund sentence; total 2045 with a 500 refund made before `cancelled_at` → `£15.45`; `rejected` paid 2045 → `£20.45` (unit tests of `cancelRefundPence` and of the `rejected`/`cancelled` templates)
   - snapshot tests (`assertSnapshot`, text versions) for each kind; SMS for `accepted`, `rejected` and `cancelled` each ≤ 306 characters with a 40-character shop name
   - handlers: `order.accepted` sends email then SMS with templates `accepted_email` / `accepted_sms`; a retried row whose email was sent sends only the SMS; invalid phone → `skipped`; `order.placed`, `order.ready` and `order.out_for_delivery` make no SMS provider call and write no `*_sms` `notifications_log` row
2. `pnpm --filter @ppos/storefront test` → green (fake timers, stubbed fetch): polls every 5 s while `placed`; after an `accepted` response the next request happens at +30 s, not +5 s; stops at `completed`; no requests while hidden, one on becoming visible; accepted shows "ready about 18:45"; rejected (paid 2045) shows `£20.45`; cancelled/unpaid shows no refund line; partially refunded (500 of 2045) then cancelled shows `£15.45`; `expired`/unpaid shows "You have not been charged."; `Service fee` row and `tel:` link present (UKC-CRA-02); basket key removed once paid
3. `pnpm --filter @ppos/core test` → schema rejects a non-UUID token and extra keys
4. `node scripts/guards/run-all.mjs` → exit 0 (no CJK, no `dangerouslySetInnerHTML`); `pnpm verify` → exit 0
5. Human check (request it in the PR): with Resend/Twilio test credentials set by the human, one sandbox order produces the receipt email and an "accepted" SMS; the human reads them on a phone

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups, how snapshots were created)
- [ ] PR opened with the template; it lists the email/SMS drafts for the lawyer (P1-20)

## Stop and escalate if

- The page or a template needs a customer field that is not in the response table, or `order-status` would need to return personal data.
- The P1-14 registry or providers are missing or shaped differently from the P1-14 card.
- A compliance rule conflicts with another, or the wording needs a legal choice (keep drafts; the lawyer decides).

## Hints (verified facts / pitfalls)

- Snapshots: `import { assertSnapshot } from '@std/testing/snapshot'` through the pinned `deno.json` entry (`"@std/testing": "jsr:@std/testing@<exact version>"`; Deliverables). Never write an inline `jsr:` specifier without an exact version: `deps-allowlist.mjs` fails it. [H] Confirm with `deno check` that the subpath `@std/testing/snapshot` resolves through the bare mapping; if it does not, stop and escalate. Create/update them once with `deno test --allow-env --allow-net --allow-read --allow-write <file> -- --update`, read every snapshot, then commit; CI compares read-only. The explicit `assertStringIncludes` checks above stay, so an update can never silently drop a required element.
- POST `{ token }` instead of a query string keeps tokens out of URL logs. Tokens are UUIDv4 (122 random bits); the rate limit is defence in depth.
- Reuse `formatPence` and `mergeAllergens` through `_shared/core.ts`; never format money by hand in templates.
- Use luxon in `Europe/London` for `HH:mm`; the server clock is UTC.

## Open questions for the planner

None. Resolved by decisions A15 (customer email for every kind; one SMS only for accepted-with-ETA and rejected/cancelled; `order.cancelled` templates belong to this card) and A16 (5 s until accepted, then 30 s; pause while hidden; stop at terminal or after 3 h).
