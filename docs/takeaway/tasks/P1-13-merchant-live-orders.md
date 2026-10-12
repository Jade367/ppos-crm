# P1-13 — Merchant live orders screen (realtime, alarm, accept/reject, ticket print)

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-12, P1-06 |
| Mode | `standard` |
| Reasoning effort | `max` for Session 1 (`merchant-order-action` triggers refunds), `high` for Session 2 (UI) |
| Model | `glm-5.3` (never Flash: auth + refunds) |
| Session budget | Two sessions on one branch `task/P1-13-merchant-live-orders`, ≤ 3 h each (plan: Spec → Sessions); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none |

## Goal

The shop's tablet shows new paid orders the moment they arrive and makes sure nobody misses one: a live board fed by Supabase Realtime (with a refetch fallback), a full-screen visual alarm plus a looping sound until each new order is acknowledged (the acknowledgement is stored in `orders.acknowledged_at`, so P1-14 can text the shop only when the tablet did not react within 60 s), and the screen kept awake. Staff accept with an ETA, reject with a reason, and move orders through ready / out for delivery / completed; every change goes through core `transition()` in the `merchant-order-action` edge function, and rejecting or cancelling a paid (or partially refunded) order refunds whatever remains (decision A5). A printable 80 mm kitchen ticket shows everything the kitchen needs, including allergens and the customer's allergy note.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §6, §7 (`orders`, `order_items`), §8 (`merchant-order-action`, `refund-order` roles + rules under the table), §10 items 1–3 and 7
- `docs/takeaway/reference/uk-compliance.md` UKC-ALG-06, UKC-A11Y-05, UKC-DP-04
- `docs/takeaway/tasks/P1-12-stripe-webhooks.md` → `apply_order_transition`, outbox types, `_shared/refunds.ts` (`processRefundDue`)
- `docs/takeaway/tasks/P1-06-merchant-auth-shell.md` → routes, `RequireRole`, current shop, i18n
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` → RLS matrix (`orders`, `order_items`: staff+ read)
- `packages/core/src/orderState.ts`; `supabase/functions/_shared/{http,supabase,core,payment-types,refunds,order-repo,stripe-gateway}.ts`
- Merchant shell (P1-06): the file that exports `RequireRole` and the current-shop hook (find them with `grep -rln "RequireRole\|useMemberships" apps/merchant/src`), `apps/merchant/src/layout/AppShell.tsx`, the router file

## Out of scope

- Merchant-initiated partial/full refunds from the order detail (P1-15), SMS/voice escalation and auto-reject (P1-14), customer notifications (P1-16).
- Star CloudPRNT / `print_jobs` (P2), audio files, push notifications, order editing, driver tracking.
- Any change to RLS policies or to `apply_order_transition` (P1-12).

## Deliverables

| Path | Action | Session |
|---|---|---|
| `packages/core/src/eta.ts` (+ `tests/unit/eta.test.ts`) | create: `ETA_PRESETS_MINUTES`, `promisedTimeFromEta` | 1 |
| `packages/core/src/schemas/order-action.ts`, `packages/core/src/index.ts` (+ unit test) | create / modify: `REJECT_REASONS`, `CANCEL_REASONS`, `orderActionRequestSchema` | 1 |
| `supabase/functions/merchant-order-action/{index,handler,handler.test}.ts` | create (`index.ts` = `Deno.serve(createHandler(realDeps))`) | 1 |
| `supabase/migrations/<ts>_p1_13_orders_realtime.sql` | create (`pnpm exec supabase migration new p1_13_orders_realtime`): `alter table public.orders add column acknowledged_at timestamptz null;` and add `public.orders` to the `supabase_realtime` publication | 1 |
| `supabase/tests/orders/orders_realtime.test.sql` | create (pgTAP, outside `acceptance/`) | 1 |
| `packages/core/src/db/database.types.ts` | regenerate | 1 |
| `apps/merchant/src/orders/{alarmReducer,alarmReducer.test}.ts` | create (pure) | 2 |
| `apps/merchant/src/orders/{useOrdersFeed,useAlarmSound,useWakeLock}.ts` | create | 2 |
| `apps/merchant/src/orders/{OrdersBoardPage,OrderCard,OrderDetail,AcceptDialog,RejectDialog,AlarmBanner,TicketPage}.tsx`, `ticket.css` (+ RTL tests) | create | 2 |
| `apps/merchant/src/i18n/en-GB.ts`, `zh-CN.ts`, router file | modify | 2 |
| `e2e/merchant-orders.spec.ts`, `e2e/fixtures/merchant-orders/*.json` | create | 2 |

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR; decision C20):
- **Session 1** (`max`): core `eta.ts` + `schemas/order-action.ts` + unit tests, `merchant-order-action` (incl. `acknowledge` and `cancel`) + deno tests, the migration, the pgTAP file, regenerated types (Acceptance 1, 2, 3). Gate: those items + `pnpm verify:quick` → checkpoint commit `feat(orders): order actions, acknowledgement and realtime [P1-13] (session 1/2)` → `git push -u origin task/P1-13-merchant-live-orders` (no PR yet) → PROGRESS.md `## Current`: `P1-13 Session 1 done (<hash>); next: Session 2, first file apps/merchant/src/orders/alarmReducer.ts`. Stop.
- **Session 2** (`high`; the human starts it with `docs/takeaway/prompts.md` §8, resume): `alarmReducer`, the three hooks, board, dialogs, `AlarmBanner`, `TicketPage` + `ticket.css`, i18n, router, RTL tests, e2e (Acceptance 4, 5, 6). Change Session 1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

**Core.** `ETA_PRESETS_MINUTES = [15, 20, 30, 45, 60] as const`. `promisedTimeFromEta(now: string, minutes): string` = `now + minutes`, rounded **up** to the whole minute, output Europe/London ISO with offset and seconds, no milliseconds (same format as P1-03 rule 8). Examples: `('2026-11-02T18:07:30Z', 20)` → `2026-11-02T18:28:00+00:00`; `('2026-10-12T17:10:00Z', 15)` → `2026-10-12T18:25:00+01:00`. `REJECT_REASONS = ['too_busy', 'closing_soon', 'item_unavailable', 'cannot_deliver_to_address', 'other']`; `CANCEL_REASONS = ['cannot_fulfil', 'customer_request', 'other']`. `orderActionRequestSchema` (`.strict()`, discriminated on `action`): `accept { orderId: uuid, etaMinutes?: preset }`, `reject { orderId, reason }`, `ready | dispatch | complete { orderId }`, `cancel { orderId, reason }`, `acknowledge { orderId }`.

**`merchant-order-action`** (POST, merchant JWT; keep `verify_jwt` default; CORS for the merchant origin):

1. Validate → `400 VALIDATION`. `requireUser(req)` → `401`.
2. Load the order by id with the service client (`id, shop_id, status, payment_status, fulfilment, requested_time`). Check `is_shop_member(order.shop_id, 'staff')` with the **caller's** client in SQL. Order missing **or** caller not a member → `404 NOT_FOUND` (same answer, so ids cannot be probed). The body never carries a `shop_id`. For `cancel`, additionally require `is_shop_member(order.shop_id, 'manager')` with the caller's client; staff → `403 FORBIDDEN` (cancel can refund an accepted order, and refunds are manager+ per architecture §8 `refund-order`).
   `acknowledge` stops here: service client `update public.orders set acknowledged_at = <now ISO> where id = <id> and status = 'placed' and acknowledged_at is null` (in supabase-js: `.update(...).eq('id', id).eq('status', 'placed').is('acknowledged_at', null)`); no transition, no outbox, no RPC; zero rows updated is not an error (already acknowledged or no longer placed) → `200 { acknowledged: true }`.
3. Build the core event: `accept` → `promisedTime = requested_time` when the order has one (then `etaMinutes` must be absent), else `promisedTimeFromEta(now, etaMinutes)` (`etaMinutes` required); `reject`/`cancel` → `reason`. `transition()` errors → `409 ILLEGAL_TRANSITION`.
4. `apply_order_transition` (P1-12) from the loaded `status/payment_status` to the result, with `promised_time` or `reject_reason` in the patch, and outbox events:

| Action | Outbox (`type`, `dedupe_key`) |
|---|---|
| accept | `order.accepted`, `accepted` |
| reject | `order.rejected`, `rejected`; plus `order.refund_due`, `full`, payload `{ initiatedBy: 'merchant_app', reasonCode: 'order_rejected' }` when `requiresRefund` |
| ready / dispatch | `order.ready`, `ready` / `order.out_for_delivery`, `out_for_delivery` |
| complete | none |
| cancel | `order.cancelled`, `cancelled`; plus `order.refund_due` (`reasonCode: 'order_cancelled'`) when `requiresRefund` |

   RPC returns false → `409 CONFLICT` ("This order changed on another device. Refresh.").
5. When an `order.refund_due` row was written: call `processRefundDue` (P1-12) inline. Success → `refund: 'refunded'`; any error → `refund: 'pending'` (the outbox row stays; P1-14 retries). Never 5xx because the refund failed after the status changed.
6. `200 { status, paymentStatus, promisedTime, refund: 'refunded' | 'pending' | 'none' }`. Log order id, action and error codes only.

`cancel` is not in architecture §8's purpose list for `merchant-order-action`, but decisions A5 (refund on cancel) and A15 (customer `order.cancelled` email) need it, and `orders.acknowledged_at` is not in §7's (non-exhaustive) column list, but A15 / §10 item 2 need it. Implement both as written here; do not stop for these two. Write under PROGRESS.md `## Proposed doc changes`: "architecture §8: `merchant-order-action` also does `cancel` (manager+) and `acknowledge` (staff+); §7 `orders`: `acknowledged_at` (P1-13)".

**Realtime feed (`useOrdersFeed(shopId)`).** Initial load: orders of the current shop with `status in (placed, accepted, ready_for_collection, out_for_delivery)` or (`status in (completed, rejected, cancelled)` and `placed_at` ≥ today 00:00 Europe/London), with `order_items`. Subscribe to `postgres_changes` on `public.orders` filtered `shop_id=eq.<shopId>` (RLS applies to the authenticated channel). Refetch the whole list when the channel (re)subscribes (reconnect), when the page becomes visible again, and every 30 s (architecture §10 item 1, decision A17), because Realtime can drop silently. `pending_payment` and `expired` orders never appear.

**Board** (`/orders`, `RequireRole min="staff"`): columns New (`placed`), Accepted, Ready / Out, Done today. Cards: order number (large), fulfilment, ASAP or requested time, age in minutes, item count, total via `formatPence`, `ALLERGY NOTE` badge when present. Tap → `OrderDetail` (lines, options, allergens, notes, customer name/phone, address for delivery; actions allowed by `allowedEvents()` only, and "Cancel order" only for manager+; ticket link).

**Alarm.** `alarmReducer(state, action)` is pure: state `{ shiftStarted, placedIds, acknowledgedIds }`; actions `shift_started`, `orders_loaded(orders)`, `order_changed(order)`, `acknowledge(id)`, `acknowledge_all`. Selectors: `bannerVisible` = some placed id not acknowledged (works before the shift starts: the visual alarm needs no audio unlock); `shouldRing` = `shiftStarted && bannerVisible`. An order leaving `placed` (accepted on another device, auto-rejected) drops out of `placedIds`; an order whose `acknowledged_at` is set (acknowledged on any device) counts as acknowledged. "Start shift" button: creates the `AudioContext` inside the click (browser autoplay rule), requests `navigator.wakeLock.request('screen')`, re-requests it on `visibilitychange` → visible; shows "Screen stays on" or, when unsupported, "Keep this screen open and plugged in". Sound: Web Audio oscillator beeps (no audio files) repeating every 2 s while `shouldRing`. `AlarmBanner` is full-screen, text "New order #<n>" + "Seen" button (acknowledge) + "Open order"; not colour-only (UKC-A11Y-05). "Seen" acknowledges every placed order the banner shows, "Open order" the one it opens; each acknowledged order is also sent to the server as `{ action: 'acknowledge', orderId }` (a failed request is ignored: the worst case is one unnecessary escalation SMS). Acknowledging stops the sound and records `orders.acknowledged_at`; the order stays in New until accepted. P1-14 texts `shops.alert_phone` when a paid order is still unacknowledged after 60 s and calls it when the order is not accepted after 2 min (architecture §10 items 2–3).

**Accept / reject dialogs.** Accept: ASAP orders show the five ETA buttons (`aria-pressed`), scheduled orders show "Accept for HH:mm". Reject: reason radio list (labels in both dictionaries), confirmation text "The customer will get a full refund". After a response with `refund: 'pending'` show "Order rejected. The refund will be retried automatically."

**Ticket** (`/orders/:id/ticket`, outside the app shell, `RequireRole min="staff"`): shop name; order number in large type; `PAID` (or `NOT PAID` if `payment_status = 'unpaid'`); `COLLECTION`/`DELIVERY`; "ASAP — promised HH:mm" or "For HH:mm"; customer name and phone; delivery address; every line with quantity, options and "Contains: …" / "May contain: …" from `allergens_snapshot`; `ALLERGY NOTE` heading + note (UKC-ALG-06); notes; totals (Items, Delivery, Service fee, Tip, Total). "Print" button → `window.print()`. `ticket.css`: `@media print` hides everything but the ticket, `@page { size: 80mm auto; margin: 3mm }` [H: browsers differ; the human checks on the pilot printer], black text, ≥ 12 pt, no backgrounds.

## Acceptance

1. `pnpm --filter @ppos/core test` → green: both `promisedTimeFromEta` examples above; schema accepts `{ action: 'acknowledge', orderId }`; schema rejects `etaMinutes: 25`, an unknown reason, an extra `shopId` key
2. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts') && deno test --allow-env --allow-net --allow-read` → green, incl. `merchant-order-action` tests with fakes: no `Authorization` header → 401 `UNAUTHORIZED` and the order is not loaded; member of another shop → 404 (same body as a missing order); staff `cancel` of a paid accepted order → 403 `FORBIDDEN`, no RPC call, no `processRefundDue`; manager `cancel` of the same order → outbox `order.cancelled` + `order.refund_due` (`reasonCode: 'order_cancelled'`); `acknowledge` twice → the first `acknowledged_at` is kept, both 200; `acknowledge` on another shop's order → 404; `acknowledge` on an accepted order → 200 and nothing written; staff accept ASAP 20 → RPC called with `promised_time` from `promisedTimeFromEta` and outbox `order.accepted`; accept with `etaMinutes` on a scheduled order → 400; reject a paid order → outbox `order.rejected` + `order.refund_due` and `processRefundDue` called once → `refund: 'refunded'`; `processRefundDue` throws → 200 `refund: 'pending'`; RPC returns false → 409 `CONFLICT`; `ready` on a delivery order → 409 `ILLEGAL_TRANSITION`; unknown key → 400
3. `supabase db reset && supabase test db` → green incl. `supabase/tests/orders/orders_realtime.test.sql`: `select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'), 1, 'orders in supabase_realtime')` and `has_column('public', 'orders', 'acknowledged_at')`
4. `pnpm --filter @ppos/merchant test` → green, incl.: `alarmReducer` (new placed order → banner + ring after shift start; banner but no ring before; acknowledge stops; second new order rings again; order accepted elsewhere stops it; an order loaded with `acknowledged_at` set does not ring); `useOrdersFeed` refetches after 30 s (fake timers) and on `visibilitychange`; "Seen" sends `{ action: 'acknowledge', orderId }`; "Cancel order" hidden for staff; board puts fixture orders in the right columns; accept dialog shows 5 presets for ASAP and one button for scheduled; UKC-ALG-06: ticket shows "Contains: Milk, Sesame" and the `ALLERGY NOTE` heading when a note exists (and no heading when empty); UKC-A11Y-05: banner text present while ringing; `en-GB` and `zh-CN` key sets identical
5. `pnpm e2e` → `merchant-orders.spec.ts` green (stubs: `**/auth/v1/**`, `**/rest/v1/**`, `**/functions/v1/merchant-order-action`; fixed clock): owner opens `/orders` → order #12 in New → "Start shift" → banner visible → "Open order" → captured request body `{ action: 'acknowledge', orderId }` → Accept → 20 min → captured request body `{ action: 'accept', orderId, etaMinutes: 20 }` → stubbed response → card in Accepted; ticket route shows the order number and allergens
6. `node scripts/guards/run-all.mjs` → exit 0 (no `dangerouslySetInnerHTML`, no CJK outside `zh-CN.ts`); `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups, the `## Proposed doc changes` entry for architecture §7/§8 from the Spec)
- [ ] PR opened with the template; the PR asks the human to test on the real tablet: sound after "Start shift", screen stays on for 10 minutes, ticket prints legibly on 80 mm paper

## Stop and escalate if

- `_shared/refunds.ts` or `apply_order_transition` (P1-12) is missing or has a different contract: do not write a second refund path.
- `shops.alert_phone` (P1-05) is missing, or `orders.acknowledged_at` already exists with a different type.
- Realtime does not deliver `orders` changes to an authenticated member under RLS in the local stack (record the exact behaviour), or needs a policy change.
- A status change seems to need an event or status that core does not have.

## Hints (verified facts / pitfalls)

- Membership is checked in SQL with the caller's JWT (`rpc('is_shop_member', { p_shop_id, p_min_role: 'staff' })`); the service client is only for reading the order, the `acknowledge` update and calling the RPC.
- [H] Realtime API shape (`channel(...).on('postgres_changes', { event, schema, table, filter }, cb).subscribe(statusCb)`) and the publication SQL: check them against the installed `@supabase/supabase-js` types and the Supabase Realtime docs; record the URL.
- Browsers start audio only from a user gesture: create/resume the `AudioContext` inside the "Start shift" click handler. Wake Lock is released when the tab is hidden; re-request on return.
- Test the reducer and dialogs with Testing Library by role and label; you cannot see or hear the tablet.
- Keep `OrdersBoardPage.tsx` small: the feed, alarm and dialogs are separate files (< 300 lines each).

## Open questions for the planner

None open. Resolved: one refund path through `_shared/refunds.ts` from P1-12 (decision A14); refetch fallback every 30 s plus `visibilitychange` / reconnect (A17); acknowledgement stored server-side for the 60-s SMS rule (A15) and `cancel` restricted to manager+ (both recorded as proposed doc changes, see Spec).
