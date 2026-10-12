# P1-08 — Shop settings: hours, prep time, busy mode, zones, legal identity

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-06, P1-03, P1-04, P1-01 |
| Mode | `standard` |
| Reasoning effort | `high` |
| Model | `glm-5.3` |
| Session budget | Two sessions on one branch `task/P1-08-shop-settings`, ≤ 3 h each (plan: Spec → Sessions); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none |

## Goal

Managers and owners configure everything that decides when and where their shop takes orders, plus the legal identity the storefront must display: opening hours per fulfilment (several sessions per day, overnight sessions), closures, prep time, busy mode, pause ordering, collection/delivery switches, delivery zones, the late-night refreshment licence confirmation (UKC-AGE-03), and business identity: legal name and legal form (with company number, registered office and part of the UK for limited companies and LLPs), a basic-rate public phone number and a UK mobile for staff alerts. Settings changes on the shop row are audit-logged. All input is validated by zod schemas in core, and a live preview of the next slots uses the P1-03 engine, so what the merchant sees is what customers will get.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §7 `shops`, `opening_hours`, `closures`, `delivery_zones`; §11
- `docs/takeaway/reference/uk-compliance.md` UKC-ID-01…05, UKC-CCR-05, UKC-AGE-03
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` → `shops_guard_update` whitelist, `shops_go_live_check` row (its identity codes), RLS matrix
- `packages/core/src/{hours,slots,zones}.ts` (P1-03, P1-04), `apps/merchant/src/auth/*` (P1-06), `packages/ui/src/index.ts` (P0-04)

## Out of scope

- Payments / Stripe status (P1-09), the `shops_go_live_check` trigger (P1-05) and the "Go live" button (P1-09); this card provides `goLiveIdentityProblems` with the trigger's identity codes. Storefront footer (P1-17).
- Changing `status`, `service_fee_pence`, `slug`, `auto_reject_after_minutes`, `crm_customer_id` (platform admin only; the trigger rejects them).
- Audit rows for opening hours, closures and zones (follow-up), FHRS badge (P2), map widgets.

## Deliverables

| Path | Action |
|---|---|
| `packages/core/src/schemas/settings.ts` | create: zod schemas below |
| `packages/core/src/hours-overlap.ts` | create: `findOverlappingSessions` |
| `packages/core/src/phone.ts` | create: `normaliseUkPhone`, `isBasicRateUkPhone`, `isUkMobile` |
| `packages/core/src/shop-identity.ts` | create: `identityWarnings`, `goLiveIdentityProblems` |
| `packages/core/src/late-night.ts` | create: `requiresLateNightLicence` |
| `packages/core/src/index.ts`, `packages/core/tests/unit/*.test.ts` | modify / create |
| `supabase/migrations/<ts>_p1_08_settings_rpc_and_audit.sql` | create (`pnpm exec supabase migration new p1_08_settings_rpc_and_audit`) |
| `supabase/tests/settings/{replace_opening_hours,shop_settings_audit}.test.sql` | create (pgTAP, outside `acceptance/`) |
| `packages/core/src/db/database.types.ts` | regenerate |
| `apps/merchant/src/pages/settings/{Hours,Closures,Ordering,Zones,Business}Page.tsx` (+ small components) | create |
| `apps/merchant/src/i18n/en-GB.ts`, `zh-CN.ts`, router file, `apps/merchant/src/**/*.test.tsx` | modify / create |

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR):
- **Session 1**: core schemas and helpers + unit tests, the migration, pgTAP, regenerated types (Acceptance 1, 2, 4). Gate: those items + `pnpm verify:quick` → checkpoint commit `feat(settings): core schemas, RPC and audit [P1-08] (session 1/2)` → `git push -u origin task/P1-08-shop-settings` (no PR yet) → PROGRESS.md `## Current`: `P1-08 Session 1 done (<hash>); next: Session 2, first file apps/merchant/src/pages/settings/OrderingPage.tsx`. Stop.
- **Session 2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): the five pages, i18n, RTL tests (Acceptance 3, 5). Change Session 1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

Build pages from `@ppos/ui` components; create no base components in `apps/merchant`. RTL tests reference Chinese only through the zh-CN dictionary object, never CJK literals (`cjk-lint` scans tests too).

**Zod schemas (`.strict()`)**

| Schema | Rules |
|---|---|
| `openingSessionInput` | `fulfilment`, `weekday` 1..7, `opensAt`/`closesAt` `HH:mm` (P1-03 regex), `opensAt ≠ closesAt` (the editor never creates 24 h sessions) |
| `weeklyHoursInput` | sessions of one fulfilment; `findOverlappingSessions` must be empty; ≤ 4 sessions per weekday |
| `closureInput` | `startsAt`/`endsAt` ISO with offset, `endsAt > startsAt`, `reason` ≤ 200 |
| `orderingSettingsInput` | `prepTimeMinutes` int 5..120; `busyExtraMinutes` ∈ {0, 10, 20, 30}; `orderingPaused`; `collectionEnabled`, `deliveryEnabled` (at least one true) |
| `deliveryZoneInput` | `kind: 'postcode_districts'` → 1..50 districts, each through `normaliseDistrict`, de-duplicated; `kind: 'radius'` → `radiusM` int 100..20000; `feePence`, `minimumOrderPence` int 0..100000; `freeDeliveryThresholdPence` null or int 1..100000; `priority` int 0..100 |
| `businessIdentityInput` | `name` 1..100; `legalName` 1..200; `addressLine1` 1..200, `addressLine2` ≤ 200, both rejecting `/\bP\.?\s*O\.?\s*Box\b/i` (UKC-ID-03); `city` 1..100; `postcode` via `normalisePostcode`; `email`; `phone` must pass `isBasicRateUkPhone`; `vatNumber` optional ≤ 20; `legalForm` ∈ `sole_trader` \| `partnership` \| `limited_company` \| `llp` \| `other` (required). When `legalForm` is `limited_company` or `llp`: `companyNumber` 1..20, `registeredOfficeAddress` 1..300 (also rejecting the PO Box regex) and `registeredIn` ∈ `england_wales` \| `scotland` \| `northern_ireland` are required; otherwise they are optional (`companyNumber` ≤ 20). `alertPhone` required, must pass `isUkMobile` (staff alerts only; never shown to customers) |

**Helpers**
- `findOverlappingSessions(sessions)`: returns index pairs. Each session is a weekly interval: start = (weekday − 1) × 1440 + opens; end = start + (closes − opens, or + 1440 when `closes ≤ opens`), modulo 10 080 minutes (Sunday overnight wraps into Monday). Touching is not overlapping. Examples: Mon 12:00–14:00 + Mon 14:00–22:00 → none; Mon 17:00–23:00 + Mon 22:00–23:30 → overlap; Sun 18:00–02:00 + Mon 01:00–05:00 → overlap; Fri 17:00–01:00 + Sat 01:00–03:00 → none.
- `normaliseUkPhone(input)`: strip spaces, `-`, `(`, `)`; `+44` or `0044` → `0`; must match `^0\d{9,10}$`, else `null`. `isBasicRateUkPhone`: normalises and rejects prefixes `09`, `084`, `087` (UKC-CCR-05). Examples: `0161 496 0000` ✓, `07700 900123` ✓, `+44 161 496 0000` → `01614960000` ✓, `0845 600 0000` ✗, `0870 000 0000` ✗, `0906 000 0000` ✗, `118 118` ✗.
- `isUkMobile(input)`: `normaliseUkPhone(input)` matches `^07\d{9}$`. Examples: `07700 900123` ✓, `+44 7700 900123` ✓, `0161 496 0000` ✗, `118 118` ✗. P1-14 reuses this helper for SMS/voice to `alert_phone` (decision C13); if it already exists, keep it.
- `requiresLateNightLicence(sessions)`: true when any session has `closesAt <= opensAt` (ends the next day), `closesAt > '23:00'` or `opensAt < '05:00'` (UKC-AGE-03). Examples: 17:00–23:00 → false; 17:00–23:30 → true; 17:00–01:00 → true; 04:30–10:00 → true; 05:00–14:00 → false.
- `identityWarnings(input)`: soft warnings only (UKC-ID-04, formats unverified): `COMPANY_NUMBER_FORMAT` unless `^([0-9]{8}|[A-Z]{2}[0-9]{6})$`; `VAT_NUMBER_FORMAT` unless (spaces removed, uppercased) `^GB([0-9]{9}|[0-9]{12})$`. They never block saving.
- `goLiveIdentityProblems(shop)`: input has `legal_name`, `legal_form`, `address_line1`, `city`, `postcode`, `email`, `phone`, `company_number`, `registered_office_address`, `registered_in`. Missing = null or empty after trimming. Returns, in this order (the same strings and order as P1-05's `shops_go_live_check`): `LEGAL_NAME_MISSING`, `LEGAL_FORM_MISSING`, `ADDRESS_MISSING` (`address_line1`), `CITY_MISSING`, `POSTCODE_MISSING`, `EMAIL_MISSING`, `PHONE_MISSING`; and, only when `legal_form` is `limited_company` or `llp`, `COMPANY_NUMBER_MISSING`, `REGISTERED_OFFICE_MISSING`, `REGISTERED_IN_MISSING` (UKC-ID-02/05). `alert_phone` is not a go-live condition, but the business page warns when it is missing.

**Migration `p1_08_settings_rpc_and_audit`**
- `replace_opening_hours(p_shop_id uuid, p_fulfilment text, p_sessions jsonb)`: `language plpgsql`, SECURITY INVOKER (RLS applies), `set search_path = ''`. First statement: `if not (public.is_shop_member(p_shop_id, 'manager') or public.is_platform_admin()) then raise exception 'forbidden' using errcode = '42501'; end if;` (so the error does not depend on `p_sessions` being non-empty); then deletes that shop's rows for that fulfilment and inserts the given sessions in one transaction. `revoke execute … from public, anon; grant execute … to authenticated`.
- Trigger `audit_shop_settings_change` AFTER UPDATE on `shops`: the changed columns are the keys whose value differs between `to_jsonb(old)` and `to_jsonb(new)`, ignoring `updated_at`; when there is at least one, insert `audit_log (shop_id = new.id, actor_user_id = auth.uid(), action 'shop_settings_change', entity 'shops', entity_id = new.id, before = <old values of the changed keys>, after = <new values of the changed keys>)`. SECURITY DEFINER, `set search_path = ''`. This logs the late-night licence confirmation (decision C21) and every other shop-row setting (architecture §7 `audit_log`).

**Late night refreshment (UKC-AGE-03, decision C21)** on `/settings/hours`: the rule applies to shops in England and Wales. Look up `shops.postcode` once with `GET https://api.postcodes.io/postcodes/<postcode>` and read `result.country`: `Scotland` or `Northern Ireland` → no confirmation needed; anything else, including a failed lookup or no postcode → needed (fail safe). When confirmation is needed, `requiresLateNightLicence(<sessions being saved>)` is true and `shops.late_night_licence_confirmed_at` is null, show an unticked checkbox "I hold a premises licence that authorises late night refreshment". Save without the tick → field error, no RPC call. With the tick → `update shops set late_night_licence_confirmed_at = <clock now ISO>` first, then the RPC. When the column is already set, show "Late night refreshment licence confirmed on <date>" instead of the checkbox.

**Pages** (`RequireRole min="manager"`; every form shows field errors with `aria-describedby`)

| Route | Behaviour |
|---|---|
| `/settings/hours` | tabs Collection / Delivery; per weekday a list of sessions with add/remove; "(next day)" after a closing time ≤ opening time; Save → validate → `rpc('replace_opening_hours')`. Preview panel "Next available times": `getAvailability` with the unsaved sessions, saved closures/prep/busy/pause and `now` from an injectable clock (default: browser time). Shows open/closed, the ASAP time and the first 8 slots as `HH:mm` (`iso.slice(11, 16)`: core returns Europe/London local ISO strings, P1-03 rule 8). Late-night confirmation as specified above |
| `/settings/closures` | upcoming closures, displayed with `Intl.DateTimeFormat` (`timeZone: 'Europe/London'`); add with a date input and a time input for start and end, each converted with core `londonWallTimeToInstant(date, time)` (P1-03); delete. Do not import luxon in `apps/merchant` (it is not an app dependency) |
| `/settings/ordering` | prep time select (5–120 step 5), busy buttons +0/+10/+20/+30 (`aria-pressed`), pause switch with the warning "Customers can't order until you turn this back on", collection/delivery switches |
| `/settings/zones` | zones by priority; add/edit/delete; districts typed as `m14, M13 m15`; radius disabled with "Add the shop address first" while `lat`/`lng` are null; shows "Delivery from £X.XX" via `lowestDeliveryFeePence` + `formatPence` |
| `/settings/business` | identity form: Legal form select; "Company number", "Registered office address" and "Part of the UK where registered" shown and required for Limited company / LLP; "Alert mobile" with the help text "Used only to alert your staff about new orders. Not shown to customers." and a warning while it is empty. On save, look up the postcode with `GET https://api.postcodes.io/postcodes/<postcode>` and store `latitude`/`longitude` as `lat`/`lng` with the address (404 → "Postcode not found", network error → nothing saved); warnings shown but not blocking |

## Acceptance

1. `pnpm --filter @ppos/core test` → green, including every example above; PO Box variants `PO Box 12`, `P.O. Box 7`, `po box 3` rejected; `m14, M13 m14` → `['M14', 'M13']`; `busyExtraMinutes: 15` rejected; both fulfilments disabled rejected; a `limited_company` fixture without a registered office → `REGISTERED_OFFICE_MISSING`; a `sole_trader` fixture → none of the company codes; `legal_form` null → `LEGAL_FORM_MISSING`; a `limited_company` fixture with every other field empty returns the nine codes other than `LEGAL_FORM_MISSING`, in the P1-05 order; `alertPhone` `0161 496 0000` rejected, `07700 900123` accepted; a `limited_company` input without `registeredIn` rejected; every `requiresLateNightLicence` example
2. `pnpm exec supabase db reset && pnpm exec supabase test db` → green, including: managerA replaces A's collection sessions (old rows gone, delivery rows untouched); staffA, managerB and anon each get `42501` and A's rows are unchanged, also with `p_sessions = '[]'`; managerA setting A's `late_night_licence_confirmed_at` writes one `audit_log` row (action `shop_settings_change`) whose `after` has exactly that key; an update that changes no value writes none
3. `pnpm --filter @ppos/merchant test` → green, including: `17:00`–`01:00` shows "(next day)"; overlapping sessions show an error and do not call the RPC; with a fixed clock `2026-11-02T18:07:00Z`, DAILY 17:00–23:00 and prep 20 the preview shows ASAP `18:27` and first slot `18:30`; business form rejects `PO Box 12` and `0845 600 0000`; choosing Limited company shows the registered office and part-of-the-UK fields as required; busy +20 has `aria-pressed="true"` after click; UKC-AGE-03: postcode lookup stubbed to `country: 'England'`, saving a 17:00–01:00 session without the tick → field error and no RPC call; with the tick → `late_night_licence_confirmed_at` updated, then the RPC called; stubbed to `Scotland` → no checkbox
4. `pnpm exec supabase gen types typescript --local > packages/core/src/db/database.types.ts && git diff --exit-code packages/core/src/db/database.types.ts` → exit 0
5. `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template

## Stop and escalate if

- A save is rejected by `shops_guard_update` for a field this card lists (whitelist mismatch with P1-05).
- `formatPence`/`parsePoundsToPence` (P1-01) or `getAvailability`/`londonWallTimeToInstant`/`normaliseDistrict` (P1-03/P1-04) are missing.
- You need a new shop column: that is a planner decision.
- `audit_log.actor_user_id` is `NOT NULL` (check `\d public.audit_log`): system updates such as the seed's `status = 'live'` have no user, so the audit trigger would break `supabase db reset`.

## Hints (verified facts / pitfalls)

- Money inputs: `parsePoundsToPence` in, `formatPence` out. No `parseFloat`.
- Use the Ofcom drama ranges (`0161 496 0xxx`, `07700 900xxx`) in tests and fixtures; never real numbers.
- postcodes.io returns `{ status, result: { latitude, longitude, outcode, country, … } }`; read only the fields you need and do not log the response. [H] `country` holds `England`, `Wales`, `Scotland` or `Northern Ireland` for GB/NI postcodes: confirm on https://postcodes.io/docs and record it in PROGRESS.md.
- A `time` column comes back as `HH:mm:ss` from PostgREST; trim to `HH:mm` before passing sessions to core.
- pgTAP fixtures: insert shops as `draft` (these tests need no live shop). Never insert `status 'live'` directly: `shops_go_live_check` (P1-05) rejects it. Impersonation as in the P1-05 hints (`set local role authenticated; set local request.jwt.claims = …`).
