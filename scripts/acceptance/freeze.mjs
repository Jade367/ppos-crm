// HUMAN-ONLY. Promote reviewed test proposals to golden acceptance tests.
// The Claude Code Bash hook blocks agents from running this script.
//
// Usage: node scripts/acceptance/freeze.mjs <TASK-ID> [--replace]
//
// Expects docs/takeaway/acceptance-proposals/<TASK-ID>/proposal.json:
//   { "command": "pnpm --filter @ppos/core test", "files": [ { "file": "slots.acceptance.test.ts", "dest": "packages/core/tests/acceptance/slots.acceptance.test.ts" } ] }
// and the listed files next to it. Moves them to docs/takeaway/acceptance/<TASK-ID>/ and updates manifest.json.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../guards/lib.mjs';

const [task, flag] = process.argv.slice(2);
if (!task) {
  console.error('Usage: node scripts/acceptance/freeze.mjs <TASK-ID> [--replace]');
  process.exit(2);
}
const proposalDir = join(REPO_ROOT, 'docs/takeaway/acceptance-proposals', task);
const proposalFile = join(proposalDir, 'proposal.json');
if (!existsSync(proposalFile)) {
  console.error(`Missing ${proposalFile}`);
  process.exit(2);
}
const manifestPath = join(REPO_ROOT, 'docs/takeaway/acceptance/manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest[task] && flag !== '--replace') {
  console.error(`${task} already has golden tests. Use --replace to overwrite (this changes the contract — be sure).`);
  process.exit(2);
}
const proposal = JSON.parse(readFileSync(proposalFile, 'utf8'));
if (!Array.isArray(proposal.files) || proposal.files.length === 0) {
  console.error('proposal.json must list at least one file');
  process.exit(2);
}
const goldenDir = join(REPO_ROOT, 'docs/takeaway/acceptance', task);
mkdirSync(goldenDir, { recursive: true });
const files = [];
for (const f of proposal.files) {
  if (!/(^|\/)tests\/acceptance\/[^/]+$/.test(f.dest)) {
    console.error(`dest must be inside a tests/acceptance/ directory: ${f.dest}`);
    process.exit(2);
  }
  renameSync(join(proposalDir, f.file), join(goldenDir, f.file));
  files.push({ src: `${task}/${f.file}`, dest: f.dest });
}
manifest[task] = { command: proposal.command ?? 'pnpm test', files };
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
rmSync(proposalDir, { recursive: true, force: true });
console.log(`Frozen ${files.length} file(s) for ${task}. Review with \`git diff\`, then commit, e.g.:\n  git add docs/takeaway && git commit -m "test(${task}): freeze acceptance tests"`);
