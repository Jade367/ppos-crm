# P1-14 — cron-tick: outbox, SMS/voice escalation, auto-reject + refund, expiry

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-12, P1-13 (`orders.acknowledged_at`), P1-08 (`packages/core/src/phone.ts`: `normaliseUkPhone`, `isUkMobile`) |
| Mode | `tests-first` (session A writes test proposals, human freezes, session B implements) |
| Reasoning effort | `max` (time rules, money, external providers) |
| Model | `glm-5.3` (never Flash) |
| Session budget | Session A ≤ 2.5 h. Session B runs as two sittings (B1, B2; see Session steps) on one branch, ≤ 3 h each; one PR at the end of B2. If a sitting runs over: checkpoint commit, write handoff, stop. |
| Golden tests | proposals (tests-first) → after freeze: `docs/takeaway/acceptance/P1-14/` |

## Goal

Once a minute Postgres (pg_cron + pg_net) calls the `cron-tick` edge function, which does four independent jobs with a fixed `now`: (1) delivers outbox events through registered handlers with retries and backoff, (2) texts the shop's alert mobile once if a paid order has not been acknowledged on the tablet within 60 s, and phones it once if the order has waited 2 minutes without being accepted (architecture §10, decisions A15, C13), (3) auto-rejects and fully refunds an order nobody accepted within the shop's limit, and (4) closes abandoned `pending_payment` orders. A failure in one job never stops the others. Twilio (SMS, voice) and Resend (email) are reached with plain `fetch` behind small interfaces, so every rule is tested without the network.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §3 (`CRON_SECRET`, `TWILIO_*`, `RESEND_API_KEY`, `EMAIL_FROM`), §6, §7 (`order_events`, `notifications_log`), §8 (`cron-tick`), §10
- `docs/takeaway/reference/stripe-endive.md` §2, §3 (`onAccount`), §6 (`expires_at` semantics), §9 (disputes); the session retrieve/expire calls are **not** in it (see Hints)
- `docs/takeaway/reference/uk-compliance.md` UKC-MKT-01, UKC-DP-04
- `docs/takeaway/tasks/P1-12-stripe-webhooks.md` → `apply_order_transition`, Outbox keys, `processRefundDue`, `RefundDue`, `StripeGateway`
- `docs/takeaway/tasks/P1-13-merchant-live-orders.md` → outbox types written by merchant actions, `acknowledge` / `orders.acknowledged_at`
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` → `order_events` and `notifications_log` columns, `shops.alert_phone`
- `docs/takeaway/03-execution-handbook.md` §F.1; `supabase/functions/_shared/{env,http,supabase,core,stripe,stripe-gateway,payment-types,refunds,order-repo}.ts`; `packages/core/src/phone.ts` (P1-08)

## Out of scope

- Customer notification templates and their handlers (P1-16 registers them into this registry). Printing via CloudPRNT / `print_jobs` (P2).
- A shop SMS on every `order.placed` (the owner SMS is only the 60-s escalation, decision A15). Changing escalation timings (60 s SMS, 2 min call, `auto_reject_after_minutes`), adding channels, marketing content (UKC-MKT-01).
- Adding `shops.alert_phone` (P1-05) or `orders.acknowledged_at` (P1-13) here.
- Creating Vault secrets or function secrets with real values (human). Session A: implementation. Session B: editing tests.

## Deliverables

| Path | Action | Session |
|---|---|---|
| `docs/takeaway/acceptance-proposals/P1-14/{proposal.json,tick.acceptance.test.ts,http.acceptance.test.ts,fakes.ts,CASES.md}` | create | A |
| `supabase/functions/cron-tick/{handler,tick,rules,registry}.ts` (+ own tests) | create | B1 |
| `supabase/functions/cron-tick/handlers/{shop-dispute,refund-due}.ts` (+ tests) | create | B1 |
| `supabase/functions/_shared/providers/types.ts` | create | B1 |
| `packages/core/src/phone.ts`, `packages/core/src/index.ts` (+ unit tests) | modify: add `ukPhoneToE164`; reuse P1-08's `normaliseUkPhone` / `isUkMobile` unchanged | B1 |
| `supabase/functions/_shared/providers/{twilio,resend}.ts` (+ tests with a fake `fetch`) | create | B2 |
| `supabase/functions/_shared/stripe-gateway.ts` (+ test) | modify: `getCheckoutSessionStatus`, `expireCheckoutSession` | B2 |
| `supabase/functions/cron-tick/{index,repo}.ts` (+ repo test) | create | B2 |
| `supabase/migrations/<ts>_p1_14_outbox_cron.sql`, `supabase/tests/cron/outbox_cron.test.sql` | create | B2 |
| `supabase/config.toml` | modify: `[functions.cron-tick]` `verify_jwt = false` | B2 |
| `packages/core/src/db/database.types.ts` | regenerate | B2 |

`proposal.json`: `{ "command": "cd supabase/functions && deno test --allow-env --allow-net --allow-read cron-tick/tests/acceptance/", "files": [ …three files, dest supabase/functions/cron-tick/tests/acceptance/<file>… ] }`. **Guard traps** (the installed copies under `supabase/functions/**` are scanned by the guards, and session B cannot edit them): import `@std/assert` through the bare specifier mapped in `supabase/functions/deno.json` if it is mapped there, otherwise inline with the exact version from `reference/versions.md`; never an unpinned `jsr:`/`npm:` specifier (`deps-allowlist`); never `stripeAccount:`/`stripeContext:` in `fakes.ts` (`stripe-account-option`); no realistic phone numbers or keys (use the Ofcom drama ranges `07700 900xxx` and `0161 496 0xxx`).

## Spec

### Session steps
- **A** (branch `task/P1-14-tests`): proposals only; `pnpm acceptance:try P1-14` fails only on missing modules; PR "P1-14 acceptance proposals (for human review)"; stop.
- **Human**: review, freeze, label, merge.
- **B** (fresh, branch `task/P1-14-cron-tick`) runs in two sittings on the same branch (decision C20), each ending with a green checkpoint commit, a push and a PROGRESS.md handoff; one PR at the end of B2:
  - **B1**: `pnpm acceptance:install P1-14`, see red (paste the line), then `tick.ts`, `rules.ts`, `registry.ts`, `handler.ts`, `handlers/*`, `_shared/providers/types.ts`, core `ukPhoneToE164` (Session B Acceptance 1, the golden and own tests of these files from 2, and 4). Gate: golden + own deno tests green and `pnpm verify:quick` → commit `feat(cron): tick rules and handlers [P1-14] (session 1/2)` → `git push -u origin task/P1-14-cron-tick` (no PR yet) → PROGRESS.md `## Current`: `P1-14 B1 done (<hash>); next: B2, first file supabase/functions/_shared/providers/twilio.ts`. Stop.
  - **B2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): verify the Twilio / Resend / Supabase docs first, then `providers/{twilio,resend}.ts`, the `stripe-gateway.ts` additions, `repo.ts`, `index.ts`, migration + pgTAP, `config.toml`, regenerated types (rest of Session B Acceptance 2, then 3, 5, 6). Change B1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

### Contracts (`cron-tick/tick.ts` and `handler.ts`; session A's fakes implement them)

```ts
export type TickStep = 'outbox' | 'escalation' | 'auto_reject' | 'expiry';
export interface TickReport { outbox: { claimed: number; succeeded: number; failed: number; dead: number; refundDueDead: number }; escalationSms: number; escalationCalls: number; autoRejected: number; expired: number; errors: { step: TickStep; code: string }[] }
export interface OutboxRow { id: number; orderId: string; shopId: string; type: string; dedupeKey: string; payload: Record<string, unknown>; attempts: number } // attempts already incremented by claim; dedupeKey = the stored key (P1-12 Outbox keys)
export type OutboxHandler = (row: OutboxRow, ctx: { now: Date }) => Promise<void>;
export type OutboxRegistry = Map<string, OutboxHandler[]>;      // every handler of a type runs; any throw fails the row
export interface PlacedOrder { id: string; shopId: string; number: number; status: OrderStatus; paymentStatus: PaymentStatus; fulfilment: Fulfilment; placedAt: string; acknowledgedAt: string | null; alertPhone: string | null; autoRejectAfterMinutes: number } // orders.acknowledged_at (P1-13), shops.alert_phone (P1-05)
export interface PendingOrder { id: string; shopId: string; fulfilment: Fulfilment; stripeAccountId: string; checkoutSessionId: string | null; checkoutExpiresAt: string }
export interface TickDeps {
  outbox: { claim(now: Date, types: string[], limit: number): Promise<OutboxRow[]>; complete(id: number, now: Date): Promise<void>; fail(id: number, errorCode: string, nextAttemptAt: Date | null): Promise<void> };
  orders: { listPlaced(): Promise<PlacedOrder[]>; listPendingPaymentDue(now: Date): Promise<PendingOrder[]>; // checkout_expires_at <= now
            applyTransition: PaymentRepo['applyTransition'] };                     // P1-12 contract, _shared/payment-types.ts
  notifications: { claim(i: { orderId: string; shopId: string; channel: 'sms' | 'voice' | 'email'; template: string; recipient: string }): Promise<boolean>;
                   finish(i: { orderId: string; channel: 'sms' | 'voice' | 'email'; template: string; status: 'sent' | 'failed' | 'skipped'; providerId: string | null; errorCode: string | null }): Promise<void> };
  sms: SmsProvider;                                                  // _shared/providers/types.ts
  voice: VoiceProvider;
  stripe: { getCheckoutSessionStatus(account: string, sessionId: string): Promise<string>; expireCheckoutSession(account: string, sessionId: string): Promise<void> };
  refunds: { processRefundDue(due: RefundDue): Promise<unknown> };    // P1-12, _shared/refunds.ts (bind repo + stripe in the real deps)
  registry: OutboxRegistry;
}
export function runTick(now: Date, deps: TickDeps): Promise<TickReport>;
export function nextAttemptAt(attempts: number, now: Date, type: string): Date | null;
// every type except order.refund_due: 1→+1 min, 2→+2, 3→+4, 4→+8, ≥5→null (dead)
// order.refund_due: +min(2^(attempts−1), 60) min, null (dead) once attempts ≥ 48 (about 42 h of retries:
//   a customer must not stay charged for a rejected or late-paid order because Stripe was unreachable for 15 min)
export function createCronHandler(o: { secret: () => string; clock: () => Date; run: (now: Date) => Promise<TickReport> }): (req: Request) => Promise<Response>;
// _shared/providers/types.ts
export interface SmsProvider { send(i: { to: string; body: string }): Promise<{ providerId: string }> }
export interface VoiceProvider { call(i: { to: string; message: string }): Promise<{ providerId: string }> }
export interface EmailProvider { send(i: { to: string; replyTo: string | null; subject: string; html: string; text: string; idempotencyKey: string }): Promise<{ providerId: string }> }
```

### Rules (steps run in this order; each step is wrapped in its own try/catch; an error adds `{ step, code: err.name }` to `errors` and the next step still runs)

| Step | Rule |
|---|---|
| 1 outbox | `claim(now, [...registry.keys()], 20)` (only registered types: unregistered rows wait for a later task's handler). Per row (own try/catch): run every handler of its type; all ok → `complete(id, now)`; any throw → `fail(id, err.name, nextAttemptAt(row.attempts, now, row.type))`, `failed++`, and `dead++` when that is `null` (plus `refundDueDead++` when the type is `order.refund_due`) |
| 2 escalation | For each `listPlaced()` order with `paymentStatus = 'paid'` and `now − placedAt < autoRejectAfterMinutes`: **(a) SMS** when `acknowledgedAt === null` and `now − placedAt ≥ 60 s`: template `escalation_sms`, body `New online order #<n> is waiting on your order screen. Please open it now.` via `sms.send`; sent → `escalationSms++`. **(b) Call** when `now − placedAt ≥ 2 min` (acknowledged or not; the rule is "not accepted"): template `escalation_call`, message `You have a new online order. Please check your order screen.` via `voice.call`; sent → `escalationCalls++`. **Recipient rule for both (decision C13):** `alertPhone` set and `isUkMobile(alertPhone)` → `notifications.claim({ channel, template, recipient: ukPhoneToE164(alertPhone) })`; claimed → provider → `finish(sent, providerId)`, or `finish(failed, null, err.name)` on error. Otherwise → `claim({ …, recipient: alertPhone ?? 'none' })`; claimed → `finish(skipped, null, 'NO_ALERT_MOBILE')`, no provider call (the unique `(order_id, channel, template)` makes this happen once) |
| 3 auto-reject | `paymentStatus = 'paid'` and `now − placedAt ≥ autoRejectAfterMinutes`: core `transition(reject, reason 'auto_timeout')` → `applyTransition` with `rejectReason: 'auto_timeout'` and outbox `order.rejected` (`rejected`, `{ reason: 'auto_timeout' }`) + `order.refund_due` (`full`, `{ initiatedBy: 'auto_reject', reasonCode: 'auto_timeout' }`); applied → `autoRejected++` and `processRefundDue` inline (errors ignored: the outbox row retries) |
| 4 expiry | for each `listPendingPaymentDue(now)` order with `now − checkoutExpiresAt ≥ 5 min`: session id present → `getCheckoutSessionStatus`: `open` → `expireCheckoutSession` then transition; `expired` → transition; `complete` → skip (the webhook decides). No session id → transition. Transition = core `checkout_expired` → `applyTransition` (`pending_payment/unpaid` → `expired/unpaid`, no outbox); applied → `expired++` |

**Registry (this task):** `order.disputed` → `shop-dispute` (SMS `shop_dispute_sms` to `shops.alert_phone` with the recipient rule of step 2, and email `shop_dispute_email` to `shops.email`: "A customer disputed the payment for order #<n>. Respond in your Stripe Dashboard by <d MMM yyyy, Europe/London>." from `evidenceDueBy`; decision A15 puts this handler here); `order.refund_due` → `refund-due`: zod-validate `row.payload` as `{ initiatedBy: 'merchant_app' | 'auto_reject' | 'platform', reasonCode: string }` (an invalid payload throws an error named `BAD_PAYLOAD`, which fails the row), then `processRefundDue({ orderId: row.orderId, initiatedBy, reasonCode })` (the order id lives on the row, not in the payload; never change the P1-12/P1-13 payload contract). No `order.placed` handler here: the owner SMS is only the 60-s escalation of step 2 (decision A15), and `order.placed` rows wait for P1-16's customer email handler. Every send goes `notifications.claim` → provider → `finish`, so a retried row never sends twice. Message bodies contain no customer personal data and are never logged or stored (UKC-DP-04).

**HTTP:** POST only (else 405); header `x-cron-secret` compared in constant time with `env.CRON_SECRET` (missing/wrong → `401`, nothing runs); `200` + the report (ids and counts only).

**Migration `p1_14_outbox_cron`:**
- `order_events.next_attempt_at`, `attempts`, `processed_at`, `last_error` and the unique `dedupe_key` already exist (P1-05, decision A6): do not add them again; add only a partial index on unprocessed rows (`where processed_at is null`).
- `claim_outbox(p_now timestamptz, p_types text[], p_limit int) returns setof public.order_events`: `update … set attempts = attempts + 1, next_attempt_at = p_now + interval '2 minutes' where id in (select id … where processed_at is null and (attempts < 5 or (type = 'order.refund_due' and attempts < 48)) and next_attempt_at <= p_now and type = any(p_types) order by id limit p_limit for update skip locked) returning *` (the attempt limits match `nextAttemptAt`). `complete_outbox`, `fail_outbox` alongside. `notifications_log` already has `shop_id` and the unique `(order_id, channel, template)` (P1-05, decision A6); this migration adds `error_code text null` and a `status` CHECK allowing `sending`, `sent`, `failed`, `skipped` only where P1-05's migration lacks them (grep it first; replace a narrower CHECK in this new migration, never edit P1-05's). `claim_notification(...)` inserts, or flips an existing `failed` row back to `sending`, else returns false. All `set search_path = ''`, `EXECUTE` only for `service_role`.
- `invoke_cron_tick()`: SECURITY DEFINER, `set search_path = ''`, `EXECUTE` revoked from `public, anon, authenticated`; reads Vault secrets `ppos_functions_url` and `ppos_cron_secret` from `vault.decrypted_secrets`; returns without doing anything if either is missing; else `net.http_post(url := <functions url> || '/cron-tick', headers := {content-type, x-cron-secret}, body := '{}')`. Then `cron.schedule('ppos-cron-tick', '* * * * *', 'select public.invoke_cron_tick()')`. **No URL or secret value in any migration.** [H] Verify every name here (Vault view and columns, `net.http_post` parameter names, `cron.schedule` signature, Vault availability) in the official Supabase docs ("Scheduling Edge Functions", pg_net, Vault) with the web reader before writing SQL; record URLs and differences in PROGRESS.md; if the documented approach differs, follow the docs and say so.
- Human, per environment (written into PROGRESS.md as a request, never run by you): create the two Vault secrets (`ppos_functions_url` = the functions base URL reachable **from the database**; `ppos_cron_secret` = the same value as the function secret `CRON_SECRET`).

**Providers** (`_shared/providers/*`, `fetch` injected, fixed hosts, 10 s timeout, errors throw `ProviderError` with the HTTP status only, never the response body). From memory and **UNVERIFIED** [H] — confirm on twilio.com / resend.com docs and record URLs: Twilio SMS `POST https://api.twilio.com/2010-04-01/Accounts/<sid>/Messages.json` (form fields `To`, `From`, `Body`; Basic auth sid:token; id in `sid`); Twilio voice `…/Calls.json` (`To`, `From`, `Twiml` = `<Response><Say language="en-GB">…</Say><Pause length="1"/><Say language="en-GB">…</Say></Response>`, text XML-escaped); Resend `POST https://api.resend.com/emails` (Bearer key; JSON `from`, `to`, `subject`, `html`, `text`, reply-to; `Idempotency-Key` header; id in `id`). `ukPhoneToE164(input)` = `normaliseUkPhone(input)` (P1-08) with the leading `0` replaced by `+44`, `null` when it does not normalise: `'0161 496 0000'` → `+441614960000`, `'07700 900123'` → `+447700900123`, `'118 118'` → `null`. `isUkMobile` is P1-08's (`^07\d{9}$` after normalising); keep it unchanged.

## Acceptance

Session A: only `docs/takeaway/acceptance-proposals/P1-14/*` + PROGRESS.md changed; guards exit 0; `pnpm acceptance:try P1-14` fails only on missing modules; guard traps: `grep -nE "[\"'](jsr|npm):" docs/takeaway/acceptance-proposals/P1-14/*.ts | grep -vE "(jsr|npm):@?[^@\"'/]+(/[^@\"'/]+)?@[0-9]+\.[0-9]+\.[0-9]+"` and `grep -nE 'stripe(Account|Context)\s*:' docs/takeaway/acceptance-proposals/P1-14/fakes.ts` → each no output; CASES.md covers (all with `now = 2026-11-02T18:07:00Z`, literal dates; default `alertPhone` `07700 900123`, `acknowledgedAt` null):
- **T01–T06 outbox:** only registered types are claimed; success → `complete`; failures with `attempts` 1, 2, 3, 4 → next attempt `18:08:00Z`, `18:09:00Z`, `18:11:00Z`, `18:15:00Z`; attempts 5 → `null`, `dead` 1; `order.refund_due` with attempts 5 → `18:23:00Z` (not dead), attempts 7 → `19:07:00Z`, attempts 48 → `null`, `dead` 1 and `refundDueDead` 1; two handlers on one type, second throws → row failed, first handler's `notifications.claim` blocks a resend on retry.
- **T07–T16 escalation:** SMS: `placedAt 18:06:00Z` → one SMS to `+447700900123` (`escalation_sms`); `18:06:01Z` → no SMS; `acknowledgedAt 18:06:30Z` → no SMS; second tick → no second SMS (claim false). Call: `placedAt 18:05:00Z` → one call to `+447700900123` (`escalation_call`), also when acknowledged; `18:05:01Z` → no call; second tick → no second call. Both: `alertPhone` `0161 496 0000` or null → one `skipped` row per channel with `NO_ALERT_MOBILE` and no provider call; unpaid or accepted → no SMS, no call; at or past the auto-reject limit → no SMS, no call.
- **T17–T21 auto-reject:** limit 8, `placedAt 17:59:00Z` → reject with `auto_timeout`, both outbox events, `processRefundDue` once; `17:59:01Z` → none; limit 5 uses 5; `applyTransition` false (accepted meanwhile) → no refund call; refund throws → tick still succeeds.
- **T22–T26 expiry:** `checkoutExpiresAt 18:02:00Z` + `open` → expire then transition; `18:02:01Z` → nothing; `expired` → transition only; `complete` → nothing; no session id → transition.
- **T27 isolation:** escalation dependency throws → outbox, auto-reject and expiry still run; `errors` = `[{ step: 'escalation', code: <name> }]`.
- **T28–T30 HTTP (`http.acceptance.test.ts`):** wrong or missing `x-cron-secret` → 401 and `run` not called; GET → 405; correct secret → 200 with the report from `run(clock())`.

Session B (B1: 1, the golden and own tests of its files from 2, 4; B2: the rest):
1. `pnpm acceptance:install P1-14` → installed; first run fails on missing modules (paste it)
2. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts') && deno test --allow-env --allow-net --allow-read` → green, incl. provider tests (URL, method, auth header shape, encoded body, timeout → `ProviderError`), handler tests (dispute SMS text; landline or missing `alert_phone` → SMS `skipped`, email still sent; dispute date `10 Nov 2026` for `evidenceDueBy` 1794268800, i.e. 2026-11-10T00:00:00Z; `refund-due` passes `{ orderId: row.orderId, initiatedBy, reasonCode }` to `processRefundDue`; `initiatedBy: 'someone'` → throws `BAD_PAYLOAD`, no Stripe call) and `stripe-gateway` tests (retrieve and expire use `onAccount(account…)` scopes)
3. `supabase db reset && supabase test db` → green: `claim_outbox` (claims, skips locked/processed/dead, lease; a normal row with `attempts` 5 is not claimed, an `order.refund_due` row with `attempts` 5 is), `claim_notification` (dup → false, failed → true), cron job `ppos-cron-tick` exists with `* * * * *`, `invoke_cron_tick()` with no Vault secrets returns without error, anon/authenticated cannot execute any of these (`42501`), no `http://`/`https://` literal in `cron.job.command`
4. `pnpm --filter @ppos/core test` → the `ukPhoneToE164` examples above pass, and P1-08's `isUkMobile` tests stay green
5. `git diff --exit-code main...HEAD -- docs/takeaway/acceptance` → exit 0 (three dots: only this branch's changes); `node scripts/guards/run-all.mjs` → exit 0; `pnpm verify` → exit 0
6. Human check (write the request into PROGRESS.md): local Vault secrets created by the human → `select * from cron.job_run_details order by start_time desc limit 3` shows runs, and the function log shows `200`

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths of the current session changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, Supabase/Twilio/Resend/Stripe facts verified with URLs or SDK file + line, the human's Vault/secret steps; `## Follow-ups`: "P1-20 monitoring: alert on any `order.refund_due` row with `processed_at is null` older than 30 minutes")
- [ ] PR opened with the template (session A: then stop)

## Stop and escalate if

- The documented Supabase way to call a function from pg_cron needs a secret or URL in the migration, or Vault is unavailable: describe the options in `## Blockers`; never commit a value.
- Twilio or Resend docs differ from the shapes above in a way that changes the interfaces.
- A frozen test contradicts this card, or the same failure survives 3 attempts.
- `shops.alert_phone` (P1-05) or `orders.acknowledged_at` (P1-13) does not exist in `supabase/migrations` (`grep -rn`), or P1-08's `isUkMobile` is missing: do not add them here.

## Hints (verified facts / pitfalls)

- [H] Not in stripe-endive.md: `getCheckoutSessionStatus` = `getStripe().checkout.sessions.retrieve(sessionId, undefined, onAccount(account))` → `session.status` (`'open' | 'complete' | 'expired'`, plus `OtherString`); `expireCheckoutSession` = `getStripe().checkout.sessions.expire(sessionId, undefined, onAccount(account, 'expire-' + sessionId))`. Confirm both signatures in `esm/resources/Checkout/Sessions.d.ts` of stripe@23.0.0 (`deno info` shows the npm cache, stripe-endive §1) and with `deno check`; record file and line in PROGRESS.md (if the types differ from this hint, the types win: follow them and record the difference). If `expire` throws `StripeInvalidRequestError` (the session is no longer open), re-read the status and transition only if it is `expired`; `complete` → skip (the payment webhook decides).

- Pure rules in `rules.ts` take `now` and one order and return a decision; `tick.ts` only wires them. Index: `Deno.serve(createCronHandler({ secret: () => env.CRON_SECRET, clock: () => new Date(), run }))`.
- Constant-time compare: hash both strings with SHA-256 (SubtleCrypto) and compare the digests byte by byte without early exit.
- `notifications_log.recipient` holds the phone/email; the message body is never stored.
- pre-bash hook: you cannot run `supabase secrets set`, print `$CRON_SECRET`, or read `.env*`; the end-to-end cron run is a human check.

## Open questions for the planner

None open. Resolved: SMS and calls go to `shops.alert_phone`, skipped when it is missing or not a UK mobile (decisions A6, C13); the owner SMS is only the 60-s escalation (A15); the `order.disputed` merchant handler is registered here (A15); `order.refund_due` retries for about 42 h instead of 15 min (money safety; architecture §8 "cron-tick retries failures").
