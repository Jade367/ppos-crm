// Shared helpers for guard scripts and Claude Code hooks. No dependencies.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export function loadJson(relPath) {
  return JSON.parse(readFileSync(join(REPO_ROOT, relPath), 'utf8'));
}

export function loadPolicy() {
  return loadJson('scripts/guards/policy.json');
}

const globCache = new Map();
export function globToRegExp(glob) {
  if (globCache.has(glob)) return globCache.get(glob);
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        const slashAfter = glob[i + 2] === '/';
        re += slashAfter ? '(?:.*/)?' : '.*';
        i += slashAfter ? 2 : 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('\\^$+.()|{}[]'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  const rx = new RegExp(`^${re}$`);
  globCache.set(glob, rx);
  return rx;
}

export function matchesAny(relPath, globs) {
  return globs.some((g) => globToRegExp(g).test(relPath));
}

/** Normalise an absolute or relative path to a POSIX path relative to the repo root, or null if outside. */
export function toRepoRelative(p, base = REPO_ROOT) {
  if (!p) return null;
  const abs = resolve(base, p);
  const rel = relative(REPO_ROOT, abs);
  if (rel.startsWith('..') || resolve(REPO_ROOT, rel) !== abs) return null;
  return rel.split(sep).join('/');
}

/** Classify a repo-relative path for write access. */
export function classifyWrite(rel, policy = loadPolicy()) {
  if (rel === null) return { kind: 'outside' };
  if (matchesAny(rel, policy.legacy)) return { kind: 'legacy' };
  if (matchesAny(rel, policy.agentWritable)) return { kind: 'writable' };
  if (matchesAny(rel, policy.protected)) return { kind: 'protected' };
  if (matchesAny(rel, policy.appendOnly)) return { kind: 'appendOnly' };
  return { kind: 'writable' };
}

export function isSecretFile(rel, policy = loadPolicy()) {
  if (rel === null) return false;
  return matchesAny(rel, policy.secretFiles) && !matchesAny(rel, policy.secretFileExceptions);
}

export function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

export function tryGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

/** Returns the first existing ref among candidates, or null. */
export function firstRef(candidates) {
  for (const ref of candidates) {
    if (tryGit(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`])) return ref;
  }
  return null;
}

/** True if the path exists in the given ref (e.g. origin/main). */
export function existsInRef(ref, rel) {
  return tryGit(['cat-file', '-e', `${ref}:${rel}`]) !== null;
}

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.vercel', '.turbo', 'playwright-report', 'test-results', '.supabase', '.temp']);

/** Recursively list repo-relative POSIX file paths under the given repo-relative directories. */
export function walk(dirs) {
  const out = [];
  const visit = (absDir) => {
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) visit(join(absDir, e.name));
      } else if (e.isFile()) {
        out.push(relative(REPO_ROOT, join(absDir, e.name)).split(sep).join('/'));
      }
    }
  };
  for (const d of dirs) {
    const abs = join(REPO_ROOT, d);
    if (existsSync(abs) && statSync(abs).isDirectory()) visit(abs);
  }
  return out;
}

export function readText(rel) {
  return readFileSync(join(REPO_ROOT, rel), 'utf8');
}

export function report(name, problems) {
  if (problems.length === 0) {
    console.log(`✔ ${name}`);
    return true;
  }
  console.log(`✘ ${name} — ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  - ${p}`);
  return false;
}
