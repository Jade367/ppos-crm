# P1-04 — Core: delivery zones (postcodes, radius)

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P0-01 |
| Mode | `tests-first` (session A writes test proposals, human freezes, session B implements) |
| Reasoning effort | `high` |
| Model | `glm-5.3` (never Flash) |
| Session budget | Session A ≤ 1.5 h, session B ≤ 2 h. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | proposals (tests-first) → after freeze: `docs/takeaway/acceptance/P1-04/` |

## Goal

`packages/core/src/zones.ts` normalises UK postcodes and decides which delivery zone (if any) a customer falls into, by postcode district or by straight-line distance from the shop. The storefront (P1-10) uses it for display, the settings editor (P1-08) for validation, and `create-checkout` (P1-11) for the authoritative server-side check, so all three agree.

## Read first (and only these, plus what you find with grep)

- This card completely (session A: the example tables are your test list)
- `docs/takeaway/reference/architecture.md` §5 rule 4, §7 `delivery_zones`
- `docs/takeaway/03-execution-handbook.md` §F.1 (tests-first protocol)
- `packages/core/src/index.ts`, `packages/core/src/pricing.ts` (`PricingZone`, from P1-01 if merged)

## Out of scope

- Calling postcodes.io or any network (callers pass `lat`/`lng`; core is pure).
- Polygons, drive time, postcode sectors (`M14 5`), checking that a postcode really exists (postcodes.io does that).
- Session A: any implementation or stub. Session B: editing tests.

## Deliverables

| Path | Action | Session |
|---|---|---|
| `docs/takeaway/acceptance-proposals/P1-04/proposal.json` | create | A |
| `docs/takeaway/acceptance-proposals/P1-04/zones.acceptance.test.ts` | create | A |
| `docs/takeaway/acceptance-proposals/P1-04/CASES.md` | create (one row per test + open questions) | A |
| `packages/core/src/zones.ts` | create | B |
| `packages/core/src/index.ts` | modify: re-export | B |
| `supabase/functions/_shared/core/**` | only if ADR-0002 chose option C: `node scripts/dev/sync-core.mjs`, commit the copy (CI's `core-sync.test.ts` fails otherwise) | B |

`proposal.json` (exactly this shape; `dest` must be inside a `tests/acceptance/` directory):

```json
{ "command": "pnpm --filter @ppos/core test",
  "files": [ { "file": "zones.acceptance.test.ts", "dest": "packages/core/tests/acceptance/zones.acceptance.test.ts" } ] }
```

## Spec

### Session steps

- **Session A** (branch `task/P1-04-tests`): write the three proposal files only; no code in `packages/`. Run `pnpm acceptance:try P1-04` and paste the output into PROGRESS.md and the PR description. Every test must fail only because `normalisePostcode` / `resolveZone` / `ZoneError` etc. are not exported yet, never because of syntax or import errors. Fix the proposal until that is true. Commit `test(P1-04): propose acceptance tests`, push, open the PR "P1-04 acceptance proposals (for human review)", update PROGRESS.md, stop.
- **Human**: review, then `node scripts/acceptance/freeze.mjs P1-04` (human only), commit `test(P1-04): freeze acceptance tests`, label `protected-change-approved`, merge.
- **Session B** (fresh, branch `task/P1-04-zones`): `pnpm acceptance:install P1-04`, see the tests fail, implement.

### API (tests import from `'../../src/index'`)

```ts
export interface GeoPoint { lat: number; lng: number }
export interface NormalisedPostcode { postcode: string; outward: string; inward: string } // 'M14 5AA', 'M14', '5AA'
export interface DeliveryZone {
  id: string; kind: 'postcode_districts' | 'radius';
  postcodeDistricts: string[];   // used when kind = 'postcode_districts'
  radiusM: number | null;        // used when kind = 'radius'
  feePence: number; minimumOrderPence: number; freeDeliveryThresholdPence: number | null;
  priority: number;              // lower number wins
}
export interface CustomerLocation { postcode: string; lat: number | null; lng: number | null }
export type ZoneErrorCode = 'INVALID_POSTCODE' | 'INVALID_DISTRICT' | 'INVALID_COORDINATES' | 'INVALID_ZONE';
export class ZoneError extends Error { readonly code: ZoneErrorCode }
export function normalisePostcode(input: string): NormalisedPostcode;
export function normaliseDistrict(input: string): string;
export function distanceMetres(a: GeoPoint, b: GeoPoint): number;
export function resolveZone(shop: GeoPoint | null, customer: CustomerLocation, zones: DeliveryZone[]): DeliveryZone | null;
export function lowestDeliveryFeePence(zones: DeliveryZone[]): number | null;
export function toPricingZone(zone: DeliveryZone): { feePence: number; minimumOrderPence: number; freeDeliveryThresholdPence: number | null };
```

### Rules

1. `normalisePostcode`: trim, uppercase, remove all whitespace; length 5–7; `inward` = last 3 characters and must match `^[0-9][A-Z]{2}$`; `outward` = the rest and must match `^[A-Z]{1,2}[0-9][A-Z0-9]?$`; `postcode` = `outward + ' ' + inward`. Anything else → `ZoneError('INVALID_POSTCODE')`. Hyphens and other characters are not stripped.
2. `normaliseDistrict`: trim + uppercase, must match the outward pattern above, else `INVALID_DISTRICT`.
3. `distanceMetres`: haversine with Earth radius **6 371 000 m**, result rounded with `Math.round` to whole metres (so boundary tests are exact). Latitude must be finite in [−90, 90], longitude finite in [−180, 180], else `INVALID_COORDINATES`.
4. `resolveZone`: normalise `customer.postcode` (invalid → `INVALID_POSTCODE`). `lat` and `lng` must be both `null` or both valid per rule 3, and a non-null `shop` must be valid too; this is checked up front, even when no radius zone exists (else `INVALID_COORDINATES`). Validate every zone first (`INVALID_ZONE`): district zones need a non-empty list of valid districts; radius zones need an integer `radiusM` ≥ 1; money fields safe integers ≥ 0 (threshold may be `null`); `priority` integer.
   - A `postcode_districts` zone matches when the customer's **outward code equals** one of its districts after `normaliseDistrict` (exact match: `M1` never matches `M14`, `M14` never matches `M1`).
   - A `radius` zone matches when `shop` is not null, customer `lat`/`lng` are not null, and `distanceMetres(shop, customer) ≤ radiusM` (equal counts as inside).
   - Among matches return the one with the lowest `priority`; ties go to the zone that comes first in the input array. Return the matching **element of the input array** (same object, unmodified). No match → `null`.
5. `lowestDeliveryFeePence`: minimum `feePence` over the zones; `null` for an empty list (used for "Delivery from £X.XX", P1-10).
6. `toPricingZone`: copies the three fields; output feeds `priceOrder`.
7. Pure: no network, no clock, no mutation of inputs.

### Required examples (session A turns every row into at least one test; values verified with Node)

`normalisePostcode`: `"m14 5aa"` → `{ postcode: 'M14 5AA', outward: 'M14', inward: '5AA' }`; `"SW1A1AA"` → `SW1A 1AA` / `SW1A` / `1AA`; `"  sw1a   1aa "` → `SW1A 1AA`; `"m1 1ae"` → `M1 1AE`; also valid: `EC1A 1BB`, `W1A 0AX`, `B33 8TH`, `CR2 6XH`, `DN55 1PT`. Invalid (`INVALID_POSTCODE`): `"ABC"`, `""`, `"M14 5A"`, `"1M4 5AA"`, `"M14 AAA"`, `"M14-5AA"`, `"M145AAA"`.
`normaliseDistrict`: `" m14 "` → `M14`; `"M14 5AA"` and `"14M"` → `INVALID_DISTRICT`.

Shop `S = { lat: 53.4500, lng: -2.2300 }`. Distances: to `{53.4590, -2.2300}` = **1001**; to `{53.4410, -2.2300}` = 1001; to `{53.4500, -2.2150}` = **993**; to `{53.4808, -2.2426}` = **3525**; to itself = 0.

Zones (in this array order): `A = { id: 'A', kind: 'postcode_districts', postcodeDistricts: ['M14', 'm13'], radiusM: null, feePence: 250, minimumOrderPence: 1200, freeDeliveryThresholdPence: null, priority: 1 }`, `B = { id: 'B', kind: 'radius', postcodeDistricts: [], radiusM: 1001, feePence: 150, minimumOrderPence: 1000, freeDeliveryThresholdPence: 2500, priority: 0 }`, `C = { id: 'C', kind: 'radius', postcodeDistricts: [], radiusM: 3000, feePence: 350, minimumOrderPence: 1500, freeDeliveryThresholdPence: null, priority: 2 }`.

| ID | shop | customer | zones | Expected |
|---|---|---|---|---|
| Z01 | S | `M14 5AA` at 53.4590, −2.2300 (1001 m) | A, B, C | `B` (all match; priority 0; boundary 1001 ≤ 1001) |
| Z02 | S | `M14 5AA` at 53.4808, −2.2426 (3525 m) | A, B, C | `A` (only district) |
| Z03 | S | `M1 1AE` at 53.4808, −2.2426 | A, B, C | `null` (M1 ≠ M14/M13; 3525 > 3000) |
| Z04 | S | `M1 1AE` at 53.4500, −2.2150 (993 m) | A, B, C | `B` |
| Z05 | S | `m13 9pl`, lat/lng `null` | A, B, C | `A` (radius zones skipped; lowercase district in zone still matches) |
| Z06 | `null` | `M1 1AE` at 53.4500, −2.2150 | A, B, C | `null` (radius needs the shop location) |
| Z07 | S | `M1 1AE` at 53.4590, −2.2300 (1001 m) | B with `radiusM: 1000` | `null` (1001 > 1000) |
| Z08 | S | `M14 5AA`, `null` | A, and A2 = copy of A with id `A2` | `A` (tie → first in array); reversed order → `A2` |
| Z09 | S | `M14 5AA`, `null` | `[]` | `null` |
| Z10 | S | `ABC`, `null` | A | throws `INVALID_POSTCODE` |
| Z11 | S | `M14 5AA`, lat 91 / lng 0 | A | throws `INVALID_COORDINATES`; lat 53 with lng `null` → `INVALID_COORDINATES` |
| Z12 | S | `M14 5AA`, `null` | radius zone with `radiusM: 0`; district zone with `[]`; zone with `feePence: -1` | each throws `INVALID_ZONE` |
| Z13 | — | — | A, B, C | `lowestDeliveryFeePence` = 150; `[]` → `null`; `toPricingZone(B)` → `{ feePence: 150, minimumOrderPence: 1000, freeDeliveryThresholdPence: 2500 }` |
| Z14 | S | `M14 5AA`, `null` | A | the zone array and zone objects are deep-equal to a snapshot taken before the call |

## Acceptance

Session A:
1. `git diff --name-only main...HEAD` → only `docs/takeaway/acceptance-proposals/P1-04/*` and `docs/takeaway/PROGRESS.md`
2. `node scripts/guards/run-all.mjs` → exit 0
3. CASES.md lists every example above (Z01–Z14 and each postcode string)
4. `pnpm acceptance:try P1-04` → non-zero exit; fails only on missing exports; output pasted into PROGRESS.md and the PR; afterwards `git status --porcelain packages` → empty

Session B:
1. `pnpm acceptance:install P1-04` → installs `packages/core/tests/acceptance/zones.acceptance.test.ts`; first run fails on missing exports (paste it)
2. `pnpm --filter @ppos/core test` → all zones tests pass, 0 failed
3. `git diff --exit-code main -- docs/takeaway/acceptance` → exit 0 (installed copies are checked by the acceptance-integrity guard in `pnpm verify`)
4. `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths of the current session changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template (session A: then stop)

## Stop and escalate if

- An example in this card contradicts a rule in this card (write both into CASES.md "Open questions").
- Session B: a frozen test looks wrong, or the same failure survives 3 attempts.

## Hints (verified facts / pitfalls)

- Session A: import only `vitest` and `'../../src/index'`; expected values are the literals above. Use `toBe(zones[1])` style identity checks where the rule says "same object".
- The rounding in `distanceMetres` is deliberate: 1000.754 m becomes 1001, so `radiusM: 1001` is inside and `1000` is outside on every platform.
- The UK uses whole-word outward codes; never use `startsWith` for district matching (`'M14'.startsWith('M1')` is the classic bug).
- `Math.asin`/`Math.atan2` variants of haversine agree after rounding for these points; pick one.
