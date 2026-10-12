# P1-02 — Core: order state machine

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P0-01 |
| Mode | `standard` (golden tests already written and mutation-tested by the planner) |
| Reasoning effort | `high` |
| Model | `glm-5.3` (never Flash) |
| Session budget | ≤ 2 hours wall-clock / one task. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | `docs/takeaway/acceptance/P1-02/order-state.acceptance.test.ts` (25 tests; install with `pnpm acceptance:install P1-02`) |

## Goal

`packages/core/src/orderState.ts` decides every order status change. Webhooks (P1-12), the merchant order screen (P1-13), cron (P1-14) and refunds (P1-15) call `transition()` and store its result; nothing else may change `orders.status`. **The golden tests are the spec.** Where this card and the golden tests seem to differ, the golden tests win and you report the difference in `PROGRESS.md`.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/acceptance/P1-02/order-state.acceptance.test.ts` (all of it, before writing code)
- `docs/takeaway/reference/architecture.md` §6 Order lifecycle, §13a
- `packages/core/src/index.ts`, `packages/core/src/types.ts` (if P1-01 created it)

## Out of scope

- Database columns, triggers or SQL versions of these rules (P1-05). Persisting timestamps (`accepted_at`…), ETA presets, refund execution.
- `dispute_status` (separate field, not part of this machine).
- New statuses or events. Any change needs an ADR.

## Deliverables

| Path | Action |
|---|---|
| `packages/core/src/types.ts` | create (or reuse if P1-01 created it): `export type Fulfilment = 'collection' \| 'delivery'` |
| `packages/core/src/orderState.ts` | create (file name fixed by architecture §6) |
| `packages/core/src/index.ts` | modify: re-export the API below |
| `packages/core/tests/acceptance/order-state.acceptance.test.ts` | installed by `pnpm acceptance:install P1-02` (never edit) |
| `packages/core/tests/unit/order-state.test.ts` | create (cases the golden file does not cover, listed below) |
| `supabase/functions/_shared/core/**` | only if ADR-0002 chose option C: `node scripts/dev/sync-core.mjs`, commit the copy (CI's `core-sync.test.ts` fails otherwise) |

## Spec

Exported API (fixed by the golden test imports):

```ts
export const ORDER_STATUSES = ['pending_payment', 'placed', 'accepted', 'ready_for_collection', 'out_for_delivery',
  'completed', 'rejected', 'cancelled', 'expired'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const PAYMENT_STATUSES = ['unpaid', 'paid', 'partially_refunded', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export interface OrderSnapshot { status: OrderStatus; paymentStatus: PaymentStatus; fulfilment: Fulfilment }
export type OrderEvent =
  | { type: 'payment_succeeded' } | { type: 'checkout_expired' } | { type: 'accept'; promisedTime: string }
  | { type: 'reject'; reason: string } | { type: 'ready' } | { type: 'dispatch' } | { type: 'complete' }
  | { type: 'cancel'; reason: string };
export type OrderEventType = OrderEvent['type'];
export interface TransitionResult { status: OrderStatus; paymentStatus: PaymentStatus; requiresRefund: boolean }
export class OrderTransitionError extends Error { readonly code: 'ILLEGAL_TRANSITION' | 'INVALID_EVENT' }
export function transition(order: OrderSnapshot, event: OrderEvent): TransitionResult;
export function allowedEvents(order: OrderSnapshot): OrderEventType[];
export function isTerminal(status: OrderStatus): boolean;
export function paymentStatusAfterRefund(input: { totalPence: number; refundedPence: number }): PaymentStatus;
```

**Step 1: validate the event shape** (fails with `INVALID_EVENT`, checked before legality):
- unknown `type`;
- `accept`: `promisedTime` must be a string matching `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$` (so `''` fails);
- `reject` / `cancel`: `reason.trim()` must be 1..500 characters (`''` and `'   '` fail).

**Step 2: legality table** (anything not listed → `ILLEGAL_TRANSITION`; never coerce):

| Event | Legal when | Result `status` / `paymentStatus` / `requiresRefund` |
|---|---|---|
| `payment_succeeded` | `paymentStatus = 'unpaid'` and status ∈ {`pending_payment`, `expired`, `cancelled`} | from `pending_payment`: `placed` / `paid` / false. From `expired`/`cancelled` (late payment): status unchanged / `paid` / **true** |
| `checkout_expired` | `pending_payment` and `unpaid` | `expired` / `unpaid` / false |
| `accept` | `placed` and `paid` | `accepted` / unchanged / false |
| `reject` | `placed` | `rejected` / unchanged / `paymentStatus ∈ {paid, partially_refunded}` |
| `ready` | `accepted` and fulfilment `collection` | `ready_for_collection` / unchanged / false |
| `dispatch` | `accepted` and fulfilment `delivery` | `out_for_delivery` / unchanged / false |
| `complete` | `ready_for_collection` or `out_for_delivery` | `completed` / unchanged / false |
| `cancel` | status ∈ {`pending_payment`, `placed`, `accepted`} | `cancelled` / unchanged / `paymentStatus ∈ {paid, partially_refunded}` |

- `isTerminal`: true exactly for `completed`, `rejected`, `cancelled`, `expired`.
- `allowedEvents(order)` returns the event types that are legal by the table (shape validity assumed). It must agree with `transition()` for every status × payment status × fulfilment × event (a golden test enumerates all of them).
- `paymentStatusAfterRefund`: `refundedPence` must be a safe integer with `0 ≤ refundedPence ≤ totalPence`, else `RangeError`. `0 → 'paid'`, `= total → 'refunded'`, otherwise `'partially_refunded'`.
- Pure: no `Date`, no I/O, no mutation of `order` or `event`.

Unit tests to add (not in the golden file): `cancel` of an `accepted` + `partially_refunded` order → `requiresRefund: true`; `reject` of `placed` + `unpaid` → `requiresRefund: false`; `accept` with `promisedTime: '2026-11-02 18:45'` (no `T`, no offset) → `INVALID_EVENT`; `reject` with a 501-character reason → `INVALID_EVENT`; `payment_succeeded` on `rejected` + `unpaid` → `ILLEGAL_TRANSITION`.

## Acceptance

1. `pnpm acceptance:install P1-02` → prints `installed packages/core/tests/acceptance/order-state.acceptance.test.ts`
2. Before implementing: `pnpm --filter @ppos/core test` → fails on the missing imports (paste the first error line into PROGRESS.md)
3. After implementing: `pnpm --filter @ppos/core test` → `order-state.acceptance.test.ts` 25 passed, unit tests passed, 0 failed (P1-01's 41 tests too, if installed)
4. `git diff --exit-code main -- docs/takeaway/acceptance` → exit 0 (installed copies are checked by the acceptance-integrity guard in `pnpm verify`)
5. `node scripts/guards/run-all.mjs` → exit 0
6. `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template

## Stop and escalate if

- A golden test contradicts the table above or architecture §6. Write the test name, expected vs actual and your reasoning under `## Blockers`; never edit or skip the test.
- You feel the need for a new status, event or payment status.
- The same failure survives 3 attempts.

## Hints (verified facts / pitfalls)

- Implement the table once as data (e.g. a function `legal(order, type): boolean` plus a result function) and build both `transition()` and `allowedEvents()` from it. Two hand-written copies drift and the enumeration test catches it.
- The golden helper checks `err instanceof OrderTransitionError`: set `this.name` and extend `Error` directly.
- The golden tests pass `{ type: 'teleport' } as never`: read `event.type` defensively (switch with a `default` that throws `INVALID_EVENT`).
- `payment_succeeded` is ILLEGAL once paid. The webhook (P1-12) relies on this to ignore duplicate deliveries, so do not make it a silent no-op.
- `core-impure` guard: no `new Date()` / `Date.now()` in `packages/core/src`. The ISO check is a regex, not a clock.
