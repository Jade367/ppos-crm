# PROGRESS — shared memory between agent sessions

> Agents: update this file at the start (section "Current") and end (sections "Done log" / "Blockers") of every session.
> Humans: read the "Blockers" and "Proposed doc changes" sections before starting the next session.
> Keep "Current" short (< 60 lines): it and "Blockers" are injected into every new session.
> Do not write a level-2 heading marker (two hashes + space) inside text: the SessionStart hook finds sections by it.

## Current

- Task: _none — next is P0-01 (after the human finishes P0-00)_
- Branch: —
- Restated goal: —
- Acceptance: —
- Hypothesis log: —
- Next step: —

## Blockers

_(none)_

## Follow-ups

_(things noticed but out of scope; the human decides whether they become task cards)_

- 2026-10-12 (setup session): `.claude/hooks/session-start.mjs` finds sections with an unanchored regex, so a heading marker written inline in this file would hijack the injected context. Worked around by rewording this file's header. Hardening (human, protected file): use `/^## Current[ \t]*$[\s\S]*?(?=^## |(?![\s\S]))/m` and the same for Blockers.

## Proposed doc changes

_(agents cannot edit plans, references, guards or golden tests — propose exact changes here)_

- 2026-10-12 (setup session) — `docs/takeaway/03-execution-handbook.md` lines 140, 555, 817, 979, 1010 still say `pre-bash` cannot stop `gh pr create --label …`. That gap is now closed. Evidence (pre-bash fed each command as hook input): `BLOCKED gh pr create --label protected-change-approved`, `BLOCKED gh pr create -l …`, `allowed gh api graphql -f query='mutation{addLabelsToLabelable…}'`, `allowed gh api -X PUT repos/o/r/pulls/1/merge`, `allowed cd scripts/acceptance && node freeze.mjs …`. Proposed: replace the `gh pr create --label` example in those 5 lines with `gh api graphql` (label mutation). Keep G-16 (check who added the label) unchanged, because label changes are still possible through GraphQL.

## Dependency requests

_(name, purpose, npm URL, weekly downloads, alternatives considered)_

## Done log

| Task | Date | Branch / PR | Commit | Evidence (last lines of `pnpm verify`) |
|---|---|---|---|---|
| — | — | — | — | — |
