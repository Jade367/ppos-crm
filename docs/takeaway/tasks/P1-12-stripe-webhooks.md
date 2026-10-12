# P1-12 — Stripe webhooks: payments, expiry, refunds, disputes, fee ledger

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-11 (and P1-09's webhook skeleton, P1-02's state machine) |
| Mode | `tests-first` (session A writes proposals, human freezes), then session **B1** (`standard`, one session, own PR: real repo, gateway and RPCs), then **`pass@2` for session B2** (two independent attempts at the golden-tested logic in separate worktrees; keep the better) |
| Reasoning effort | `max` (money, idempotency, Stripe) |
| Model | `glm-5.3` (never Flash) |
| Session budget | Session A ≤ 3 h; session B1 ≤ 3 h; each B2 attempt ≤ 4 h. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | proposals (tests-first) → after freeze: `docs/takeaway/acceptance/P1-12/` |

## Goal

Stripe tells us what happened to money; this task makes the database follow, exactly once, whatever order or how often the events arrive. A paid Checkout Session turns the order `placed` and queues `order.placed`; expiry and failed async payments close unpaid orders; a payment that arrives after expiry is refunded in full at once; refunds made anywhere (our app or the shop's own Stripe Dashboard) update `refunded_pence`, `payment_status` and the `refunds` table, and a full refund always returns the 45p application fee; disputes are flagged and queued for the merchant; application fees land in `platform_fee_ledger`. Nothing here sends SMS or email.

## Read first (and only these, plus what you find with grep)

- **`docs/takeaway/reference/stripe-endive.md` §2, §3, §7, §8, §9, §10 — completely, before any code.**
- `docs/takeaway/reference/architecture.md` §6, §7 (`orders`, `order_events`, `stripe_events`, `platform_fee_ledger`, `refunds`), §8 rules under the table, §9
- `docs/takeaway/tasks/P1-09-stripe-onboarding.md` (webhook skeleton, `_shared/stripe-events.ts`), `docs/takeaway/tasks/P1-11-create-checkout.md` (what an order looks like)
- `docs/takeaway/acceptance/P1-02/order-state.acceptance.test.ts` (`payment_succeeded` is ILLEGAL once paid; late payment → `requiresRefund`)
- `docs/takeaway/03-execution-handbook.md` §F.1, §F.2
- `supabase/functions/_shared/{env,http,supabase,stripe,stripe-events,core}.ts`, `supabase/functions/stripe-webhook-connect/{index,handler}.ts` (other files only when grep points you there)
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` → `order_events` columns (`dedupe_key text not null unique`, `next_attempt_at`, `attempts`, `processed_at`, `last_error`)

## Out of scope

- Sending anything (outbox processing, templates: P1-14, P1-16). Merchant refund UI and partial refunds initiated by us (P1-15).
- Submitting dispute evidence, refunding the fee on disputes (FROZEN: platform keeps it), Accounts v2, thin `v2.` events, SaaS billing events (phase 2).
- Session A: implementation. Session B: editing frozen tests, fixtures or fakes.

## Deliverables

| Path | Action | Session |
|---|---|---|
| `docs/takeaway/acceptance-proposals/P1-12/` `proposal.json`, `webhook-http.acceptance.test.ts`, `payments.acceptance.test.ts`, `fees.acceptance.test.ts`, `fakes.ts`, `fx-*.json`, `CASES.md` | create | A |
| `supabase/functions/_shared/payment-types.ts` | create: the shared types of the Contracts block, exactly | B1 |
| `supabase/functions/_shared/stripe-gateway.ts` (+ test with an SDK-shaped fake asserting `onAccount`/`onPlatform` scopes) | create: real `StripeGateway` | B1 |
| `supabase/functions/_shared/order-repo.ts` (+ test) | create: Supabase implementation of `PaymentRepo` / `FeeRepo` | B1 |
| `supabase/migrations/<ts>_p1_12_order_rpcs.sql`, `supabase/tests/webhooks/order_rpcs.test.sql` | create | B1 |
| `packages/core/src/db/database.types.ts` | regenerate | B1 |
| `supabase/config.toml` | modify: `[functions.stripe-webhook-platform]` `verify_jwt = false` | B2 |
| `supabase/functions/_shared/webhook-http.ts` (+ test) | create: `createWebhookHandler` (below); refactor `stripe-webhook-connect/handler.ts` (P1-09) to use it; P1-09 tests stay green | B2 |
| `supabase/functions/_shared/refunds.ts` (+ test) | create: `buildFullRefundRequest`, `processRefundDue` (reused by P1-13, P1-14, P1-15) | B2 |
| `supabase/functions/stripe-webhook-connect/payments.ts` + routing in `handler.ts`, real deps in `index.ts` | create / modify | B2 |
| `supabase/functions/stripe-webhook-platform/{index,handler,fees}.ts` (+ `handler.test.ts`) | create | B2 |
| `supabase/functions/stripe-webhook-connect/fixtures/*.json` | create (session B2's own extra fixtures) | B2 |

`proposal.json`: command `cd supabase/functions && deno test --allow-env --allow-net --allow-read _shared/tests/acceptance/ stripe-webhook-connect/tests/acceptance/ stripe-webhook-platform/tests/acceptance/`; one `files` entry per file, with these `dest` directories: `webhook-http.acceptance.test.ts` → `supabase/functions/_shared/tests/acceptance/`; `payments.acceptance.test.ts`, `fakes.ts` and the connect fixtures → `supabase/functions/stripe-webhook-connect/tests/acceptance/`; `fees.acceptance.test.ts` and `fx-application-fee-*.json` → `supabase/functions/stripe-webhook-platform/tests/acceptance/`. **Fixture layout:** `freeze.mjs` accepts only files directly inside a `tests/acceptance/` directory, so golden fixtures are flat, named `fx-<event-type-with-dashes>.json` (e.g. `fx-checkout-session-completed.json`, `fx-charge-refunded.json`, `fx-charge-dispute-created.json`, `fx-application-fee-created.json`), next to the test that reads them. Tests read them with `Deno.readTextFile(new URL('./fx-….json', import.meta.url))` (raw text is needed for signatures). `fees.acceptance.test.ts` lives in `stripe-webhook-platform/tests/acceptance/` and imports `../../../stripe-webhook-connect/tests/acceptance/fakes.ts`. Fixtures contain only the fields the handlers read, fake ids (`evt_test_c1`, `acct_test1`, `cs_test_1`, `pi_test_1`, `ch_test_1`, `re_test_1`, `du_test_1`, `fee_test_1`), and no personal data. **Guard traps** (the installed copies under `supabase/functions/**` are scanned by the guards, and session B cannot edit them): import `@std/assert` (and any other std module) through the bare specifier mapped in `supabase/functions/deno.json` if it is mapped there, otherwise inline with the exact version from `reference/versions.md` (e.g. `jsr:@std/assert@<x.y.z>`), never an unpinned `jsr:`/`npm:` specifier (`deps-allowlist`); never write the token `payment_method_types`, not even as a fixture field copied from a real Session object (`stripe-payment-method-types`); write `stripeAccount:`/`stripeContext:` only in `*.test.ts` files, never in `fakes.ts` or fixtures (`stripe-account-option`).

## Spec

### Session steps
- **A** (branch `task/P1-12-tests`): proposals only; `pnpm acceptance:try P1-12` fails only on missing modules; PR "P1-12 acceptance proposals (for human review)"; stop.
- **Human**: review, `node scripts/acceptance/freeze.mjs P1-12`, commit, label, merge.
- **B1** (one standard session, branch `task/P1-12-base`; the card is too large for one session, decision C20): `_shared/payment-types.ts` (the Contracts block, exactly), `_shared/stripe-gateway.ts` + test, `_shared/order-repo.ts` + test, migration `p1_12_order_rpcs` + `supabase/tests/webhooks/order_rpcs.test.sql`, regenerated types (Session B Acceptance 2 for these files, 3, 5). Do not install the golden tests and do not touch either webhook function's `handler.ts`/`index.ts`. Gate: `pnpm verify` → commit → push → PR "P1-12 part 1: repo, gateway, RPCs" → PROGRESS.md handoff → stop.
- **Human**: review and merge the B1 PR, then create two worktrees from the updated `main` (`task/P1-12-a`, `task/P1-12-b`) per handbook §F.2 / prompts §4a.
- **B2 (twice, independently)**: `pnpm acceptance:install P1-12`, see it fail, implement `webhook-http.ts`, `refunds.ts`, `payments.ts`, the routing and real-deps wiring of both webhook functions (B1's repo and gateway), `stripe-webhook-platform/*`, `config.toml`; all of Session B Acceptance 1, 2, 5 → draft PR "P1-12 attempt A|B". Change B1 files only to fix a failing check. Never read the other worktree or branch.
- **Sandbox** (Session B Acceptance 4): winning attempt only, in a follow-up session on its branch after the human picks it.

### Contracts (exported exactly like this; session A's fakes implement them)

```ts
// _shared/webhook-http.ts
export interface WebhookEventsStore { begin(e: Stripe.Event): Promise<'new' | 'duplicate'>; markProcessed(id: string): Promise<void>; markFailed(id: string, message: string): Promise<void> }
export function createWebhookHandler(o: { stripe: Stripe; secret: () => string; events: WebhookEventsStore; handle: (e: Stripe.Event) => Promise<unknown> }): (req: Request) => Promise<Response>;
// _shared/payment-types.ts (types only; imported by functions and by _shared/refunds.ts)
export type OutboxType = 'order.placed' | 'order.accepted' | 'order.rejected' | 'order.ready' | 'order.out_for_delivery'
  | 'order.cancelled' | 'order.disputed' | 'order.refund_due';            // the full P1 list; this task writes placed/disputed/refund_due
export interface OutboxEvent { type: OutboxType; dedupeKey: string; payload: Record<string, string | number | null> }
export interface OrderRecord { id: string; shopId: string; status: OrderStatus; paymentStatus: PaymentStatus; fulfilment: Fulfilment; totalPence: number; refundedPence: number; stripeAccountId: string; checkoutSessionId: string | null; paymentIntentId: string | null }
export interface RefundRecord { stripeRefundId: string; orderId: string; shopId: string; amountPence: number; refundApplicationFee: boolean; reason: string | null; initiatedBy: 'merchant_app' | 'stripe_dashboard' | 'auto_reject' | 'platform'; createdBy: string | null }
export type AnomalyCode = 'ORDER_NOT_FOUND' | 'ACCOUNT_MISMATCH' | 'AMOUNT_MISMATCH' | 'CURRENCY_MISMATCH';
export interface PaymentRepo {
  getOrder(id: string): Promise<OrderRecord | null>;
  findOrderBySessionId(sessionId: string): Promise<OrderRecord | null>;
  findOrderByPaymentIntentId(pi: string): Promise<OrderRecord | null>;
  applyTransition(i: { orderId: string; from: { status: OrderStatus; paymentStatus: PaymentStatus }; to: { status: OrderStatus; paymentStatus: PaymentStatus }; paymentIntentId?: string; rejectReason?: string; outbox: OutboxEvent[] }): Promise<boolean>; // false: row not in `from` state, nothing written
  setRefundState(orderId: string, refundedPence: number, paymentStatus: PaymentStatus): Promise<void>; // absolute values
  listRefunds(orderId: string): Promise<RefundRecord[]>;
  upsertRefund(r: RefundRecord): Promise<void>;                       // insert if absent on stripeRefundId
  setDisputeStatus(orderId: string, status: string): Promise<void>;
  enqueueOutbox(orderId: string, shopId: string, e: OutboxEvent): Promise<void>; // one row per (orderId, type, dedupeKey); a duplicate does nothing (RPC enqueue_outbox)
  markOutboxProcessed(orderId: string, type: OutboxType, dedupeKey: string): Promise<void>; // RPC mark_outbox_processed
  recordAnomaly(eventId: string, code: AnomalyCode): Promise<void>;   // writes stripe_events.error
}
export interface FeeRepo { findOrderByPaymentIntentId(pi: string): Promise<OrderRecord | null>; upsertFeeLedger(r: { applicationFeeId: string; orderId: string; shopId: string; amountPence: number; refundedPence: number }): Promise<void>; setApplicationFeeId(orderId: string, feeId: string): Promise<void> }
export interface StripeGateway {
  retrieveCharge(account: string, chargeId: string): Promise<{ id: string; paymentIntentId: string | null; amount: number; amountRefunded: number; refunded: boolean; applicationFeeId: string | null }>;
  listRefunds(account: string, chargeId: string): Promise<{ id: string; amount: number; status: string | null; metadata: Record<string, string> }[]>;
  retrieveDispute(account: string, disputeId: string): Promise<{ id: string; status: string; paymentIntentId: string | null; evidenceDueBy: number | null }>;
  retrieveApplicationFee(feeId: string): Promise<{ id: string; amount: number; amountRefunded: number; account: string; chargeId: string }>;
  createApplicationFeeRefund(feeId: string, amountPence: number, orderId: string, idempotencyKey: string): Promise<void>;
  createRefund(account: string, i: { paymentIntentId: string; amountPence?: number; refundApplicationFee: boolean; metadata: { order_id: string; initiated_by: string; reason_code: string } }, idempotencyKey: string): Promise<{ id: string; amount: number }>;
}
// stripe-webhook-connect/payments.ts
export function handlePaymentEvent(e: Stripe.Event, deps: { repo: PaymentRepo; stripe: StripeGateway }): Promise<'handled' | 'ignored'>;
// stripe-webhook-platform/fees.ts
export function handlePlatformEvent(e: Stripe.Event, deps: { repo: FeeRepo; stripe: StripeGateway }): Promise<'handled' | 'ignored'>;
// _shared/refunds.ts
export interface RefundDue { orderId: string; initiatedBy: 'merchant_app' | 'auto_reject' | 'platform'; reasonCode: string }
export function processRefundDue(due: RefundDue, deps: { repo: PaymentRepo; stripe: StripeGateway }): Promise<'refunded' | 'nothing_to_refund'>;
```

### Event → effect (connect endpoint; every status change goes through core `transition()` first)

| Event | Lookup | Effect |
|---|---|---|
| `checkout.session.completed`, `…async_payment_succeeded` | `findOrderBySessionId(session.id)`; none → anomaly `ORDER_NOT_FOUND`, 200 | `event.account ≠ order.stripeAccountId` → `ACCOUNT_MISMATCH`; `amount_total ≠ totalPence` → `AMOUNT_MISMATCH`; `currency ≠ 'gbp'` → `CURRENCY_MISMATCH` (no transition). `payment_status ≠ 'paid'` → nothing. `paymentStatus ≠ 'unpaid'` → nothing (duplicate). Else `payment_succeeded`: normal → `applyTransition` to `placed/paid` + `paymentIntentId` + outbox `order.placed` (dedupe `placed`). **Late payment** (`requiresRefund`, order `expired`/`cancelled`) → `applyTransition` to `<same status>/paid` + outbox `order.refund_due` (dedupe `full`, payload `{ initiatedBy: 'platform', reasonCode: 'late_payment' }`), no `order.placed`; then `processRefundDue` inline; if it throws, log the error class and return normally (the outbox row stays for P1-14) |
| `checkout.session.async_payment_failed` | same | order `pending_payment` → `cancel` (reason `async_payment_failed`) to `cancelled/unpaid`; else nothing |
| `checkout.session.expired` | same | order `pending_payment` → `checkout_expired`; else nothing |
| `charge.refunded` | `findOrderByPaymentIntentId(charge.payment_intent)`; **none → throw** (Stripe retries; covers refund-before-completed) | account check; re-fetch `retrieveCharge`; `setRefundState(id, charge.amountRefunded, paymentStatusAfterRefund(...))`; `listRefunds` → `upsertRefund` for status not `failed`/`canceled` (`initiatedBy` = `metadata.initiated_by` if one of ours, else `stripe_dashboard`; `reason` = `metadata.reason_code ?? null`); if `charge.refunded` and `applicationFeeId`: `retrieveApplicationFee`, `remaining = amount − amountRefunded`, `remaining > 0` → `createApplicationFeeRefund(fee, remaining, orderId, 'appfee-refund-' + orderId)` |
| `charge.dispute.created/updated/closed` | by PI; none → throw | account check; re-fetch `retrieveDispute`; `setDisputeStatus`; on `created` only: outbox `order.disputed` (dedupe = dispute id, payload `{ disputeId, evidenceDueBy }`). Never touch `status`/`payment_status`; never refund the fee |
| `account.updated`, `account.application.deauthorized` | P1-09 | unchanged (P1-09 code and tests) |
| anything else | — | `'ignored'`, recorded by the HTTP layer, 200 |

**Platform endpoint** (`stripe-webhook-platform`, secret `STRIPE_WEBHOOK_SECRET_PLATFORM`): `application_fee.created` / `.refunded` → re-fetch `retrieveApplicationFee(id)` (never trust the snapshot), `retrieveCharge(fee.account, fee.chargeId)` → order by PI; none → throw; `upsertFeeLedger` with absolute `amount` / `amountRefunded`; `setApplicationFeeId`. Others → `'ignored'`.

**`processRefundDue`** (full refund of what remains): `already = max(order.refundedPence, Σ listRefunds amounts)`, `remaining = totalPence − already`; `remaining ≤ 0` → `markOutboxProcessed(…, 'order.refund_due', 'full')`, `'nothing_to_refund'`. Else `isFull = already === 0`; `n = listRefunds().length + 1`; `createRefund(acct, { paymentIntentId, amountPence: isFull ? undefined : remaining, refundApplicationFee: isFull, metadata: { order_id, initiated_by, reason_code } }, 'refund-' + id + '-' + n)`; `upsertRefund` (same `initiatedBy`, `refundApplicationFee: isFull`); `markOutboxProcessed`; `'refunded'`. `buildFullRefundRequest` is the pure part (stripe-endive §8: omit `amount` for full, never set Stripe's `reason`).

**HTTP layer** (`createWebhookHandler`, shape of stripe-endive §7): non-POST → 405; no `stripe-signature` → 400; raw `req.text()`; `constructEventAsync(raw, sig, secret(), undefined, webhookCryptoProvider)` failure → 400; `begin` `'duplicate'` → 200 without calling `handle`; `handle` throws → `markFailed` + 500; else `markProcessed` + 200. Log only `event.id`, `event.type`, `event.account`.

**Outbox keys.** `order_events.dedupe_key` already exists from P1-05 as `text not null unique` (decision A6, architecture §7). Do not add, drop or alter that column or its constraint. Short keys such as `placed` or `full` repeat across orders, so the **stored** value is always `<order_id>:<type>:<dedupeKey>` (e.g. `<uuid>:order.placed:placed`), built only in SQL by `public.outbox_dedupe_key(p_order_id uuid, p_type text, p_key text) returns text` (`language sql immutable`, `set search_path = ''`). TypeScript never builds this string: `OutboxEvent.dedupeKey` stays the short key, and `order-repo.ts` calls the RPCs below.

**Migration `p1_12_order_rpcs`**: `outbox_dedupe_key` (above); `apply_order_transition(p_order_id uuid, p_from_status text, p_from_payment text, p_to_status text, p_to_payment text, p_patch jsonb, p_outbox jsonb) returns boolean` — one statement `update … where id = p_order_id and status = p_from_status and payment_status = p_from_payment`; patch keys whitelisted (`payment_intent_id`, `promised_time`, `reject_reason`); sets `placed_at`/`accepted_at`/`rejected_at`/`completed_at`/`cancelled_at` = `now()` when entering that status; inserts every `p_outbox` element (`{ type, dedupeKey, payload }`) with `dedupe_key = outbox_dedupe_key(p_order_id, type, dedupeKey)` and `on conflict (dedupe_key) do nothing`, **only if the update hit a row**; `enqueue_outbox(p_order_id uuid, p_shop_id uuid, p_type text, p_dedupe_key text, p_payload jsonb) returns void` (same key rule, `on conflict (dedupe_key) do nothing`); `mark_outbox_processed(p_order_id uuid, p_type text, p_dedupe_key text) returns void`. All three: SECURITY INVOKER, `set search_path = ''`, `EXECUTE` only for `service_role`. P1-13/P1-14 reuse them.

## Acceptance

Session A: `git diff --name-only main...HEAD` → only `docs/takeaway/acceptance-proposals/P1-12/*` + PROGRESS.md; guards exit 0; `pnpm acceptance:try P1-12` fails only on missing modules; CASES.md lists every case below with literal expectations; guard traps: `grep -nE "[\"'](jsr|npm):" docs/takeaway/acceptance-proposals/P1-12/*.ts | grep -vE "(jsr|npm):@?[^@\"'/]+(/[^@\"'/]+)?@[0-9]+\.[0-9]+\.[0-9]+"`, `grep -n payment_method_types docs/takeaway/acceptance-proposals/P1-12/*` and `grep -nE 'stripe(Account|Context)\s*:' docs/takeaway/acceptance-proposals/P1-12/fakes.ts docs/takeaway/acceptance-proposals/P1-12/*.json` → each no output. Base fixture order: collection, `totalPence` 2045, `acct_test1`, `cs_test_1`, `pending_payment/unpaid`.
- **H01–H08 (HTTP):** valid signature (`generateTestHeaderStringAsync`, secret `whsec_test`) → 200, `handle` once, `markProcessed`; tampered body / wrong secret / `timestamp = now − 400` / no header → 400 and `handle` not called; GET → 405; same signed request twice → 200 + 200, `handle` once (replay); `handle` throws → 500 + `markFailed`, a redelivery calls `handle` again.
- **W01–W22 (connect):** W01 completed → `placed/paid`, PI stored, exactly one `order.placed`; W02 same event twice → one transition, one outbox row; W03 `unpaid` session → nothing; W04 account mismatch; W05 amount 2046 and currency `eur` mismatches; W06 unknown session → anomaly, no throw; W07 late payment on `expired` and on `cancelled` → status unchanged, `paid`, `order.refund_due` only, `createRefund` with no amount, fee flag true, key `refund-<id>-1`, metadata `initiated_by: 'platform'`, `reason_code: 'late_payment'`, refund row `platform`, outbox row processed; W08 W07 with `createRefund` throwing → resolves, outbox row unprocessed; W09 async succeeded = W01; W10 async failed → `cancelled/unpaid` (and nothing on a `placed` order); W11 expired → `expired` (and nothing on `placed`); W12 partial 500 → `refunded_pence` 500, `partially_refunded`, row `stripe_dashboard`, no fee calls; W13 full dashboard refund → `refunded`, `createApplicationFeeRefund('fee_test_1', 45, <id>, 'appfee-refund-<id>')`; W14 full refund whose fee is already refunded → no fee call, row keeps `merchant_app`; W15 W13 delivered twice → `refunded_pence` 2045 (not 4090), one row, one fee refund; W16 partials 1000 + 1045 → `refunded` + fee top-up 45; W17 **out of order**: full `charge.refunded` first → throws; completed → `placed/paid`; refund retried → final fake state deep-equals the in-order run; W18 dispute created → `needs_response`, one `order.disputed` `{ disputeId: 'du_test_1', evidenceDueBy: 1794000000 }`, status/payment unchanged, no fee refund; W19 created twice + closed (`lost`) → one outbox row, final `lost`; W20 dispute for unknown PI → throws; W21 unknown type → `'ignored'`, no writes; W22 refund event from another account → anomaly, no writes.
- **F01–F04 (platform):** created → ledger `{ fee_test_1, 45, 0 }` + `application_fee_id` set; duplicate → one ledger row; `.refunded` before `.created` (current fee `amountRefunded` 45) → ledger keeps 45; no order for PI → throws.

Session B (B1 = items 2 for its own files, 3, 5; each B2 attempt = items 1, 2, 5; item 4 = follow-up on the winner):
1. B2: `pnpm acceptance:install P1-12` → all files installed; first run fails on missing modules (paste it)
2. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts') && deno test --allow-env --allow-net --allow-read` → green (B1: P1-09 + own tests incl. `stripe-gateway` scopes and `order-repo` RPC calls; B2: golden + P1-09 + own tests)
3. B1: `supabase db reset && supabase test db` → green incl. `apply_order_transition`: wrong `from` → false and no outbox row; outbox `order.placed`/`placed` for two different orders → two rows, the same order twice → one row, stored `dedupe_key` = `<order_id>:order.placed:placed`; `enqueue_outbox` duplicate → still one row; `mark_outbox_processed` sets `processed_at`; timestamps set; anon/authenticated execute of all three RPCs → `42501`
4. Sandbox — winning attempt only, in a follow-up session on its branch after the human picks it (`stripe listen --latest --forward-to …/stripe-webhook-platform --forward-connect-to …/stripe-webhook-connect`, human key; the human pays and refunds in the browser, you run `stripe listen`, query the rows and paste them): pay a P1-11 order → `placed/paid`, `order.placed` row, ledger row; full refund in the connected account's Dashboard → `refunded` and ledger `refunded_pence` 45. **Record on which endpoint `application_fee.created` arrived** (stripe-endive §7 [H]). Paste event ids and final rows (no payloads)
5. `git diff --exit-code main...HEAD -- docs/takeaway/acceptance` → exit 0 (three dots: only this branch's changes, so a later freeze merged to `main` cannot fail it; golden sources untouched); `node scripts/guards/run-all.mjs` → exit 0 (acceptance-integrity: installed copies byte-identical); `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths of the current session changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups, the sandbox endpoint finding with event ids)
- [ ] PR opened with the template (session A: then stop; B1: PR "P1-12 part 1: repo, gateway, RPCs", then stop; B2: draft PR "P1-12 attempt A|B" — the human picks the winner per handbook §F.2)

## Stop and escalate if

- `application_fee.created` arrives on the connect endpoint, a `v2.` event appears, or a re-fetch returns a shape `deno check` rejects.
- A frozen test seems to contradict stripe-endive.md or the golden P1-02 tests, or the same failure survives 3 attempts.
- You are tempted to use `event.created` for ordering, `+=` on `refunded_pence`, metadata as the only lookup key, or to refund the fee on a dispute.
- `order_events.dedupe_key` is missing or is not `unique` in `supabase/migrations` (P1-05): do not add or change it here.
- Session A: a test or fixture genuinely needs a banned token: stop; the human must add an `allowlist.json` entry before the freeze.

## Hints (verified facts / pitfalls)

- At-least-once + concurrent duplicates: `begin()` is not enough; the real guards are `apply_order_transition`'s `where status = … and payment_status = …`, unique keys and upserts (stripe-endive §7).
- `charge.payment_intent`, `dispute.payment_intent`, `fee.account`, `fee.charge` can be a string or an expanded object: take `.id` when not a string (inside `stripe-gateway.ts`).
- `applicationFees.createRefund(id, params, options)`: options are the **third** argument; the fee is a platform object (no `onAccount`).
- `payment_succeeded` throws `ILLEGAL_TRANSITION` once paid: check `paymentStatus` first and treat it as a duplicate, never a 500.
- A refund row written by the webhook for one of our refunds may have `refundApplicationFee: false` if the webhook wins the insert race; reports use `payment_status` and the ledger, not this flag.

## Open questions for the planner

None open. Resolved: `_shared/refunds.ts` is owned here and reused by P1-13, P1-14 and P1-15 (decision A14); a full refund reached through several partial refunds returns the 45p (A12); `order_events.dedupe_key` is P1-05's globally unique column (A6), which is why the stored key includes the order id and type (Spec → Outbox keys).
