# P0-B1 — CRM security audit & lockdown plan (read-only)

| Field | Value |
|---|---|
| Phase | P0 (track B: CRM lockdown) |
| Depends on | — (the human should apply the CRM stop-gap, P0-00 step H, first) |
| Mode | `review` — read-only. Writes only `docs/takeaway/reviews/`, `docs/takeaway/tasks/proposed/` and `PROGRESS.md`. No code changes. |
| Reasoning effort | `max` |
| Model | `glm-5.3` (never Flash: security, auth, RLS) |
| Session budget | ≤ 3 hours wall-clock. Read at most ~3,000 lines of `index.html` in total. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | none |

## Goal

The legacy CRM (`index.html` + root `*.sql`, live business data) is open: its Supabase database grants the `anon` role read and write on business tables, login happens only in the browser, and PDF generation builds HTML from database fields. Confirm every finding with exact `file:line` evidence, find what earlier research missed, describe the blast radius plainly, and turn the fix into a staged, reversible plan: one review document plus four proposed task cards (P0-B2 … P0-B5) that the human approves before any CRM code changes.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §12 (CRM boundary)
- `docs/takeaway/tasks/TEMPLATE.md` (proposed cards must follow it exactly)
- `supabase_schema.sql`
- `migration_self_auth.sql`
- `migration_fix_rls_anon.sql`
- `migration_factory_portal.sql`
- `index.html` — only through `grep -n` plus `Read` with `offset` and `limit` ≤ 400 (hook-enforced). Start from the line map in Spec 1.

## Out of scope

- Changing `index.html`, any root `*.sql`, or anything outside Deliverables. B1 fixes nothing.
- Any network call to the CRM's Supabase project or any live system: no `curl`, no `fetch`, no Supabase CLI against it, no "testing" of an exploit. Static analysis only.
- Reading the contents of `import_*.sql` or of `index.html` lines ~9322–9449 (a hard-coded real profit statement). Use counts only.
- Exploit payloads or working attack code in any file.
- Git history rewrites, key rotation, hosting changes (human decisions — describe them, do not do them).
- The takeaway platform code.

## Deliverables

| Path | Action |
|---|---|
| `docs/takeaway/reviews/P0-B1-crm-security.md` | create |
| `docs/takeaway/tasks/proposed/P0-B2-crm-supabase-auth.md` | create |
| `docs/takeaway/tasks/proposed/P0-B3-crm-rls-lockdown.md` | create |
| `docs/takeaway/tasks/proposed/P0-B4-crm-pdf-xss.md` | create |
| `docs/takeaway/tasks/proposed/P0-B5-crm-repo-data-and-cdn.md` | create |
| `docs/takeaway/PROGRESS.md` | edit |

## Spec

**1. Line map to start from.** Main anchors were re-checked with `grep -n` on 2026-10-11; `~` lines come from earlier research. Re-locate everything with `grep -n` and cite only lines you read in this session.

| Topic | Location |
|---|---|
| Unpinned CDN scripts; `document.write` fallback loader | `index.html` 7–16 (16) |
| Supabase URL + publishable key in the page | `index.html` 112–113 |
| `db` data layer; `profiles.list()` with `select('*')`; recycle bin (restore / hard delete by table name) | ~221–509; ~466–469; 483 (~483–508) |
| `hashPassword` (SHA-256 + one static salt) | 634 (~634–639) |
| `createTeamMember` (browser inserts profiles); synthetic email `<username>@ppos.local` | 642; 650 |
| `signIn` (fetches the row incl. `password_hash`, compares in the browser) | 669 (~669–686) |
| `LoginPage` first-run "create admin"; minimum password length | 688 (~702–734); ~725, ~4234 |
| `VendorPortal` loads all data, filters by factory in the browser | 901; ~918, ~936–945 |
| Plaintext new password shown in a toast | ~4249 |
| Recycle-bin UI handlers | 4279–4301 |
| `generateExportDoc`: HTML string from DB fields → `innerHTML` | 6010; sink 6164 (fields ~6046–6058) |
| Quote PDF: HTML string → `innerHTML` | sink 7117 (fields ~7022, ~7059, ~7106) |
| Order-id generation per customer → global PK collision → update fallback overwrites another order (integrity) | ~8072–8079, ~8124–8131, ~8546–8552; ~9656–9661 |
| `CRMApp`; hard-coded profit import (do not read) | 9224; 9323 (~9322–9449) |
| Session key in localStorage; role routing in `App` | 11115; 11117 (~11117–11172) |
| anon full CRUD on business tables | `migration_fix_rls_anon.sql` ~22–34 |
| `password_hash` column; FK to `auth.users` dropped; profiles open to anon | `migration_self_auth.sql` ~7, ~11–28, ~38–44 |
| Original authenticated-only policies; role CHECK | `supabase_schema.sql` ~262–273; ~17 |
| `linked_factory_id` | `migration_factory_portal.sql` ~13 |
| Real business data committed | `import_qiao_profit_statement.sql`, `import_zen_products.sql` — confirm with `wc -l` and `grep -ci 'insert into'` only |

Also skim the two short migrations `migration_add_sort_order.sql` and `migration_quotes_shipping_tax.sql` for grants or policies. Then search for what the map misses: other `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, `dangerouslySetInnerHTML`, `localStorage`, `select('*')`, `.delete(`, `.upsert(`, `rpc(`, `window.open`, JSON/CSV import paths that overwrite data, anything that looks like a secret.

**2. Review document** `docs/takeaway/reviews/P0-B1-crm-security.md` (English except §0):
- `## 0. Owner summary` — Simplified Chinese, ≤ 15 lines, plain words: what is exposed, what the stop-gap does and does not do, the fix order, what the owner must decide.
- `## 1. Scope and method` — files, commands, every `index.html` range you read (`offset`–`offset+limit`) and their total, what was not checked (the live database: its policies may differ from the repo SQL).
- `## 2. Findings` — one table: `| ID | Severity | Title | Evidence (file:line) | Status | Exploit scenario | Impact | Fix (card) |`. IDs `CRM-01`, `CRM-02`, …; Severity `Critical` / `High` / `Medium` / `Low` / `Info`; Status `Confirmed` (you read the lines this session) or `Inferred`; scenario in words, never a payload.
- `## 3. Blast radius` — per table: data categories (personal data such as names, phones, addresses, chat handles; commercial data such as costs, prices, margins, revenue; credentials); read / modify / delete exposure; who can do it and what they need; detection (no audit trail; history fields are client-written); effect on the takeaway platform (none — separate project, architecture §12).
- `## 4. Checks only the human can do` — e.g. in the CRM project's SQL editor: `select schemaname, tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by tablename;` and a grants check for `anon`; API/auth logs for unusual access; backups exist; repo visibility history.
- `## 5. Staged lockdown plan` — order, reasons, preconditions, downtime and staff communication, rollback per stage, API-key rotation after B3. State that P0-B2…B4 merged is a go-live gate for the takeaway pilot (architecture §15, P1-20).
- `## 6. Follow-ups` — findings not covered by B2–B5.

**3. Proposed cards** — each follows `TEMPLATE.md` exactly (all table fields, all headings), English, ≤ 160 lines, Read-first ≤ 8 files, Acceptance items executable or explicitly marked `human check`, a `Rollback` subsection inside Spec, and these Stop items: "a `[ppos guard]` refusal says the legacy CRM file is read-only, meaning the human did not start this session with `PPOS_ALLOW_LEGACY=1` → stop; never work around it" (B2–B4, and B5's CDN part), "reads ≤ 400 lines, small `Edit`s, never a whole-file write of `index.html`", "never run anything against the production CRM database; the human applies SQL". Definition of Done must include: "PR description states that it changes legacy CRM paths, so CI's protected-paths check stays red until the human reviews and adds `protected-change-approved`. Never try to make that check green another way." Hints must say the session starts with `docs/takeaway/prompts.md` §1 (CRM start command) + §7.

| Card | Must cover |
|---|---|
| P0-B2 Supabase Auth login (Mode `standard`, effort `max`) | `auth.users` for existing `profiles` created by a **human-run** step (agents never hold CRM service keys); how `profiles.id` maps to the auth user id; emails are synthetic (`@ppos.local`), so reset-by-email cannot work → choose (a) collect real staff emails or (b) admin-set temporary passwords + forced change at first login; replace `hashPassword` and the localStorage session with the supabase-js auth session; role read from `profiles`; the CRM must keep working while the anon policies still exist (B3 comes after) |
| P0-B3 RLS lockdown (Mode `standard`, effort `max`) | new root SQL file(s) `migration_crm_<topic>.sql` (legacy path) + matching rollback SQL; policies `to authenticated` using a role helper function (`SECURITY DEFINER`, `set search_path = ''`, execute revoked from `public` and `anon`); drop every open policy (permissive policies are OR-combined, so adding strict ones closes nothing); factory users see only rows of their `linked_factory_id` (decide whether cost/revenue columns need a view); role changes admin-only; drop `password_hash`; revoke `anon`; recycle-bin hard delete admin-only; pgTAP allow + deny tests run on a staging copy the human restores from a backup; the pgTAP files live in a new root folder `crm-tests/` (never under `supabase/`, whose tests CI runs against the takeaway schema), and the card states the exact human command to run them against the staging copy ([H] `psql`/`pg_prove` with pgTAP installed there; agents never get CRM credentials); the human applies to production after a fresh backup; then rotates the project's API keys and updates the page |
| P0-B4 PDF XSS (Mode `standard`, effort `max`) | list every HTML sink with line numbers; escape every DB-derived value with one `escapeHtml` helper or build DOM with `textContent`; acceptance via `grep` for remaining raw interpolations + a syntax/parse check of the page script that needs no new dependency (or a Dependency request); the page script is JSX (`<script type="text/babel">`), so `node --check` cannot parse it: extract the `text/babel` block into a scratch `.jsx` file outside the repo with a Node one-liner that writes via `fs.writeFileSync` (shell redirects on commands naming `index.html` are refused by the Bash hook unless `PPOS_ALLOW_LEGACY=1`), then `pnpm exec tsc --noEmit --allowJs --jsx preserve --target esnext <file>` must report no TS1xxx syntax errors ([H] verify in B4; needs the P0-01 workspace); human test with a harmless marker string |
| P0-B5 Repo data & CDN (Mode `standard`, effort `high`) | a human decision record: purge real data from Git history (`git filter-repo` is human-only and rewrites every clone) vs. keep the repo private and delete going forward; remove the real-data files and the hard-coded import at `index.html` ~9322–9449 if the human agrees; pin exact CDN versions with `integrity` + `crossorigin`; remove the `document.write` fallback; Tailwind Play CDN is not for production (follow-up) |

Order: B2 → B3 (B3 first would lock every user out); B4 and B5 are independent of B2/B3.

**4. Writing rules**: never copy into any file the Supabase URL, key or project ref, the password salt, customer or company names, amounts, or any other CRM value — cite `file:line`. Mark Supabase/Postgres behaviour you did not verify in official docs as `[H]`; give the URL for what you verified.

## Acceptance

1. `ls docs/takeaway/tasks/proposed/P0-B[2-5]-*.md | wc -l` → `4`
2. `git diff --name-only main...HEAD` → only the 6 Deliverables paths
3. `grep -cE '^\| CRM-[0-9]{2} ' docs/takeaway/reviews/P0-B1-crm-security.md` → ≥ `8`
4. `grep -E '^\| CRM-[0-9]{2} ' docs/takeaway/reviews/P0-B1-crm-security.md | grep -E '\| (Critical|High) \|' | grep -vc '| Confirmed |'` → `0`
5. `for f in docs/takeaway/tasks/proposed/P0-B*.md; do for h in '## Goal' '## Read first' '## Out of scope' '## Deliverables' '## Spec' '## Acceptance' '## Definition of Done' '## Stop and escalate if' '## Hints'; do grep -q "^$h" "$f" || echo "MISSING $h in $f"; done; done` → no output
6. `grep -nE 'supabase\.co|sb_publishable_|sb_secret_|eyJ[A-Za-z0-9_-]{20,}|_salt_' docs/takeaway/reviews/P0-B1-crm-security.md docs/takeaway/tasks/proposed/P0-B*.md` → no output
7. `grep -c '^## 0\. Owner summary' docs/takeaway/reviews/P0-B1-crm-security.md` → `1`
8. `node scripts/guards/run-all.mjs` → `All guards passed.`
9. `for f in docs/takeaway/tasks/proposed/P0-B*.md; do [ $(wc -l < "$f") -le 160 ] || echo "LONG $f"; for k in '| Phase |' '| Depends on |' '| Mode |' '| Reasoning effort |' '| Model |' '| Session budget |' '| Golden tests |' 'Rollback' 'PPOS_ALLOW_LEGACY' 'protected-change-approved'; do grep -qF "$k" "$f" || echo "MISSING $k in $f"; done; done` → no output
10. Human check: pick 3 `Confirmed` Critical/High rows, open each cited `file:line`; the lines lie inside a range listed in §1 and show the issue

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `node scripts/guards/run-all.mjs` exits 0 (and `pnpm verify` exits 0 if the workspace from P0-01 exists)
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log; `## Current` points the human to the review and the four proposals)
- [ ] PR opened with the template

## Stop and escalate if

- You find a secret beyond the page's publishable key (e.g. a service-role/secret key, a password, a token) in any file → stop at once; record only `file:line` (never the value) under `## Blockers`; the human rotates it.
- A finding suggests data is being lost or changed right now → write it at the top of the report and under `## Blockers`, then stop.
- A hook blocks a read you need → follow its message; never work around it.
- A proposed fix would need the takeaway platform to touch the CRM database, contradicting architecture §12.

## Hints (verified facts / pitfalls)

- Everything you read is sent to the model provider. The CRM URL and key are already exposed in the page; never repeat them in output.
- The read hook refuses `index.html` reads without `limit` ≤ 400; the bash hook refuses `cat index.html` and large `head`/`tail`/`sed` ranges. Use `Grep` with `-n` and `-C`, then small ranged reads (60–120 lines usually suffice).
- Legacy files are readable without `PPOS_ALLOW_LEGACY`; writing them is blocked, and you need no writes.
- `supabase_schema.sql` alone is outdated. The effective schema is that file plus the migrations in roughly this order (confirm from their headers): `migration_self_auth.sql`, `migration_fix_rls_anon.sql`, `migration_factory_portal.sql`, `migration_add_sort_order.sql`, `migration_quotes_shipping_tax.sql`. The live database may differ again (human check).
- The page's publishable key is public by design; only RLS protects the data. With policies `USING (true)` for `anon`, anyone holding the URL and key can read and write without logging in.
- Postgres permissive policies on the same table and command are OR-combined: one open policy keeps the table open whatever else exists.
- Supabase recommends `(select auth.uid())` inside policies for performance, and `SECURITY DEFINER` helpers need `set search_path = ''` [H — verify in the Supabase RLS docs and cite the URL].
- Severity guide: Critical = unauthenticated read/write of business data or credential takeover; High = privilege escalation or stored XSS reachable through anonymous writes; Medium = weakness needing another flaw or insider access; Low/Info = hygiene.
- Third-party reports (unverified) rate GLM-5.3 well at security review; its known risk is confident hallucination. Mark anything you did not read this session as `Inferred`.
