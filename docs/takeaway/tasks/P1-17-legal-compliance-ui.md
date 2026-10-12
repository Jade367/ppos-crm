# P1-17 — Legal pages & compliance UI

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-10, P1-08 |
| Mode | `standard` |
| Reasoning effort | `high` |
| Model | `glm-5.3` |
| Session budget | Two sessions on one branch `task/P1-17-legal-ui`, ≤ 4 h each (plan: Spec → Sessions; decision C20); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none (every rule below is a launch-blocking acceptance item; the lawyer approves the wording at P1-20) |

## Goal

Every storefront page shows who the customer is buying from, and each shop has the legal pages UK law expects of an online food seller: terms (with the no-cancellation statement and statutory rights), a privacy notice (shop = controller, Pocket Packet = processor), an allergen information page one click from the menu, and "About our service fee". The merchant app gets the platform terms and privacy notice for shops. Automated tests prove the fee is never given a banned name, the storefront sets no cookies and talks to no third parties, and a traceability file shows, for every phase-1 rule in `uk-compliance.md`, which test or human check covers it. All text is a draft marked `LAWYER REVIEW REQUIRED` until a human removes the marker at P1-20.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/uk-compliance.md` §0 (rules for agents) and every rule listed in the table below; §17 (P1-20 checklist) for context
- `docs/takeaway/reference/architecture.md` §7 (`shops` identity columns, Allergens), §11
- `docs/takeaway/tasks/P1-10-storefront-menu-basket.md` (routes, data loading, fee notice, e2e stubbing), `P1-08-shop-settings.md` (identity fields), `P1-16-order-status-notifications.md` (`shop` fields of `order-status`)
- Storefront: `apps/storefront/src/App.tsx` (routes, P0-04), `apps/storefront/src/i18n/en-GB.ts`, `apps/storefront/src/components/{ServiceFeeNotice,PriceBreakdown}.tsx`, `apps/storefront/src/pages/{Menu,Checkout}Page.tsx` (P1-10), `packages/ui/src/index.ts` (P0-04); locate the shop data loaders under `apps/storefront/src/data/` with grep (do not read the folder whole)
- Merchant: `apps/merchant/src/App.tsx` (routes), `apps/merchant/src/i18n/en-GB.ts`, `apps/merchant/src/layout/AppShell.tsx`, `apps/merchant/src/pages/LoginPage.tsx` (P1-06); find anything else with grep

## Out of scope

- Deciding legal wording, retention periods, the reg 28 sub-paragraph or the fee-in-prices question (lawyer, P1-20). Cookie banners (none needed: no cookies), analytics, FHRS badge (P2).
- Schema changes of any kind (the identity columns, incl. `legal_form`, `registered_office_address`, `registered_in`, exist since P1-05/P1-08); Chinese translations of legal text (English is the binding draft in P1).
- Editing `uk-compliance.md`, tests owned by other cards, or removing any `LAWYER REVIEW REQUIRED` marker.

## Deliverables

| Path | Action |
|---|---|
| `apps/storefront/src/components/ShopFooter.tsx` (+ test), `src/layout/ShopLayout.tsx`, router | create / modify: footer on every shop route incl. `/o/:token` |
| `apps/storefront/src/legal/{TermsPage,PrivacyPage,AllergensPage,ServiceFeePage,PlatformPage}.tsx`, `legal/platform-identity.ts` | create |
| `apps/storefront/src/legal/{legal-pages,banned-strings}.test.tsx` | create |
| the P1-10 shop loader in `apps/storefront/src/data/` (find it with grep) | modify only if needed: add the footer's identity columns to its explicit column list (`legal_name`, `legal_form`, `email`, `phone`, address, `company_number`, `vat_number`, `registered_office_address`, `registered_in`; all anon-granted by P1-05; never `select *`) |
| `apps/storefront/src/i18n/en-GB.ts`, checkout + fee-notice components (P1-10) | modify: "About our service fee" link next to the notice and the checkout breakdown; Terms link beside the terms checkbox |
| `apps/merchant/src/legal/{PlatformTermsPage,PlatformPrivacyPage}.tsx` (+ test), router, `AppShell.tsx`, `LoginPage.tsx`, `i18n/en-GB.ts`, `zh-CN.ts` | create / modify (nav labels translated; legal body English) |
| `e2e/storefront-legal.spec.ts`, `e2e/storefront-privacy.spec.ts`, `e2e/fixtures/storefront-legal/*.json` | create |
| `docs/takeaway/reviews/P1-17-compliance-trace.md` | create (agent-writable) |

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR):
- **Session 1** (storefront): `ShopFooter` (incl. UKC-ID-05) + test, `ShopLayout`, router, the legal pages + `platform-identity.ts`, `legal-pages`/`banned-strings` tests, the fee-notice/checkout links, `en-GB.ts`, `storefront-legal.spec.ts` and `storefront-privacy.spec.ts` with fixtures and axe checks (Acceptance 1, 3, and 4 for the storefront files). Gate: those items + `pnpm verify:quick` → checkpoint commit `feat(storefront): footer and legal pages [P1-17] (session 1/2)` → `git push -u origin task/P1-17-legal-ui` (no PR yet) → PROGRESS.md `## Current`: `P1-17 Session 1 done (<hash>); next: Session 2, first file apps/merchant/src/legal/PlatformTermsPage.tsx`. Stop.
- **Session 2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): merchant `PlatformTermsPage`/`PlatformPrivacyPage` + tests, router, `AppShell`, `LoginPage`, both merchant dictionaries, then the traceability file (Acceptance 2, 4–7). Change Session 1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

**Routes.** Storefront: `/:shopSlug/terms`, `/:shopSlug/privacy`, `/:shopSlug/allergens`, `/:shopSlug/service-fee`, `/legal/platform` (static route; outranks `/:shopSlug/...`). Merchant (public, no login): `/legal/terms`, `/legal/privacy`, linked from the login page and the shell.

**Footer (UKC-ID-01).** From the shop data already loaded (menu/basket/checkout/legal pages) or the `shop` object of `order-status` (`/o/:token`): legal name; trading name when it differs; address lines + postcode; email (`mailto:`); phone (`tel:`); "Company number …" only if set (rendered once; the go-live trigger guarantees it for limited companies and LLPs); "VAT number …" only if set; **UKC-ID-05:** when `legal_form` is `limited_company` or `llp`, also "Registered office: {registered_office_address}" and "Registered in England and Wales" / "Registered in Scotland" / "Registered in Northern Ireland" (from `registered_in`: `england_wales` / `scotland` / `northern_ireland`); links Terms · Privacy · Allergens · About our service fee; "Online ordering by {PLATFORM_IDENTITY.legalName}" linking `/legal/platform` (UKC-ID-07). `platform-identity.ts` exports `PLATFORM_IDENTITY` with fields `legalName, address, email, companyNumber` whose values are the literal placeholders `TODO-HUMAN …` (the human fills them before go-live; never invent Pocket Packet's details).

**Legal templates.** Each file starts with `// LAWYER REVIEW REQUIRED — a human removes this line after written approval (P1-20)`. Shop data is interpolated as React text (never HTML). Footer and pages are built from `@ppos/ui` components (decision A1); no new base components in the apps. Headings (exact, tests use them):

| Page | Headings / content |
|---|---|
| Terms | "Who you are buying from" (identity block: the UKC-ID-01 data and, for limited companies and LLPs, the same UKC-ID-05 lines as the footer); "Prices and the service fee" (prices include VAT where applicable; delivery shown before checkout; the per-order service fee from `formatPence(shop.service_fee_pence)`, same for every order, never discounted); "Collection and delivery"; "Paying" (card payment, including Apple Pay, Google Pay and Link, through Stripe hosted checkout (decision A11), UKC-PAY-01/03: the shop is the seller and appears on the card statement); "Cancelling your order" (UKC-CCR-03 draft text, identical to checkout); "Problems and complaints" (call/email the shop; full or partial refunds for missing, wrong, late or poor-quality items); "Your statutory rights" ("This does not affect your statutory rights.") |
| Privacy | controller = the shop (identity); processor = the platform operator (`PLATFORM_IDENTITY`); what we collect (name, phone, email, delivery address, notes, allergy note, order details) and why (to take and deliver your order: contract); recipients (Supabase, Vercel, Stripe, Twilio, Resend, postcodes.io); "How long we keep your data" (placeholder `TODO-LAWYER: retention periods`, UKC-DP-07); rights + right to complain to the ICO; "Cookies and storage" (no cookies; the basket is kept in this browser tab's session storage only) |
| Allergens | every published, non-archived item of the shop and every available option, grouped by category, with "Contains: …" / "May contain: …" / "None of the 14 allergens" from the allergen maps, the 14 allergen names, and "Have a food allergy? Call {shopName} on {phone} before you order." (UKC-ALG-09) |
| About our service fee | what it is (a fixed £X.XX per order paid to the platform that runs this ordering site), that it is the same for every order and every payment method, shown in the basket total from the first item, never discounted, not a tip (tips go 100% to the shop), returned when an order ends up fully refunded (architecture §9). Do not describe what happens to it on partial refunds (UKC-CRA-03) |
| Platform (`/legal/platform`) | `PLATFORM_IDENTITY` block; one paragraph on the platform's role |

Merchant platform terms (headings): "Our service", "Fees" (the per-order service fee taken as a Stripe application fee; subscription terms `TODO-HUMAN`; "we do not take a commission on your food sales"), "Payments, refunds and disputes" (shop is merchant of record; disputes are answered in the shop's own Stripe Dashboard; Stripe's fees are set by Stripe — link https://stripe.com/gb/pricing, no figures, UKC-PAY-04; refund policy as frozen in architecture §9 / decision A12: "the service fee is returned when an order ends up fully refunded, whether by one full refund, by several partial refunds that add up to the total, or by refunds made in your own Stripe Dashboard; while any part of the payment stays charged, the platform keeps the service fee; on disputes the platform keeps the service fee"), "Allergen information" (UKC-ALG-11 a–c incl. Natasha's Law/PPDS), "Tips" (UKC-NAME-05: pass 100% to workers; written tipping policy if tips are frequent), "Age-restricted products" (not permitted), "Data protection" (controller/processor, DPA summary), "Changes and contact". Merchant privacy notice: data about merchant users; "Storage in your browser" lists the Supabase sign-in session, `ppos.merchant.lang`, `ppos.merchant.shop` as strictly necessary / your preference (UKC-COOKIE-03).

### Rule → acceptance map (rules whose "Implemented in" names P1-17)

| Rule | Check (test name starts with the rule ID) |
|---|---|
| UKC-PRICE-02 | RTL: the "About our service fee" link exists **and** the visible fee notice is still rendered without interaction (link is additional, never a replacement) |
| UKC-PRICE-08, UKC-CRA-03, UKC-NAME-02 | `banned-strings.test.tsx`: case-insensitive, word-bounded scan of `apps/storefront/src/i18n/en-GB.ts`, `apps/storefront/src/legal/**` (non-test files), and, if present, `supabase/functions/_shared/notifications/templates.ts` and `supabase/functions/create-checkout/params.ts` for: `card fee`, `surcharge`, `service charge`, `card charge`, `processing fee`, `payment fee`, `no fees`, `no hidden fees`, `non-refundable`, `no refunds`. The test fails if en-GB.ts or the legal folder is missing, and prints which optional files were absent |
| UKC-NAME-01, UKC-NAME-03 | RTL: the fee page heading and footer link say "service fee"; no heading/label on the fee page matches `/tax|vat|processing|payment|card/i`; unit: every en-GB value under the `serviceFee.*` keys fails `/tax|vat|processing|payment|card/i` |
| UKC-NAME-05, UKC-ALG-11, UKC-PAY-03 | merchant RTL: the platform terms page has the "Tips", "Allergen information" and "Payments, refunds and disputes" headings, and the Payments section contains `ends up fully refunded` (decision A12); content approval = human check at P1-20 |
| UKC-PAY-04 | `grep -rnE "£20|1\.5%|1\.9%|2\.5%|3\.25%|(^|[^0-9.])20p([^x]|$)" apps/merchant/src/i18n apps/merchant/src/legal` → no output (the `20p` part ignores CSS sizes such as `720px` or `w-[320px]`) |
| UKC-CCR-03 | RTL + e2e: the terms page contains the same no-cancellation sentence as the checkout (one i18n key, two uses) |
| UKC-CCR-07 | e2e: from `/demo-chippy`, footer "Terms" → all seven terms headings visible |
| UKC-ID-01 | RTL: full fixture → every field rendered; sole-trader fixture (no company/VAT number) → those rows absent; e2e: legal name visible on menu, basket, checkout, each legal page, and `/o/<token>` (the last one only once P1-16 is merged; otherwise list it as pending in the trace file) |
| UKC-ID-05 | RTL (footer and terms identity block): a `limited_company` fixture shows `Registered office` and `Registered in England and Wales`; a `sole_trader` fixture shows neither |
| UKC-ID-07 | e2e: footer link "Online ordering by …" → `/legal/platform` |
| UKC-ALG-09 | e2e: footer "Allergens" → page lists the seeded fixture items with their allergens ("Contains: Milk") |
| UKC-DP-03, UKC-DP-07 | e2e: footer "Privacy" from every storefront route reaches the notice; RTL: headings incl. "How long we keep your data"; merchant `/legal/privacy` renders |
| UKC-COOKIE-01 | `storefront-privacy.spec.ts`: menu → item sheet → basket; `context.cookies()` is `[]`; every request host ∈ {storefront origin, Supabase URL host, functions URL host, `api.postcodes.io`} (hosts read from the same values the Playwright config passes to the app); no `<script src>`/`<link>` to another origin |
| UKC-COOKIE-03 | merchant RTL: privacy notice lists the three storage keys |

**Traceability file** `docs/takeaway/reviews/P1-17-compliance-trace.md`: one row per phase-1 rule ID of `uk-compliance.md` (PRICE-01…08, NAME-01…05, CCR-01…07, CRA-01…03, ID-01…07, ALG-01…11, AGE-01…02, VAT-01…04, DP-01…09, COOKIE-01…04, A11Y-01…06, PAY-01…04, MKT-01): owner task (from the rule's "Implemented in"), kind (`automated` / `human` / `later phase` / `planner gap`), evidence (`file:line` of the test whose name contains the ID, found with the grep below), status (`covered` / `pending <task>` / `human check at P1-20`). Do not mark a rule covered without a `file:line`.

## Acceptance

1. `pnpm --filter @ppos/storefront test` → green: footer, legal-pages and banned-strings tests per the map
2. `pnpm --filter @ppos/merchant test` → green: platform terms/privacy headings; `en-GB` and `zh-CN` key sets identical
3. `pnpm e2e` → `storefront-legal.spec.ts` and `storefront-privacy.spec.ts` green (network stubbed as in P1-10; fixed clock). Accessibility (decision G4): `storefront-legal.spec.ts` runs `const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze(); expect(r.violations).toEqual([]);` on each storefront legal page (`terms`, `privacy`, `allergens`, `service-fee`, `/legal/platform`), with `import AxeBuilder from '@axe-core/playwright';` (the P0-04 / P1-10 pattern)
4. `grep -L "LAWYER REVIEW REQUIRED" apps/storefront/src/legal/*Page.tsx apps/merchant/src/legal/*Page.tsx` → no output (every template carries the marker)
5. `grep -rnE "£20|1\.5%|1\.9%|2\.5%|3\.25%|(^|[^0-9.])20p([^x]|$)" apps/merchant/src/i18n apps/merchant/src/legal` → no output (UKC-PAY-04)
6. `grep -rnoE "UKC-[A-Z0-9]+-[0-9]{2}" apps packages supabase e2e --include='*.test.ts' --include='*.test.tsx' --include='*.spec.ts' --include='*.test.sql' | sort -u` → its output is reflected in the trace file; every P1-17 rule above has status `covered` with a `file:line`
7. `node scripts/guards/run-all.mjs` → exit 0 (no CJK outside `zh-CN.ts`, no `dangerouslySetInnerHTML`); `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log; follow-up: "human: fill PLATFORM_IDENTITY, lawyer review of all LAWYER REVIEW REQUIRED files")
- [ ] PR opened with the template; it lists every legal draft file for the lawyer and asks the human to check the footer at 375 px on the preview

## Stop and escalate if

- `shops.legal_form`, `registered_office_address` or `registered_in` is missing from `packages/core/src/db/database.types.ts` (P1-05/P1-08 not merged): do not add a migration or fake the fields.
- A legal statement needs a fact you do not have (Pocket Packet's legal details, retention periods, subscription terms): use the `TODO-HUMAN` / `TODO-LAWYER` placeholders; never invent them.
- A banned string is needed to explain something (e.g. "not a card surcharge"): rephrase without it; if impossible, ask under `## Blockers`.
- The storefront makes a request to a host outside the allowlist (e.g. a font CDN): fix the source; never widen the allowlist without an ADR (UKC-COOKIE-04).

## Hints (verified facts / pitfalls)

- The banned list applies to customer-facing text only; the merchant terms may say "service charge" when explaining the Tips Act. Keep that wording out of storefront files.
- Footer data on `/o/:token` comes from the `order-status` response (P1-16); if P1-16 is not merged yet, render the footer there from a prop and leave the wiring as a follow-up.
- A test that reads repo files can use `node:fs` with paths resolved from `import.meta.url`; exclude `*.test.*` files from the scan (the test itself contains the banned words).
- Strings quoted in `uk-compliance.md` are drafts; keep them in one place (i18n or the legal template) so tests and the lawyer read the same text.
