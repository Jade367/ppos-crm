# <ID> — <Title>

| Field | Value |
|---|---|
| Phase | P? |
| Depends on | <IDs, or —> |
| Mode | `standard` \| `tests-first` (session A writes test proposals, human freezes, session B implements) \| `pass@2` (two independent attempts, keep the better) \| `review` (read-only; writes only docs/takeaway/reviews/, tasks/proposed/ and PROGRESS.md) \| `spike` (time-boxed experiment; result and evidence go into an ADR) \| `human` |
| Reasoning effort | `high` (routine) \| `max` (design, debugging, security, money) |
| Model | `glm-5.3` (never Flash for money, auth, RLS, Stripe or migrations) |
| Session budget | ≤ N hours wall-clock / one task. If exceeded: checkpoint commit, write handoff, stop. |
| Golden tests | `docs/takeaway/acceptance/<ID>/` (install with `pnpm acceptance:install <ID>`) \| none \| proposals (tests-first) |

## Goal

One paragraph: what exists when this is done, and why it matters.

## Read first (and only these, plus what you find with grep)

- `docs/takeaway/reference/architecture.md` §…
- …

## Out of scope

- Explicit list of tempting things NOT to do in this task.

## Deliverables

| Path | Action |
|---|---|
| `packages/core/src/….ts` | create |

## Spec

Precise rules, types, names, edge cases. Prefer examples and tables over prose.

## Acceptance

Executable checks only. Each line is a command plus its expected result, or a golden test file.

1. `pnpm acceptance:install <ID> && pnpm --filter @ppos/core test` → all green
2. …

## Definition of Done

- [ ] All Acceptance items pass (paste output into PROGRESS.md)
- [ ] `pnpm verify` exits 0
- [ ] Only the Deliverables paths changed (`git diff --stat main...HEAD`)
- [ ] PROGRESS.md updated (done log, follow-ups)
- [ ] PR opened with the template

## Stop and escalate if

- …

## Hints (verified facts / pitfalls)

- …
