# P1-03 — Core: opening hours & time slots (Europe/London, DST)

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P0-01 |
| Mode | `tests-first` (session A writes test proposals, human freezes, session B implements) |
| Reasoning effort | `max` (time logic) |
| Model | `glm-5.3` (never Flash) |
| Session budget | Session A ≤ 2 h, session B ≤ 3 h. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | proposals (tests-first) → after freeze: `docs/takeaway/acceptance/P1-03/` |

## Goal

`packages/core` can answer, for one shop and one fulfilment type at a given instant: is it open, can the customer order ASAP and when would it be ready, which 15-minute slots can they pick today and tomorrow, and when does it next open. Everything is computed in `Europe/London` with luxon, including overnight sessions and both 2026/27 clock changes. The storefront (P1-10), shop settings preview (P1-08) and `create-checkout` (P1-11) all use this one implementation.

## Read first (and only these, plus what you find with grep)

- This card completely (session A: the scenario table is your test list)
- `docs/takeaway/reference/architecture.md` §2 (luxon), §7 `opening_hours` / `closures`, §13 testing contract
- `docs/takeaway/03-execution-handbook.md` §F.1 (tests-first protocol)
- `packages/core/src/index.ts`, `packages/core/src/types.ts` (`Fulfilment`)

## Out of scope

- UI, database queries, the hours editor (P1-08), slot validation inside `create-checkout` (P1-11).
- Shop time zones other than `Europe/London`. Delivery travel time (a slot is the requested ready/delivery time; no extra offset in P1).
- Session A: any implementation, stub or dependency change. Session B: editing tests.

## Deliverables

| Path | Action | Session |
|---|---|---|
| `docs/takeaway/acceptance-proposals/P1-03/proposal.json` | create (format below) | A |
| `docs/takeaway/acceptance-proposals/P1-03/hours-slots.acceptance.test.ts` | create | A |
| `docs/takeaway/acceptance-proposals/P1-03/CASES.md` | create (one row per test + open questions) | A |
| `packages/core/src/hours.ts` | create: types, validation, session → interval expansion | B |
| `packages/core/src/slots.ts` | create: `getAvailability`, `isRequestedTimeAvailable` | B |
| `packages/core/src/index.ts` | modify: re-export the API | B |
| `packages/core/package.json`, `pnpm-lock.yaml` | modify: `luxon` + `@types/luxon` (exact versions) | B |
| `docs/takeaway/reference/versions.md` | modify: luxon row | B |
| `supabase/functions/deno.json` | modify as ADR-0002 prescribes for core's bare imports (expected: `"luxon": "npm:luxon@<same exact version>"`) | B |
| `packages/core/tests/unit/hours.test.ts` | create: `londonWallTimeToInstant` gives the Hints target values; then, with luxon `Settings.now = () => Date.UTC(2026, 11, 1)` and again `() => Date.UTC(2026, 6, 1)`, and with `Settings.defaultZone` set to `'UTC'` and to `'Asia/Shanghai'`, H13 and H14 give exactly the table's results every time. Restore the original `Settings.now` and `Settings.defaultZone` in `afterEach` | B |
| `supabase/functions/_shared/core/**` | only if ADR-0002 chose option C: regenerate with `node scripts/dev/sync-core.mjs` and commit the copy (CI's `core-sync.test.ts` fails otherwise) | B |

`proposal.json` (exactly this shape; `freeze.mjs` rejects a `dest` outside a `tests/acceptance/` directory):

```json
{ "command": "pnpm --filter @ppos/core test",
  "files": [ { "file": "hours-slots.acceptance.test.ts", "dest": "packages/core/tests/acceptance/hours-slots.acceptance.test.ts" } ] }
```

## Spec

### Session steps

- **Session A** (branch `task/P1-03-tests`): write the three proposal files only. No files under `packages/`, no stubs, no dependency changes, no implementation "to check the tests". Run `pnpm acceptance:try P1-03` and paste its output into PROGRESS.md and the PR description. Every test must fail only because `getAvailability` / `isRequestedTimeAvailable` / `HoursError` do not exist yet (`is not a function`, `undefined`, `Right-hand side of 'instanceof' is not callable`), never because of a syntax error, an import-path error or runner setup. Fix the proposal until that is true. Commit `test(P1-03): propose acceptance tests`, push, open the PR "P1-03 acceptance proposals (for human review)", update PROGRESS.md, stop.
- **Human**: review CASES.md against the scenario table, edit the proposals if needed, run `node scripts/acceptance/freeze.mjs P1-03` in your own terminal, commit `test(P1-03): freeze acceptance tests`, add the label `protected-change-approved`, merge.
- **Session B** (fresh session, branch `task/P1-03-hours-slots`): `pnpm acceptance:install P1-03`, see the tests fail, implement. The frozen tests are the contract.

### API and rules

API (tests import these from `'../../src/index'`):

```ts
export interface OpeningSession { fulfilment: Fulfilment; weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7; opensAt: string; closesAt: string } // ISO weekday, Mon = 1; "HH:mm"
export interface Closure { startsAt: string; endsAt: string } // ISO-8601 instants with offset or Z
export interface AvailabilityInput {
  now: string; fulfilment: Fulfilment; sessions: OpeningSession[]; closures: Closure[];
  prepTimeMinutes: number; busyExtraMinutes: number; orderingPaused: boolean; slotMinutes?: number; // default 15
}
export interface Availability {
  isOpenNow: boolean; asapAvailable: boolean; earliestAsapTime: string | null; slots: string[]; nextOpening: string | null;
}
export type HoursErrorCode = 'INVALID_TIME' | 'INVALID_WEEKDAY' | 'INVALID_INSTANT' | 'INVALID_CLOSURE' | 'INVALID_MINUTES';
export class HoursError extends Error { readonly code: HoursErrorCode }
export function getAvailability(input: AvailabilityInput): Availability;
export function isRequestedTimeAvailable(availability: Availability, requestedTime: string | null): boolean;
```

Rules:
1. **Validation** → `HoursError`: `opensAt`/`closesAt` must match `^([01]\d|2[0-3]):[0-5]\d$` (`INVALID_TIME`; `"7:00"`, `"24:00"`, `"25:00"` fail); weekday integer 1..7 (`INVALID_WEEKDAY`); `now` and closure instants must be ISO-8601 with `Z` or `±HH:MM` (`INVALID_INSTANT`); closure `endsAt > startsAt` (`INVALID_CLOSURE`); prep and busy integers 0..240, `slotMinutes` ∈ {5, 10, 15, 20, 30, 60} (`INVALID_MINUTES`).
2. **Sessions → intervals.** Only sessions whose `fulfilment` matches. A session on local date D (ISO weekday = `weekday`) runs from D `opensAt` to D `closesAt`, or to D+1 `closesAt` when `closesAt <= opensAt` (equal = 24 h). Local wall times become instants through ONE helper exported from `hours.ts`, `londonWallTimeToInstant(localDate: string /* yyyy-MM-dd */, time: string /* HH:mm */): string`, which must not depend on the current time or on the machine's time zone. Build two candidates, `` DateTime.fromISO(`${localDate}T${time}`, { zone: 'UTC+1' }) `` and the same with `{ zone: 'UTC' }`. Keep the candidates whose `.setZone('Europe/London').toFormat('yyyy-MM-dd HH:mm')` equals the input and return the earliest one (rule 8 format): in the autumn repeated hour this is the **earlier** occurrence (`+01:00`). If neither candidate matches (spring gap), return the `UTC` candidate, so the time moves **forward one hour** (`01:30` → `02:30+01:00`). Never use `DateTime.fromObject(..., { zone: 'Europe/London' })`, `DateTime.local(...)` or `.set({ hour, minute })` on a Europe/London `DateTime` for this. [C] luxon 3.7.2 picks the repeated-hour occurrence from the offset of the real current time (`Settings.now()`) or of the `DateTime` being changed, so those results change between summer and winter.
3. Overlapping or touching intervals of the same fulfilment are merged. Then closures `[startsAt, endsAt)` are cut out. Result: **open intervals** `[a, b)`.
4. `isOpenNow` = some open interval has `a ≤ now < b`. `orderingPaused` does not change it.
5. `earliest` = `now + prep + busy`, rounded **up** to the whole minute. `asapAvailable` = not paused AND open now AND `earliest ≤ b` of the interval containing `now`. `earliestAsapTime` = `earliest` when `asapAvailable`, else `null`.
6. **Slots**: every instant `s` with minute divisible by `slotMinutes` and seconds 0, `s ≥ earliest`, inside some open interval with `a + prep ≤ s ≤ b`, and `s <` 00:00 local on (local date of `now`) + 2 days. Sorted ascending by instant, no duplicates. Empty when paused.
7. `nextOpening` = `null` when open now; otherwise the smallest `a > now` within 7 days of `now`, else `null`. Paused does not change it.
8. **Output format** for every time: Europe/London local with numeric offset, seconds, no milliseconds: `2026-10-25T01:45:00+01:00`, `2026-11-02T18:30:00+00:00` (luxon `toISO({ suppressMilliseconds: true })` in zone Europe/London; never `Z`).
9. `isRequestedTimeAvailable(av, null)` = `av.asapAvailable`. For a string: true iff it is a valid ISO instant equal (as an instant) to one of `av.slots`; invalid strings → false.
10. Pure: `now` is an argument; no `Date.now()`/`new Date()`.

### Required scenarios (session A turns every row into at least one test; expected values were computed with luxon 3 and must be written as literals)

Defaults unless stated: `fulfilment 'collection'`, `prepTimeMinutes 20`, `busyExtraMinutes 0`, `orderingPaused false`, no closures. **DAILY** = collection sessions on weekdays 1–7, `17:00`–`23:00`. 2026-11-02 is a Monday; 2026-10-25 and 2027-03-28 are Sundays.

| ID | Sessions / changes | `now` | Expected |
|---|---|---|---|
| H01 normal | DAILY | `2026-11-02T18:07:00Z` | open; ASAP `2026-11-02T18:27:00+00:00`; 42 slots, first `2026-11-02T18:30:00+00:00`, then `…18:45:00+00:00`, last `2026-11-03T23:00:00+00:00`; nextOpening null |
| H02 before opening | DAILY | `2026-11-02T10:00:00Z` | closed; ASAP false/null; nextOpening `2026-11-02T17:00:00+00:00`; 46 slots, first `2026-11-02T17:30:00+00:00` (opening + prep) |
| H03 ASAP at close | DAILY | `2026-11-02T22:40:00Z` | ASAP `2026-11-02T23:00:00+00:00`; 24 slots, first `2026-11-02T23:00:00+00:00` |
| H04 ASAP past close | DAILY | `2026-11-02T22:41:00Z` | open; ASAP false/null; 23 slots, first `2026-11-03T17:30:00+00:00`; nextOpening null |
| H05 at closing instant | DAILY | `2026-11-02T23:00:00Z` | closed; nextOpening `2026-11-03T17:00:00+00:00` |
| H06 seconds round up | DAILY | `2026-11-02T18:07:30Z` | ASAP `2026-11-02T18:28:00+00:00` |
| H07 summer time | DAILY | `2026-10-12T17:10:00Z` | ASAP `2026-10-12T18:30:00+01:00`; 42 slots, first `2026-10-12T18:30:00+01:00`, last `2026-10-13T23:00:00+01:00` |
| H08 overnight | Fri(5) `17:00`–`01:00` only | `2026-11-07T00:30:00Z` | open (Friday's session); ASAP `2026-11-07T00:50:00+00:00`; slots exactly [`2026-11-07T01:00:00+00:00`] |
| H09 overnight ended | as H08 | `2026-11-07T01:00:00Z` | closed; slots []; nextOpening `2026-11-13T17:00:00+00:00` |
| H10 clocks go back, 1st 01:20 | Sat(6) `17:00`–`02:00` | `2026-10-25T00:20:00Z` | open; ASAP `2026-10-25T01:40:00+01:00`; slots exactly [`2026-10-25T01:45:00+01:00`, `2026-10-25T01:00:00+00:00`, `2026-10-25T01:15:00+00:00`, `2026-10-25T01:30:00+00:00`, `2026-10-25T01:45:00+00:00`, `2026-10-25T02:00:00+00:00`] |
| H11 clocks go back, 2nd 01:20 | as H10 | `2026-10-25T01:20:00Z` | ASAP `2026-10-25T01:40:00+00:00`; slots exactly [`2026-10-25T01:45:00+00:00`, `2026-10-25T02:00:00+00:00`] |
| H12 same instant, other notation | as H10 | `2026-10-25T01:20:00+01:00` | deep-equal to H10's result |
| H13 close in repeated hour | Sat(6) `17:00`–`01:30` | `2026-10-25T00:05:00Z` | open; ASAP `2026-10-25T01:25:00+01:00`; slots exactly [`2026-10-25T01:30:00+01:00`] |
| H14 closed at FIRST 01:30 | as H13 | `2026-10-25T01:00:00Z` | closed; slots []; nextOpening `2026-10-31T17:00:00+00:00` |
| H15 clocks go forward | Sat(6) `17:00`–`03:00` | `2027-03-28T00:20:00Z` | ASAP `2027-03-28T00:40:00+00:00`; slots exactly [`2027-03-28T00:45:00+00:00`, `2027-03-28T02:00:00+01:00`, `2027-03-28T02:15:00+01:00`, `2027-03-28T02:30:00+01:00`, `2027-03-28T02:45:00+01:00`, `2027-03-28T03:00:00+01:00`] (no local 01:xx exists) |
| H16 close inside the gap | Sat(6) `17:00`–`01:30` | `2027-03-28T01:10:00Z` | open; ASAP `2027-03-28T02:30:00+01:00`; slots exactly [`2027-03-28T02:30:00+01:00`] |
| H17 after shifted close | as H16 | `2027-03-28T01:31:00Z` | closed; nextOpening `2027-04-03T17:00:00+01:00` |
| H18 closure mid-session | Mon(1) `17:00`–`23:00`; closure `2026-11-02T18:00:00Z`→`2026-11-02T19:00:00Z` | `2026-11-02T17:50:00Z` | open; ASAP false (18:10 is after the closure starts); 15 slots, first `2026-11-02T19:30:00+00:00`, last `2026-11-02T23:00:00+00:00` |
| H19 inside closure | as H18 | `2026-11-02T18:30:00Z` | closed; nextOpening `2026-11-02T19:00:00+00:00` |
| H20 full-day closure | DAILY; closure `2026-11-02T00:00:00Z`→`2026-11-03T00:00:00Z` | `2026-11-02T10:00:00Z` | closed; nextOpening `2026-11-03T17:00:00+00:00`; 23 slots, first `2026-11-03T17:30:00+00:00` |
| H21 paused | DAILY; `orderingPaused: true` | `2026-11-02T18:07:00Z` | `isOpenNow` true; ASAP false/null; slots []; nextOpening null |
| H22 busy mode | DAILY; busy 20 | `2026-11-02T18:07:00Z` | ASAP `2026-11-02T18:47:00+00:00`; 40 slots, first `2026-11-02T19:00:00+00:00` |
| H23 busy boundary | DAILY; busy 20 | `22:20:00Z` / `22:21:00Z` on 2026-11-02 | ASAP `2026-11-02T23:00:00+00:00` / ASAP false |
| H24 hours differ by fulfilment | collection Mon `17:00`–`23:00`; delivery Mon `17:30`–`22:30` | `2026-11-02T22:15:00Z` | collection: ASAP `…22:35:00+00:00`, slots [`2026-11-02T22:45:00+00:00`, `2026-11-02T23:00:00+00:00`]; delivery: open, ASAP false, slots [] |
| H25 delivery not open yet | as H24, delivery | `2026-11-02T17:10:00Z` | closed; nextOpening `2026-11-02T17:30:00+00:00`; 19 slots, first `2026-11-02T18:00:00+00:00`, last `2026-11-02T22:30:00+00:00` |
| H26 Sunday → Monday | Sun(7) `18:00`–`02:00` | `2026-11-09T01:00:00Z` | open; ASAP `2026-11-09T01:20:00+00:00`; slots exactly [`…01:30:00+00:00`, `…01:45:00+00:00`, `…02:00:00+00:00`] (2026-11-09) |
| H27 after the wrap | as H26 | `2026-11-09T02:00:00Z` | closed; nextOpening `2026-11-15T18:00:00+00:00` |
| H28 touching sessions merge | Mon `12:00`–`14:00` + Mon `14:00`–`22:00` | `2026-11-02T13:50:00Z` | ASAP `2026-11-02T14:10:00+00:00`; 32 slots, first `…14:15:00+00:00`, last `…22:00:00+00:00` |
| H29 requested time | H01 / H10 results | — | H01: `"2026-11-02T18:30:00Z"` true, `"2026-11-02T18:40:00Z"` false, `null` true; H10: `"2026-10-25T01:00:00Z"` true, `"2026-10-25T00:00:00Z"` false; H21 result + `null` → false |
| H30 validation | — | — | one test per error code with the bad values from rule 1 |

## Acceptance

Session A:
1. `git diff --name-only main...HEAD` → only files under `docs/takeaway/acceptance-proposals/P1-03/` plus `docs/takeaway/PROGRESS.md`
2. `node scripts/guards/run-all.mjs` → exit 0 (no `.skip`/`.only`/`.todo`, no CJK)
3. CASES.md has a row for every scenario H01–H30; every expected value in the test file is a literal
4. `pnpm acceptance:try P1-03` → non-zero exit; every failure is a missing export; output pasted into PROGRESS.md and the PR; afterwards `git status --porcelain packages` → empty

Human: review against this card, then `node scripts/acceptance/freeze.mjs P1-03` (human only), commit, label `protected-change-approved`, merge.

Session B:
1. `pnpm acceptance:install P1-03` → installs `packages/core/tests/acceptance/hours-slots.acceptance.test.ts`; run it once and paste the failure (missing exports) into PROGRESS.md
2. `pnpm --filter @ppos/core test` → all hours-slots tests and `hours.test.ts` pass, 0 failed
3. `TZ=UTC pnpm --filter @ppos/core test` and `TZ=Asia/Shanghai pnpm --filter @ppos/core test` → both 0 failed (results must not depend on the machine's time zone; paste both summaries)
4. `git diff --exit-code main -- docs/takeaway/acceptance` → exit 0 (installed copies are checked by the acceptance-integrity guard in `pnpm verify`)
5. `cd supabase/functions && deno check $(find . -name '*.ts' -not -name '*.test.ts' -not -path '*/node_modules/*') && deno test --allow-env --allow-net --allow-read` → exit 0 (core with luxon still resolves under Deno; option C: `core-sync.test.ts` passes)
6. `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths of the current session changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template (session A: title "P1-03 acceptance proposals (for human review)", then stop)

## Stop and escalate if

- Session A: a scenario's expected value contradicts the rules above. Write both readings into CASES.md "Open questions" and the PR; do not silently pick one.
- Session B: a frozen test looks wrong (test name, expected vs actual, your reasoning under `## Blockers`), or the same failure survives 3 attempts.
- The core↔Deno bridge (ADR-0002) cannot resolve `luxon`.

## Hints (verified facts / pitfalls)

- Session A may import only `vitest` and `'../../src/index'`. Do not compute expected values with luxon in the test; write the strings from the table.
- Target values of `londonWallTimeToInstant`, independent of today's date and of `TZ`: `('2026-10-25', '01:30')` → `2026-10-25T01:30:00+01:00` (00:30Z); `('2027-03-28', '01:30')` → `2027-03-28T02:30:00+01:00` (01:30Z); `('2026-10-25', '02:00')` → `2026-10-25T02:00:00+00:00`. [C] Checked with luxon 3.7.2 under `Settings.now` = July 2026 and December 2026, and with `TZ=Asia/Shanghai`.
- Generate slots by stepping instants (UTC milliseconds) in `slotMinutes` steps from `earliest` rounded up. UK offsets are whole hours, so UTC alignment equals local alignment, and the repeated hour appears twice automatically.
- Expand sessions for local dates `today − 1` (overnight sessions still running) to `today + 8` (nextOpening search).
- `new Date()` in core is a guard failure; use `DateTime.fromISO(now, { setZone: true })` and compare with `toMillis()`.
