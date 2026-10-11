// Copy a task's golden acceptance tests into place (byte-identical). Agents run this; they never edit the copies.
// Usage: pnpm acceptance:install <TASK-ID>      e.g. pnpm acceptance:install P1-01
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadJson, REPO_ROOT } from '../guards/lib.mjs';

const task = process.argv[2];
const manifest = loadJson('docs/takeaway/acceptance/manifest.json');
const tasks = Object.keys(manifest).filter((k) => !k.startsWith('$'));

if (!task) {
  console.error(`Usage: pnpm acceptance:install <TASK-ID>\nTasks with golden tests: ${tasks.join(', ') || '(none)'}`);
  process.exit(2);
}
const entry = manifest[task];
if (!entry) {
  console.error(`No golden acceptance tests for ${task}.\nTasks with golden tests: ${tasks.join(', ') || '(none)'}\nIf this task is "tests-first", write proposals in docs/takeaway/acceptance-proposals/${task}/ and ask the human to freeze them.`);
  process.exit(2);
}
for (const f of entry.files) {
  const src = join(REPO_ROOT, 'docs/takeaway/acceptance', f.src);
  const dest = join(REPO_ROOT, f.dest);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  console.log(`installed ${f.dest}`);
}
console.log(`\n${task}: ${entry.files.length} golden acceptance file(s) installed. Run: ${entry.command ?? 'pnpm test'}`);
