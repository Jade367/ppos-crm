# P1-01 — Core: money & pricing engine

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P0-01 |
| Mode | `standard` (golden tests already written and mutation-tested by the planner) |
| Reasoning effort | `max` (money) |
| Model | `glm-5.3` (never Flash) |
| Session budget | ≤ 3 hours wall-clock / one task. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | `docs/takeaway/acceptance/P1-01/pricing.acceptance.test.ts` (41 tests; install with `pnpm acceptance:install P1-01`) |

## Goal

`packages/core` gains the one and only price calculator, `priceOrder`, plus `formatPence`. The storefront uses it to show the basket total and `create-checkout` uses it to re-price from database prices, so both always agree to the penny. **The golden tests are the spec.** Where this card and the golden tests seem to differ, the golden tests win and you report the difference in `PROGRESS.md`.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/acceptance/P1-01/pricing.acceptance.test.ts` (all of it, before writing code)
- `docs/takeaway/reference/architecture.md` §4 Money, §5 Pricing rules, §13a (scripts)
- `docs/takeaway/reference/versions.md` (zod row), `docs/takeaway/reference/approved-deps.json`
- `docs/takeaway/adr/0002-core-deno-bridge.md` (how edge functions import core; written by P0-03)

## Out of scope

- Discount codes, promotions UI or storage (phase 2). The `discount` input exists only so the engine is ready.
- VAT calculation of any kind. Display components. Edge functions. Database.
- Any change to rounding, the service-fee rule or the application-fee rule (FROZEN; ADR only).

## Deliverables

| Path | Action |
|---|---|
| `packages/core/src/types.ts` | create (or extend if P1-02 already created it): `export type Fulfilment = 'collection' \| 'delivery'` |
| `packages/core/src/money.ts` | create: `formatPence`, `parsePoundsToPence` |
| `packages/core/src/pricing.ts` | create: types, `PricingError`, `priceOrder` |
| `packages/core/src/schemas/pricing.ts` | create: `pricingInputSchema` (zod) |
| `packages/core/src/index.ts` | modify: re-export everything above |
| `packages/core/tests/acceptance/pricing.acceptance.test.ts` | installed by `pnpm acceptance:install P1-01` (never edit) |
| `packages/core/tests/unit/money.test.ts`, `packages/core/tests/unit/pricing-schema.test.ts` | create |
| `packages/core/package.json`, `pnpm-lock.yaml` | modify: add `zod` (exact version) |
| `docs/takeaway/reference/versions.md` | modify: fill the zod row (version + how verified) |
| `supabase/functions/deno.json` | modify as ADR-0002 prescribes for core's bare imports (expected: `"zod": "npm:zod@<same exact version>"`) |
| `supabase/functions/_shared/core/**` | only if ADR-0002 chose option C: run `node scripts/dev/sync-core.mjs` after every change under `packages/core/src` and commit the copy (CI's `core-sync.test.ts` fails otherwise) |

## Spec

Exported API (names and shapes are fixed by the golden test imports):

```ts
export interface PricingOption { optionId: string; pricePence: number; quantity?: number } // quantity default 1
export interface PricingLine { itemId: string; unitPricePence: number; quantity: number; options?: PricingOption[] }
export interface PricingZone { feePence: number; minimumOrderPence: number; freeDeliveryThresholdPence?: number | null }
export type PricingDiscount =
  | { kind: 'percent'; basisPoints: number } | { kind: 'fixed'; amountPence: number } | { kind: 'free_delivery' };
export interface PricingInput {
  lines: PricingLine[]; fulfilment: Fulfilment; zone?: PricingZone | null;
  collectionMinimumOrderPence?: number; serviceFeePence: number; discount?: PricingDiscount | null; tipPence?: number;
}
export interface PricingResult {
  lines: { itemId: string; lineTotalPence: number }[]; // EXACTLY these two keys per line (golden test uses toEqual)
  itemsSubtotalPence: number; discountPence: number; deliveryFeePence: number; serviceFeePence: number;
  tipPence: number; totalPence: number; applicationFeePence: number;
  minimumOrderPence: number; meetsMinimumOrder: boolean; shortfallPence: number;
}
export type PricingErrorCode = 'EMPTY_BASKET' | 'INVALID_AMOUNT' | 'INVALID_QUANTITY' | 'ZONE_REQUIRED' | 'INVALID_DISCOUNT';
export class PricingError extends Error { readonly code: PricingErrorCode }
export function priceOrder(input: PricingInput): PricingResult;
export function formatPence(pence: number): string;
export function parsePoundsToPence(input: string): number;
```

Rules (architecture §5, made precise by the golden tests):

| # | Rule |
|---|---|
| 1 | `lineTotal = (unitPricePence + Σ option.pricePence × (option.quantity ?? 1)) × quantity`. Lines keep input order. |
| 2 | Quantities (line and option) are integers 1..99, else `INVALID_QUANTITY` (NaN, 0, -1, 1.5, 100 all fail). |
| 3 | Every money input (`unitPricePence`, option `pricePence`, `serviceFeePence`, `tipPence`, `collectionMinimumOrderPence`, zone fields when delivery) must be a safe integer ≥ 0, else `INVALID_AMOUNT` (catches -1, 3.5, 0.45, Infinity). Any intermediate that stops being a safe integer → `INVALID_AMOUNT`. |
| 4 | `lines: []` → `EMPTY_BASKET`. Delivery with `zone` missing or `null` → `ZONE_REQUIRED`. |
| 5 | Discount: `percent` needs integer `basisPoints` 1..10000; `fixed` needs integer `amountPence` ≥ 1; anything else → `INVALID_DISCOUNT`. `percent` = `Math.floor(itemsSubtotal × bps / 10000)`; `fixed` = `min(amount, itemsSubtotal)`; `free_delivery` = the delivery fee actually charged (0 on collection or above the threshold). `null`/missing = 0. |
| 6 | Delivery fee: 0 for collection (even if a zone is passed). Delivery: `zone.feePence`, or 0 when `freeDeliveryThresholdPence` is non-null and `itemsSubtotal ≥ threshold` (subtotal BEFORE discount). The fee is still reported when a `free_delivery` discount cancels it. |
| 7 | Service fee applies to every order and is never discounted. `applicationFeePence = serviceFeePence`. Tip defaults to 0 and never touches the application fee. |
| 8 | `totalPence = itemsSubtotal − discount + deliveryFee + serviceFee + tip`. |
| 9 | Minimum: delivery → `zone.minimumOrderPence`; collection → `collectionMinimumOrderPence ?? 0`. Compared with `itemsSubtotal` BEFORE discount. `shortfallPence = max(0, minimum − itemsSubtotal)`. Below the minimum still returns a full result. |
| 10 | Never mutate the input. No `Date`, no I/O, no floats except inside `formatPence`. |

`formatPence(pence)`: throws `RangeError` unless `Number.isSafeInteger(pence)`; otherwise `new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100)`. Verified outputs: `0 → £0.00`, `45 → £0.45`, `123456 → £1,234.56`, `-120 → -£1.20`.

`parsePoundsToPence(input)` (not in the golden tests; used later by merchant price inputs and the tip field): trim, optional leading `£`, then `^\d{1,5}(\.\d{1,2})?$`; parse the digit groups as integers (no `parseFloat`). Examples: `"9.50"→950`, `"9.5"→950`, `"9"→900`, `"£12.00"→1200`, `" 0.45 "→45`. Throws `RangeError` for `""`, `"abc"`, `"-1"`, `"9.505"`, `"1,000"`, `"1e3"`, `"£"`.

`pricingInputSchema` (zod): mirrors `PricingInput` with `.strict()` objects, integer and range checks identical to rules 2–5. The unit test parses a valid fixture and assigns the result to a `PricingInput` variable (compile-time compatibility), and rejects at least: unknown key, `quantity: 0`, `unitPricePence: 1.5`, `discount: { kind: 'percent', basisPoints: 0 }`. Use only the API of the zod major you installed (check its docs; error-customisation APIs differ between majors).

## Acceptance

1. `pnpm acceptance:install P1-01` → prints `installed packages/core/tests/acceptance/pricing.acceptance.test.ts`
2. Before implementing: `pnpm --filter @ppos/core test` → fails because the imports do not exist yet (paste the first error line into PROGRESS.md)
3. After implementing: `pnpm --filter @ppos/core test` → `pricing.acceptance.test.ts` 41 passed, unit tests passed, 0 failed
4. `git diff --exit-code main -- docs/takeaway/acceptance` → exit 0 (golden sources untouched; the installed copies are checked byte-for-byte by the acceptance-integrity guard in the next item)
5. `node scripts/guards/run-all.mjs` → exit 0 (acceptance-integrity: installed copy byte-identical; banned patterns: no `parseFloat`/`.toFixed`/`Date.now` in core)
6. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts' -not -path '*/node_modules/*') && deno test --allow-env --allow-net --allow-read` → exit 0 (the same commands as CI; option C: `core-sync.test.ts` passes)
7. `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template

## Stop and escalate if

- A golden test looks wrong. Write the test name, expected vs actual and your arithmetic under `## Blockers`. Never edit, skip or work around it.
- Making one golden test pass breaks another after 3 attempts (anti-loop rule).
- zod's installed major makes the schema awkward, or the core↔Deno bridge (ADR-0002) cannot resolve `zod`.

## Hints (verified facts / pitfalls)

- The golden helper `expectPricingError` requires `err instanceof PricingError`. With TS class transpilation, set `this.name = 'PricingError'` and keep the class a plain `extends Error`.
- `r.lines` is compared with `toEqual([{ itemId, lineTotalPence }])`: an extra key with a defined value (e.g. `quantity`) fails the test.
- Validate `discount` even when it is worth 0 (e.g. `percent` with `basisPoints: 0` on any basket → `INVALID_DISCOUNT`).
- `free_delivery` on a delivery order above the threshold: delivery fee 0 and discount 0 (golden test).
- Worked example from the business plan: £20.00 collection → `totalPence 2045`, `applicationFeePence 45`, `formatPence → £20.45`.
