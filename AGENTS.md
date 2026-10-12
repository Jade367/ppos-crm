# AGENTS.md — operating rules for coding agents in this repo

This repo contains (1) a **legacy CRM** (`index.html` + root `*.sql`, live business data) and (2) the **takeaway ordering platform** being built under `apps/`, `packages/`, `supabase/`, `e2e/`. You are the executing agent. A human owns every decision outside your task card.

These rules are short on purpose. Hooks in `.claude/` and CI in `.github/` enforce the important ones. If a hook blocks you, **do not look for a way around it**. Follow its message.

## 1. Where things are

- Task cards: `docs/takeaway/tasks/<ID>-*.md`. You execute exactly one per session.
- Canonical spec: `docs/takeaway/reference/architecture.md`. If a card and the spec disagree, stop and report it.
- Stripe facts: `docs/takeaway/reference/stripe-endive.md`. Read it before writing **any** Stripe code. Your training data predates this Stripe API version.
- UK legal rules for product behaviour: `docs/takeaway/reference/uk-compliance.md`.
- Pinned versions: `docs/takeaway/reference/versions.md`. Approved packages: `docs/takeaway/reference/approved-deps.json`.
- Shared memory between sessions: `docs/takeaway/PROGRESS.md`. Keep it current; the next session starts from it.

## 2. Session loop (follow in order)

1. Read `PROGRESS.md` → `## Current`, then the task card. Read only the files the card lists under **Read first**, plus files you discover with `grep`/`rg`. Do not bulk-read directories.
2. Write a 3–5 line restatement of the goal and the acceptance criteria into `PROGRESS.md` → `## Current`.
3. `git checkout -b task/<ID>-<slug>` from an up-to-date `main` (or continue the existing task branch).
4. If the card has golden tests: `pnpm acceptance:install <ID>`, run them, confirm they fail for the right reason.
5. Work in small steps. After each step that turns something green: `pnpm verify:quick`, then commit (`feat(scope): … [<ID>]`). Checkpoint commits are mandatory: they are your undo button.
6. Finish with `pnpm verify`. Paste its last 20 lines into `PROGRESS.md` → `## Done log` together with the commit hash.
7. Push the branch and open a PR with the template. Update `PROGRESS.md` handoff. **Stop.** Do not start the next task.

## 3. Definition of done

All of: every checklist item in the card's **Definition of Done**; `pnpm verify` exits 0; golden acceptance tests (if any) are installed unmodified and green; CI green on the PR. Your own statement that something works is not evidence. Command output is.

## 4. Never

- Never edit, delete, skip (`.skip`, `.only`, `.todo`, `skipIf`), weaken or mock-away a test to make it pass. Never edit files under any `tests/acceptance/` directory.
- Never edit protected files: `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `.github/**`, `scripts/guards/**`, `scripts/acceptance/**`, `docs/takeaway/**` (except `PROGRESS.md`, `reference/versions.md`, `acceptance-proposals/**`, `adr/**`, `tasks/proposed/**`, `reviews/**`). Propose changes in `PROGRESS.md` instead.
- Never touch the legacy CRM (`index.html`, root `*.sql`, `3d-packaging.html`) unless the card says so **and** the human started the session with `PPOS_ALLOW_LEGACY=1`. Even then: locate with `grep -n`, read ≤ 400 lines at a time, change with small `Edit`s. Never rewrite the file.
- Never edit a migration that is already on `main`. Add a new one with `supabase migration new <name>`.
- Never install a package that is not in `approved-deps.json`, and never use version ranges. Do not guess package names.
- Never read `.env*` files, print environment variables, or put secrets, real customer data or production identifiers in code, logs, commits or prompts.
- Never run commands against production, merge PRs, add PR labels, force-push or push to `main`.
- Never use floats for money, `new Date()`/`Date.now()` inside `packages/core`, `@ts-ignore`/`@ts-expect-error`, `eslint-disable`, or `dangerouslySetInnerHTML`.
- Never write Chinese (or any CJK) text in customer-facing code. Merchant Chinese goes only in `apps/merchant/src/i18n/zh-CN.ts`.

## 5. When stuck (anti-loop rule)

- Keep a hypothesis log in `PROGRESS.md` → `## Current`: mark each idea **[H] unconfirmed** or **[C] confirmed by <command/output>**. Do not build on an [H].
- After **3 failed attempts at the same failure**, stop changing code. Write a `## Blockers` entry: the exact error, what you tried, the confirmed facts, the open hypotheses and the question for the human. Then end the session.
- Also stop and ask (via `## Blockers`) when: the card is ambiguous; the spec seems wrong; you need a new dependency, a protected-file change, a schema change outside the card, a money/legal/pricing rule, or any production access.
- If you are unsure how an external API behaves (Stripe, Supabase, Twilio), read the reference docs or the official docs through the web-reader tool. Do not rely on memory. Write what you verified, with the URL, into the card's notes in `PROGRESS.md`.

## 6. Code rules

- TypeScript strict everywhere. Fix type errors properly: they are how we catch invented APIs.
- `packages/core` is pure: no I/O, no clock, no randomness. Pass `now` and config in as arguments.
- Money is integer pence (`*_pence` / `*Pence`). Format only with `formatPence`.
- One price calculator (`priceOrder` in `packages/core`) is used by both the UI and the server. The server always re-prices from the database.
- If ADR-0002 chose the copy approach (option C), run `node scripts/dev/sync-core.mjs` after any change under `packages/core/src` and commit the copy; CI fails otherwise.
- Keep files under ~300 lines. Prefer creating a new small file to growing a big one. For any file over 300 lines, use targeted `Edit`s, never a full rewrite.
- Do only what the card asks. If you notice something else worth doing, note it under `## Follow-ups` in `PROGRESS.md`.
- UI work: you cannot see the screen. Verify with Testing Library / Playwright assertions on roles, labels and text. The human checks visuals on the Vercel preview.

## 7. Communication

- Commit messages, code, comments and identifiers: English. `PROGRESS.md` may mix English and Chinese; keep technical terms in English.
- In `PROGRESS.md`, write facts and evidence, not adjectives. "Done", "fixed" or "works" must come with the command and output that show it.
