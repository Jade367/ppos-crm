// SessionStart hook: inject the current task state so every new/resumed/compacted session re-anchors on
// PROGRESS.md instead of on memory. Output must stay under 10,000 characters.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, tryGit } from '../../scripts/guards/lib.mjs';

const MAX = 9000;
const parts = [];
const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD']) ?? '?';
parts.push(`# Session context (auto-injected by .claude/hooks/session-start.mjs)`);
parts.push(`Branch: ${branch}`);
const log = tryGit(['log', '--oneline', '-5']);
if (log) parts.push(`Recent commits:\n${log}`);
const st = tryGit(['status', '--short']);
parts.push(`Uncommitted changes:\n${st ? st.split('\n').slice(0, 25).join('\n') : '(none)'}`);

const progressPath = join(REPO_ROOT, 'docs/takeaway/PROGRESS.md');
if (existsSync(progressPath)) {
  const text = readFileSync(progressPath, 'utf8');
  const m = text.match(/## Current[\s\S]*?(?=\n## (?!Current)|$)/);
  const blockers = text.match(/## Blockers[\s\S]*?(?=\n## |$)/);
  parts.push(`From docs/takeaway/PROGRESS.md:\n${(m?.[0] ?? '(no "## Current" section)').slice(0, 3500)}`);
  if (blockers) parts.push(blockers[0].slice(0, 1500));
}
parts.push(
  [
    'Reminders (full rules in AGENTS.md):',
    '1. One task card per session. Re-read the card before acting; do only what it lists.',
    '2. Done = `pnpm verify` green + golden acceptance tests green + CI green. Paste real output as evidence.',
    '3. Never edit or skip tests; never touch protected files; hooks will block you.',
    '4. Stripe: read docs/takeaway/reference/stripe-endive.md before writing any Stripe code.',
    '5. 3 failed attempts at the same problem → write BLOCKED in PROGRESS.md and stop.',
    '6. Commit a checkpoint after every green step. Update PROGRESS.md before you stop.',
  ].join('\n'),
);

let out = parts.join('\n\n');
if (out.length > MAX) out = `${out.slice(0, MAX - 40)}\n…(truncated)`;
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: out } }));
