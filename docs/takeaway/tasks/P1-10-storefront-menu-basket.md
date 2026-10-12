# P1-10 — Storefront: menu, item sheet, basket with up-front service fee, fulfilment & slots

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-01, P1-03, P1-04, P1-05, P0-04 |
| Mode | `standard` |
| Reasoning effort | `high` |
| Model | `glm-5.3` |
| Session budget | Two sessions on one branch `task/P1-10-storefront`, ≤ 4 h each (plan: Spec → Sessions; decision C20); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none (UK-compliance checks below are launch-blocking acceptance items) |

## Goal

A customer opens `/<shopSlug>`, browses the live menu with allergens, builds a basket, chooses collection or delivery and a time, fills in the checkout form and presses "Place order and pay £X.XX", which calls `create-checkout` (P1-11) and redirects to Stripe. The 45p service fee is visible **up front** at every step, as the DMCC Act 2024 drip-pricing rules require: a permanent notice on the menu, a running basket total that includes the fee from the first item, and an itemised checkout. Every amount comes from core `priceOrder`; the UI does no money arithmetic.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/uk-compliance.md` §0 (rules for agents), §1 UKC-PRICE, §2 UKC-NAME, §3 UKC-CCR, UKC-ID-06, UKC-ALG-03/04/08, UKC-COOKIE-02, UKC-A11Y-02/04/05, UKC-DP-02
- `docs/takeaway/reference/architecture.md` §4, §5, §11, §14 (customer copy only in `en-GB.ts`)
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` → anon columns of `shops` (column grants: never `select *`)
- `packages/core/src/{pricing,money,slots,zones}.ts`, `apps/storefront/src/` (P0-04 shell), `packages/ui/src/index.ts` (P0-04), `e2e/playwright.config.ts` (read only)
- Only if P1-07 is not merged: `docs/takeaway/tasks/P1-07-menu-builder.md` → Core (`ALLERGEN_KEYS`, `isSoldOut`)

## Out of scope

- The `create-checkout` function (P1-11), order status page (P1-16; only a placeholder route here), footer and legal pages (P1-17; link to `/<slug>/terms` as a placeholder).
- Discount codes, customer accounts, saved addresses, analytics, maps, any Stripe.js.
- Folding the fee into menu prices (needs an ADR and a golden-test change by a human).

## Deliverables

| Path | Action |
|---|---|
| `packages/core/src/allergens.ts` | create or extend (P1-07 may exist): `ALLERGEN_KEYS`, `AllergenMap` as in P1-07, plus `mergeAllergens(maps): { contains: AllergenKey[]; mayContain: AllergenKey[] }` (contains > may_contain > free, `ALLERGEN_KEYS` order) |
| `packages/core/src/menu.ts` | create only if P1-07 has not: `isSoldOut` exactly as the P1-07 card specifies (P1-07 extends the file later) |
| `packages/core/src/basket.ts` | create: `validateGroupSelection(group, selectedOptionIds)`, `basketToPricingInput(...)` |
| `packages/core/src/schemas/checkout.ts` | create: `checkoutRequestSchema` (below; P1-11 owns any later change) |
| `packages/core/src/index.ts`, `packages/core/tests/unit/*.test.ts` | modify / create |
| `apps/storefront/src/lib/supabase.ts` | create: client with no persisted auth session |
| `apps/storefront/src/data/*`, `src/basket/*`, `src/clock.ts` (injectable `now`) | create |
| `apps/storefront/src/pages/{Menu,Basket,Checkout,OrderStatusPlaceholder}Page.tsx` | create |
| `apps/storefront/src/components/{ServiceFeeNotice,BasketBar,ItemSheet,AllergenList,FulfilmentToggle,PostcodeLookup,SlotPicker,PriceBreakdown,TipSelector}.tsx` | create |
| `apps/storefront/src/i18n/en-GB.ts`, router file, `apps/storefront/src/**/*.test.tsx` | modify / create |
| `e2e/storefront-order.spec.ts`, `e2e/fixtures/storefront/*.json` | create |

`e2e/playwright.config.ts` is **not** a deliverable: P0-04's `storefront` project already matches `storefront-*.spec.ts` (regex `testMatch`, decision C3) and its `webServer` entries forward the dummy `VITE_*` values CI sets (decision C19). If either is not true, stop and escalate.

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR):
- **Session 1**: core `allergens.ts`, `basket.ts`, `schemas/checkout.ts` (and `menu.ts` if needed) + unit tests; `lib/supabase.ts`, `data/*`, `clock.ts`, basket storage; the router; `MenuPage`, `ServiceFeeNotice`, `ItemSheet`, `AllergenList`, `BasketBar`; RTL UKC-PRICE-01…04, UKC-ALG-03, UKC-ID-06, UKC-NAME-02/-03, UKC-A11Y-02 (Acceptance 1, part of 2). Gate: those tests + `pnpm verify:quick` → checkpoint commit `feat(storefront): menu, item sheet and basket bar [P1-10] (session 1/2)` → `git push -u origin task/P1-10-storefront` (no PR yet) → PROGRESS.md `## Current`: `P1-10 Session 1 done (<hash>); next: Session 2, first file apps/storefront/src/pages/BasketPage.tsx`. Stop.
- **Session 2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): `BasketPage`, `FulfilmentToggle`, `PostcodeLookup`, `SlotPicker`, `CheckoutPage`, `PriceBreakdown`, `TipSelector`, `OrderStatusPlaceholderPage`, submit; RTL UKC-PRICE-05/-06, UKC-CCR-01…04, UKC-ALG-04/-08 and the time states; the e2e spec, fixtures and axe checks (rest of Acceptance 2, then 3–5). Change Session 1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

**Components:** build pages from `@ppos/ui` (`Button`, `Input`, `Select`, `Card`, `Badge`, `Dialog` with `variant="sheet"` for the item sheet, `Spinner`); create no base components in `apps/storefront`.

**Routes:** `/:shopSlug` (menu), `/:shopSlug/basket`, `/:shopSlug/checkout`, `/o/:token` (placeholder "Order status", replaced by P1-16). Unknown or non-live shop → "We couldn't find this shop".

**Data (anon, explicit column lists):** shop by slug, visible categories, items, modifier groups and options, opening hours, closures, delivery zones. `createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } })`. Check these option names against the installed supabase-js (UKC-COOKIE-02).

**Basket:** `sessionStorage['ppos.basket.<shopSlug>']` = `{ version: 1, lines: [{ key, itemId, quantity, options: [{ optionId, quantity }] }], fulfilment, postcode, requestedTime, tipPence }`; never prices. Lines whose item or option disappeared, is unavailable or sold out are shown as "No longer available" and must be removed before checkout. The basket is **never cleared** by this card (the customer may come back from Stripe via `cancel_url`; P1-16 clears it after payment). Storage access wrapped in try/catch.

**Pricing:** one `priceOrder` call per render of a total, input from `basketToPricingInput` with menu prices, `shop.service_fee_pence`, the resolved zone (`toPricingZone`) and `tipPence`. Display only through `formatPence`. Never hard-code `£0.45`.

**Delivery before the postcode is known (FROZEN, architecture §11 / UKC-PRICE-05, decision A19):** price with the provisional zone `{ feePence: 0, minimumOrderPence: 0, freeDeliveryThresholdPence: null }`, so the bar shows items + service fee (+ tip) as `£9.45 incl. £0.45 service fee`, followed by `+ delivery from £1.50` (`formatPence(lowestDeliveryFeePence(zones))`). Never label a total "from" and never add a delivery fee yourself. Checkout stays disabled until a zone resolves. A shop with no zones (`lowestDeliveryFeePence` → `null`) offers collection only. Postcode flow: `normalisePostcode` (error message on invalid) → `GET https://api.postcodes.io/postcodes/<postcode>` → `resolveZone(shop, { postcode, lat, lng }, zones)`; 404 → "We couldn't find that postcode"; network failure → `lat/lng = null` (district zones still work); no zone → "Sorry, we don't deliver to <postcode>" + suggest collection.

**Time:** `getAvailability` with the injectable clock. Paused → "We're not taking online orders right now". No ASAP and no slots → "Closed, opens <nextOpening formatted with `new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })`, e.g. `Tue 17:00`>". Slot picker: "ASAP (ready about HH:mm)" when available, then Today / Tomorrow groups. Core returns Europe/London local ISO strings (P1-03 rule 8), so `HH:mm` = `iso.slice(11, 16)` and the local date = `iso.slice(0, 10)`. Format every time this way or with `Intl`; do not import luxon in `apps/storefront` (it is not an app dependency). Re-check the choice with `isRequestedTimeAvailable` before checkout. Browsing and adding stay possible when closed; checkout is disabled.

**Item sheet:** `role="dialog"` + `aria-modal`; groups as `fieldset`/`legend`, radios when `max_select = 1` else checkboxes; min/max enforced by `validateGroupSelection` with errors via `aria-describedby`; unavailable options disabled; **no option preselected**; quantity 1–99; merged allergens "Contains: …" / "May contain: …" (labels in `en-GB.ts`); add button "Add · £9.00" with "+ £0.45 service fee per order" directly beneath it in the same container; sold-out items (core `isSoldOut(item.sold_out_until, clock.nowIso())`) show "Sold out today" with the button disabled. Item photos have `alt` = item name (UKC-A11Y-05).

**Checkout form** (all labelled): name, mobile phone (`^(\+44|0)\d{9,10}$` after removing spaces), email, delivery address (line 1, line 2, city; postcode pre-filled from the lookup, read-only), notes ≤ 500, allergy note ≤ 500 with "Have a food allergy or intolerance? Call {shopName} on {phone} before you order." and a `tel:` link, tip selector labelled `Add a tip (optional) · 100% goes to the {shopName} team` (UKC-NAME-04 draft; starts at £0.00; buttons £1 / £2 / £3 with `aria-pressed`, none pressed initially; "Other amount" via `parsePoundsToPence`), an unticked "I agree to the Terms" checkbox, then the order summary (lines with options and quantities, fulfilment and time, Items / Delivery / Service fee / Tip / Total, shop legal name), the statement `Once the shop accepts your order it can't be cancelled, because food is prepared fresh. If something is wrong with your order, contact the shop.` (UKC-CCR-03, exact string) and the button **"Place order and pay £X.XX"** (Total of the same `priceOrder` result).

**`checkoutRequestSchema`** (`.strict()`): `shopSlug`, `fulfilment`, `requestedTime: string | null`, `lines: [{ itemId, quantity 1..99, options: [{ optionId, quantity? }] }]` (1..50 lines), `customer: { name 1..100, phone (form rule above), email }`, `delivery?: { line1 1..100, line2? ≤ 100, city 1..100, postcode }` (required iff delivery), `notes?` ≤ 500, `allergyNote?` ≤ 500, `tipPence` int 0..10000, `acceptTerms: true`.

**Submit:** `POST ${VITE_FUNCTIONS_URL}/create-checkout` (JSON, header `apikey: VITE_SUPABASE_PUBLISHABLE_KEY`); button disabled while pending. `200 { url, token }` → `window.location.assign(url)`. `400` → field errors; `409 SHOP_CLOSED | ITEM_UNAVAILABLE | BELOW_MINIMUM | OUT_OF_ZONE | SLOT_UNAVAILABLE` → explanation + back to basket; `503 PAYMENTS_NOT_READY` → "Online payment isn't available right now. Please call {shopName}."; network error or any other non-2xx → the generic retry message. `expectedTotalPence` and the `409 PRICE_CHANGED`, `404 SHOP_NOT_FOUND` and `429 RATE_LIMITED` handling are added by P1-11 (decision A10); do not add them here.

## Acceptance

RTL test names start with the rule ID. Fixture shop: name `Demo Chippy`, slug `demo-chippy`, `service_fee_pence 45`, item "Cod & chips" £9.00, item "Meal" £20.00, option "Sesame dip" (+£0.50, contains sesame), zones fee 150 and 250 (min 1200).

1. `pnpm --filter @ppos/core test` → green: `mergeAllergens` precedence; `validateGroupSelection` min/max; schema rejects a 501-character allergy note, an unknown key, `acceptTerms: false`, delivery without address
2. `pnpm --filter @ppos/storefront test` → green, including:
   - UKC-PRICE-01: empty basket → `getByText('A £0.45 service fee applies to every order.')` on the menu; with fee 50 → `A £0.50 service fee applies to every order.`
   - UKC-PRICE-02: that notice has no `hidden`/`aria-hidden` ancestor and is not inside a closed `<details>`
   - UKC-PRICE-03: add "Cod & chips" → bar shows `1 item · £9.45` and `incl. £0.45 service fee`
   - UKC-PRICE-04: the item sheet's fee text is inside the same container as the Add button
   - UKC-PRICE-05: "Cod & chips" in the basket, delivery, no postcode → the bar reads `£9.45 incl. £0.45 service fee` and `+ delivery from £1.50`, and the checkout button is disabled; postcode resolving to the 250 zone → total `£11.95` and "Add £3.00 more" (minimum 1200)
   - UKC-PRICE-06: checkout shows Items, Delivery, Service fee, Tip, Total; Total text equals the button amount
   - UKC-CCR-01: "Meal" on collection → `getByRole('button', { name: 'Place order and pay £20.45' })`
   - UKC-CCR-02 / -03: summary and the exact no-cancellation statement precede the button in DOM order and are visible without interaction; summary contains the legal name and "Service fee"
   - UKC-CCR-04 / UKC-NAME-04: tip starts at `£0.00`, no tip button `aria-pressed="true"`, no checked option in a fresh item sheet, terms box unchecked; the tip label reads `Add a tip (optional) · 100% goes to the Demo Chippy team`
   - UKC-ALG-03 / -04 / -08: choosing "Sesame dip" adds "Sesame" to "Contains"; checkout lines show allergens; the `tel:` href equals the shop phone
   - UKC-ID-06: menu shows "Prices include VAT where applicable. Delivery (if any) and the £0.45 service fee are shown in your basket total." (dictionary key `vatPositionNotice`, not `serviceFee*`)
   - UKC-NAME-02 / -03: no `en-GB.ts` value matches `/card fee|card charge|surcharge|processing fee|payment fee|service charge|no fees|no hidden fees|no refunds|non-refundable/i`; no value whose key starts with `serviceFee` matches `/tax|vat|processing|payment|card/i` (dictionary keys are flat camelCase, P0-04)
   - UKC-A11Y-02: keyboard only: open sheet, choose, add, Esc closes, focus returns to the trigger
3. `pnpm e2e` → `storefront-order.spec.ts` green. CI's e2e job has no Supabase; it sets dummy `VITE_*` values pointing at `http://127.0.0.1:54321` (decision C19), which P0-04's `webServer` forwards. Stub every request to that host (`**/rest/v1/**`, `**/create-checkout`) and `https://api.postcodes.io/**` with fixtures, run with no dev server of your own (`reuseExistingServer` would reuse it with your real env), and fix the clock with `page.clock.setFixedTime('2026-11-02T18:07:00Z')`. Flow: menu → scroll to the bottom, notice `toBeInViewport()` (UKC-PRICE-01) → add item → basket → checkout → button → captured request body passes `checkoutRequestSchema` with `tipPence: 0` → redirected to the stub URL → back to `/demo-chippy/basket`, lines still present (UKC-A11Y-04) → `context.cookies()` empty and `localStorage` empty (UKC-COOKIE-02). Accessibility (decision G4): on the menu, the open item sheet, the basket and the checkout, `const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze(); expect(r.violations).toEqual([]);` with `import AxeBuilder from '@axe-core/playwright';` (the P0-04 pattern; [H] confirm the tag names in the installed axe-core README)
4. `grep -rnE "serviceFee[A-Za-z]*\s*\+|\+\s*[A-Za-z.]*serviceFee|parseFloat|toFixed" apps/storefront/src` → no output (UKC-PRICE-03: no UI fee arithmetic)
5. `node scripts/guards/run-all.mjs` → exit 0 (no CJK, no `dangerouslySetInnerHTML`); `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template; the PR asks the human to check the menu, sheet, basket and checkout at 375 px on the Vercel preview

## Stop and escalate if

- Any compliance rule above conflicts with another, or the wording needs a legal choice (all copy is a draft for the lawyer; keep it in `en-GB.ts`).
- A total cannot be produced by `priceOrder` without UI arithmetic.
- Anon cannot read a column you need (P1-05 grants); never work around RLS.
- `e2e/playwright.config.ts` does not match `storefront-order.spec.ts` or does not forward the dummy `VITE_*` env (a P0-04 gap; do not edit the file in this card).

## Hints (verified facts / pitfalls)

- `£9.00 + £0.45 = £9.45`; delivery `900 + 250 + 45 = 1195 → £11.95`; `£20.00` collection → `£20.45` (P1-01 golden example).
- The browser clock may be read in the app layer (`src/clock.ts`) and passed to core; core itself stays pure.
- Strings quoted here are drafts from uk-compliance.md; tests may match them exactly because they live in one dictionary.
- The app must render with CI's dummy `VITE_*` values (decision C19): create the Supabase client without any request at import time.
