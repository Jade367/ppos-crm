# P1-07 — Menu builder with allergens & publish gate

| Field | Value |
|---|---|
| Phase | P1 |
| Depends on | P1-06, P1-01 |
| Mode | `standard` |
| Reasoning effort | `high` |
| Model | `glm-5.3` |
| Session budget | Two sessions on one branch `task/P1-07-menu-builder`, ≤ 3 h each (plan: Spec → Sessions); one PR, opened at the end of Session 2. If a session runs over: checkpoint commit, handoff in PROGRESS.md, stop. |
| Golden tests | none |

## Goal

Managers and owners build their menu in the back office: categories, items with photos, modifier groups with min/max rules and priced options, VAT category, dietary tags, and all 14 allergens for every item and option. An item can only be published when every allergen is explicitly set on it and on all its options; this is checked in core for the UI and enforced again by the P1-05 database trigger. Staff and above can mark items sold out until 04:00 the next morning through the `set_item_sold_out` RPC; every other menu write needs manager or above. Price and allergen changes are audit-logged.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §7 menu tables + Allergens, §11 (no age-restricted items)
- `docs/takeaway/reference/uk-compliance.md` UKC-ALG-01, -02, -10, -11; UKC-VAT-01; UKC-AGE-01; UKC-A11Y-01
- `docs/takeaway/tasks/P1-05-db-schema-rls.md` → RLS matrix, Functions (`is_shop_member`), Triggers
- `apps/merchant/src/auth/*`, `apps/merchant/src/layout/AppShell.tsx` (P1-06), `packages/core/src/money.ts` (P1-01), `packages/ui/src/index.ts` (P0-04)

## Out of scope

- Storefront display (P1-10), allergen information page (P1-17), CSV menu import, bulk "set all to free" (allergens must be chosen one by one), drag-and-drop libraries.
- `age_restricted`, alcohol, calories (UKC-KCAL: no P1 work), a `gluten_free` tag (regulated claim).
- Changing P1-05 policies or triggers (new migrations only add what this card lists).

## Deliverables

| Path | Action |
|---|---|
| `packages/core/src/allergens.ts` | create, or extend if P1-10 created it: `ALLERGEN_KEYS`, types, `isAllergenMapComplete`, `validateAllergens` |
| `packages/core/src/menu.ts` | create, or extend if P1-10 created it with `isSoldOut` only: `DIETARY_TAGS`, `soldOutUntil`, `isSoldOut` |
| `packages/core/src/schemas/menu.ts` + `packages/core/src/index.ts` | create / modify |
| `packages/core/tests/unit/{allergens,menu,menu-schema}.test.ts` | create |
| `supabase/migrations/<ts>_p1_07_menu_images_audit_sold_out.sql` | create (`pnpm exec supabase migration new p1_07_menu_images_audit_sold_out`) |
| `supabase/tests/menu/{price_audit,allergen_audit,set_item_sold_out,storage_policies}.test.sql` | create (pgTAP, outside `acceptance/`) |
| `packages/core/src/db/database.types.ts` | regenerate |
| `apps/merchant/src/pages/menu/*`, `apps/merchant/src/components/AllergenEditor.tsx` | create |
| `apps/merchant/src/i18n/en-GB.ts`, `zh-CN.ts`, router file | modify |
| `apps/merchant/src/**/*.test.tsx` | create (RTL) |
| `packages/core/package.json`, `pnpm-lock.yaml`, `reference/versions.md` | modify only if `luxon` is not yet installed (P1-03 normally adds it) |
| `supabase/functions/deno.json` | modify only if this card is the first to add `luxon` to core: the mapping ADR-0002 prescribes for core's bare imports (expected `"luxon": "npm:luxon@<same exact version>"`) |

## Spec

**Sessions** (one card ID, one branch, two sessions, one PR):
- **Session 1**: core (`allergens.ts`, `menu.ts`, `schemas/menu.ts` + unit tests), the migration (storage, price and allergen audit, `set_item_sold_out`), the pgTAP files, regenerated types (Acceptance 1, 2, 4). Gate: those items + `pnpm verify:quick` → checkpoint commit `feat(menu): core, migration and pgTAP [P1-07] (session 1/2)` → `git push -u origin task/P1-07-menu-builder` (no PR yet) → PROGRESS.md `## Current`: `P1-07 Session 1 done (<hash>); next: Session 2, first file apps/merchant/src/components/AllergenEditor.tsx`. Stop.
- **Session 2** (the human starts it with `docs/takeaway/prompts.md` §8, resume): menu pages, `AllergenEditor`, i18n, RTL tests (Acceptance 3, 5). Change Session 1 files only to fix a failing check. Gate: every Acceptance item → commit → push → open the PR.

**Core**

```ts
export const ALLERGEN_KEYS = ['celery', 'cereals_gluten', 'crustaceans', 'eggs', 'fish', 'lupin', 'milk', 'molluscs',
  'mustard', 'tree_nuts', 'peanuts', 'sesame', 'soya', 'sulphites'] as const; // architecture §7 order
export type AllergenKey = (typeof ALLERGEN_KEYS)[number];
export type AllergenValue = 'contains' | 'may_contain' | 'free';
export type AllergenMap = Partial<Record<AllergenKey, AllergenValue>>;
export function isAllergenMapComplete(map: AllergenMap): boolean;
export function validateAllergens(input: { item: AllergenMap; options: { id: string; allergens: AllergenMap }[] }):
  { ok: true } | { ok: false; missing: { target: 'item' | string; keys: AllergenKey[] }[] }; // target = option id; keys in ALLERGEN_KEYS order
export const DIETARY_TAGS = ['vegetarian', 'vegan', 'halal', 'spicy'] as const;
export function soldOutUntil(now: string): string;           // next 04:00 Europe/London strictly after now
export function isSoldOut(soldOutUntil: string | null, now: string): boolean; // soldOutUntil > now
```

`soldOutUntil` examples (verified with luxon 3; output format as P1-03 rule 8): `2026-11-02T18:00:00Z → 2026-11-03T04:00:00+00:00`; `2026-11-03T03:59:00Z → 2026-11-03T04:00:00+00:00`; `2026-11-03T04:00:00Z → 2026-11-04T04:00:00+00:00`; `2026-10-24T22:00:00Z → 2026-10-25T04:00:00+00:00`; `2027-03-27T23:30:00Z → 2027-03-28T04:00:00+01:00`.

Zod (`.strict()` everywhere, so an `age_restricted` key fails): category `{ name 1..80, description ≤ 300?, isVisible }`; item `{ categoryId uuid, name 1..100, description ≤ 500?, pricePence int 0..100000, dietaryTags ⊆ DIETARY_TAGS, vatCategory 'hot_standard'|'cold_zero'|'always_standard', allergens }`; group `{ name 1..80, minSelect int 0..20, maxSelect int 1..20, maxSelect ≥ minSelect }`; option `{ name 1..80, pricePence int 0..100000, isAvailable, allergens }`.

**Migration `p1_07_menu_images_audit_sold_out`**
- Storage bucket `menu-images`: public read, `file_size_limit` 2 MB, `allowed_mime_types` jpeg/png/webp. Object path `<shop_id>/<item_id>/<random>.<ext>`. Policies on `storage.objects` for `bucket_id = 'menu-images'`: INSERT/UPDATE/DELETE `to authenticated` only when `public.is_shop_member(((storage.foldername(name))[1])::uuid, 'manager')`.
- Trigger `audit_menu_price_change` AFTER UPDATE OF `price_pence` on `menu_items` and `modifier_options`, when the value changed: insert `audit_log (shop_id, actor_user_id = auth.uid(), action 'price_change', entity '<table>', entity_id, before {"price_pence": old}, after {"price_pence": new})`. SECURITY DEFINER, `set search_path = ''`.
- Trigger `audit_menu_allergen_change` AFTER UPDATE OF `allergens` on `menu_items` and `modifier_options`, only when `old.allergens is distinct from new.allergens`: insert `audit_log (shop_id, actor_user_id = auth.uid(), action 'allergen_change', entity '<table>', entity_id, before {"allergens": old.allergens}, after {"allergens": new.allergens})`. SECURITY DEFINER, `set search_path = ''` (UKC-ALG-10).
- RPC `public.set_item_sold_out(p_item_id uuid, p_sold_out_until timestamptz) returns void`: `language plpgsql`, SECURITY DEFINER, `set search_path = ''`. Read the item's `shop_id`; raise `42501` unless `public.is_shop_member(<that shop_id>, 'staff')` (an unknown item id also gives `42501`). Raise `22023` unless `p_sold_out_until is null or (p_sold_out_until > now() and p_sold_out_until <= now() + interval '48 hours')`. Update only `menu_items.sold_out_until`. `revoke execute on function public.set_item_sold_out(uuid, timestamptz) from public, anon; grant execute on function public.set_item_sold_out(uuid, timestamptz) to authenticated;`.

**Merchant UI** (`RequireRole min="staff"` to view; "Sold out today" / "Back in stock" for staff and above; every other edit control only for manager+). Build screens from `@ppos/ui` components; create no base components in `apps/merchant`.

| Screen | Behaviour |
|---|---|
| `/menu` | categories in `sort_order` with their items (archived hidden); per row: Up / Down buttons (swap `sort_order` with the neighbour), visibility toggle (categories), status badges Published / Draft / Sold out today |
| `/menu/items/new`, `/menu/items/:id` | name, description, price (text input parsed with `parsePoundsToPence`, shown with `formatPence`), photo upload, dietary tag checkboxes, VAT select (default `hot_standard`, help text ending "Check with your accountant."), `AllergenEditor`, modifier groups (name, min, max) with options (name, price, available, own `AllergenEditor`), Archive button (sets `archived_at`, unpublishes) |
| Publish toggle | disabled while `validateAllergens` fails; the missing keys are listed by item/option name. A DB `23514` error is shown as the same message |
| Sold out today | visible to staff and above; calls `rpc('set_item_sold_out', { p_item_id, p_sold_out_until: soldOutUntil(<clock now ISO>) })`; "Back in stock" passes `null`. Never a direct table update (staff have no UPDATE on `menu_items`) |

`AllergenEditor`: 14 rows in `ALLERGEN_KEYS` order, each a `radiogroup` labelled with the allergen name and three radios "Contains" / "May contain" / "Free from"; new items and options start with `{}` and **nothing checked**; shows "N of 14 set". Labels in `en-GB.ts` and `zh-CN.ts`.

## Acceptance

1. `pnpm --filter @ppos/core test` → green, including: complete map → ok; 13 keys → missing `[that key]`; option missing `sesame` → `{ target: '<option id>', keys: ['sesame'] }`; the five `soldOutUntil` examples; `isSoldOut('2026-11-03T04:00:00+00:00', '2026-11-03T03:59:00Z')` → true and `'…04:00:00Z'` → false; schema rejects `age_restricted: true`, `minSelect 2 / maxSelect 1`, tag `gluten_free`, `pricePence: 9.5`
2. `pnpm exec supabase db reset && pnpm exec supabase test db` → green, including the new tests: a price update by managerA writes one `audit_log` row with before/after; an update that does not change the price writes none; an allergen update by managerA writes one `audit_log` row (action `allergen_change`) with before/after; an update that leaves the allergens unchanged writes none; staffA `set_item_sold_out` on an A item → only `sold_out_until` changes; staffB on an A item → `42501`; anon → `42501`; a value 3 days ahead → `22023`; managerA can upload under `<shopA>/…` but not `<shopB>/…`; anon cannot upload
3. `pnpm --filter @ppos/merchant test` → green, including: a new item shows 14 radio groups with none checked (UKC-ALG-01); Publish is disabled until all 14 are set on the item and its option; VAT select defaults to `hot_standard` and shows the help text; staff sees "Sold out today" / "Back in stock" but no other edit control; "Sold out today" calls `rpc('set_item_sold_out', …)` with `soldOutUntil` of the fixed test clock; Down on the first item swaps `sort_order` with the second
4. `pnpm exec supabase gen types typescript --local > packages/core/src/db/database.types.ts && git diff --exit-code packages/core/src/db/database.types.ts` → exit 0
5. `pnpm verify` → exit 0

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template

## Stop and escalate if

- `formatPence` / `parsePoundsToPence` are missing from core (P1-01 not merged).
- Storage policies cannot be created from a migration in the local stack (record the exact error).
- You need to change a P1-05 trigger or policy.

## Hints (verified facts / pitfalls)

- `money-float` guard: never `parseFloat`/`toFixed` for prices; use the core helpers.
- Supabase Storage keeps its own tables in schema `storage`; check the bucket columns with `\d storage.buckets` locally before writing the insert.
- Treat the merchant's choice as the only source of allergen values. Never default a missing key to `free`, in the UI or in code.
- Show errors with `aria-describedby` next to the field; tests query by role and label only.
- RTL tests reference Chinese only through the dictionary object (`getByText(zhCN.<key>)`), never CJK literals: `cjk-lint` scans test files too.
- pgTAP fixtures: these tests need no live shop, so insert shops as `draft`. If a test ever needs one live, follow P1-05: insert as `draft` with complete identity → insert a ready `stripe_accounts` row → update to `live` as `postgres` (`shops_go_live_check`). Never insert `status 'live'` directly.
- `audit_log.actor_user_id` is `auth.uid()`; in pgTAP set the caller with `set local role authenticated` + `set local request.jwt.claims = '{"sub":"<managerA id>","role":"authenticated"}'` … `reset role;` (P1-05 hints).
- 04:00 is never inside the repeated or missing hour in Europe/London, so `soldOutUntil` is deterministic. If core already exports `londonWallTimeToInstant` (P1-03), build it from that helper (London date of `now`, or the next date when the London time is ≥ 04:00) rather than `.set({ hour: 4 })`.
