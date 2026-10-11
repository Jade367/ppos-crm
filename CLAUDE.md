@AGENTS.md

## Claude Code specifics (also applies when Claude Code is driven by GLM-5.3 via Z.ai)

- Project hooks in `.claude/settings.json` enforce the rules above: protected/legacy paths, ranged reads of `index.html`, dangerous shell commands, unapproved packages, a verification gate before you stop, and session context injection. A `[ppos guard]` message means the action was refused on purpose; follow its instruction instead of retrying another way.
- The SessionStart hook injects `PROGRESS.md` → `## Current`. Treat it as the ground truth for where the work stands, not your memory of earlier sessions.
- Prefer `Grep` + `Read` with `offset`/`limit` over reading whole files. Keep the working context small; long contexts degrade quality.
- Use `Edit` for changes to existing files. Use `Write` only for new files or files under ~300 lines.
