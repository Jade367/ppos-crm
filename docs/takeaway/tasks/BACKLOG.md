# Backlog: epics for phases P2–P5 (planner/agent-facing; NOT task cards)

> Status: written 2026-10-11. Nothing here authorises code. An agent never implements from this file.
> Use: a planning session (`docs/takeaway/prompts.md` §6) turns ONE epic at a time into draft cards in `docs/takeaway/tasks/proposed/`, following `tasks/TEMPLATE.md`. The human approves a card by moving it into `tasks/`.
> Canonical spec: `reference/architecture.md` wins over this file. Legal rule IDs (`UKC-*`) refer to `reference/uk-compliance.md`. Stripe facts: `reference/stripe-endive.md`.
> UNVERIFIED = not checked against a live primary source. A card that relies on such a fact must start by verifying it (official docs via the web-reader tool, URL recorded in PROGRESS.md) or stop and escalate.

## 0. Rules for every epic

1. **Frozen names.** Any new table, column outside architecture §7, edge function (§8), env var (§3), app directory (§1) or dependency needs a human-approved ADR in `docs/takeaway/adr/` that updates `architecture.md` BEFORE the first implementation card. Draft the ADR as the first card of the epic.
2. **Money rules stay.** Integer pence; one calculator (`priceOrder`); the service fee is never discounted; `applicationFeePence = serviceFeePence` (45p). Changing any of these needs an ADR plus new golden tests written or frozen by the human.
3. **0% commission promise.** No feature may take a percentage of the shop's sales, directly or hidden (billing, loyalty funding, promotions).
4. **RLS.** Every new table: RLS on, default deny, pgTAP allow AND deny tests (anon, staff of shop A vs shop B, manager, owner, platform admin, service role; plus customer A vs customer B once customer accounts exist).
5. **Side effects only through the outbox** (`order_events`), never inline in a webhook or request handler.
6. **Stripe.** API `2026-09-30.endive`, `npm:stripe@23.0.0`. Anything not already in `stripe-endive.md` is a hallucination risk: the card must add a verified snippet to `stripe-endive.md` via a human-approved doc change first.
7. **Card sizing.** One card = one session (≤ ~300-line files, ≤ one PR); a card whose Deliverables exceed ~15 files is split, or keeps its ID and describes Session 1 / Session 2 inside the card (each ending in a green checkpoint commit and a PROGRESS.md handoff; one PR), as P1-07 does. Model `glm-5.3` (never Flash) for money, auth, RLS, Stripe, migrations and printing protocols. Effort per handbook H.1: `max` for money movement, Stripe, RLS/security design, time logic, device-protocol spikes and reviews; `high` otherwise.
8. **Mode heuristics.** `tests-first` when the behaviour is a rule set that can be written as tests before code (pure functions, RLS, webhook handlers, state machines). `pass@2` for handlers that move money or change order/payment state. `review` (max effort, fresh session) after any epic touching auth, money or personal data. `spike` → ADR when an external API or device protocol is not yet in a reference file.
9. **No real data.** Fixtures from real devices or APIs are scrubbed by the human before they enter the repo.
10. **E2E.** CI's e2e job does not start Supabase: e2e tests stub every backend request (Supabase, functions, postcodes.io) with Playwright `page.route` fixtures against the dummy `VITE_*` values. An e2e test that needs the real local stack (e.g. P2-E6 OTP mail capture) first needs a human-approved CI change (`.github/` is protected).

## 1. Phase gates and suggested order

| Phase | Starts when | Exit gate (business) |
|---|---|---|
| P2 Sellable SaaS | P1 exit: pilot shop live ≥ 2 weeks, ≥ 100 real orders, 0 reconciliation errors, merchant would recommend | 10 paying shops; < 1 support hour per shop per week |
| P3 City density | P2 exit | 30–50 shops in ONE city; QR scan → order conversion measured |
| P4 Aggregator | P3 exit (never earlier) | set by the owner at the end of P3 (e.g. app/PWA order share, 30-day reorder rate) |
| P5 Next city | P4 data shows the app works | same as P3, per city |

Suggested P2 build order (dependency-driven): P2-E7 admin console → P2-E2 billing → P2-E1 self-serve onboarding → (P2-E4 discount codes, P2-E9 FHRS, P2-E3 custom domains, P2-E5 CloudPRNT, P2-E6 customer accounts in any order) → P2-E8 CRM sync (only after P0-B2/B3) → P2-E10 only on demand.

---

## P2 — Sellable SaaS

### P2-E1 Self-serve onboarding

- **Goal:** a takeaway owner signs up, builds the shop, connects Stripe, subscribes and requests go-live without the owner's hands-on help.
- **Scope:**
  - Public sign-up in the merchant app (Supabase Auth email + password, email confirmation) → new edge function (name via ADR) creates a `draft` shop + `owner` membership. Today only `platform-invite` creates shops, and public sign-up is disabled in Supabase Auth (P1-06); re-enabling it is part of this epic's ADR.
  - Guided checklist reusing P1 screens: legal identity (P1-08), hours and zones, menu with all 14 allergens (P1-07 publish gate), Stripe Connect (P1-09), subscription (P2-E2), merchant platform terms acceptance stored with terms version + timestamp.
  - Optional embedded onboarding with `@stripe/connect-js` 3.4.6 / `@stripe/react-connect-js` 3.4.4 (Account Sessions; components `account_onboarding`, `account_management`, `notification_banner`). Reserved in `versions.md`; needs `approved-deps.json` + ADR (architecture §2 bans browser Stripe SDKs for the MVP).
  - Go-live request → platform-admin approval (P2-E7) behind an automated gate (below). Merchants still cannot set `status = 'live'` (P1-05 trigger).
  - Every new merchant screen ships `en-GB` + `zh-CN` strings.
- **Key risks:** fake or abusive sign-ups (rate limit, email confirmation, admin approval); incomplete trader identity on a live site (UKC-ID); allergen data quality is the shop's legal duty (UKC-ALG-11), so the checklist must say so; terms acceptance must be provable.
- **Depends on:** P1 complete; P2-E2; P2-E7; the accountant's answer on HMRC platform reporting (UKC-AGG-07, see P4-E5).
- **Tests to write:** pure core `goLiveBlockers(shop, stripeAccount, items, subscription)` → list of reasons (`charges_enabled` && `card_payments` active, identity complete, every published item and option allergen-complete, no `age_restricted`, subscription active or founder flag) — **golden candidate (planner-written)**; deno tests for the sign-up function (idempotent retry, reserved/duplicate slugs); pgTAP: a new user cannot attach themselves to another shop; e2e: sign-up → checklist visible.
- **Modes:** tests-first for the go-live gate and sign-up function; standard for UI; review after.
- **Open decisions (owner):** manual approval forever or automatic go-live once the gate passes; embedded onboarding vs Account Links; reserved slug list; is clickwrap acceptance enough (lawyer); accountant, before any P2-E1 card is drafted: is the platform a reporting platform operator under the Reporting Platform Operators Regulations 2023 (UKC-AGG-07)? If yes, the sign-up/onboarding flow must collect the seller due-diligence data (fields from HMRC primary guidance).

### P2-E2 SaaS billing (Stripe Billing: £149 setup + £39/month)

- **Goal:** bill every shop automatically on the platform account; suspend ordering for unpaid shops after a grace period; no manual invoicing.
- **Scope:**
  - Follow `stripe-endive.md` §12: platform account only (no `onAccount`); one Stripe Customer per shop (`metadata.shop_id`, id stored on the shop via ADR); Prices created once by the human in the Dashboard (recurring `unit_amount` 3900 GBP monthly; one-off 14900); `subscriptions.create` with `items` + `add_invoice_items`, idempotency key `sub-create-<shopId>`; `default_tax_rates` only if the entity is VAT-registered (accountant).
  - Founder offer (setup waived + 3 months free): drop `add_invoice_items` and use a trial; the human picks the mechanism.
  - `stripe-webhook-platform` handles `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`; dedupe on `stripe_events`; subscription state stored in a new table (name via ADR), derived from the object's current state, never from event order.
  - Dunning: Stripe-side retries and reminder emails are Dashboard settings (exact features UNVERIFIED). Our side: merchant banner + email when payment fails; after `graceDays` a **platform-controlled billing hold** blocks new checkouts (create-checkout → 409). The P2-E2 ADR decides how the hold is stored (a new platform-only column, e.g. `shops.billing_hold_at timestamptz null`, or a `shops.status` value). It must stay distinct from the merchant's own `ordering_paused` and from a manual `status = 'paused'`, and the P1-05 shop-column guard must be extended so merchants can neither set nor clear it. Platform admin override with `audit_log`.
  - Merchant Billing page: plan, status, invoices (Stripe-hosted links). Customer portal for card updates: UNVERIFIED for endive → decision.
  - Never set `payment_settings.payment_method_types` (still exists on subscriptions/invoices, but the guard flags the token); configure methods in the Dashboard.
- **Key risks:** stale Billing knowledge (status enum, invoice fields) → verify against the stripe@23.0.0 types; wrongly pausing a paying shop (hold only from webhook-confirmed state, grace period, admin override); out-of-order events; VAT on £149/£39 (accountant); Billing fee 0.7% UNVERIFIED-LIVE.
- **Depends on:** P1-12 (platform endpoint), P2-E7; legal-entity decision (01 plan §7 item 1); accountant (VAT); lawyer (merchant subscription contract, cancellation terms).
- **Tests to write:** pure `billingHold(subscriptionStatus, pastDueSince, now, graceDays)` — **golden candidate**; param-builder test for `subscriptions.create` (no `payment_method_types`, idempotency key, `metadata.shop_id`); deno fixture tests per event incl. duplicate and out-of-order delivery; pgTAP: merchants cannot write billing or hold columns.
- **Modes:** tests-first for the hold logic and handlers; **pass@2** for the billing webhook handler; review after.
- **Open decisions (owner):** hold storage (separate column recommended vs `status`); grace days; card only or also Direct Debit (Bacs availability on Billing UNVERIFIED); customer portal yes/no; trial vs coupon for founders; prices shown "+VAT"; cancellation notice; annual plan.

### P2-E3 Custom domains

- **Goal:** a shop's storefront also answers on the shop's own hostname (e.g. `order.<shop>.co.uk`) with automatic TLS.
- **Scope:**
  - `shop_domains` (architecture §7 phase 2: `hostname` unique, `shop_id`, `verified_at`); anon may read only verified hostnames of live shops.
  - Edge function (name via ADR) calling the Vercel domains API to attach/detach the hostname on the storefront project and poll verification. Vercel token = function secret (new env var name via ADR); the agent never holds it. API shape, limits and plan quotas were NOT researched → spike first.
  - Merchant UI: enter hostname → DNS records to create (as returned by Vercel) → status.
  - Storefront resolves `location.hostname` → shop (hostname mode) besides `/:shopSlug`.
  - CORS allowlist for `create-checkout` / `order-status` generated from verified `shop_domains` + `APP_STOREFRONT_URL`.
  - Checkout `success_url` / `cancel_url` use the shop's verified domain → changes the P1-11 `buildCheckoutSessionParams` contract (new tests frozen by the human with `freeze.mjs --replace`).
  - Hosted Checkout needs no Apple Pay domain registration; embedded/Elements would need payment method domains registered per connected account per domain (stripe research) → stay on hosted Checkout.
- **Key risks:** dangling DNS / domain takeover after a shop leaves (detach on closure); CORS mistakes; sessions are per origin (affects P2-E6 logins); unverified Vercel API.
- **Depends on:** P1-10, P1-11, P2-E7 (approve domains).
- **Tests to write:** pure `normaliseHostname` / validation (reject IPs, the platform's own domain, wildcards); deno tests with a fake Vercel client; pgTAP RLS for `shop_domains`; param-builder tests for per-domain return URLs; CORS tests (unknown origin rejected).
- **Modes:** spike (max) → ADR; tests-first for hostname resolution, CORS and params.
- **Open decisions (owner):** free subdomain on the platform domain as default; who pays for the shop's domain; subdomain-only (simpler DNS) vs apex allowed; admin approval per domain.

### P2-E4 Discount codes

- **Goal:** shops create promo codes; `priceOrder` already supports `percent` (bps), `fixed` and `free_delivery`.
- **Scope:**
  - Tables via ADR: codes (shop_id, normalised code, kind, value, starts/ends, max redemptions, optional minimum, active) and redemptions (`order_id` unique).
  - `create-checkout` validates the code server-side and passes `discount` to `priceOrder`; a redemption counts only when the webhook confirms payment.
  - Stripe representation: hosted Checkout line items cannot be negative (knowledge; UNVERIFIED for endive). Options: a per-session coupon on the connected account (`discounts`) or reduced item lines. Invariant: Stripe total == `order.total_pence`, `application_fee_amount` unchanged (45p). Decide by ADR + `stripe-endive.md` update.
  - Basket code field; running total and up-front service-fee notice unchanged (UKC-PRICE).
  - Merchant CRUD + usage stats + `audit_log`.
  - Core rules hold: one discount per order, items only, service fee never discounted, minimum compares items subtotal before discount.
- **Key risks:** Stripe/order total mismatch → reconciliation errors; tiny totals after large discounts (fee must stay below the charge; Stripe GBP minimum charge UNVERIFIED); per-customer limits need identity (P2-E6 or hashed email/phone); promotional claims wording (lawyer).
- **Depends on:** P1-01, P1-11, P1-12; P2-E6 for per-customer limits.
- **Tests to write:** reuse P1-01 golden math; tests-first for code validation (expired, not yet started, exhausted, wrong shop, case-insensitive, below minimum) and for checkout params with a discount (Stripe total equals order total); pgTAP: anon cannot list codes.
- **Modes:** tests-first; **pass@2** for the `create-checkout` change.
- **Open decisions (owner):** cap percent discounts below 100%; codes public or private; platform-funded promotions (not with direct charges in P2 — the shop funds its own codes).

### P2-E5 Star CloudPRNT printing

- **Goal:** tickets print automatically on a Star CloudPRNT printer, without browser printing.
- **Scope:**
  - `print_jobs` (architecture §7: `shop_id`, `order_id`, `printer_id`, `format`, `payload`, `status`, `claimed_at`, `printed_at`) + a printers table via ADR (shop, device id, credential hash, `last_seen_at`, status).
  - Outbox handler enqueues jobs; never print from the payment webhook (architecture §8).
  - Poll endpoint per the CloudPRNT protocol (Protocol Guide v2.5.2, pull-based): printer POSTs JSON status, GETs the job, DELETEs to confirm; no port forwarding, no SSL on the printer. Exact fields are NOT in the repo → spike writes `reference/star-cloudprnt.md` (human-approved) first.
  - Renderer abstraction (`format`: Star markup / text / HTML); same content as the P1-13 ticket: number, fulfilment, time, items + modifiers, allergens, allergy note, PAID, address + postcode.
  - Back office: pairing, online/offline and paper status, test print, reprint.
  - Cost: default ~5 s polling = 17,280 requests/day/printer (~520k/month). Use an interval ≥ 10 s and a single indexed query per poll; moving the endpoint to a cheaper worker needs an ADR. Supabase included invocations and overage price UNVERIFIED.
- **Key risks:** protocol from memory (hallucination); GLM cannot see or hold hardware → the human captures real request/response fixtures; printer authentication design; duplicate prints on retries; invocation cost; Flipdish-style auto-accept-on-print conflicts with our accept flow.
- **Depends on:** P1-13, P1-14; owner's printer model choice.
- **Tests to write:** tests-first job state machine (queued → claimed → printed | failed | expired; idempotent confirm); renderer snapshot tests (allergens and allergy note always present, escaping); deno poll-handler tests with scrubbed real fixtures; pgTAP: members see only their printers.
- **Modes:** spike (max) → ADR; tests-first for state machine + renderer; standard UI.
- **Open decisions (owner):** model to resell (TSP143IV or mC-Print3); print on `placed` or on `accepted`; poll interval; endpoint host; copies per order.

### P2-E6 Customer OTP accounts & saved addresses

- **Goal:** returning customers sign in with a one-time code, reuse details and saved addresses; prerequisite for loyalty (P3-E2) and the app (P4-E2).
- **Scope:**
  - Supabase Auth OTP, email first (SMS costs money; SMS pumping risk). Customers are never `shop_members`.
  - Tables via ADR (architecture §7 has no customer table in P1; choose names that cannot be confused with the legacy CRM's `customers` table, e.g. `customer_profiles`, `customer_addresses`): profile, addresses; `orders.customer_user_id` nullable.
  - RLS: a customer reads/writes only own rows; own order history through a function returning safe fields. Guest checkout + `public_token` status page stay the default (no forced login).
  - Self-service account deletion (UK GDPR; needed later for Apple 5.1.1(v)); order financial records kept per the retention decision, contact fields pseudonymised.
  - Storage: P1 storefront must not persist an auth session (UKC-COOKIE-02). A user-chosen login session is plausibly strictly necessary → lawyer confirms; update the privacy notice.
  - No marketing checkbox here (P3-E3).
- **Key risks:** cross-customer data leaks; OTP brute force / enumeration (check Supabase rate limits); controller change — a platform-wide account makes Pocket Packet a (joint) controller (lawyer); per-origin sessions on custom domains.
- **Depends on:** P1 complete; interacts with P2-E3.
- **Tests to write:** tests-first pgTAP allow/deny (customer A vs B, shop staff, anon, platform admin); e2e OTP login against local Supabase mail capture (verify the tool name in the installed CLI; needs the CI change in rule 10, otherwise stub it); deletion test.
- **Modes:** tests-first (max) for RLS; review after.
- **Open decisions (owner):** email-only or SMS OTP too; one account across all shops (recommended for loyalty); retention periods (lawyer).

### P2-E7 Platform admin console

- **Goal:** the owner runs onboarding, go-live, support and reconciliation from `/platform-admin` in the merchant app (architecture §1), without SQL.
- **Scope:**
  - Routes guarded by `is_platform_admin()`; every write through an edge function with `audit_log`.
  - Shops: list, status, go-live action (P2-E1 gate), pause/close, per-shop `service_fee_pence` (platform-only column, confirm dialog), `crm_customer_id`.
  - Read-only views: order search with minimal PII, `stripe_events` errors, outbox failures (`attempts`, `last_error`), `notifications_log`, fee ledger, subscriptions (P2-E2).
  - Reconciliation report: orders vs `platform_fee_ledger` vs refunds (the P1 exit gate demands 0 errors).
  - Invite/resend owners (existing `platform-invite`). MFA for admins (Supabase Auth MFA — verify current API). `zh-CN` UI.
- **Key risks:** highest-privilege surface (auth mistakes, PII exposure); accidental fee changes.
- **Depends on:** P1-05, P1-06, P1-12, P1-18.
- **Tests to write:** pure `reconcile(orders, ledger, refunds)` → mismatch list — **golden candidate**; pgTAP: non-admins denied on every admin view/RPC; deno role-check tests for admin functions.
- **Modes:** tests-first for reconciliation + RLS; review (max) after.
- **Open decisions (owner):** impersonation (recommend none; read-only "view as" if ever, audited); who else gets admin; MFA mandatory.

### P2-E8 CRM summary sync (after P0-B lockdown)

- **Goal:** the CRM shows each shop's platform status (live/paused, subscription, recent order volume) on the CRM customer row.
- **Hard precondition:** P0-B2 and P0-B3 merged and verified (CRM on Supabase Auth, anon revoked). Until then architecture §12 forbids storing CRM credentials.
- **Scope:**
  - One-way, platform → CRM summary table (e.g. `crm_shop_summary` keyed by CRM `customers.id`), created in the CRM project by a CRM task (`PPOS_ALLOW_LEGACY=1`, ranged reads ≤ 400 lines, small Edits).
  - Scheduled platform job (name via ADR) writes aggregates only: shop status, subscription status, orders last 7/30 days, last order time. No end-customer PII. The CRM never writes the platform DB.
  - Link key `shops.crm_customer_id` (text, e.g. `C-001`), set by a platform admin.
  - CRM credentials only as function secrets (new env var names via ADR); prefer a narrowly-granted role over a service key (feasibility to verify). The `crm-boundary` guard blocks the CRM project ref literal in platform code → env vars only.
  - CRM UI badge on the customer row.
- **Key risks:** re-opening the CRM hole; credential blast radius; `index.html` ≈ 220K tokens (never rewrite); stale summaries.
- **Depends on:** P0-B2, P0-B3 (and B4); P2-E2; P2-E7.
- **Tests to write:** pure `toCrmSummary(shop, stats)` with a key allowlist test (no PII keys); deno test with a fake CRM client; human check on the CRM side.
- **Modes:** standard + review; CRM card uses prompts §7.
- **Open decisions (owner):** fields; frequency; credential type.

### P2-E9 FHRS hygiene badge

- **Goal:** optional food hygiene rating badge on the storefront from official FSA data (UKC-FHRS-01/02).
- **Scope:** look up `shops.fhrs_id` via FHRS API v2 (no key; header `x-api-version: 2` from knowledge — check docs) server-side on a schedule; cache with "Rating checked on {date}"; FSA official rating images, self-hosted; hide on failure or stale data; Scottish FHIS (Pass / Improvement Required) comes from the same API; per-shop "mandatory online display" flag for future rules; admin confirms the establishment match.
- **Key risks:** wrong establishment matched; stale rating; a browser call to the FSA would break the P1-17 no-third-party-requests test → server-side only.
- **Depends on:** P1-08, P1-17, P2-E7.
- **Tests to write:** deno tests with fixture responses (rating, FHIS, error → hidden); e2e: no badge without a cached rating; P1-17 network test stays green.
- **Modes:** standard (high).
- **Open decisions (owner):** opt-in per shop (display is voluntary in England); show low ratings or let the shop hide them.

### P2-E10 Epson & Sunmi printing (on demand)

- **Goal:** support non-Star printers on the same `print_jobs` queue.
- **Scope:** Epson Server Direct Print (TM-m30III / TM-i firmware) is also polling-based, jobs in ePOS-Print XML, "URL Encode" must be off; one vendor guide suggests 1 s polling → we still use ≥ 10 s; Epson developer docs were unreachable during research (UNVERIFIED) → spike + reference file. Sunmi (V2 / V2s / V2 Pro) prints through an Android printer service/SDK → needs a native Android wrapper (Capacitor or React Native) = new app + deps via ADR.
- **Key risks:** unverified protocols; device testing by the human; a native wrapper doubles maintenance.
- **Depends on:** P2-E5.
- **Tests to write:** renderer snapshot tests per format; poll-handler fixture tests.
- **Modes:** spike → ADR; standard.
- **Open decisions (owner):** build only when a paying shop needs it; which device to resell.

---

## P3 — City density

### P3-E1 QR campaigns tied to packaging orders

- **Goal:** every QR printed on Pocket Packet packaging is traceable to a CRM packaging order and a shop; scans and orders are attributed (the P3 exit metric).
- **Scope:**
  - Platform `qr_campaigns` (via ADR): short code, `shop_id`, CRM `orders.id` + `customers.id` (CRM order ids are client-generated and can collide across customers, per research), packaging SKU, quantity printed, landing target (the shop's own page by default), UTM defaults, active window, Welsh-shop flag.
  - CRM side: nullable `orders.qr_campaign_id` (or per line in the `items` JSONB) in the CRM DB, CRM task after lockdown; CRM stage "Delivered" is the natural activation point.
  - Scan endpoint (via ADR): 302 to the shop page with `?c=<code>&utm_source=packaging&utm_medium=qr&utm_campaign=<code>`; log campaign, time, IP hashed with a rotating salt, coarse device class; **no cookies** (UKC-COOKIE-01); filter link-preview/bot fetches.
  - Attribution in the URL → basket → `create-checkout` field → `orders.qr_campaign_id` (column via ADR). Storage-based attribution only if the lawyer confirms the DUAA analytics exemption (needs notice + opt-out).
  - Printable QR via the approved `qrcode` package (SVG/PDF for factories); Welsh shops' printed matter carries the bilingual FHRS statement (UKC-FHRS-03).
  - Reports: scans, orders, conversion per campaign / batch / shop.
- **Key risks:** printed codes live for years → codes never reused, redirect layer and short domain permanent; inflated scan counts; IP is personal data (hash, short raw retention); CRM id collisions.
- **Depends on:** P2-E8, P0-B lockdown, P1-11 schema change, P2-E7.
- **Tests to write:** tests-first scan endpoint (no `Set-Cookie`, correct 302, unknown/expired code still lands on the shop, hashed IP only); pure attribution normalisation; pgTAP: merchants read only their own campaign stats; template test for the Welsh statement.
- **Modes:** tests-first; standard for print templates.
- **Open decisions (owner):** dedicated permanent short domain; one code per shop or per batch; who creates campaigns (CRM staff or platform admin); scan-log retention.

### P3-E2 Cross-shop loyalty ledger

- **Goal:** customers earn points at any participating shop and redeem at any participating shop, with correct liability accounting.
- **Scope:**
  - Requires P2-E6 accounts. Append-only ledger (via ADR): customer, shop, order, `delta_points`, reason (`earn`, `redeem`, `reverse`, `expire`, `adjust`), `expires_at`; balance = sum; UPDATE/DELETE blocked by trigger.
  - Earn on paid + completed orders; reverse on refunds and lost disputes.
  - Redemption is a discount → conflicts with "one discount per order" (§5 rule 3) and the P1-01 golden tests → ADR + new golden tests by the human.
  - **Funding is unresolved:** with direct charges the customer pays the shop. Platform-funded points need money to flow platform → shop (Connect transfers to connected accounts: NOT researched, UNVERIFIED); cross-shop redemption means shop B honours points earned at shop A → settlement. Decide before any code.
  - Unredeemed points recorded as a liability (accountant); expiry in T&Cs (lawyer); gift cards / stored credit → e-money rules check; a paid tier would trigger the DMCCA subscription-contract regime (commencement UNVERIFIED) (UKC-AGG-09).
  - Loyalty marketing needs explicit consent (UKC-MKT-03). Service fee never reduced by points.
- **Key risks:** the money model (largest P3 design risk); hidden commission through funding rules; fraud (refund after earning, fake orders); reconciliation complexity.
- **Depends on:** P2-E6, P2-E4, P2-E7; a Stripe Connect-transfers spike (below); accountant + lawyer.
- **Tests to write:** **golden (planner)** ledger maths: earn, redeem, reverse, expire, balance never negative, idempotent per order; pgTAP: append-only enforced, customers read only their own ledger.
- **Modes:** spike (max) first: verify transfers from the platform balance to connected accounts (and transfer reversals) for a direct-charge platform against the stripe@23.0.0 types and official docs; the human adds verified snippets to `stripe-endive.md`, and an ADR decides funding and cross-shop settlement before any other card. Then tests-first; **pass@2** for redemption at checkout and reversal in webhooks; review after.
- **Open decisions (owner):** who funds points; earn rate; expiry; cross-shop settlement; can shops opt out.

### P3-E3 Marketing consent & campaigns (PECR)

- **Goal:** shops (and later the platform) send lawful marketing SMS/email.
- **Scope (UKC-MKT-01…04):**
  - Consent records: subject, controller (shop or platform), channel, basis (`soft_opt_in` | `consent`), source, wording version, timestamp, `withdrawn_at`.
  - Soft opt-in only for the collecting shop and its own similar products; opt-out offered unticked at checkout and in every message. Platform or cross-shop marketing needs a separate unticked consent box.
  - Suppression list checked before every send; email unsubscribe link; SMS STOP handling (Twilio inbound — verify); sender identity in every message (reg 23).
  - Campaign composer for shops (audience = own consenting customers), sent through the outbox with rate limits and an SMS cost estimate.
  - P1 rule stays: transactional messages contain no marketing.
- **Key risks:** PECR fines raised to UK GDPR levels by DUAA 2025 (commencement UNVERIFIED); cross-shop leakage; consent provenance lost; SMS cost.
- **Depends on:** P2-E6; P3-E2 for loyalty messages; lawyer wording.
- **Tests to write:** tests-first pure `canSend(recipient, controller, channel, consents, suppressions)`; pgTAP: shop A cannot read shop B consents; template tests: every marketing template has opt-out + sender identity.
- **Modes:** tests-first (max); standard UI.
- **Open decisions (owner):** does the platform itself market in P3; SMS or email only; frequency caps.

### P3-E4 Packaging consumption forecast → draft quotes in CRM

- **Goal:** use real order volume to predict a shop's packaging needs and draft a CRM quote for staff approval.
- **Scope:** owner maps menu items/categories → packaging SKUs and boxes per order; platform order volume arrives through the P2-E8 summary; CRM-side logic compares with CRM `purchased_items` (usual SKUs, `pcs_per_carton`) and factory lead times, then creates a CRM `quotes` row with status `draft` (precedent: the CRM price-ripple engine, `index.html` ~9462–9639 per research). Never auto-send; the CRM never writes the platform DB.
- **Key risks:** CRM file size (ranged reads, small Edits only); mapping data quality; wrong forecasts annoy customers.
- **Depends on:** P2-E8; P0-B lockdown.
- **Tests to write:** tests-first pure forecast (orders/day × boxes/order ÷ pcs per carton → cartons and reorder date) with fixtures; human check on the CRM side.
- **Modes:** tests-first for the maths; CRM cards with `PPOS_ALLOW_LEGACY=1`.
- **Open decisions (owner):** forecast runs platform-side or CRM-side; mapping granularity; lead-time source.

---

## P4 — Aggregator (only after the P3 gate)

### P4-E1 City PWA picker

- **Goal:** one city entry point listing participating shops; every order is still a direct charge on one shop.
- **Scope:** new app or route set (layout FROZEN → ADR), PWA via approved `vite-plugin-pwa`; discovery by postcode (core `resolveZone`) and opening state (core hours); disclosed ranking parameters (P2B); shop pages reuse storefront components; identity of each shop + the platform shown (UKC-AGG-10); drip-pricing rules unchanged; iOS web push only for Home Screen web apps (iOS 16.4+, permission from a user gesture), otherwise SMS/email (UKC-AGG-04). QR scans still land on the shop's own page first.
- **Key risks:** empty-shelf effect if launched before density; P2B duties; pressure to add analytics/trackers (ADR + consent first).
- **Depends on:** P3 exit; P2-E6; P2-E3 (city domain).
- **Tests to write:** pure `rankShops(shops, location, now)` implementing only the disclosed parameters — **golden candidate**; e2e discovery flow; P1-17-style no-cookie / no-third-party test.
- **Modes:** tests-first for ranking/discovery; standard UI.
- **Open decisions (owner):** brand and domain; ranking parameters; launch city.

### P4-E2 Expo app (one binary, all cities)

- **Goal:** one native app in the "picker" model that adds value beyond the website.
- **Scope:**
  - Expo / React Native; new app dir + deps via ADR and `approved-deps.json`; developer accounts under the platform Ltd.
  - Apple rules (UKC-AGG-01…03): 4.2.6 picker model allowed; 4.3(a) one app for all cities, never per-city bundle IDs; 4.2 more than a repackaged website (saved addresses, push tracking, loyalty wallet, reorder); 4.2.3(i) standalone; 3.1.3(e) food paid via Stripe / Apple Pay / card, never IAP; 5.1.1(v) in-app account deletion and guest ordering; 4.8 avoided by using only our own email/SMS OTP.
  - Payments: PaymentSheet (`@stripe/stripe-react-native`) on the shop's connected account → a new edge function creating a PaymentIntent with `application_fee_amount` (ADR + verified snippets added to `stripe-endive.md`; Apple Pay merchant ID setup). The research's Expo/RN notes are general knowledge, UNVERIFIED.
  - Push: Expo push (APNs/FCM) driven by the outbox.
  - Google Play physical-goods billing exemption: UNVERIFIED (page not fetched). CMA mobile-platform conduct requirements: not researched.
- **Key risks:** GLM is text-only (cannot see the app) → human device testing; review rejection; hallucinated RN/Expo/Stripe-RN APIs; two payment paths (Checkout + PaymentSheet) must share pricing, fee and webhook logic.
- **Depends on:** P4-E1, P2-E6, P3-E2 (wallet).
- **Tests to write:** PaymentIntent param-builder tests (fee 45p, connected account, idempotency key); webhook extension tests for the PaymentIntent path; app unit tests; a human device checklist.
- **Modes:** spike (max) → ADR; tests-first + **pass@2** for the payment function and webhook changes.
- **Open decisions (owner):** minimum feature set for Apple 4.2; brand; release timing.

### P4-E3 Reviews

- **Goal:** customers rate shops after completed orders, within the DMCCA Schedule 20 fake-review ban (from 6 Apr 2025; CMA208 guidance) (UKC-AGG-08).
- **Scope:** reviews only from completed orders (one per order); incentives disclosed (recommend none); no suppression of negative reviews; published moderation policy with logged removal reasons; merchant reply; report button; disclosed rating aggregation.
- **Key risks:** CMA enforcement; moderation workload; shops pressing for removals; fake orders to game ratings.
- **Depends on:** P2-E6 or order-token linkage; P4-E1.
- **Tests to write:** tests-first eligibility (completed, paid, not fully refunded, within N days, one per order) and aggregation; pgTAP: shops cannot edit or delete reviews; moderation actions audited.
- **Modes:** tests-first.
- **Open decisions (owner):** launch reviews at all; moderation SLA; reply rules.

### P4-E4 P2B transparency

- **Goal:** comply with the assimilated P2B Regulation (EU) 2019/1150 if the aggregator is an online intermediation service — **lawyer to confirm it still applies** (UKC-AGG-06).
- **Scope:** plain merchant T&Cs; published main ranking parameters (linked from the merchant app); 15 days' notice of T&C changes (versioned terms, notification, acceptance log); internal complaint handling; stated reasons for suspension or termination.
- **Depends on:** P4-E1 (ranking); terms acceptance records from P2-E1.
- **Tests to write:** pure `termsEffectiveDate(publishedAt)` ≥ 15 days; pgTAP for acceptance records; e2e: ranking page reachable.
- **Modes:** standard; lawyer review.
- **Open decisions (owner):** who handles complaints and how fast.

### P4-E5 HMRC platform reporting

- **Goal:** comply with the Reporting Platform Operators Regulations 2023 (from 1 Jan 2024) if they apply: seller due-diligence data and an annual report of merchant income to HMRC (UKC-AGG-07, needs accountant).
- **Scope:** collect the required seller data (fields NOT researched → read HMRC primary guidance first); generate the annual per-seller report from orders, refunds and fees; export in HMRC's format (UNVERIFIED).
- **Key risk:** applicability may start before P4 (whether a storefront SaaS where the shop is merchant of record is in scope is for the accountant).
- **Depends on:** P1-18 reports; P2-E1 sign-up (collect data at onboarding if needed).
- **Tests to write:** tests-first aggregation from fixtures once fields are known; pgTAP for the reporting function.
- **Modes:** tests-first.
- **Open decisions (owner):** ask the accountant before the P2-E1 sign-up form is built.

---

## P5 — Next city

### P5-E1 Multi-city operations

- **Goal:** add a city by configuration, not code.
- **Scope:** cities/areas as data (table via ADR, `shops.city_id`); city filters in the admin console and reports (shops live, orders, scans, conversion); still one app (Apple 4.3); support tooling; database compute or read-replica decision by measured load; regional rules as per-shop flags (Welsh FHRS statement, Scottish FHIS; alcohol stays off).
- **Key risks:** owner's ops time; performance; regional rule differences.
- **Depends on:** P4 data; the P3 playbook.
- **Tests to write:** pgTAP for city scoping if a city-manager role is added; report tests.
- **Modes:** standard; review if a new role is added.
- **Open decisions (owner):** second city; city-manager role.
