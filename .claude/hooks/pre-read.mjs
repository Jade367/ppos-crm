// PreToolUse(Read): block secret files; force ranged reads of huge legacy files (index.html ≈ 220K tokens).
import { isSecretFile, loadPolicy, REPO_ROOT, toRepoRelative } from '../../scripts/guards/lib.mjs';
import { allowSilently, deny, guardMain, overrideOn, readInput } from './hook-lib.mjs';

guardMain(async () => {
  const input = await readInput();
  const ti = input.tool_input ?? {};
  if (!ti.file_path) allowSilently();
  const policy = loadPolicy();
  const rel = toRepoRelative(ti.file_path, input.cwd || REPO_ROOT);

  if (isSecretFile(rel, policy)) {
    deny(`${rel} may contain secrets. Agents never read secret files (anything you read is sent to the model provider). Use the variable names documented in docs/takeaway/reference/architecture.md §3.`);
  }
  if (!overrideOn(policy)) {
    for (const r of policy.rangedReadOnly) {
      if (rel !== r.path) continue;
      const limit = Number(ti.limit);
      if (!Number.isFinite(limit) || limit <= 0 || limit > r.maxLines) {
        deny(`${rel} is huge. Locate code with Grep first, then Read with offset and limit ≤ ${r.maxLines} lines.`);
      }
    }
  }
  allowSilently();
});
