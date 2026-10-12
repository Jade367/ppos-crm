// Dry-run a tests-first proposal (session A). Temporarily copies the proposed tests to their dest, runs the
// proposal's command, then always removes the copies. Before implementation the tests SHOULD fail — but because
// the implementation is missing (missing export / "not implemented"), never because of syntax errors, wrong
// import paths or wrong test-runner setup. Paste the output into the proposal PR.
// Usage: pnpm acceptance:try <TASK-ID>      (or: node scripts/acceptance/try-proposal.mjs <TASK-ID>)
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { REPO_ROOT } from '../guards/lib.mjs';

const task = process.argv[2];
if (!task) {
  console.error('Usage: node scripts/acceptance/try-proposal.mjs <TASK-ID>');
  process.exit(2);
}
const dir = join(REPO_ROOT, 'docs/takeaway/acceptance-proposals', task);
const proposal = JSON.parse(readFileSync(join(dir, 'proposal.json'), 'utf8'));
const copied = [];
let status = 1;
try {
  for (const f of proposal.files ?? []) {
    if (!/(^|\/)tests\/acceptance\/[^/]+$/.test(f.dest)) throw new Error(`dest must be inside a tests/acceptance/ directory: ${f.dest}`);
    const dest = join(REPO_ROOT, f.dest);
    if (existsSync(dest)) throw new Error(`${f.dest} already exists — refusing to overwrite (is it already frozen?)`);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(dir, f.file), dest);
    copied.push(dest);
  }
  const command = proposal.command ?? 'pnpm test';
  console.log(`$ ${command}   (proposal dry-run for ${task}; copies are removed afterwards)\n`);
  const r = spawnSync(command, { cwd: REPO_ROOT, stdio: 'inherit', shell: true });
  status = r.status ?? 1;
} catch (err) {
  console.error(String(err?.message ?? err));
  status = 2;
} finally {
  for (const p of copied) rmSync(p, { force: true });
  console.log(`\nRemoved ${copied.length} temporary file(s). Command exit status: ${status}.`);
}
process.exit(status);
