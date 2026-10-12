# P1-18 — Reports v1 (daily summary, fees, refunds, CSV)

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-12, P1-15 |
| Mode | `standard` |
| Reasoning effort | `high` |
| Model | `glm-5.3` (never Flash: SQL migration + money) |
| Session budget | ≤ 3 hours wall-clock / one task. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | none (the pgTAP expectations below are literal and mandatory) |

## Goal

Managers and owners see, per day and for any date range, how many paid orders they had, what customers paid (items, delivery, service fee, tips), what was refunded, and what the shop keeps before Stripe's own processing fees, and can download it as CSV for their accountant. The numbers come from one SQL function that runs under the caller's RLS, uses Europe/London calendar days, and reconciles exactly with the platform fee ledger, which is how the pilot proves "0 reconciliation errors".

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §4 (money, `bigint` aggregates), §5 rules 5–8, §6 (`payment_status`), §7 (`orders`, `refunds`, `platform_fee_ledger`), RLS principles, §9 refund policy
- `docs/takeaway/reference/uk-compliance.md` UKC-VAT-04, UKC-DP-02, UKC-PAY-04
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` → functions conventions, RLS matrix, pgTAP impersonation hints
- `docs/takeaway/tasks/P1-12-stripe-webhooks.md` → how `refunded_pence`, `payment_status` and the ledger are written
- `apps/merchant/src/{auth,layout}/*`, `packages/core/src/money.ts`, `packages/ui/src/index.ts` (P0-04)

## Out of scope

- Stripe fees, payouts or balances (read from the shop's own Stripe Dashboard), VAT splits by `vat_category` (UKC-VAT-02 planner gap), item-level or hourly reports, charts, PDF export, scheduled emails.
- A platform-admin finance dashboard (the reconciliation here is a pgTAP test, not a page).
- Any customer personal data in reports or CSV (UKC-DP-02).

## Deliverables

| Path | Action |
|---|---|
| `supabase/migrations/<ts>_p1_18_reports.sql` | create (`pnpm exec supabase migration new p1_18_reports`) |
| `supabase/tests/reports/shop_daily_summary.test.sql` | create (pgTAP, outside `acceptance/`) |
| `packages/core/src/csv.ts`, `packages/core/src/index.ts` (+ `tests/unit/csv.test.ts`) | create / modify: `penceToDecimalString`, `toCsv` |
| `apps/merchant/src/pages/reports/ReportsPage.tsx`, `apps/merchant/src/reports/{useDailySummary,reportCsv}.ts` (+ tests), router, nav | create / modify |
| `apps/merchant/src/i18n/en-GB.ts`, `zh-CN.ts` | modify |
| `packages/core/src/db/database.types.ts` | regenerate |

## Spec

**SQL** `public.shop_daily_summary(p_shop_id uuid, p_from date, p_to date)` — `language plpgsql`, `stable`, **SECURITY INVOKER** (the caller's RLS applies), `set search_path = ''`; `EXECUTE` revoked from `public, anon`, granted to `authenticated`.
1. Unless `public.is_shop_member(p_shop_id, 'manager') or public.is_platform_admin()` → raise SQLSTATE `42501`.
2. `p_from > p_to` or `p_to - p_from > 366` → raise `22023`.
3. Included orders: `shop_id = p_shop_id` and `payment_status <> 'unpaid'`. Day = `(coalesce(placed_at, created_at) at time zone 'Europe/London')::date`. (Late payments that were refunded at once appear with net 0.)
4. Return one row per day from `p_from` to `p_to` (`generate_series`), zeros on empty days, ordered by day:

| Column (`bigint` unless noted) | Value per day |
|---|---|
| `day` (`date`) | the London calendar day |
| `orders_count` | included orders |
| `refunded_orders_count` | included orders with `payment_status = 'refunded'` |
| `items_subtotal_pence`, `discount_pence`, `delivery_fee_pence`, `service_fee_pence`, `tip_pence` | Σ of the order columns |
| `gross_pence` | Σ `total_pence` |
| `refunded_pence` | Σ `refunded_pence` (current value: refunds made later still count on the order's day) |
| `service_fee_refunded_pence` | Σ `application_fee_pence` where `payment_status = 'refunded'` (FROZEN policy: a fully refunded order returns the fee) |
| `net_before_stripe_fees_pence` | `gross − service_fee − refunded + service_fee_refunded` |

**Core.** `penceToDecimalString(pence)`: safe integer → `'18.45'`, `5 → '0.05'`, `0 → '0.00'`, `-120 → '-1.20'`; else `RangeError`; integer arithmetic only (no `/ 100` floats, no `toFixed`). `toCsv(header: string[], rows: (string | number)[][]): string`: RFC 4180 (quote cells containing `,` `"` CR or LF; double inner quotes), CRLF line endings, trailing CRLF; a string cell that starts with `=`, `+`, `-`, `@`, tab or CR and is not a plain number (`^-?\d+(\.\d+)?$`) gets a leading `'` (spreadsheet formula injection).

**Reports page** `/reports` (`RequireRole min="manager"`, nav link "Reports"): date inputs From / To (default: the last 7 London days including today, from an injectable clock; To < From → inline error; > 366 days → inline error, no request). Calls `rpc('shop_daily_summary', { p_shop_id, p_from, p_to })` for the current shop. Shows a totals panel (orders, gross, refunds, service fees net of refunds, net before Stripe fees) and a table with one row per day; money via `formatPence`. Notes under the table (both dictionaries): "Figures are by order date and include refunds made later." and "Stripe's processing fees are not included. You can see them in your Stripe Dashboard." with a link to `https://dashboard.stripe.com/` (no fee figures, UKC-PAY-04). "Download CSV" builds the file client-side with `toCsv` and `penceToDecimalString`, header exactly `date,orders,refunded_orders,items_subtotal,discounts,delivery_fees,service_fees,tips,gross,refunds,service_fees_refunded,net_before_stripe_fees`, then a `Total` row; filename `ppos-report-<slug>-<from>-<to>.csv`; download through `Blob` + `URL.createObjectURL` + a temporary `<a download>` (no `innerHTML`). The CSV has no customer fields (UKC-DP-02). Build the page from `@ppos/ui` components (decision A1); create no base components in `apps/merchant`.

### pgTAP fixture and expected values (all literal)

Shops A and B; users managerA, staffA, staffB, admin (as in P1-05 tests). Orders of A (fee 45 each):

| Order | `placed_at` (UTC) | Fulfilment | items / delivery / tip / total | Payment | `refunded_pence` |
|---|---|---|---|---|---|
| o1 | `2026-10-24T23:30:00Z` (00:30 BST on 25 Oct) | collection | 2000 / 0 / 0 / 2045 | `paid` | 0 |
| o2 | `2026-10-25T12:00:00Z` | delivery | 1500 / 250 / 100 / 1895 | `partially_refunded` | 500 |
| o3 | `2026-10-25T13:00:00Z` | collection | 2000 / 0 / 0 / 2045 | `refunded` | 2045 |
| o4 | `created_at 2026-10-25T14:00:00Z`, `placed_at` null | collection | 900 / 0 / 0 / 945 | `unpaid` (`pending_payment`) | 0 |
| o5 | `2026-10-26T00:30:00Z` (00:30 GMT on 26 Oct) | collection | 900 / 0 / 0 / 945 | `paid` | 0 |

Plus one paid order of shop B on 25 Oct. Ledger rows for o1, o2, o3, o5 (`amount_pence` 45; `refunded_pence` 45 for o3 only).

Expected `shop_daily_summary(A, '2026-10-24', '2026-10-26')` as managerA:
- 24 Oct: all zeros.
- 25 Oct: `orders_count` 3, `refunded_orders_count` 1, items 5500, discount 0, delivery 250, service 135, tips 100, gross 5985, refunded 2545, service fee refunded 45, **net 3350**.
- 26 Oct: orders 1, items 900, service 45, gross 945, refunded 0, net 900.

Also: staffA → `42501`; staffB → `42501`; admin → same rows as managerA; anon → `42501`; `('2026-10-26', '2026-10-24')` → `22023`; `('2026-01-01', '2027-01-03')` → `22023`; **reconciliation (UKC-VAT-04):** for shop A, Σ `service_fee_pence` over the range = Σ ledger `amount_pence` of A's orders (180) and Σ `service_fee_refunded_pence` = Σ ledger `refunded_pence` (45).

## Acceptance

1. `supabase db reset && supabase test db` → green, including every expectation above
2. `supabase db lint --level error` → no errors
3. `pnpm --filter @ppos/core test` → green: `penceToDecimalString` cases above; `toCsv` quotes `Fish, "large"` as `"Fish, ""large"""`, prefixes `=SUM(A1)` with `'`, leaves `-1.20` unchanged, ends with CRLF
4. `pnpm --filter @ppos/merchant test` → green: page renders the fixture rows (25 Oct net `£33.50`); CSV for the fixture equals a literal expected string (header + 3 day rows + `Total` row with net `42.50`); To < From → error and no RPC call; Reports link hidden for staff; `en-GB`/`zh-CN` key sets identical
5. `supabase gen types typescript --local > packages/core/src/db/database.types.ts && git diff --exit-code packages/core/src/db/database.types.ts` → exit 0
6. `node scripts/guards/run-all.mjs` → exit 0 (no `.toFixed`/`parseFloat` in core); `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups), including under `## Follow-ups`: "Accountant to confirm (decision C14): reports use the London day of `coalesce(placed_at, created_at)` and count later refunds on the order's day; the P1-20 runbook §12 records the answer."
- [ ] PR opened with the template; the PR asks the human to open the CSV in a spreadsheet once

## Stop and escalate if

- RLS hides rows a manager should see, or the function would need SECURITY DEFINER to work: do not switch; report the exact case.
- The fixture's expected numbers do not match the money rules in architecture §5/§9 by your own step-by-step calculation: write both calculations under `## Blockers`.
- The accountant-facing meaning of a column is unclear (VAT, fee treatment): keep the column as specified and add the question to PROGRESS.md.

## Hints (verified facts / pitfalls)

- `at time zone 'Europe/London'` on a `timestamptz` gives local wall time; `::date` then gives the London day. 2026-10-25 is the day the clocks go back.
- Use `coalesce(sum(...), 0)::bigint` so empty days return `0`, not `null`; join the day series with a `left join`.
- pgTAP impersonation: `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';` and `reset role;` (P1-05 hints). Insert fixtures as `postgres` before switching role; filter by fixture ids, never rely on seed rows.
- Fixture totals must satisfy the `orders` total CHECK from P1-05 (o2: 1500 + 250 + 45 + 100 = 1895).
