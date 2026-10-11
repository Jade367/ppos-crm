// Runs every guard. Used by `pnpm guards`, the Claude Code Stop hook and CI.
// Usage: node scripts/guards/run-all.mjs [--with-protected-paths]
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO_ROOT } from './lib.mjs';

const guards = ['banned-patterns.mjs', 'cjk-lint.mjs', 'acceptance-integrity.mjs', 'deps-allowlist.mjs'];
if (process.argv.includes('--with-protected-paths')) guards.push('protected-paths.mjs');

let failed = 0;
for (const g of guards) {
  const r = spawnSync(process.execPath, [join(REPO_ROOT, 'scripts/guards', g), ...process.argv.slice(2).filter((a) => a !== '--with-protected-paths')], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  if (r.status !== 0) failed++;
}
if (failed) {
  console.log(`\n${failed} guard(s) failed.`);
  process.exit(1);
}
console.log('\nAll guards passed.');
