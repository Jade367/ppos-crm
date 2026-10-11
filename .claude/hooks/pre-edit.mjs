// PreToolUse(Edit|Write|MultiEdit|NotebookEdit): block writes to protected, legacy and merged-migration files.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { classifyWrite, existsInRef, firstRef, loadPolicy, REPO_ROOT, toRepoRelative } from '../../scripts/guards/lib.mjs';
import { allowSilently, deny, guardMain, legacyOn, overrideOn, readInput } from './hook-lib.mjs';

guardMain(async () => {
  const input = await readInput();
  const ti = input.tool_input ?? {};
  const target = ti.file_path ?? ti.notebook_path ?? ti.path;
  if (!target) allowSilently();
  const policy = loadPolicy();
  const rel = toRepoRelative(target, input.cwd || REPO_ROOT);
  const cls = classifyWrite(rel, policy);

  if (cls.kind === 'protected' && !overrideOn(policy)) {
    deny(
      `${rel} is protected (guardrails, plans, golden tests, CI, agent rules). Do not edit it. ` +
        `If it really must change, write the exact proposed change under "Proposed doc changes" in docs/takeaway/PROGRESS.md and stop for human review.`,
    );
  }
  if (cls.kind === 'legacy' && !legacyOn(policy) && !overrideOn(policy)) {
    deny(
      `${rel} belongs to the legacy CRM and is read-only unless the human starts the session with ${policy.legacyEnv}=1 for a CRM task. ` +
        `Never rewrite index.html wholesale; use small Edit calls only.`,
    );
  }
  if (cls.kind === 'legacy' && rel === 'index.html' && input.tool_name === 'Write' && existsSync(join(REPO_ROOT, rel))) {
    deny('index.html is ~220K tokens — larger than the model output limit. Whole-file Write would truncate it. Use small Edit calls.');
  }
  if (cls.kind === 'appendOnly' && !overrideOn(policy)) {
    const base = firstRef(['origin/main', 'main']);
    if (base && existsInRef(base, rel)) {
      deny(`${rel} is already merged into ${base}. Migrations are append-only: create a new one with \`supabase migration new <name>\`.`);
    }
  }
  allowSilently();
});
