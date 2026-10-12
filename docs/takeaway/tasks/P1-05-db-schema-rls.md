# P1-05 — Database schema v1 + RLS + pgTAP tests

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P0-02, P1-02 |
| Mode | `tests-first` (session A writes pgTAP proposals, human freezes, session B writes migrations) |
| Reasoning effort | `max` (security / RLS) |
| Model | `glm-5.3` (never Flash) |
| Session budget | Session A ≤ 3 h, session B ≤ 4 h. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | proposals (tests-first) → after freeze: `docs/takeaway/acceptance/P1-05/` |

## Goal

The platform database exists as append-only migrations: every phase-1 table of architecture §7, multi-tenant Row Level Security that is default-deny, the helper functions every later policy uses, the per-shop order-number counter, the allergen publish gate, the shop-column guard and the go-live check (`shops_go_live_check`) as database triggers, a fake seed, and generated TypeScript types. A frozen pgTAP suite proves every policy both ways, so a later migration cannot silently open a cross-shop leak.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §4, §6, §7 (all), §8 (generated types), §13, §14
- `docs/takeaway/reference/stripe-endive.md` §2 item 15, §4 (sync table), §7 (dedupe SQL)
- `docs/takeaway/reference/uk-compliance.md` UKC-ALG-01/02, UKC-VAT-01, UKC-ID-02, UKC-ID-05, UKC-AGE-03
- `docs/takeaway/adr/0001-migrations.md`, `docs/takeaway/acceptance/P0-02/rls_enabled.test.sql`
- `docs/takeaway/03-execution-handbook.md` §F.1

## Out of scope

- `shop_domains` (phase 2), `print_jobs` (P2; CloudPRNT is P2), `rate_limits` (P1-11), Storage buckets (P1-07), price and allergen audit triggers and the `set_item_sold_out` RPC (P1-07), settings RPCs and identity validation (P1-08), Stripe account creation/sync and the platform-admin "Go live" button (P1-09; the `shops_go_live_check` trigger itself belongs to this card), Realtime publication (P1-13), auth users in the seed (P1-06).
- Edge functions, UI, any change to the CRM database or root `*.sql` files.

## Deliverables

| Path | Action | Session |
|---|---|---|
| `docs/takeaway/acceptance-proposals/P1-05/proposal.json` | create | A |
| `docs/takeaway/acceptance-proposals/P1-05/p1_05_{schema,rls_anon,rls_members,rls_admin_service,triggers,order_number}.test.sql` | create (6 files) | A |
| `docs/takeaway/acceptance-proposals/P1-05/CASES.md` | create (one row per assertion group + open questions) | A |
| `supabase/migrations/<ts>_p1_05_tables.sql`, `<ts>_p1_05_functions_triggers.sql`, `<ts>_p1_05_rls.sql` | create with `pnpm exec supabase migration new` (each < 300 lines; split further if needed) | B |
| `supabase/seed.sql` | modify (fake data only) | B |
| `packages/core/src/db/database.types.ts` | generate | B |
| `packages/core/src/index.ts` | modify: `export type { Database } from './db/database.types'` (import-extension style per P0-01) | B |
| `eslint.config.js` (+ `.prettierignore` if present) | check only: P0-01 already ignores `packages/core/src/db/database.types.ts`; add the entry to the config's ignore list only if missing (never inline disables) | B |

`proposal.json`: `{ "command": "supabase test db", "files": [ { "file": "p1_05_schema.test.sql", "dest": "supabase/tests/acceptance/p1_05_schema.test.sql" }, … one entry per file … ] }`. Every `dest` sits directly in `supabase/tests/acceptance/`.

## Spec

### Session steps

- **Session A** (branch `task/P1-05-tests`): write the proposal files only (no migrations). With the local stack running (`pnpm exec supabase start`), run `pnpm acceptance:try P1-05` and paste the output into PROGRESS.md and the PR description. The first error of every file must be `relation "public.…" does not exist` or `function public.… does not exist`, never a syntax error or a missing pgTAP function such as `plan` (`supabase test db` stops each file at its first error, so read the rest of each file once more for syntax). Also run `grep -nE '(^|[^a-z_])(skip|todo)[[:space:]]*\(' docs/takeaway/acceptance-proposals/P1-05/*.sql` → no output (the guard's pgTAP `skip()`/`todo()` rule only scans `supabase/tests/**`, not the proposal directory). Commit `test(P1-05): propose acceptance tests`, push, PR "P1-05 acceptance proposals (for human review)", update PROGRESS.md, stop.
- **Human**: review the matrix coverage in CASES.md (optionally run the read-only review prompt `docs/takeaway/prompts.md` §3b), `node scripts/acceptance/freeze.mjs P1-05`, commit, label `protected-change-approved`, merge.
- **Session B** (fresh, branch `task/P1-05-schema`): `pnpm acceptance:install P1-05`, write the migrations until the suite is green.

### Schema rules (on top of architecture §7 names)

- UUID PKs `default gen_random_uuid()`; `created_at`/`updated_at timestamptz not null default now()` + the P0-02 `set_updated_at()` trigger on every mutable table. Money `integer` `*_pence` with `CHECK (… >= 0)`. Our own statuses are `text` + `CHECK`; Stripe-owned values (`card_payments_status`, `disabled_reason`, `dispute_status`) are plain `text`.
- `shops` adds `phone` (public), `alert_phone` (UK mobile for staff SMS/voice; never granted to anon), `email`, `address_line1`, `address_line2`, `city`, `legal_form text null CHECK (legal_form in ('sole_trader','partnership','limited_company','llp','other'))`, `registered_office_address text null`, `registered_in text null CHECK (registered_in in ('england_wales','scotland','northern_ireland'))`, `late_night_licence_confirmed_at timestamptz null` (UKC-AGE-03; P1-08 writes it); defaults `status 'draft'`, `timezone 'Europe/London'`, `prep_time_minutes 20` (0..240), `busy_extra_minutes 0` (∈ 0,10,20,30), `ordering_paused false`, `auto_reject_after_minutes 8` (2..60), `service_fee_pence 45`; `slug` matches `^[a-z0-9]+(-[a-z0-9]+)*$`.
- `orders`: `number int not null`, `unique (shop_id, number)`; `public_token uuid unique default gen_random_uuid()`; `customer_name/phone/email`; `items_subtotal_pence, discount_pence, delivery_fee_pence, service_fee_pence, tip_pence, total_pence, application_fee_pence`; `CHECK (total_pence = items_subtotal_pence - discount_pence + delivery_fee_pence + service_fee_pence + tip_pence)`; `refunded_pence` default 0, `CHECK (refunded_pence between 0 and total_pence)`; status / payment_status CHECK lists = `ORDER_STATUSES` / `PAYMENT_STATUSES` of P1-02; defaults `pending_payment` / `unpaid`; `checkout_attempt` default 1.
- `notifications_log` gets `shop_id` and `unique (order_id, channel, template)`. `order_events`: `dedupe_key text not null unique`, `next_attempt_at timestamptz not null default now()`, `attempts int not null default 0`, `processed_at timestamptz null`, `last_error text null`. `order_items.vat_category_snapshot text not null` with the same CHECK as `menu_items.vat_category`. New table `shop_counters (shop_id uuid PK → shops, last_order_number int not null default 0)`.
- **Tenant-safe foreign keys:** parents get `unique (id, shop_id)`; children reference `(parent_id, shop_id)` so a row can never point at another shop's parent: items→categories, groups→items, options→groups, order_items/refunds/order_events/notifications_log/platform_fee_ledger→orders.
- `allergens jsonb not null default '{}'` on items and options with `CHECK (public.allergens_valid(allergens))`. `vat_category` CHECK, default `hot_standard`. `dietary_tags text[] not null default '{}'`. Groups: `min_select >= 0`, `max_select >= 1`, `max_select >= min_select`. `opening_hours.weekday` 1..7. `closures`: `ends_at > starts_at`. Zones: `postcode_districts` needs a non-empty array, `radius` needs `radius_m > 0`; threshold null or ≥ 1. `refunds.initiated_by` CHECK per §7, `amount_pence > 0`.

### Functions (all in `public`, `set search_path = ''`, fully qualified names inside)

| Function | Kind | Behaviour |
|---|---|---|
| `is_platform_admin()` | SECURITY DEFINER, STABLE | `auth.uid()` is in `platform_admins` |
| `is_shop_member(p_shop_id uuid, p_min_role text)` | SECURITY DEFINER, STABLE | caller's role in the shop ≥ `min_role` (owner > manager > staff); unknown `min_role` → raise `22023` |
| `is_shop_public(p_shop_id uuid)` | SECURITY DEFINER, STABLE | shop `status = 'live'` (used by anon policies) |
| `allergens_valid(jsonb)` / `allergens_complete(jsonb)` | IMMUTABLE | valid = object whose keys ⊆ the 14 keys and values ∈ `contains`/`may_contain`/`free`; complete = valid and all 14 present |
| `next_order_number(p_shop_id uuid) returns int` | SECURITY INVOKER; `EXECUTE` revoked from `public, anon, authenticated`, granted to `service_role` | `insert … on conflict (shop_id) do update set last_order_number = last_order_number + 1 returning …`; first call 1, then 2…; per shop; row lock serialises concurrent callers |

### Triggers

| Trigger | Rule | Error |
|---|---|---|
| `shops_guard_update` (BEFORE UPDATE on `shops`; function SECURITY INVOKER) | When `current_user` is `authenticated` and not `is_platform_admin()`: only `name, phone, email, address_line1, address_line2, city, postcode, lat, lng, legal_name, company_number, vat_number, fhrs_id, collection_enabled, delivery_enabled, prep_time_minutes, busy_extra_minutes, ordering_paused, alert_phone, legal_form, registered_office_address, registered_in, late_night_licence_confirmed_at` may change. `service_role`/`postgres` are not restricted. | SQLSTATE `42501`, message starts `shops.<column>` |
| `shops_go_live_check` (BEFORE INSERT OR UPDATE OF `status` on `shops`, for every role including `service_role`/`postgres`; function SECURITY DEFINER with `set search_path = ''`, so RLS on `stripe_accounts` never hides the row) | Runs when the new status is `live` and (`INSERT`, or `old.status` is not `live`). Collects, in this order: `LEGAL_NAME_MISSING`, `LEGAL_FORM_MISSING`, `ADDRESS_MISSING` (`address_line1`), `CITY_MISSING`, `POSTCODE_MISSING`, `EMAIL_MISSING`, `PHONE_MISSING`; when `legal_form` is `limited_company` or `llp` also `COMPANY_NUMBER_MISSING`, `REGISTERED_OFFICE_MISSING`, `REGISTERED_IN_MISSING`; and `PAYMENTS_NOT_READY` unless a `stripe_accounts` row of the shop has `charges_enabled = true`, `card_payments_status = 'active'` and `deauthorized_at is null`. Missing = null or `btrim(value) = ''`. Raises when any code was collected. P1-08's `goLiveIdentityProblems` returns the same identity codes | `23514`, message `shop not ready to go live: <codes joined by ', '>` |
| `menu_items_publish_gate` (BEFORE INSERT OR UPDATE) | `is_published = true` requires `allergens_complete` on the item and on every option of every group of the item | `23514`, message contains `allergens` |
| `modifier_options_publish_gate` (BEFORE INSERT OR UPDATE) and `modifier_groups_publish_gate` (BEFORE UPDATE OF item_id) | an option that is incomplete may not belong to a published item | `23514` |

### RLS matrix (FROZEN for P1; S select, I insert, U update, D delete, — nothing)

"—" means: `anon` gets a privilege error `42501` (table privileges revoked); `authenticated` sees 0 rows, inserts fail with `42501`, updates/deletes change 0 rows.

| Table | anon | authenticated non-member, or member of another shop | staff (own shop) | manager (own) | owner (own) | platform admin | service_role |
|---|---|---|---|---|---|---|---|
| `shops` | S live rows; columns: id, slug, name, status, timezone, phone, email, address_line1, address_line2, city, postcode, lat, lng, legal_name, company_number, vat_number, fhrs_id, collection_enabled, delivery_enabled, prep_time_minutes, busy_extra_minutes, ordering_paused, service_fee_pence, legal_form, registered_office_address, registered_in (NOT `alert_phone`, `crm_customer_id`, `late_night_licence_confirmed_at`) | — | S | S U (trigger whitelist) | S U (whitelist) | S I U | all |
| `shop_members` | — | S own rows only | S own row | S own row | S all rows of shop; D rows with role ≠ owner | S I U D | all |
| `platform_admins` | — | S own row | S own row | S own row | S own row | S | all |
| `platform_settings` | — | — | — | — | — | S I U | all |
| `menu_categories` | S live shop, `is_visible`, not archived | — | S | S I U | S I U | S I U D | all |
| `menu_items` | S live shop, `is_published`, not archived | — | S | S I U | S I U | S I U D | all |
| `modifier_groups`, `modifier_options` | S when the parent item is anon-visible | — | S | S I U D | S I U D | S I U D | all |
| `opening_hours`, `closures`, `delivery_zones` | S live shop | — | S | S I U D | S I U D | S I U D | all |
| `orders`, `order_items`, `refunds` | — | — | S | S | S | S | all |
| `stripe_accounts`, `audit_log` | — | — | — | S | S | S | all |
| `order_events`, `stripe_events`, `platform_fee_ledger`, `notifications_log`, `shop_counters` | — | — | — | — | — | S | all |

Write policies `to anon` or `to authenticated` explicitly, using `is_shop_member(shop_id, '<role>') or is_platform_admin()`. Anon gets column-level `grant select (…)` on `shops`, SELECT-only on the public tables, and nothing else.

### Seed (`supabase/seed.sql`, fake data, fixed UUIDs)

`platform_settings` `default_service_fee_pence = 45`; shop `demo-chippy` (fake Manchester address, postcode `M14 5AA`, lat 53.4500, lng −2.2300, full legal identity: `legal_name`, `legal_form 'sole_trader'`, `email`, `phone '0161 496 0000'`, `alert_phone '07700 900123'` — Ofcom drama-range numbers) inserted as `draft`, then its `stripe_accounts` row (`acct_demo0001`, `charges_enabled true`, `card_payments_status 'active'`), menu (2 categories, 4 published items with complete allergens, one group "Size" min 1 max 1 with 2 options, one unpublished item with `{}` allergens), DAILY hours 17:00–23:00 for both fulfilments, zones (district `M14, M13` fee 250 min 1200 priority 1; radius 3000 fee 350 min 1500 priority 2), **then** `update … set status = 'live'` (this order is what `shops_go_live_check` requires); shop `draft-diner` stays `draft`. No orders, no auth users.

### Required test content (session A)

Each file: `begin; create extension if not exists pgtap with schema extensions; select plan(n); <own fixture>; … select * from finish(); rollback;` (the first two lines as in P0-02's `rls_enabled.test.sql`). Fixture: shops A (live), B (live), C (draft). `shops_go_live_check` rejects `live` unless the shop has a ready `stripe_accounts` row and a complete legal identity, so every fixture must already satisfy it: insert each shop as `status 'draft'` with `legal_name`, `legal_form 'sole_trader'`, `address_line1`, `city`, `postcode`, `email`, `phone` set; then insert its `stripe_accounts` row (`stripe_account_id` `'acct_testA'` / `'acct_testB'` / `'acct_testC'`, `charges_enabled true`, `card_payments_status 'active'`); then, as `postgres`, `update public.shops set status = 'live' where id in (<A>, <B>)`. Never insert a shop with status `live` directly. Build the shops through one helper per file (e.g. `create function pg_temp.make_ready_shop(p_id uuid, p_slug text) …`, called as `postgres` and rolled back with the file). C gets the same identity and stripe row, so the admin go-live test on C succeeds. Users inserted into `auth.users (id, email)`: ownerA, managerA, staffA, staffB (member of B), outsider, admin (row in `platform_admins`); one order per shop. Never rely on seed rows (CI loads the seed): always filter by fixture ids.
Minimum assertions: every non-"—" cell has an allow test and every table has a deny test for anon, staffB→A and outsider; plus: anon `select crm_customer_id from shops`, `select alert_phone from shops` and `select late_night_licence_confirmed_at from shops` → each `42501`; anon cannot see C, unpublished/archived items, hidden categories, options of unpublished items; staffA cannot change a price (row unchanged afterwards); managerA cannot insert an item with `shop_id` B (`42501`) nor an option of B's group with `shop_id` A (`23503`); managerA updating `service_fee_pence`, `status → 'paused'` (A is already live, so `'live'` would be no change), `crm_customer_id`, `slug` each `42501`; managerA updating `prep_time_minutes`, `alert_phone`, `legal_form`, `registered_office_address`, `registered_in`, `late_night_licence_confirmed_at` each succeeds; ownerA deletes staffA's membership but not her own owner row; admin reads both shops' orders and sets C's status to `live`; anon/authenticated `select next_order_number(A)` → `42501`; service_role gets 1, 2, 3 for A and 1 for B; duplicate `(shop_id, number)` → `23505`; publish gate: 13 keys → `23514`, value `'maybe'` → `23514`, an option missing a key → `23514`, complete → succeeds, adding an incomplete option to a published item → `23514`; editing an option of a published item so it loses a key → `23514`; moving an incomplete option under a published item's group (`update modifier_options set group_id = …`) → `23514`; moving a group that holds an incomplete option to a published item (`update modifier_groups set item_id = …`) → `23514`; editing a published item's own allergens so it loses a key → `23514`; the same edits on an unpublished item succeed; go-live (in `p1_05_triggers.test.sql`, as `postgres`): a draft shop D with complete identity and no `stripe_accounts` row → `23514` with `PAYMENTS_NOT_READY` in the message; then a row with `charges_enabled false` → `23514`; `card_payments_status 'pending'` → `23514`; `deauthorized_at` set → `23514`; ready row but `phone` null → message contains `PHONE_MISSING`; `legal_form` null → `LEGAL_FORM_MISSING`; `legal_form 'limited_company'` without `registered_office_address` → `REGISTERED_OFFICE_MISSING`; inserting a new shop directly as `live` → `23514`; complete → succeeds; after setting A's `charges_enabled = false`, managerA updating A's `prep_time_minutes` still succeeds (the check fires only on a change to `live`); a duplicate `order_events.dedupe_key` → `23505`; a duplicate `(order_id, channel, template)` in `notifications_log` → `23505`; `updated_at` advances on update; CHECKs reject negative price, unknown status, weekday 8, wrong order total, `legal_form 'plc'`, `registered_in 'wales'` (`23514`); defaults: `allergens '{}'`, `service_fee_pence 45`, `auto_reject_after_minutes 8`.

## Acceptance

Session A: `git diff --name-only main...HEAD` → only `docs/takeaway/acceptance-proposals/P1-05/*` + `docs/takeaway/PROGRESS.md`; `node scripts/guards/run-all.mjs` → exit 0; `pnpm acceptance:try P1-05` output pasted (each file fails only on a missing relation/function of this card, never on syntax or a missing pgTAP function); the `grep` for `skip(`/`todo(` from Session steps prints nothing; afterwards `git status --porcelain supabase` → empty.

Session B:
1. `pnpm exec supabase db reset` → migrations and seed apply with no error
2. `pnpm acceptance:install P1-05` → 6 files installed in `supabase/tests/acceptance/`
3. `pnpm exec supabase test db` → all files pass, including P0-02's `rls_enabled.test.sql`
4. `pnpm exec supabase db lint --level error` → no errors
5. `pnpm exec supabase gen types typescript --local > packages/core/src/db/database.types.ts && git diff --exit-code packages/core/src/db/database.types.ts` → exit 0 (committed types are current)
6. `git diff --exit-code main -- docs/takeaway/acceptance` → exit 0 (installed copies are checked by the acceptance-integrity guard); `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths of the current session changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template (session A: then stop)

## Stop and escalate if

- A matrix cell seems wrong for a later card's needs, or architecture §7 lacks a column you need: write it under `## Blockers`; do not invent policies.
- `auth.uid()` does not read `request.jwt.claims` in the local stack, or inserting into `auth.users` needs columns you cannot fill: record the exact error.
- Session B: a frozen test looks wrong, or the same failure survives 3 attempts.

## Hints (verified facts / pitfalls)

- Impersonation in pgTAP: `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';` … `reset role;`. Anon: `set local role anon;`. Service: `set local role service_role;`. [H] Confirm `auth.uid()` reads it before writing 200 assertions.
- An RLS-hidden UPDATE/DELETE is not an error. Run it with `lives_ok`, then `reset role` and assert with `is()` that the row is unchanged. A data-modifying `WITH` cannot be wrapped inside `results_eq` (cursors forbid it).
- Supabase grants `anon`/`authenticated` table and function privileges by default. Revoke explicitly where the matrix says "—" for anon, and revoke `EXECUTE` on `next_order_number`.
- With column grants, anon `select *` on `shops` fails: the storefront must list columns (P1-10).
- The P0-02 golden test fails if any SECURITY DEFINER function lacks `set search_path`. Prefix parameters with `p_` so they never collide with column names such as `shop_id`.
- Postgres fires BEFORE triggers of the same event in alphabetical order of trigger name, so `shops_go_live_check` runs before `shops_guard_update`. Test the guard with a status change that is not `live` (e.g. `'paused'`), so the result does not depend on that order.
- pgTAP: assert the SQLSTATE with `throws_ok(<sql>, '23514')` and the go-live reason with `throws_like(<sql>, '%PHONE_MISSING%')`.
- P1-07, P1-08, P1-09, P1-18 and every later pgTAP fixture that needs a live shop uses the same order: draft with complete identity → ready `stripe_accounts` row → `update … set status = 'live'`.
