# P0-00 — Human setup: accounts, environments, Claude Code + GLM config

| Field | Value |
|---|---|
| Phase | P0 |
| Depends on | — |
| Mode | `human` — the owner does every step. No agent session. |
| Reasoning effort | — (step B6 measures how `high` / `max` behave; later cards use the result) |
| Model | — (this card configures `glm-5.3` for every later card) |
| Session budget | 1–2 days of calendar time, in short sittings. Rows marked **later** happen after another task merges. |
| Golden tests | none |

## Goal

When this is done: your computer (the "agent machine") runs GLM-5.3 inside Claude Code with this repo's hooks active; the planning files are merged into `main`; GitHub refuses direct pushes, force pushes and merges into `main` whose five CI checks are not green (pull request required, no required approvals); Supabase DEV and PROD projects exist in London and PROD credentials never touch the agent machine; a Stripe platform account with Connect and a sandbox exists; `docs/takeaway/reference/environments.md` holds every non-secret reference the agents need; and you have applied (or consciously decided on) the stop-gap for the legacy CRM, whose database is currently open to anyone who has the page.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/03-execution-handbook.md` §D (Claude Code + GLM, step by step, in Chinese)
- `docs/takeaway/01-upgrade-plan.md` §3.6 (CRM stop-gap) and §7 (decisions)
- `docs/takeaway/reference/architecture.md` §3 (environments, env var names)
- `docs/takeaway/reference/stripe-endive.md` §1, §4, §11
- `docs/takeaway/02-tech-roadmap.md` §7.2 (who may touch what)

## Out of scope

- Code, `package.json`, `supabase init` (P0-01, P0-02 do that).
- Stripe live mode, live webhooks, the PROD deploy workflow (P1-20); Stripe Billing for £149 + £39 (P2).
- Putting any PROD or live key on the agent machine, in a prompt, or in the repo.
- Fixing the CRM (P0-B1 … B5). Here you only apply the stop-gap and record the decision.

## Deliverables

| Path / place | Action |
|---|---|
| Agent machine | install the tools in step A |
| `~/.claude/settings.json` (personal, never in the repo) | edit (step B) |
| GitHub repo settings | label `protected-change-approved`; planning branch merged into `main`; private repo; rules on `main` (step C) |
| Supabase | `takeaway-dev` + `takeaway-prod` in London; DEV linked locally (**later**) (step D) |
| Stripe | UK platform account, Connect configured, sandbox (step E) |
| Vercel, domain, Twilio, Resend | accounts now or **later** (step F) |
| `docs/takeaway/reference/environments.md` | create — protected path: commit on a branch, PR + label (step G) |
| `.env.local` (repo root, git-ignored) | create; never commit (step G) |
| CRM stop-gap | apply + record in `environments.md` (step H) |

## Spec

**A. Tools on the agent machine** (install each with its official installer; on macOS Homebrew is easiest)

| Tool | Check | Note |
|---|---|---|
| Node.js 24 LTS (22 LTS fallback) | `node -v` | hooks need `node` on PATH |
| pnpm | `pnpm -v` | pnpm.io/installation; P0-01 writes this exact version into `packageManager` |
| Git + GitHub CLI | `gh auth status` | run `gh auth login` once; the agent pushes branches and opens PRs with it |
| Docker Desktop | `docker info` | must be running for P0-02 onwards; licence: free for small businesses (UNVERIFIED — read docker.com terms) |
| Supabase CLI | `supabase --version` | only you use it for `link` / `secrets`; agents use the copy pinned by P0-02 |
| Deno 2 | `deno --version` → `deno 2.` | P0-03 needs it; CI uses `v2.x` |
| Stripe CLI | `stripe --version` | log in to the **sandbox** only |
| Claude Code | `claude --version` | per code.claude.com docs |
| macOS only: coreutils | `gtimeout --version` | install: `brew install coreutils`; macOS has no `timeout`; headless runs use `gtimeout` |

**B. Z.ai + Claude Code** (details and screenshots-free walkthrough: handbook §D.2–D.10)

1. Buy the GLM Coding Plan at z.ai/subscribe. Pro is recommended (reported $80/month — UNVERIFIED; no overage billing: when the 5-hour or weekly quota is used up, calls stop). Create an API key. Keep it only in your password manager and `~/.claude/settings.json`.
2. Run `npx @z_ai/coding-helper`, choose Claude Code, paste the key. **Pitfall (verified):** it sets all three model slots to `glm-5.3-flash[1m]`.
3. Edit `~/.claude/settings.json` → `env`: `ANTHROPIC_BASE_URL` = `https://api.z.ai/api/anthropic`; `API_TIMEOUT_MS` = `3000000`; `ANTHROPIC_DEFAULT_OPUS_MODEL` and `ANTHROPIC_DEFAULT_SONNET_MODEL` = `glm-5.3[1m]`; `ANTHROPIC_DEFAULT_HAIKU_MODEL` = `glm-5.3-flash[1m]`. Keep the helper's other keys. Do **not** set `ENABLE_TOOL_SEARCH`. Re-check this file every time you re-run the helper.
4. Do steps B4–B5 after step C0 (planning branch merged, `git checkout main && git pull`). Check the repo contains `.claude/settings.json` (it wires the hooks and sets `CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000`, `CLAUDE_CODE_ATTRIBUTION_HEADER=0`). If it is missing, stop (see Stop and escalate).
5. In the repo folder run `claude`, accept "trust this folder". Then: `/status` → model `glm-5.3[1m]`, base URL `api.z.ai`. `/hooks` → SessionStart, PreToolUse, Stop listed. Paste the guard test from handbook §D.6 → expect a `[ppos guard] index.html is ~220K tokens …` refusal.
6. Effort probe (handbook §D.8, ~15 min, off-peak, in a folder outside the repo): run the same prompt with `--effort low|high|max|medium|xhigh`, twice each, compare `output_tokens`. Record the table and your conclusion in `environments.md`. Rule if unsure: use only `high` and `max`.
7. Run `claude --help | grep -c -- '--max-turns'` and record `0` or `1` (headless runs rely on it; `timeout`/`gtimeout` is the hard cap either way).
8. Plugins: `glm-plan-usage` is fine. Never install `glm-plan-bug` (it uploads a summary of the conversation).
9. The Coding Plan may only be used inside supported tools (Claude Code etc.). Scripts, CI or servers calling GLM need a separate pay-as-you-go key. Nothing needs one today.

**C. GitHub**

0. Merge the planning branch first (handbook §D.1a; order matters: label → merge → branch rules): `gh label create protected-change-approved --color B60205 --description "Human-approved change to protected paths. Agents never add this."` → find or open the PR from `claude/delivery-platform-pricing-69ynlr` into `main` → add the label (CI re-runs on `labeled`) → wait for all checks green → squash-merge → `git checkout main && git pull`. Skip the merge if `main` already contains `docs/takeaway/` and `.claude/settings.json`. Only then do C1–C3 and B4–B5.
1. Repository visibility = **Private** (it contains the CRM key and real business data). Note in step H whether it was ever public.
2. Branch rules on private repos may need a paid GitHub plan (UNVERIFIED-LIVE — check docs.github.com "About protected branches"). Upgrade if needed.
3. Create a ruleset (Settings → Rules) or classic protection for `main`: require a pull request; require status checks to pass — select all five CI jobs: `guards (banned patterns, CJK, acceptance integrity, deps, protected paths)`, `typecheck, lint, unit + acceptance tests`, `edge functions (deno check + deno test)`, `database (migrations + pgTAP RLS tests)`, `end-to-end (Playwright, DOM/ARIA assertions)`; block force pushes; block deletion; no bypass list. The checks appear in the picker only after the workflow has run once on a PR (each job passes with "skipping" until its code exists). Do **not** require approvals while the agent uses your own GitHub login (you cannot approve your own PR).
4. The label from C0 is how you approve every later change to protected paths. The CI workflow also runs on `labeled` / `unlabeled`, so adding the label re-runs the checks. If they do not re-run, push an empty commit (handbook §K.3).

**D. Supabase**

1. Use two Supabase logins. Account A (your main login) owns organisation `ppos-prod` with project `takeaway-prod`. Account B (e.g. an email alias) owns organisation `ppos-dev` with project `takeaway-dev`; invite account A to `ppos-dev` so you see both in the browser. Reason: a CLI login can act on every project its account can see. The pre-bash hook blocks `supabase login/logout/link` and `--project-ref`/`--db-url`, but hooks are heuristic and exist only in Claude Code, so the account separation is the real barrier.
2. Create both projects in region **London (eu-west-2)** with strong database passwords (password manager). Note the Postgres major version (Settings → Infrastructure) for `environments.md`.
3. On the agent machine, `supabase login` with **account B only**. Never log in with account A there. Never copy PROD keys, URLs or refs to this machine.
4. **Later (after P0-02 is merged — linking needs `supabase/config.toml`):** at the repo root run `pnpm exec supabase link --project-ref <dev-ref>` once. Agents cannot link (hook-blocked).
5. **Later (before P1-09):** set DEV function secrets yourself: `pnpm exec supabase secrets set --env-file <file>` (sandbox values only). Agents cannot set secrets.

**E. Stripe**

1. Open the platform account as the legal entity decided in 01 plan §7 item 4; turn on 2FA. Business country UK, currency GBP.
2. Enable Connect. Choose the options that match our model: connected accounts get the **full Stripe Dashboard** and **pay Stripe's processing fees themselves** (Stripe handles pricing); the platform only takes an application fee (45p). Code creates accounts with controller properties (stripe-endive §4); never pick "Express" or "Custom". Wording in the wizard may differ (UNVERIFIED) — if no option matches, stop.
3. Create a **sandbox** (name it `takeaway-dev`); configure Connect there too if the sandbox asks. Log the Stripe CLI into the sandbox only. Its secret key starts `sk_test_...`; it goes only into `.env.local` and DEV function secrets.
4. In the sandbox `takeaway-dev`: Connect → payment method settings for connected accounts: Cards ON, Apple Pay ON, Google Pay ON, Link ON; every other method OFF (bank debits, bank transfers, buy now pay later, vouchers, other wallets), because hot food cannot wait for delayed settlement (architecture §9, stripe-endive §2 item 1; decided). Live mode gets the same settings at P1-20. Menu wording may differ (UNVERIFIED). Record the date and the enabled list in `environments.md` → Accounts.
5. Processing-fee figures in stripe-endive §11 are UNVERIFIED-LIVE: check stripe.com/gb/pricing before quoting any merchant.

**F. Vercel, domain, Twilio, Resend**

1. Vercel account linked to GitHub (Hobby is reported to be non-commercial; Pro ≈ $20/user/month — UNVERIFIED). Do not log in the Vercel CLI on the agent machine. **Later (after P0-04):** create two projects from this repo with Root Directory `apps/storefront` and `apps/merchant`, framework Vite; Preview env vars = DEV values of `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_FUNCTIONS_URL`. Never PROD values in Preview. Right after creating each project, turn off automatic production deployments from `main` (architecture §3) in the Vercel dashboard (UNVERIFIED which options the current UI offers: production-branch / "Ignored Build Step" settings, staged production deployments without automatic domain assignment, or `git.deploymentEnabled`; check Vercel's docs, prefer a dashboard setting over editing the agent-owned `vercel.json`, and note which one you used in `environments.md`). Production is promoted by hand at P1-20, after migrations and functions.
2. Buy the platform domain once the brand is chosen (check the name at UKIPO first). DNS comes later.
3. **Later (before P1-14):** Twilio (UK numbers need a regulatory bundle — UNVERIFIED) and Resend (verify the sending domain). Turn on spend alerts or caps on every service.

**G. `environments.md` and `.env.local`**

Create `docs/takeaway/reference/environments.md` on a branch (`chore/environments`), open a PR, add the label `protected-change-approved` (CI re-runs), merge when green. **Only non-secret values.** No keys, tokens, passwords, connection strings, and no PROD identifiers (AGENTS.md §4). Sections:

```markdown
# Environments (non-secret references; human-maintained)
## Environments
| Env | Supabase project | Ref | API URL | Region | Postgres major | Stripe | Frontend URL |
|---|---|---|---|---|---|---|---|
| local | supabase start | — | http://127.0.0.1:54321 | — | (config.toml) | sandbox | storefront :5173, merchant :5174 |
| dev | takeaway-dev | <ref> | https://<ref>.supabase.co | London | <n> | sandbox takeaway-dev | Vercel Preview |
| prod | takeaway-prod | not recorded here | not recorded here | London | <n> | live | (P1-20) |
## Where secrets live (names only — values never here)
## Accounts (service, organisation name, plan, 2FA yes/no, spend cap)
## Owner machine (tool versions from step A; claude --version; --max-turns supported: yes/no)
## GLM effort probe (date, claude version, output_tokens per effort, conclusion)
## CRM stop-gap (step H)
```

Create `.env.local` at the repo root with the variable names from architecture §3 (P0-01 adds `.env.example` with the same list). Fill only local/sandbox/DEV values, as each task needs them. Before P0-03 it must hold at least `APP_STOREFRONT_URL=http://localhost:5173` and `APP_MERCHANT_URL=http://localhost:5174` (P0-03 verifies `supabase functions serve --env-file .env.local`); tell the agent it exists, never paste its content. Agents never read it (hook-blocked).

**H. CRM stop-gap (decide today; 01 plan §3.6)**

1. Back up every CRM table (Supabase dashboard of the CRM project → export CSV) to encrypted storage outside the repo.
2. Find where `index.html` is hosted and restrict access (host password protection, IP allowlist, or an access proxy). Test from a phone on mobile data: you must be refused.
3. Confirm the repo is private; if it was ever public, assume the CRM key and the `import_*.sql` data are copied, and run P0-B1 → B3 first.
4. Tell staff: do not forward the CRM link; change reused passwords elsewhere.
5. Know the limit: anyone who already has the URL + key can still call the database directly. Only P0-B2/B3 fix that. P0-B1 will read `index.html`, so the CRM URL and key will be sent to Z.ai; accept this, and rotate the CRM API keys after P0-B3.
6. Record date, actions, repo-visibility history and backup date in `environments.md` → "CRM stop-gap".

## Acceptance

1. `node -v` → `v24.` (or `v22.`); `pnpm -v`, `supabase --version`, `stripe --version`, `claude --version` → each prints a version
2. `deno --version` → first line starts `deno 2.`; `docker info` → exit 0; `gh auth status` → "Logged in to github.com"
3. Claude Code in the repo: `/status` → `glm-5.3[1m]` and `api.z.ai`; `/hooks` → SessionStart, PreToolUse, Stop; guard test → `[ppos guard]` refusal
4. `gh repo view --json visibility --jq .visibility` → `PRIVATE`
5. `gh label list | grep -c protected-change-approved` → `1`
6. `gh api 'repos/{owner}/{repo}/rules/branches/main' --jq 'map(.type)'` → contains `pull_request`, `required_status_checks`, `non_fast_forward` (or, for classic protection, `gh api 'repos/{owner}/{repo}/branches/main/protection'` → HTTP 200)
7. `git check-ignore -v .env.local` → prints a `.gitignore` rule; `git ls-files | grep -E '(^|/)\.env'` → nothing except `.env.example`
8. `grep -nE 'sk_(live|test)_|rk_(live|test)_|whsec_|sb_secret_|sb_publishable_|eyJ' docs/takeaway/reference/environments.md` → no output
9. `node scripts/guards/run-all.mjs` → `All guards passed.`
10. `git fetch origin && git ls-tree --name-only origin/main | grep -cE '^(AGENTS\.md|CLAUDE\.md|\.claude|\.github|scripts|docs)$'` → `6`; `git cat-file -e origin/main:.claude/settings.json` → exit 0 (step C0 done)
11. Human check: the sandbox's Connect payment-method settings show only Cards, Apple Pay, Google Pay and Link enabled (step E4)
12. **Later:** `supabase projects list` (account B) → shows `takeaway-dev` and not `takeaway-prod`; after linking, `cat supabase/.temp/project-ref` → the DEV ref
13. **Later (first merge to `main` after the Vercel projects exist):** Vercel → Deployments shows no new deployment serving production for that merge (none created, or staged and not assigned to the production domain)

## Definition of Done

- [ ] All Acceptance items pass (paste a one-line summary per item into PROGRESS.md → Done log)
- [ ] `node scripts/guards/run-all.mjs` exits 0 on `main` after the `environments.md` PR
- [ ] The `environments.md` PR changed only that file
- [ ] PROGRESS.md → `## Current` says the next task (P0-01 or P0-B1; they are independent); start it with the prompts in `docs/takeaway/prompts.md` (P0-01: §1, then §2b followed by §2a; P0-B1: §1 + §5a)
- [ ] CRM stop-gap applied, or the decision not to apply it is recorded with a date

## Stop and escalate if

- `/status` still shows Flash or a non-`api.z.ai` URL after step B3, or `/hooks` is empty, or the guard test is not refused → start no agent task.
- `.claude/settings.json` is missing from the repo → ask the planner; the guardrails are not wired.
- Branch rules are unavailable and you do not want to upgrade GitHub → ask the planner for an alternative.
- Any key was committed, pasted into a chat or shown in a screenshot → rotate it immediately (Z.ai, Stripe, Supabase) before anything else.
- Stripe Connect setup has no option matching "connected accounts pay Stripe fees, full Dashboard", or Supabase offers no London region → ask before choosing.
- The repo was ever public → do step H, then run P0-B1 before any platform work.

## Hints (verified facts / pitfalls)

- Peak hours (reported, UNVERIFIED): Mon–Fri 14:00–18:00 UTC+8 = UK 06:00–10:00 GMT / 07:00–11:00 BST. Schedule long runs outside them.
- Effort: Claude Code sends `--effort` as `output_config.effort`; GLM-5.3 knows only `low | high | max` and treats anything else as `max`. How Z.ai maps Claude Code levels is undocumented, hence the probe.
- In zsh quote model names: `claude --model 'glm-5.3[1m]'`.
- The project's `CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000` overrides the helper's 1048576 in this repo; that is intended (quality beyond ~100K tokens is unproven).
- If GLM loops on ToolSearch calls, add `"ENABLE_TOOL_SEARCH": "false"` to `~/.claude/settings.json` → `env` and restart (handbook §D.7).
- Supabase free projects pause when idle (UNVERIFIED): resume `takeaway-dev` before P0-03.
- Agent machine = DEV only. Keep PROD in account A, Vercel Production and Stripe live, managed from your browser.
