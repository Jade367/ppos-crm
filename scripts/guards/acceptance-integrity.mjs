// Golden acceptance tests live in docs/takeaway/acceptance/<TASK>/ and are installed (copied) into packages.
// Installed copies must be byte-identical to the golden source, and every file under a tests/acceptance
// directory must come from the manifest. This prevents "making tests pass" by editing the tests.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadJson, REPO_ROOT, report, walk } from './lib.mjs';

const MANIFEST = 'docs/takeaway/acceptance/manifest.json';
const problems = [];
let manifest = {};
try {
  manifest = loadJson(MANIFEST);
} catch (e) {
  problems.push(`cannot read ${MANIFEST}: ${e.message}`);
}

const knownDest = new Set();
for (const [task, entry] of Object.entries(manifest)) {
  if (task.startsWith('$')) continue;
  for (const f of entry.files ?? []) {
    const src = `docs/takeaway/acceptance/${f.src}`;
    knownDest.add(f.dest);
    if (!existsSync(join(REPO_ROOT, src))) {
      problems.push(`[${task}] golden source missing: ${src}`);
      continue;
    }
    if (!existsSync(join(REPO_ROOT, f.dest))) continue; // not installed yet — fine
    const a = readFileSync(join(REPO_ROOT, src));
    const b = readFileSync(join(REPO_ROOT, f.dest));
    if (!a.equals(b)) problems.push(`[${task}] ${f.dest} differs from golden ${src}. Re-run \`pnpm acceptance:install ${task}\`; never edit acceptance tests.`);
  }
}

for (const file of walk(['apps', 'packages', 'supabase', 'e2e'])) {
  if (/(^|\/)tests\/acceptance\//.test(file) && !knownDest.has(file)) {
    problems.push(`${file} is in an acceptance directory but not in ${MANIFEST}. Acceptance tests are added only via the human freeze step.`);
  }
}

const ok = report('acceptance-integrity', problems);
process.exitCode = ok ? 0 : 1;
