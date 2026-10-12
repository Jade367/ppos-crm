# P1-19 — Security review pass (findings only)

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-01 … P1-18 (all merged to `main`) |
| Mode | `review` — read-only, **run twice independently** (run `a` and run `b`, each in a fresh session from `main`). Writes only its own review file and `PROGRESS.md`. **No code changes.** |
| Reasoning effort | `max` |
| Model | `glm-5.3` (never Flash: security) |
| Session budget | ≤ 4 hours wall-clock per run. If exceeded: commit what you have (marked incomplete), write handoff, stop. |
| Golden tests | none |

## Goal

Before real customers pay real money, two independent reviewers attack the phase-1 platform on paper (and against the local stack only) and report every way someone could read another shop's data, change a price, get food or money they should not, forge or replay a Stripe event, guess a customer's order, abuse a public endpoint, or leak a secret or personal data. Each run produces one evidence-backed findings file. The human merges both runs: findings seen by both are trusted, findings seen once are proved with a failing test first, and every Critical/High becomes a fix card that must be done before P1-20.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §3, §7 (RLS principles), §8 (+ rules under the table), §9, §12
- `docs/takeaway/reference/stripe-endive.md` §2, §3, §6, §7, §8, §13
- `docs/takeaway/reference/uk-compliance.md` UKC-DP-01 … DP-06, UKC-COOKIE-01
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` (RLS matrix = the intended access), `docs/takeaway/03-execution-handbook.md` §F.3
- Code (Grep + ranged Read, ≤ 400 lines per read): `supabase/migrations/**`, `supabase/tests/**`, `supabase/config.toml`, `supabase/functions/**`, `apps/storefront/src/**`, `apps/merchant/src/**`, `packages/core/src/schemas/**`, `vercel.json` files

## Out of scope

- **Any change to code, tests, migrations, config, docs or task cards.** Only the two files in Deliverables. No fix branches.
- Any request to a remote system: no `curl`/`fetch` to Supabase DEV/PROD, Stripe, Twilio, Resend, Vercel, postcodes.io; no `supabase` command with `--linked`/`--project-ref`. The **local** stack (`127.0.0.1`) is allowed for confirming a finding.
- Reading `.env*`, printing secrets or keys (including `supabase status` output), the legacy CRM (`index.html`, root `*.sql`: separate track P0-B*), the other run's review file.
- Exploit code or payloads in the report: describe steps in words; quote our code as evidence.

## Deliverables

| Path | Action |
|---|---|
| `docs/takeaway/reviews/P1-19-security-run-<a\|b>.md` | create (your run's letter only) |
| `docs/takeaway/PROGRESS.md` | edit (`## Current`, `## Done log`) |

## Spec

**Run protocol.** The human starts each run in a new session with the review prompt in `docs/takeaway/prompts.md` §5a (run `a` or `b`; the later merge step uses §5b) and tells you the run letter. Branch `task/P1-19-review-<a|b>` from `main`. Record the reviewed commit (`git rev-parse HEAD`). Do not open or search `docs/takeaway/reviews/P1-19-*` except your own file. Work through the checklist in order; for every area write either findings or "checked, fine" with what you looked at.

**Attack checklist (every area must appear in §4 of your file).**

| # | Area | What to try (on paper; confirm locally when possible) |
|---|---|---|
| 1 | RLS bypass | Every table: RLS enabled? any policy `using (true)` or missing `to <role>`? anon reaching `orders`, `order_items`, `refunds`, `stripe_*`, ledgers, `order_events`, `notifications_log`, `rate_limits`, `audit_log`, `crm_customer_id`? staff of shop A reading/writing shop B (incl. Storage `menu-images` paths)? column grants on `shops`; `shops_guard_update` whitelist (can a manager set `status`, `service_fee_pence`, `slug`?); Realtime channel on `orders` leaking other shops |
| 2 | SECURITY DEFINER & RPCs | every `security definer` has `set search_path = ''`, fully qualified names, minimal `EXECUTE` grants; `apply_order_transition`, `create_pending_order` (and who calls it), `next_order_number`, `claim_outbox`, `complete_outbox`, `fail_outbox`, `claim_notification`, `rate_limit_hit`, `invoke_cron_tick`, `replace_opening_hours`, `shop_daily_summary` callable by anon/authenticated? `set_item_sold_out` (staff may change only `sold_out_until` of items of their own shop); any order-acknowledge RPC or column update used by the 60 s escalation (staff of shop A acknowledging B's orders, or suppressing escalation for orders they cannot see); parameter-driven tenant escape |
| 3 | IDOR via ids in bodies | `merchant-order-action`, `refund-order`, `connect-onboarding`, `platform-invite`: is membership checked in SQL with the caller's JWT for the shop **of the loaded row**, never a `shop_id` from the body? 403 vs 404 enumeration; service-role client used before the check |
| 4 | Webhook signature & replay | raw body before verification; `constructEventAsync` with the right secret per endpoint; no tolerance `0`; `verify_jwt = false` only where intended; replayed or reordered events; events for an account that does not own the order; `metadata`-only lookups; `v2.` payloads |
| 5 | Idempotency & double money | double refund (concurrent `refund-order`, reject + auto-reject + late payment), idempotency key derivation, `refunded_pence` absolute writes, outbox `dedupe_key`, notifications sent twice, `checkout_attempt` reuse |
| 6 | Price tampering | can the client influence any amount (prices, options, delivery fee, service fee, tip bounds, quantities 0/100, negative, duplicates, options of another item/shop, sold-out/unpublished items, zone choice, `expectedTotalPence`)? Stripe line items vs `orders.total_pence` vs `application_fee_amount` |
| 7 | Public token guessing | `public_token` generation (`gen_random_uuid()`), `order-status` response fields (no PII, UKC-DP-05), timing/enumeration differences, rate limit, tokens in logs or URLs sent to third parties |
| 8 | Rate limiting & abuse | `create-checkout`, `order-status` limits: IP source header trust, bypass via header spoofing, unbounded table growth, cost amplification (Stripe sessions, SMS/voice/email triggers, postcodes.io calls per request), lines/options size limits |
| 9 | Secrets in the client bundle | `pnpm --filter @ppos/storefront build` and `pnpm --filter @ppos/merchant build` locally, then the **bundle scan** command below (file names only); `VITE_*` usage |
| 10 | XSS & injection | email/SMS/TwiML templates (escaping of shop and item names, notes, allergy note); React escape hatches; ticket page; CSV formula injection; SQL built by string concatenation in functions; `Twiml` XML escaping |
| 11 | SSRF & outbound calls | postcodes.io URL built only from a normalised postcode; provider hosts fixed; no user-controlled URL fetched; `success_url`/`cancel_url`/Account Link URLs built from env, not input (open redirect) |
| 12 | CORS & headers | `corsHeaders` echoes only exact allowed origins, never `*`; preflight; credentials; `vercel.json` security headers (CSP, `frame-ancestors`, `Referrer-Policy`) present or missing |
| 13 | AuthN/AuthZ in functions | `verify_jwt` per function in `config.toml`; `requireUser` before any work; `x-cron-secret` constant-time compare; platform-admin checks; invite flows (role escalation via `invite_member`) |
| 14 | Data protection & logging | `console.*` with customer fields or payloads; error bodies echoing input; `stripe_events.error`, `order_events.last_error`, `notifications_log` contents; `allergy_note` handling (UKC-DP-02, -04) |
| 15 | Supply chain & config | exact pins (`npm:stripe@23.0.0`, lockfile), `deno.json` imports, approved deps only, `.gitignore` covers env files, no secrets committed in any revision: the **history scan** command below (`rev:path` only) |

**Secret scans (areas 9 and 15; copy exactly).** Never run a command that prints matching lines (`grep` without `-l`, `git log -p | grep`, `git show`), and never open a listed file around the match: the value would enter your context and the provider's logs (AGENTS.md §4).
- Bundle scan (area 9): `grep -rlE 'sk_(live|test)_|rk_(live|test)_|whsec_|sb_secret_|service_role|STRIPE_|TWILIO_|RESEND_|CRON_SECRET' apps/storefront/dist apps/merchant/dist` → file names only. The patterns stop at the prefix, so `grep -rhoE '<same pattern>' <listed files> | sort | uniq -c` may count which prefixes occur. Report prefixes and file names, never a value. A listed file containing `sk_`, `rk_`, `whsec_` or `sb_secret_` → Stop and escalate.
- History scan (area 15): `git grep -lE 'sk_(live|test)_[A-Za-z0-9]{8,}|rk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|sb_secret_[A-Za-z0-9]{8,}|eyJ[A-Za-z0-9_-]{20,}' $(git rev-list --all) -- apps packages supabase e2e scripts docs .github` → `rev:path` only (the legacy CRM paths are out of scope). A listed path → record only `rev:path` under `## Blockers`, then Stop and escalate.

**Severity:** Critical = unauthenticated read/write of orders, customer data or money movement, or secret exposure; High = cross-shop access, price/refund manipulation by an authenticated user, webhook forgery/replay with effect; Medium = needs another flaw, insider, or only DoS/cost; Low/Info = hardening.

**Report format** (`P1-19-security-run-<x>.md`, English except §0):
- `## 0. Owner summary` — Simplified Chinese, ≤ 15 lines: what is most dangerous, what must be fixed before go-live.
- `## 1. Scope and method` — commit hash, files and areas read, commands run (with exit codes), local confirmations, time spent.
- `## 2. Findings` — table `| ID | Severity | Area (#) | Title | Evidence (file:line) | Status | Confidence |`; IDs `SEC-<x>-01`, …; Status `Confirmed` (you read the lines this session; add "reproduced locally" if you did) or `Inferred`; Confidence High/Medium/Low.
- `## 3. Finding details` — per ID: exploit scenario in 2–4 numbered steps (who sends what, what they gain), the quoted code (≤ 15 lines), why existing tests miss it, a fix suggestion, and a **regression test idea** (pgTAP or deno test, described in words).
- `## 4. Checklist results` — one row per area 1–15: `fine` / `findings: SEC-…` / `not checked (why)`.
- `## 5. Could not check` — e.g. live Supabase/Stripe settings, Vercel headers in production, Realtime under load.

## Acceptance

1. `git diff --name-only main...HEAD` → only `docs/takeaway/reviews/P1-19-security-run-<x>.md` and `docs/takeaway/PROGRESS.md`
2. `for h in '## 0. Owner summary' '## 1. Scope and method' '## 2. Findings' '## 3. Finding details' '## 4. Checklist results' '## 5. Could not check'; do grep -q "^$h" docs/takeaway/reviews/P1-19-security-run-<x>.md || echo "MISSING $h"; done` → no output
3. `grep -cE '^\| ([1-9]|1[0-5]) \|' docs/takeaway/reviews/P1-19-security-run-<x>.md` → ≥ `15` (every checklist area has a row in §4)
4. `grep -E '^\| SEC-[ab]-[0-9]{2} ' docs/takeaway/reviews/P1-19-security-run-<x>.md | grep -E '\| (Critical|High) \|' | grep -vc '| Confirmed |'` → `0` (no Critical/High without reading the code)
5. `grep -nE 'sk_(live|test)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|sb_secret_|eyJ[A-Za-z0-9_-]{20,}|supabase\.co' docs/takeaway/reviews/P1-19-security-run-<x>.md` → no output
6. `node scripts/guards/run-all.mjs` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `node scripts/guards/run-all.mjs` exits 0 (`pnpm verify` is not required: you changed no code)
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log; `## Current` tells the human the run is finished and how many Critical/High findings it has)
- [ ] PR opened with the template, titled "P1-19 security review run <x>"; then stop

## Stop and escalate if

- You find a real secret value or production identifier in the repo or a build: stop at once, record only the file name, `file:line` or `rev:path` under `## Blockers` (never the value); the human checks and rotates it.
- You find evidence that a deployed environment is being abused or leaking data right now: put it at the top of the report and under `## Blockers`, then stop.
- A hook blocks a read or command you think you need: follow its message; never work around it.

## Hints (verified facts / pitfalls)

- Local confirmation without keys: `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres` with `set local role anon;` or `set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';` inside `begin … rollback` (P1-05 hints). Running the existing suites (`supabase test db`, `deno test`, `pnpm test`) is allowed.
- Permissive Postgres policies on the same table and command are OR-combined: one broad policy opens the table whatever else exists.
- Third-party claims that GLM-5.3 is a strong defensive security reviewer are unverified (`docs/takeaway/reference/glm-5.3-facts.md`; decision C16); assume you can hallucinate confidently. Cite only lines you read in this session; mark the rest `Inferred`. A finding without a file:line is not a finding.
- Read the RLS matrix in P1-05 as the intended design: a difference between it and the migrations is a finding even if it looks harmless.
