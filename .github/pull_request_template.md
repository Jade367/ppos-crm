## Task

- Task card: `docs/takeaway/tasks/<TASK-ID>-*.md`
- Task ID: <!-- e.g. P1-01 -->

## What changed

<!-- 3–6 bullet points. No marketing language. -->

## Evidence (paste real output — the reviewer will compare it with CI)

```text
$ pnpm verify
<last 20 lines>
```

- [ ] Golden acceptance tests installed with `pnpm acceptance:install <TASK-ID>` (if the task has them) and green
- [ ] No test was edited, skipped or weakened to make it pass
- [ ] No protected or legacy file changed (or the human approved it with the `protected-change-approved` label)
- [ ] New dependencies are in `approved-deps.json` and pinned exactly
- [ ] `docs/takeaway/PROGRESS.md` updated (done log + handoff)

## Out of scope / follow-ups

<!-- Anything noticed but intentionally not done. -->

## Reviewer checklist (human)

- [ ] Preview deployment looks right on a phone-sized screen (UI tasks)
- [ ] Diff touches only the files the task card lists
- [ ] Money is integer pence; no Stripe pattern from the banned list
