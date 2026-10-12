# P1-20 — Pilot go-live checklist

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-19 (and every Critical/High fix card from it merged); P0-B2, P0-B3, P0-B4 merged and applied (CRM lockdown is a P1 go-live gate: architecture §15, decision A20) |
| Mode | `human` + agent — the agent drafts the runbook and a proposed deploy workflow (docs only); the human does everything that touches production, money, contracts or the pilot shop |
| Reasoning effort | `high` (agent part) |
| Model | `glm-5.3` |
| Session budget | Agent: ≤ 3 hours wall-clock, one session. Human: about 1–2 weeks elapsed (lawyer, accountant, Stripe live activation, shop onboarding). |
| Golden tests | none |

## Goal

The first real shop takes real orders safely. The agent writes a step-by-step runbook and a manual, approval-gated deploy workflow; the human creates and configures production (Supabase, Stripe live, Twilio, Resend, Vercel), deploys in the fixed order database → functions → frontend, onboards the pilot shop, proves the money path with a £1.00 live order and full refund that reconciles to the penny, collects the lawyer's and accountant's sign-off, and switches on monitoring and an incident procedure. Phase 1 ends when the pilot has run at least 2 weeks with at least 100 real orders, 0 reconciliation errors, and the shop would recommend it.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §3 (environments, env var names), §8, §9, §10, §15
- `docs/takeaway/reference/stripe-endive.md` §1, §5, §7 (endpoints and exact event lists), §8, §11 (fees: never in copy), §2 item 1 (payment methods; former open question 4)
- `docs/takeaway/reference/uk-compliance.md` §17 (launch-blocking checklist), §18 (lawyer/accountant questions), UKC-DP-08, UKC-ID-05, UKC-AGE-02, UKC-AGE-03, UKC-ALG-11
- `docs/takeaway/02-tech-roadmap.md` §7.6 (release flow), `docs/takeaway/reference/environments.md`, `docs/takeaway/reference/versions.md`
- `docs/takeaway/tasks/P1-14-cron-tick-escalation.md` (Vault secrets), `P1-18-reports-v1.md` (report columns), `.github/workflows/takeaway-ci.yml` (style only)
- `docs/takeaway/reviews/P1-19-*.md` and `docs/takeaway/reviews/P1-17-compliance-trace.md`

## Out of scope

- **Agent:** any command against production or DEV secrets, `supabase link`, `secrets set`, `db push`, `functions deploy`, Stripe live calls, editing `.github/**` (the workflow is a proposal under `tasks/proposed/`), code changes, legal wording decisions.
- SaaS billing (£149 + £39/month, founder offer) and Stripe Billing: phase 2; the pilot runs on the service fee only.
- Printing via CloudPRNT (P2, decision A18), a second shop, marketing.

## Deliverables

| Path | Action | Who |
|---|---|---|
| `docs/takeaway/reviews/P1-20-go-live-runbook.md` | create | agent |
| `docs/takeaway/tasks/proposed/deploy-workflow.yml` | create (the human reviews and installs it as `.github/workflows/takeaway-deploy.yml`) | agent |
| `docs/takeaway/PROGRESS.md` | edit | agent |
| Production projects, secrets, Stripe live settings, pilot shop, sign-offs | do, with evidence in the runbook | human |

## Spec

**Runbook** (`P1-20-go-live-runbook.md`): written for the owner in Simplified Chinese, with commands, setting names, paths, env var names and technical terms in English. Every step is a table row `| # | Step | Who (human / agent / lawyer / accountant / shop) | Evidence | Done |` with a numeric `#` (column contents in Chinese where they are prose). Required sections, as headings `## 0. …` to `## 12. …`:

| § | Content |
|---|---|
| 0 | Go / no-go: all P1-19 Critical/High fixed (PR links), `main` CI green, uk-compliance §17 fully ticked, sign-off documents filed, `PLATFORM_IDENTITY` filled, every `LAWYER REVIEW REQUIRED` marker removed **by the human** after approval; CRM lockdown P0-B2, P0-B3 and P0-B4 merged and applied to the CRM's live database (PR links), including P0-B3's rotation of the CRM project's API keys after anon access was revoked (architecture §15, decision A20) |
| 1 | Production Supabase (`takeaway-prod`, London): created in a **separate Supabase organization**; the agent machine's Supabase CLI account is not a member (evidence: the human runs `supabase projects list` on the agent machine and `takeaway-prod` is absent; architecture §3, decision A3); plan and backups, PITR decision (cost), Auth (site URL, redirect URL `<merchant>/auth/accept`, public sign-up off, custom SMTP for invites [H: verify the default email limits in Supabase docs]), function secrets (names only, from architecture §3), Vault secrets `ppos_functions_url` and `ppos_cron_secret` (P1-14), check `cron.job_run_details` shows successful runs |
| 2 | Deploy order **database → functions → frontend**, with the proposed workflow or the equivalent manual commands; how to check each step (`supabase migration list`, `health` function, storefront loads); `verify_jwt` settings from `config.toml` are respected [H: verify in Supabase CLI docs] |
| 3 | Vercel production: env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_FUNCTIONS_URL`), domains. Production auto-deploy from `main` is **OFF** (architecture §3, decided; not an option): record the exact Vercel setting that disables it [H: verify the setting name in Vercel docs], the manual promotion step after database → functions are deployed, and evidence that a merge to `main` did not change production |
| 4 | Stripe live: account activation; Connect settings ("Stripe handles pricing", connected accounts pay fees); payment methods for connected accounts: cards, Apple Pay, Google Pay, Link only; delayed/async methods (bank debits, transfers) off (P1 decision: architecture §9, decision A11, stripe-endive §2 item 1); two live webhook endpoints created by the human with `api_version` `2026-09-30.endive`: connect endpoint → `stripe-webhook-connect` with the exact 10 events of stripe-endive §7, platform endpoint → `stripe-webhook-platform` with `application_fee.created`, `application_fee.refunded`; secrets into Supabase; live key never on the agent machine; fees only via https://stripe.com/gb/pricing |
| 5 | Twilio (UK sender number and any regulatory requirements [H]) and Resend (sending domain verified with SPF/DKIM [H]); a test SMS and email to the owner |
| 6 | Pilot shop onboarding: platform admin creates the shop and invites the owner; owner fills business identity (UKC-ID-01): `legal_form`, and for a limited company or LLP also the company number, registered office address and part of the UK where registered (UKC-ID-05); hours (if any session runs past 23:00 or starts before 05:00 in England/Wales: the late night refreshment licence tick matches the premises licence, UKC-AGE-03); zones; public `phone` (basic rate, answered in opening hours); `alert_phone` (a UK mobile for the escalation SMS and call, architecture §10); full menu with all 14 allergens per item/option and the owner's **written** confirmation; PPDS (Natasha's Law) check for pre-packed items (UKC-ALG-11); no alcohol or age-restricted items (UKC-AGE-02); Tips Act briefing (UKC-NAME-05); signed merchant terms + DPA; Stripe onboarding until `charges_enabled` and `card_payments` active; platform admin "Go live" |
| 7 | Tablet: merchant app installed as PWA, "Start shift" each day, volume up, charger, screen stays on, test ticket on the 80 mm printer (browser print), the `alert_phone` receives the escalation SMS and call (architecture §10, decisions A15/C13) |
| 8 | **Live £1.00 test and reconciliation** (below) |
| 9 | Monitoring: daily SQL checks (below), Stripe webhook failure emails to the owner, Supabase function logs, an uptime check on the storefront and the `health` function |
| 10 | Incident and breach procedure (UKC-DP-08): contacts (owner, developer, lawyer, pilot shop), first actions (pause ordering for the shop, `cron.alter_job`/`unschedule` for `ppos-cron-tick` [H], disable a webhook endpoint, rotate keys), the processor tells the shop without undue delay, the shop (controller) decides on ICO notification within 72 hours |
| 11 | Rollback: frontend → Vercel instant rollback; functions → redeploy the previous commit; database → forward-fix migration only (migrations are append-only), PITR/backup restore as last resort |
| 12 | Pilot tracking for the P1 exit gate: weekly reconciliation, order count, issues log, merchant feedback; the accountant's answer on the report basis (P1-18, decision C14: London day of `coalesce(placed_at, created_at)`, later refunds counted on the order's day) |

**£1.00 live test (§8, exact values).** Create a published test item `Test item` priced £0.55 (all 14 allergens `free`), collection. Expected Checkout page: `Test item` £0.55, `Service fee` £0.45, total £1.00 = the pay button. Pay with a real card → order `placed/paid`, customer receipt email, tablet alarm; tap "Seen" within 60 s → no escalation SMS for this order in `notifications_log` (architecture §10: the SMS to `alert_phone` is sent only when the tablet has not acknowledged within 60 s); accept with 15 min → customer email + one SMS (decision A15). Then full refund from the merchant app (`kind: 'full'`, reason `other`) → `refunds` row `merchant_app`, `refund_application_fee` true; after the webhook `payment_status = 'refunded'`, `refunded_pence = 100`; `platform_fee_ledger` row `amount_pence 45`, `refunded_pence 45`; platform Stripe Dashboard shows the £0.45 application fee refunded; the shop's Dashboard shows £1.00 refunded and Stripe's processing fee **not** returned (borne by the shop); `shop_daily_summary` for that day: gross 100, refunded 100, service fee 45, service fee refunded 45, net 0. Second £1.00 order, the same day, left alone on the tablet (proves escalation and auto-reject): one SMS to `alert_phone` at ≥ 60 s, one voice call to `alert_phone` at ≥ 2 min, auto-reject + full refund at `auto_reject_after_minutes` (default 8) → `refunds` row `auto_reject`, `payment_status = 'refunded'`, ledger `refunded_pence 45`, customer rejected email with the refund line `£1.00` + one SMS; the day's `shop_daily_summary` becomes gross 200, refunded 200, service fee 90, service fee refunded 90, net 0. Unpublish the test item. Every value goes into the evidence column.

**Daily monitoring SQL (§9, read-only; give each with its expected result "0 rows"):** `stripe_events` with `error is not null` or `processed_at is null and received_at < now() - interval '10 minutes'`; `order_events` with `processed_at is null and attempts >= 5`; `orders` with `status = 'pending_payment' and created_at < now() - interval '1 hour'`; `orders` with `status in ('rejected','cancelled','expired') and payment_status in ('paid','partially_refunded')` (refund missing; architecture §6); `notifications_log` with `status = 'failed'` today.

**Proposed deploy workflow** (`deploy-workflow.yml`): `on: workflow_dispatch` with inputs `ref` (default `main`) and `confirm` (the job fails unless it equals `deploy-production`); `permissions: contents: read`; `concurrency: deploy-production`; one job with `environment: production` (the human configures required reviewers there); steps: checkout `ref`; `supabase/setup-cli@v1` with the exact CLI version from `versions.md`; `supabase link --project-ref` from a secret; `supabase db push --dry-run`, then `supabase db push`; `supabase functions deploy`; a smoke check of `/functions/v1/health` (expects the core version). Secrets only as `${{ secrets.NAME }}` (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROD_PROJECT_REF`, `SUPABASE_PROD_FUNCTIONS_URL`), passed through `env:`; no `set -x`, nothing echoed; frontend promotion stays a human step (§3). Header comment: "PROPOSAL — human installs into .github/workflows after review". Verify every CLI flag in the Supabase CLI docs with the web reader and record the URLs in the runbook; mark anything unverified `[H]`.

## Acceptance

Agent:
1. `git diff --name-only main...HEAD` → only the two agent Deliverables and `docs/takeaway/PROGRESS.md`
2. `for n in 0 1 2 3 4 5 6 7 8 9 10 11 12; do grep -qE "^## ${n}\. " docs/takeaway/reviews/P1-20-go-live-runbook.md || echo "MISSING §$n"; done` → no output
3. `grep -cE '^\| [0-9]+ \|' docs/takeaway/reviews/P1-20-go-live-runbook.md` → ≥ `40` checklist rows
4. `grep -nE 'workflow_dispatch|environment: production|db push --dry-run|functions deploy' docs/takeaway/tasks/proposed/deploy-workflow.yml` → all four present; `grep -nE 'sk_live|whsec_[A-Za-z0-9]|sbp_|set -x' docs/takeaway/tasks/proposed/deploy-workflow.yml` → no output
5. `node scripts/guards/run-all.mjs` → exit 0

Human (evidence in the runbook's last column; the go-live date is set only when all are ticked):
6. Every row of runbook §0–§9 ticked, incl. uk-compliance §17 in full and the lawyer's written view on the fee display (CMA209 current version)
7. £1.00 live test reconciles exactly as specified; daily monitoring SQL returns 0 rows for 3 consecutive days before the public launch
8. P1 exit gate recorded in PROGRESS.md: pilot ≥ 2 weeks live, ≥ 100 real orders, 0 reconciliation errors (weekly: Stripe shop Dashboard payments and refunds = `shop_daily_summary` = ledger), merchant would recommend

## Definition of Done

- [ ] All Acceptance items pass (agent: paste output into PROGRESS.md; human: evidence in the runbook)
- [ ] `node scripts/guards/run-all.mjs` exits 0 (`pnpm verify` also exits 0: no code changed)
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log; `## Current` hands over to the human with the first runbook step)
- [ ] PR opened with the template (agent part), then stop

## Stop and escalate if

- A step needs a production credential, a live Stripe call or a `.github/**` change from the agent: write it as a human step instead.
- P1-19 has an open Critical/High finding, a §17 compliance item cannot be met, or the £1.00 test does not reconcile to the penny: **no go-live**; write it under `## Blockers`.
- You cannot verify a Supabase, Vercel, Twilio or Resend setting name in official docs: mark it `[H]` in the runbook; never present it as fact.

## Hints (verified facts / pitfalls)

- The agent never receives prod keys and never links prod (architecture §3); the pre-bash hook blocks `supabase link`, `secrets set` and secret interpolation anyway.
- Webhook endpoint secrets (`whsec_...`) are shown only once at creation (stripe-endive §7): the human copies them straight into Supabase secrets.
- In live mode, `stripe listen` is not used; the endpoints are real URLs `https://<project-ref>.supabase.co/functions/v1/<function>`.
- Stripe fee figures in stripe-endive §11 are UNVERIFIED-LIVE: the runbook may mention them for the owner's maths only, labelled as such, never in merchant or customer copy.
