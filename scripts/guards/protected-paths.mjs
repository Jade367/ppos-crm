// CI check: a branch/PR must not change protected, legacy or already-merged (append-only) files unless a human
// applied the approval label. Usage: node scripts/guards/protected-paths.mjs [--base <ref>]
// In GitHub Actions the base is origin/$GITHUB_BASE_REF and labels come from $GITHUB_EVENT_PATH.
import { readFileSync } from 'node:fs';
import { classifyWrite, existsInRef, firstRef, loadPolicy, report, tryGit } from './lib.mjs';

const policy = loadPolicy();
const argBase = (() => {
  const i = process.argv.indexOf('--base');
  return i > -1 ? process.argv[i + 1] : null;
})();
const ghBase = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null;
const base = argBase ?? ghBase ?? firstRef(['origin/main', 'main']);

if (!base) {
  console.log('✔ protected-paths (skipped: no base ref)');
  process.exit(0);
}

const labels = (() => {
  try {
    const ev = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH ?? '', 'utf8'));
    return (ev.pull_request?.labels ?? []).map((l) => l.name);
  } catch {
    return [];
  }
})();
const approved = labels.includes(policy.approvalLabel);

const mergeBase = tryGit(['merge-base', base, 'HEAD']);
if (!mergeBase) {
  console.log(`✔ protected-paths (skipped: no merge-base with ${base})`);
  process.exit(0);
}
if (tryGit(['rev-parse', 'HEAD']) === mergeBase) {
  console.log(`✔ protected-paths (no changes vs ${base})`);
  process.exit(0);
}

const diff = tryGit(['diff', '--name-status', '--no-renames', `${mergeBase}...HEAD`]) ?? '';
const problems = [];
for (const line of diff.split('\n').filter(Boolean)) {
  const [status, file] = line.split('\t');
  const cls = classifyWrite(file, policy);
  if (cls.kind === 'protected') problems.push(`${status} ${file} (protected)`);
  else if (cls.kind === 'legacy') problems.push(`${status} ${file} (legacy CRM file)`);
  else if (cls.kind === 'appendOnly' && status !== 'A' && existsInRef(mergeBase, file)) problems.push(`${status} ${file} (already-merged migration; add a new migration instead)`);
}

if (problems.length && approved) {
  console.log(`✔ protected-paths — ${problems.length} protected change(s) approved by label "${policy.approvalLabel}":`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(0);
}
if (problems.length) {
  problems.push(`A human must review these changes and add the PR label "${policy.approvalLabel}" (agents must never add it).`);
}
const ok = report(`protected-paths (base ${base})`, problems);
process.exitCode = ok ? 0 : 1;
