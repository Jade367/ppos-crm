# P1-15 — Refunds from the back office

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-12, P1-13 (`apps/merchant/src/orders/OrderDetail.tsx`), P1-06 |
| Mode | `standard` |
| Reasoning effort | `max` (money, Stripe, idempotency) |
| Model | `glm-5.3` (never Flash) |
| Session budget | Two sessions on one branch `task/P1-15-refunds`, ≤ 3 h each (plan: Spec → Sessions); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none (the refund policy is FROZEN in architecture §9; tests below are mandatory) |

## Goal

A manager or owner can refund an accepted or finished order, in full or in part, from the order detail, with a reason code (statutory rights for wrong or missing food, UKC-CRA-01). The `refund-order` edge function checks the role in SQL, computes what is still refundable, applies the FROZEN fee policy (full refund → the 45p application fee is returned; partial → it is not) and creates the refund on the shop's connected account with a deterministic idempotency key, so a double click or a network retry never refunds twice. The final `payment_status` is still set only by the `charge.refunded` webhook (P1-12).

## Read first (and only these, plus what you find with grep)

- **`docs/takeaway/reference/stripe-endive.md` §2, §3, §8 (completely) and former open question 6**
- `docs/takeaway/reference/architecture.md` §6 (`payment_status`), §7 (`refunds`, `audit_log`), §8 (`refund-order`), §9 refund policy
- `docs/takeaway/reference/uk-compliance.md` UKC-CRA-01, -03, UKC-DP-04
- `docs/takeaway/tasks/P1-12-stripe-webhooks.md` → `_shared/refunds.ts`, `StripeGateway.createRefund`, `PaymentRepo`
- `supabase/functions/_shared/{refunds,stripe-gateway,order-repo,http,supabase}.ts`, `apps/merchant/src/orders/OrderDetail.tsx` (P1-13)

## Out of scope

- Refunding `placed` orders (use Reject, P1-13), dispute handling, refunds of tips only, store credit, partial refund of the service fee itself.
- Changing the fee policy, `processRefundDue` behaviour, or the webhook (P1-12; its frozen tests must stay green).
- Refunds against the platform account or any `applicationFees.*` call from this function (the webhook tops up the fee).

## Deliverables

| Path | Action | Session |
|---|---|---|
| `packages/core/src/refund-policy.ts` (+ `tests/unit/refund-policy.test.ts`) | create: `MERCHANT_REFUND_REASONS`, `planRefund` | 1 |
| `packages/core/src/schemas/refund.ts`, `packages/core/src/index.ts` (+ unit test) | create / modify: `refundRequestSchema` | 1 |
| `supabase/functions/_shared/refunds.ts` (+ test) | modify: add pure `buildRefundRequest` for partial **and** full; `buildFullRefundRequest` delegates to it (P1-12 golden tests stay green) | 1 |
| `supabase/functions/refund-order/{index,handler,handler.test}.ts` | create (`index.ts` = `Deno.serve(createHandler(realDeps))`) | 1 |
| `apps/merchant/src/orders/{RefundDialog,RefundHistory}.tsx` (+ RTL tests), `OrderDetail.tsx` | create / modify | 2 |
| `apps/merchant/src/i18n/en-GB.ts`, `zh-CN.ts` | modify | 2 |

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR; decision C20, the card lists about 17 files):
- **Session 1**: core `refund-policy.ts` + `schemas/refund.ts` + unit tests, `_shared/refunds.ts` `buildRefundRequest`, `refund-order` + deno tests (Acceptance 1, 2). Gate: those items + `pnpm verify:quick` → checkpoint commit `feat(refunds): refund policy and refund-order [P1-15] (session 1/2)` → `git push -u origin task/P1-15-refunds` (no PR yet) → PROGRESS.md `## Current`: `P1-15 Session 1 done (<hash>); next: Session 2, first file apps/merchant/src/orders/RefundDialog.tsx`. Stop.
- **Session 2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): `RefundDialog`, `RefundHistory`, `OrderDetail` changes, i18n, RTL tests (Acceptance 3), the sandbox request (Acceptance 4), `pnpm verify` (Acceptance 5). Change Session 1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

**Core.**
```ts
export const MERCHANT_REFUND_REASONS = ['item_missing', 'wrong_item', 'late', 'quality', 'customer_request', 'other'] as const;
export interface RefundPlanInput { totalPence: number; refundedPence: number; recordedRefundsPence: number; recordedRefundCount: number; kind: 'full' | 'partial'; amountPence?: number }
export type RefundPlan =
  | { ok: true; amountPence: number; isFull: boolean; refundApplicationFee: boolean; sequence: number; remainingAfterPence: number }
  | { ok: false; code: 'NOTHING_TO_REFUND' | 'AMOUNT_EXCEEDS_REMAINING' | 'INVALID_AMOUNT' };
export function planRefund(input: RefundPlanInput): RefundPlan;
```
Rules: all inputs safe integers ≥ 0, else `INVALID_AMOUNT`. `already = max(refundedPence, recordedRefundsPence)`; `remaining = totalPence − already`; `remaining ≤ 0` → `NOTHING_TO_REFUND`. `kind 'full'` → `amountPence = remaining`; `kind 'partial'` → `amountPence` must be an integer 1..remaining (`0`/missing → `INVALID_AMOUNT`, above → `AMOUNT_EXCEEDS_REMAINING`). `isFull = already === 0 && amountPence === totalPence`; `refundApplicationFee = isFull` (architecture §9, stripe-endive §8); `sequence = recordedRefundCount + 1`.

| Case (total 2045) | Input | Plan |
|---|---|---|
| R1 fresh full | refunded 0, recorded 0/0, full | 2045, isFull, fee **true**, seq 1, after 0 |
| R2 fresh partial | partial 500 | 500, not full, fee **false**, seq 1, after 1545 |
| R3 partial = total | partial 2045, nothing before | 2045, isFull, fee true (same as R1) |
| R4 second partial | refunded 500, recorded 500/1, partial 300 | 300, fee false, seq 2, after 1245 |
| R5 "refund remaining" | refunded 500, recorded 500/1, full | 1545, isFull **false**, fee false, seq 2 (the webhook returns the 45p once the charge is fully refunded) |
| R6 webhook lag | refunded 0, recorded 500/1, partial 2000 | `AMOUNT_EXCEEDS_REMAINING` (remaining is 1545) |
| R7 nothing left | refunded 2045 | `NOTHING_TO_REFUND` |
| R8 bad amounts | partial 0, partial 12.5, partial −1 | `INVALID_AMOUNT` |

**`refundRequestSchema`** (`.strict()`): `orderId` uuid; `kind: 'full' | 'partial'`; `amountPence` int ≥ 1, required iff `partial`, forbidden for `full`; `reasonCode` ∈ `MERCHANT_REFUND_REASONS`; `note?` ≤ 200 (stored in `audit_log` only, never sent to Stripe); `expectedRefundCount` int ≥ 0.

**`refund-order`** (POST, merchant JWT; keep `verify_jwt` default; CORS for the merchant origin):
1. Validate → `400 VALIDATION`; `requireUser` → 401.
2. Load the order (service client). Missing, or caller not `is_shop_member(shop_id, 'staff')` → `404 NOT_FOUND`; member but not `is_shop_member(shop_id, 'manager')` → `403 FORBIDDEN` (both checks in SQL with the caller's JWT).
3. `status = 'placed'` → `409 ORDER_NOT_ACCEPTED` ("Reject the order instead"); status not in `accepted, ready_for_collection, out_for_delivery, completed`, or `payment_status` not in `paid, partially_refunded` → `409 NOT_REFUNDABLE`.
4. `rows = listRefunds(orderId)`. `rows.length !== expectedRefundCount` → `409 REFUND_STATE_CHANGED` with `details.refundCount` (architecture §9, decision A13; stripe-endive former open question 6: the client sends the count it saw; a retry of the same click sends the same count and therefore replays the same key).
5. `planRefund({ totalPence, refundedPence, recordedRefundsPence: Σ rows, recordedRefundCount: rows.length, kind, amountPence })`; not ok → `409` with its code.
6. `buildRefundRequest` → `stripe.createRefund(acct, { paymentIntentId, amountPence: isFull ? undefined : amount, refundApplicationFee, metadata: { order_id, initiated_by: 'merchant_app', reason_code } }, 'refund-' + orderId + '-' + sequence)`.
7. `upsertRefund({ initiatedBy: 'merchant_app', createdBy: user.id, reason: reasonCode, refundApplicationFee, amountPence })` and insert `audit_log` (`action 'order.refund'`, `entity 'orders'`, `entity_id`, `after: { refundId, amountPence, reasonCode, refundApplicationFee, note }`; no customer data).
8. `200 { refundId, amountPence, refundApplicationFee, remainingAfterPence }`.

Stripe errors: `StripeIdempotencyError` → `409 IDEMPOTENCY_CONFLICT`; `StripeInvalidRequestError` → `409 STRIPE_REJECTED` (e.g. already refunded in the Dashboard; log `err.code` only); `StripePermissionError` → `409 ACCOUNT_DEAUTHORIZED`; connection/API/rate limit → `503 STRIPE_UNAVAILABLE`. Logs: ids and codes only.

**UI.** `OrderDetail` (P1-13) shows "Refund" for manager+ when the order is refundable, plus `RefundHistory` (date, amount, reason label, who: "Your team" / "Stripe Dashboard" / "Automatic"). `RefundDialog`: shows "Refundable: £X.XX" (= `formatPence(total − max(refunded_pence, Σ rows))`), radio Full / Part, amount input parsed with `parsePoundsToPence` (no floats), reason select (en-GB + zh-CN labels), optional note, confirmation sentence "The customer gets £X.XX back. This cannot be undone." and a submit button disabled while pending. It sends `expectedRefundCount` = the number of rows it displayed. `409 REFUND_STATE_CHANGED` → reload history and ask again; success → "Refund sent. It can take a few days to reach the customer." and the history refetches. No Stripe fee figures in copy (UKC-PAY-04).

## Acceptance

1. `pnpm --filter @ppos/core test` → green: R1–R8 exactly as the table; schema rejects `amountPence` on `full`, missing `amountPence` on `partial`, `reasonCode: 'fraudulent'`, an extra `shopId`
2. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts') && deno test --allow-env --allow-net --allow-read` → green, incl. P1-12 golden tests and `refund-order` tests with fakes: full on a fresh order → `createRefund` input has **no** `amountPence`, `refundApplicationFee: true`, key `refund-<id>-1`, metadata `{ order_id, initiated_by: 'merchant_app', reason_code: 'wrong_item' }`; partial 500 → `amountPence: 500`, fee false, key `-1`; second partial → key `-2`; same request twice with the same `expectedRefundCount` before the row exists → the same key both times; stale count → `409 REFUND_STATE_CHANGED` and no Stripe call; no `Authorization` header → 401 and no order read; staff → 403; manager of shop B on shop A's order → 404 `NOT_FOUND` (same body as a missing id); `placed` → 409 `ORDER_NOT_ACCEPTED`; `payment_status` `refunded` → 409 `NOT_REFUNDABLE`; `payment_status` `unpaid` with status `accepted` → 409 `NOT_REFUNDABLE`; each Stripe error class → its status; a refunds row and an `audit_log` row written with `initiated_by 'merchant_app'` and no customer fields
3. `pnpm --filter @ppos/merchant test` → green: dialog shows "Refundable: £15.45" for total 2045 with 500 refunded; amount "15.46" → inline error; Refund button hidden for staff; request body contains `expectedRefundCount`; zh-CN/en-GB key sets identical
4. Sandbox (human key; the human pays the P1-11 order with 4242 in the browser, you call `refund-order` on the local stack): partial £5.00 then "refund remaining" on that paid order → `refunds` rows 2, order `refunded` after the webhook, `platform_fee_ledger.refunded_pence` 45 (P1-12 top-up). Paste ids and final rows (no payloads)
5. `node scripts/guards/run-all.mjs` → exit 0; `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template

## Stop and escalate if

- Any P1-12 golden test turns red after your change to `_shared/refunds.ts`: revert that change and escalate; never edit the test.
- `apps/merchant/src/orders/OrderDetail.tsx` (P1-13) is missing.
- The fee policy seems to need an exception (dispute, tip, partial service fee): it is FROZEN; write it under `## Blockers`.
- You need `applicationFees.createRefund` here, a Stripe `reason`, or `stripeAccount:` outside `onAccount()`.

## Hints (verified facts / pitfalls)

- Omit `amount` for a full refund; never send Stripe's `reason` (`'fraudulent'` has Radar side effects) — our reason goes into `metadata.reason_code`.
- `refunded_pence` lags behind until `charge.refunded` arrives; `recordedRefundsPence` (our rows) closes that gap, which is why both feed `already`.
- Same key + different params → `StripeIdempotencyError`: that is the double-refund protection working; show "Refresh and try again".
- Role order owner > manager > staff is defined once in `apps/merchant/src/auth/roles.ts` (P1-06); reuse it.
