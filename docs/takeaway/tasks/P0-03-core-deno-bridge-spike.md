# P0-03 — Spike: share packages/core with Deno edge functions + `_shared` skeleton

| Field | Value |
|---|---|
| Phase | P0 |
| Depends on | P0-01, P0-02 (and P0-00 step D4: the human has linked the DEV project) |
| Mode | `standard` (spike → ADR-0002) |
| Reasoning effort | `max` |
| Model | `glm-5.3` (never Flash: Stripe client, auth helpers) |
| Session budget | ≤ 4 hours wall-clock. At most 45 minutes per option; record the result and move on. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | none |

## Goal

Decide, with evidence, how Supabase Edge Functions import `packages/core`, so that pricing and order rules exist exactly once (architecture §5, §6) and run unchanged in the browser, in Vitest and in Deno. Record the decision as ADR-0002, and ship the `_shared` skeleton every later function builds on (`env`, `http`, `supabase`, `stripe`, `core` bridge) plus a `health` function, deployed to DEV, that returns the core version.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §1, §3 (env var names), §8, §13a
- `docs/takeaway/reference/stripe-endive.md` §1, §2, §3, §13
- `docs/takeaway/reference/approved-deps.json` (`deno` section)
- `docs/takeaway/reference/versions.md`
- `docs/takeaway/reference/environments.md` (DEV project ref and API URL)
- `.github/workflows/takeaway-ci.yml` (`deno` job)
- `packages/core/src/index.ts`
- `supabase/config.toml`

## Out of scope

- Business functions (`create-checkout`, webhooks, `merchant-order-action`, …), membership checks, `_shared/auth.ts`, refund helpers.
- Calling the Stripe API. The client is created and unit-tested, never used against the network.
- `supabase link`, `supabase secrets set`, `--project-ref`, anything on PROD (human only; hook-blocked).
- Changing core's public API. If the bridge needs a core change, it must be tiny and listed in the ADR.
- Editing `.github/**` or guards; packages outside the approved `deno` list; `https://` imports.

## Deliverables

| Path | Action |
|---|---|
| `docs/takeaway/adr/0002-core-deno-bridge.md` | create |
| `supabase/functions/deno.json` | create (pinned `npm:`/`jsr:` imports; `@ppos/core` entry only if option B wins) |
| `supabase/functions/deno.lock` | create if Deno generates it: commit it, or set `"lock": false` in `deno.json` and justify that in ADR-0002 |
| `supabase/functions/_shared/core.ts` | create — the only file that imports core; all functions import `../_shared/core.ts` |
| `supabase/functions/_shared/env.ts`, `env.test.ts` | create |
| `supabase/functions/_shared/http.ts`, `http.test.ts` | create |
| `supabase/functions/_shared/supabase.ts`, `supabase.test.ts` | create |
| `supabase/functions/_shared/stripe.ts`, `stripe.test.ts` | create (code exactly as stripe-endive §3) |
| `supabase/functions/health/index.ts`, `handler.ts`, `handler.test.ts` | create |
| `supabase/config.toml` | edit: `[functions.health]` `verify_jwt = false`, plus what the chosen option needs |
| `docs/takeaway/reference/versions.md` | edit: Deno, Edge Runtime, Supabase-injected env var names, `@supabase/supabase-js`, `@std/assert` |
| `docs/takeaway/PROGRESS.md` | edit |
| Option C only: `scripts/dev/sync-core.mjs`, `supabase/functions/_shared/core/**`, `supabase/functions/_shared/core-sync.test.ts` | create |

## Spec

**1. Options** (try in this order; record every option you tried, stop at the first that passes all criteria 1, 2, 2b, 3, 4)

| ID | How `_shared/core.ts` reaches core |
|---|---|
| A | `export * from '../../../packages/core/src/index.ts';` (relative import with `.ts`) |
| B | `supabase/functions/deno.json` `"imports": { "@ppos/core": "../../packages/core/src/index.ts" }`, and `export * from '@ppos/core';` |
| C | `node scripts/dev/sync-core.mjs` copies `packages/core/src/**` to `supabase/functions/_shared/core/` with a "GENERATED — do not edit" header; `export * from './core/index.ts';`; `core-sync.test.ts` (Deno, uses `--allow-read`) fails when any copy differs from its source |

| # | Criterion (record command, exit code and 3–10 output lines) |
|---|---|
| 1 | Local stack running, `pnpm exec supabase functions serve` in the background, then `curl -sS -i http://127.0.0.1:54321/functions/v1/health` → `200`, body `{"ok":true,"coreVersion":"<CORE_VERSION>"}` |
| 2 | CI's `deno check` exactly (cwd `supabase/functions`): `deno check $(find . -name '*.ts' -not -name '*.test.ts' -not -path '*/node_modules/*')` → exit 0 |
| 2b | Same as CI, in a checkout without `node_modules` (CI's `deno` job runs no `pnpm install`): after a checkpoint commit, `git worktree add /tmp/ppos-ci-check HEAD`, then in `/tmp/ppos-ci-check/supabase/functions` run criterion 2's `deno check` and criterion 3's `deno test` → both exit 0; then `git worktree remove --force /tmp/ppos-ci-check`. Record local and clean-checkout results side by side |
| 3 | CI's `deno test --allow-env --allow-net --allow-read` (cwd `supabase/functions`) → exit 0 |
| 4 | `pnpm exec supabase functions deploy health` (linked DEV project) then `curl -sS -i <DEV API URL>/functions/v1/health` → same `200` body |

If more than one passes, prefer A, then B, then C (fewest moving parts). For the winner, also decide how a future bare import inside core resolves under Deno (`zod` in P1-01, `luxon` in P1-03). Expected rule: one `deno.json` import entry per package, pinned to the same exact version as `packages/core/package.json`. Confirm it is feasible from the docs and state it in the ADR, because P1-01 relies on it.

**2. `_shared` contracts** (later cards depend on these names)
- `env.ts`: `export const env` with one getter per edge-function variable in architecture §3, named exactly like the variable (`env.STRIPE_SECRET_KEY`, …). Each getter returns a non-empty string or throws `Error('Missing environment variable <NAME>')` (never the value). Add `env.supabaseUrl`, `env.supabasePublicKey` (anon/publishable) and `env.supabaseServiceKey` (service-role/secret), reading the injected names you verified in Spec 3. Reads happen only inside getters, never at import time.
- `http.ts`: `json(body, status = 200, headers?)` → `Response` with `content-type: application/json; charset=utf-8`. Exactly: `export class HttpError extends Error { readonly status: number; readonly code: string; constructor(status: number, code: string, message: string = code) { super(message); this.name = 'HttpError'; this.status = status; this.code = code; } }`: positional `(status, code, message?)`; codes UPPER_SNAKE (`VALIDATION`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, …); later cards may append parameters, never reorder them. `errorResponse(err)`: `HttpError` → `{ error: { code, message } }` with its status; anything else → `500` `{ error: { code: 'INTERNAL', message: 'Internal error' } }` (never echo the original message or stack; never log request bodies). `allowedOrigins()` = `new URL(…).origin` of `APP_STOREFRONT_URL` and `APP_MERCHANT_URL`. `corsHeaders(origin, allowed)`: echo the origin only on exact match, plus `Vary: Origin`, allow headers `authorization, x-client-info, apikey, content-type`, methods `GET, POST, OPTIONS`; never `*`. `preflight(req, allowed)`: `OPTIONS` → `204` with CORS headers, otherwise `null`.
- `supabase.ts`: `createServiceClient()` (service key; `auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }`); `createUserClient(req)` (public key + `global.headers.Authorization` copied from the request; missing or non-`Bearer` header → `HttpError(401, 'UNAUTHORIZED')`); `requireUser(req)` → `{ user, client }` via `client.auth.getUser()`, `401` on error. Import `npm:@supabase/supabase-js@<exact>` only here (or through `deno.json`).
- `stripe.ts`: the code block in stripe-endive §3, byte for byte. Allowed changes: the import line (if the ADR picks the `deno.json` mapping) and the `env` property access. `stripe.test.ts`: the three required tests listed under that block.
- `core.ts`: one export line for the chosen option.
- `health/handler.ts`: `export function handler(req: Request): Response` → `GET` → `json({ ok: true, coreVersion: CORE_VERSION })`; other methods → `405` `METHOD_NOT_ALLOWED` via `errorResponse`. `health/index.ts`: `Deno.serve(handler);` and nothing else. `handler.test.ts`: GET 200 body; POST 405 body shape.
- Tests (no network calls except module downloads): `env` getter returns a set value and throws when unset (`Deno.env.set` / `Deno.env.delete`); `http`: `json` status and content type, `new HttpError(409, 'X').message === 'X'`, `errorResponse(new HttpError(409, 'X', 'Y'))` → `409` `{ error: { code: 'X', message: 'Y' } }`, unknown error → 500 without the original message, allowed origin echoed, foreign origin gets no `access-control-allow-origin`, preflight 204; `supabase`: `createUserClient` throws 401 without an `Authorization` header (set dummy URL/key env values in the test).

**3. Supabase-injected variable names and `--env-file`**: read the current Supabase docs on Edge Function environment variables (web-reader). Confirm locally with a temporary function `env-names-probe` that returns names only, never values: `{ supabase: Object.keys(Deno.env.toObject()).filter((k) => k.startsWith('SUPABASE_')).sort(), frozen: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET_CONNECT', 'STRIPE_WEBHOOK_SECRET_PLATFORM', 'APP_STOREFRONT_URL', 'APP_MERCHANT_URL', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'RESEND_API_KEY', 'EMAIL_FROM', 'CRON_SECRET'].filter((k) => Deno.env.get(k) !== undefined) }`. Serve it once from the repo root with `pnpm exec supabase functions serve --env-file .env.local --no-verify-jwt` ([H] confirm both flags in `pnpm exec supabase functions serve --help`; if `--no-verify-jwt` does not exist, add a temporary `[functions.env-names-probe] verify_jwt = false` to `config.toml` and remove it before committing). Precondition: the human has confirmed that `.env.local` exists and holds at least local `APP_STOREFRONT_URL` and `APP_MERCHANT_URL` values (P0-00 step G); you check only with `test -f .env.local` and never open it. Never deploy the probe; delete it before committing. Record the names, the doc URL and the working `--env-file` command in `versions.md`.

**4. ADR-0002** `docs/takeaway/adr/0002-core-deno-bridge.md` — headings: Status (`Proposed`), Context, Options (table: every option tried × criteria 1, 2, 2b, 3, 4 → pass/fail + evidence reference; 2 and 2b side by side), Decision, Consequences (how functions import core; how core's bare imports resolve; the `.ts`-extension rule for core; what to do when core needs a package), How to run locally (the human keeps local values in the root `.env.local`; quote the exact serve command with `--env-file .env.local` that Spec 3 verified), Versions (Deno, Edge Runtime, CLI), Evidence (commands + outputs), Open risks (include: per-branch Vercel preview origins vs exact-match CORS, see Hints).

## Acceptance

1. (cwd `supabase/functions`) `deno check $(find . -name '*.ts' -not -name '*.test.ts' -not -path '*/node_modules/*')` → exit 0
2. (cwd `supabase/functions`) `deno test --allow-env --allow-net --allow-read` → exit 0; the summary line reads `ok | N passed | 0 failed` with no `ignored` count; the run includes `stripe.test.ts` (3 tests), `http.test.ts`, `env.test.ts`, `supabase.test.ts`, `handler.test.ts`; and `grep -rnE 'ignore\s*:|\.ignore\(|\.only\(' supabase/functions --include='*.test.ts'` → no output
3. Criterion 1 (local serve + curl) → `200` and the JSON body above; criterion 2b (clean checkout) → both commands exit 0
4. Criterion 4 (deploy to DEV + curl) → `200` and the same body (human check: from your own machine, `curl -sS <DEV API URL>/functions/v1/health` returns the same body)
5. `pnpm verify` → exit 0 and the deno step ran (no `SKIPPED (no edge functions)`)
6. `node scripts/guards/run-all.mjs` → `All guards passed.` (deps-allowlist: every `npm:`/`jsr:` specifier approved and exactly pinned)
7. `grep -rl --include='*.ts' --include='deno.json' 'npm:stripe' supabase/functions | wc -l` → `1`
8. `grep -rn 'packages/core' supabase/functions` → only `_shared/core.ts` or `deno.json` (option C: only the sync test and generated headers)
9. `grep -rn 'Deno\.env' supabase/functions --include='*.ts' | grep -vE '_shared/env\.ts|\.test\.ts'` → no output (production code reads env only through `_shared/env.ts`)
10. `ls supabase/functions` → no `env-names-probe`; `grep -c env-names-probe supabase/config.toml` → `0`
11. `grep -nE '^\| (Deno|Supabase-injected env var names) ' docs/takeaway/reference/versions.md` → both rows filled, no `TBD`
12. The probe served with `--env-file .env.local` (Spec 3) → `frozen` includes `APP_STOREFRONT_URL` and `APP_MERCHANT_URL` (paste the JSON); ADR-0002 "How to run locally" quotes that exact command (if a different path form was needed, quote the working form and the `--help` line)

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] ADR-0002 contains evidence for every option tried; status `Proposed` (the human accepts it)
- [ ] PROGRESS.md updated: done log; `## Proposed doc changes`: "`.github/workflows/takeaway-ci.yml` deno job: `deno-version: <recorded version>` instead of `v2.x` (protected; human edits)"; `## Follow-ups`: "Planner question: per-branch Vercel preview origins vs exact-match CORS (options: (a) DEV `APP_*_URL` = a stable Vercel branch alias used for manual preview checks; (b) an ADR adding a DEV-only allowed-origin suffix variable)"
- [ ] PR opened with the template; CI `deno` job ran (not skipped) and is green

## Stop and escalate if

- `functions deploy` fails with "not linked" or an auth error → BLOCKED; the human must link DEV (P0-00 D4). Never pass `--project-ref`.
- `test -f .env.local` fails → BLOCKED; ask the human to create it (P0-00 step G). Never create, open or print it yourself.
- No option passes all criteria after at most 3 attempts per option → BLOCKED; commit the ADR draft with the evidence you have.
- `stripe.ts` exactly as specified fails `deno check` → BLOCKED with the exact error. Do not change its logic.
- A fix needs a protected file, an unapproved package, a remote URL import, or a `deno.json` setting whose effect you cannot verify.
- The local Deno major differs from the Edge Runtime's Deno major and the criteria give different results.
- The env probe would show values rather than names → stop, delete it, report.

## Hints (verified facts / pitfalls)

- CI runs, from `supabase/functions`: `deno check $files` (all `*.ts` except `*.test.ts` and `node_modules`), then `deno test --allow-env --allow-net --allow-read`. Locally run exactly the same commands.
- `deno test` collects `*.test.ts` (and `*_test.ts`) recursively. Never name a non-test file `test.ts`.
- Deno looks for `deno.json` from the working directory upwards; Deno 2 also discovers `package.json` files, and the repo root now has one (P0-01). [H] This can change npm resolution (`nodeModulesDir`): your machine has a root `node_modules`, CI's `deno` job does not (criterion 2b). If `serve` and `check`, or local and clean checkout, disagree, investigate this first and record the outcome. If you see "Could not find a matching package for npm:… in the node_modules directory", test `"nodeModulesDir": "none"` in `deno.json` [H] and record the result.
- Previews (architecture §3) run on per-branch `*.vercel.app` origins, which exact-match CORS rejects. Do not add wildcards, suffix matching or new env names (§3 env names are frozen); record it under ADR Open risks and as the planner question in the DoD.
- [H] Supabase docs recommend a `deno.json` per function folder for deploys, while CI's `deno check` only sees `supabase/functions/deno.json`. Whatever you choose must pass all criteria.
- [H] `functions deploy` bundles the function and the files it imports; whether files outside `supabase/functions/` are included is exactly what criterion 4 tests for options A and B.
- [H] If `config.toml` has `[edge_runtime] deno_version`, it must be `2` to match CI (`deno-version: v2.x`).
- [H] New-style publishable/secret API keys are not JWTs, so platform JWT verification may not apply to them. `health` uses `verify_jwt = false` (it returns no data). Merchant functions will check the user themselves via `auth.getUser` (architecture §8).
- `Deno.serve(handler)` is the built-in server; do not import `std/http`.
- The deps guard rejects unapproved names, versions that are not exact, and `https://` imports, in `deno.json` and inline specifiers alike.
- The first `deno check` downloads `npm:stripe@23.0.0`, which needs network. `Stripe.createSubtleCryptoProvider()` at module top level is fine (no env read).
- Run `functions serve` with the Bash tool's background option, poll with `curl`, then stop it. Default local API port: 54321.
- The banned pattern `core-impure` forbids `Deno.` inside `packages/core/src`. Core must never detect its runtime.
- Do not add `deno-lint-ignore` or `@ts-nocheck` comments (banned).
