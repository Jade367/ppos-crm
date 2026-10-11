// Every dependency must be human-approved (docs/takeaway/reference/approved-deps.json) and pinned to an
// exact version. Guards against hallucinated / typo-squatted package names and silent upgrades.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadJson, readText, REPO_ROOT, report, walk } from './lib.mjs';

const problems = [];
const approved = loadJson('docs/takeaway/reference/approved-deps.json');
const npmOk = new Set(Object.keys(approved.npm ?? {}));
const denoOk = new Set(Object.keys(approved.deno ?? {}));
const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const pkgFiles = ['package.json', ...walk(['apps', 'packages', 'e2e']).filter((f) => f.endsWith('/package.json'))];
for (const file of pkgFiles) {
  if (!existsSync(join(REPO_ROOT, file))) continue;
  const pkg = JSON.parse(readText(file));
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, spec] of Object.entries(pkg[field] ?? {})) {
      if (typeof spec === 'string' && spec.startsWith('workspace:')) continue;
      if (!npmOk.has(name)) problems.push(`${file} ${field}: "${name}" is not in approved-deps.json (ask the human; never guess package names).`);
      if (field !== 'peerDependencies' && !EXACT.test(String(spec))) problems.push(`${file} ${field}: "${name}@${spec}" must be an exact version (no ^ ~ * ranges).`);
    }
  }
}

// Deno: deno.json / import_map.json imports + inline npm:/jsr: specifiers in function sources.
const SPEC = /["'`](npm|jsr):(@?[^@"'`\s/]+(?:\/[^@"'`\s/]+)?)(?:@([^"'`\s/]+))?[^"'`]*["'`]/g;
const denoFiles = walk(['supabase/functions', 'packages']).filter((f) => /(deno\.jsonc?|import_map\.json|\.(t|j)sx?)$/.test(f));
for (const file of denoFiles) {
  const text = readText(file);
  if (/\.(t|j)sx?$/.test(file) && /from\s+["']https?:\/\//.test(text)) problems.push(`${file}: remote URL imports are not allowed; map packages in deno.json with pinned npm:/jsr: specifiers.`);
  for (const m of text.matchAll(SPEC)) {
    const [, scheme, name, version] = m;
    const key = `${scheme}:${name}`;
    if (!denoOk.has(key)) problems.push(`${file}: "${key}" is not in approved-deps.json deno section.`);
    if (!version || !EXACT.test(version)) problems.push(`${file}: "${key}" must be pinned to an exact version (got "${version ?? 'none'}").`);
  }
}

const ok = report('deps-allowlist', problems);
process.exitCode = ok ? 0 : 1;
