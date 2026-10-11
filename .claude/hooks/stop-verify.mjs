// Stop hook: before the agent ends a turn with uncommitted code changes, run the quick verification.
// If it fails, block the stop once and show the failure. Never loops: if stop_hook_active is true we allow.
// Caches the last green state so pure conversation turns stay fast.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, tryGit } from '../../scripts/guards/lib.mjs';
import { readInput } from './hook-lib.mjs';

const CODE = /^(apps|packages|supabase|e2e|scripts)\//;
const STATE_DIR = join(REPO_ROOT, '.claude', '.state');
const STATE = join(STATE_DIR, 'last-green.txt');

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

async function main() {
  const input = await readInput();
  if (input.stop_hook_active) process.exit(0);

  const status = tryGit(['status', '--porcelain', '--untracked-files=all']) ?? '';
  const changed = status
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3).replace(/^"|"$/g, ''))
    .filter((f) => CODE.test(f));
  if (changed.length === 0) process.exit(0);

  const fingerprint = createHash('sha256')
    .update(status)
    .update(tryGit(['diff', 'HEAD']) ?? '')
    .update(changed.filter((f) => existsSync(join(REPO_ROOT, f))).map((f) => readFileSync(join(REPO_ROOT, f))).join('\0'))
    .digest('hex');
  if (existsSync(STATE) && readFileSync(STATE, 'utf8').trim() === fingerprint) process.exit(0);

  const hasPnpm = existsSync(join(REPO_ROOT, 'package.json')) && /"verify:quick"/.test(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const [cmd, args] = hasPnpm ? ['pnpm', ['-s', 'verify:quick']] : [process.execPath, ['scripts/guards/run-all.mjs']];
  const r = spawnSync(cmd, args, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 280_000, maxBuffer: 20 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (r.status === 0) {
    mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE, fingerprint);
    process.exit(0);
  }
  const tail = out.split('\n').slice(-60).join('\n');
  block(
    `Uncommitted code changes do not pass \`${hasPnpm ? 'pnpm verify:quick' : 'node scripts/guards/run-all.mjs'}\` (exit ${r.status ?? 'timeout'}).\n` +
      `Fix the cause — never edit tests, skip tests or suppress checks to get green. If you have already tried 3 times, ` +
      `write a BLOCKED entry (with the failing output and your confirmed vs unconfirmed hypotheses) in docs/takeaway/PROGRESS.md and stop.\n\n${tail}`,
  );
}

main().catch((err) => {
  process.stderr.write(`[ppos stop hook] internal error (allowing stop): ${err?.stack ?? err}\n`);
  process.exit(0);
});
