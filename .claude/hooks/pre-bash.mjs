// PreToolUse(Bash): block destructive git, secret dumping, human-only scripts, writes to protected files via the
// shell, whole-file reads of index.html, unapproved package installs and pipe-to-shell installers.
// Heuristic by design: CI (protected-paths, deps-allowlist, acceptance-integrity) is the backstop.
import { loadJson, loadPolicy, matchesAny } from '../../scripts/guards/lib.mjs';
import { allowSilently, deny, guardMain, legacyOn, overrideOn, readInput } from './hook-lib.mjs';

const RULES = [
  [/\bgit\s+push\b[^\n]*\s(--force\b|--force-with-lease\b|-f\b|\+)/, 'Force-push is not allowed.'],
  [/\bgit\s+push\b[^\n]*\b(origin\s+)?(HEAD:)?(main|master)\b(?![\w/-])/, 'Never push to main. Push your task branch (task/<ID>-<slug>) and open a PR.'],
  [/\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s+\.|restore\s+(--staged\s+)?\.(\s|$)|stash\s+drop|stash\s+clear|branch\s+-D|filter-branch|filter-repo)/, 'Destructive git command. Commit a checkpoint instead; if you are stuck, record BLOCKED in PROGRESS.md and stop.'],
  [/\bgit\s+commit\b[^\n]*--no-verify/, 'Do not bypass checks.'],
  [/\brm\s+(-[a-zA-Z]+\s+)*-[a-zA-Z]*[rR][a-zA-Z]*\s+(-[a-zA-Z]+\s+)*(\/(\s|$|\*)|~\/?(\s|$)|\.\.?\/?(\s|$)|\*(\s|$)|\$HOME\/?(\s|$))/, 'Recursive delete of a root/home/repo directory is blocked.'],
  [/\bsupabase\s+(db\s+reset\s+--linked|projects\s+delete|secrets\s+(set|unset)|link\b)/, 'This Supabase command is human-only (linked project / secrets).'],
  [/\b(printenv|env)\s*($|\||;|&)|\bset\s*$|\bexport\s+-p\b/, 'Dumping the environment can leak secrets to the model provider.'],
  [/\$\{?[A-Z0-9_]*(SECRET|TOKEN|PASSWORD|SERVICE_ROLE|API_KEY|AUTH)[A-Z0-9_]*\}?/, 'Do not print or interpolate secret environment variables in shell commands.'],
  [/\b(cat|less|more|bat|strings|base64|xxd|head|tail)\b[^\n|;]*\.env(?!\.example)\b/, 'Do not read secret files.'],
  [/scripts\/acceptance\/freeze\.mjs/, 'freeze.mjs is human-only. Write proposals to docs/takeaway/acceptance-proposals/<TASK>/ and stop for review.'],
  [/\bgh\s+(pr\s+(merge|edit[^\n]*--add-label|review[^\n]*--approve)|label\b|secret\b|api\b[^\n]*\/labels)/, 'Merging, approving, labelling and secrets are human-only on GitHub.'],
  [/\b(curl|wget)\b[^\n]*\|\s*(ba|z)?sh\b|\bbash\s+<\(\s*(curl|wget)/, 'Pipe-to-shell installers are blocked. Ask the human to install tools.'],
  [/\b(cat|less|more|bat)\s+([^\n|;]*\s)?\.?\/?index\.html\b/, 'index.html is ~220K tokens. Use grep -n to locate code, then Read with offset/limit ≤ 400 lines.'],
];

const WRITE_OPS = /(^|[\s;&|])(>|>>|tee\b|sed\s+-i|perl\s+-[a-z]*i|mv\b|cp\b|rm\b|truncate\b|dd\b|chmod\b|ln\b|install\b|git\s+(rm|mv|checkout|restore)\b)/;
const INSTALL = /\b(?:pnpm|npm|yarn|bun)\b(?:\s+(?:--filter\s+\S+|-F\s+\S+|-C\s+\S+|--dir\s+\S+|--prefix\s+\S+|-[A-Za-z-]+))*\s+(?:add|install|i)\b([^\n;&|]*)/g;
const FLAG_WITH_VALUE = new Set(['--filter', '-F', '-C', '--dir', '--prefix', '--registry', '--tag']);
const RUNNERS = /\b(?:npx|pnpm\s+dlx|bunx|yarn\s+dlx)\s+(?:-[^\s]+\s+)*([^\s;&|]+)/g;

function pkgName(spec) {
  const s = spec.replace(/^['"]|['"]$/g, '');
  if (s.startsWith('-')) return null;
  if (s.startsWith('@')) {
    const [scope, rest = ''] = s.split('/');
    return `${scope}/${rest.split('@')[0]}`;
  }
  return s.split('@')[0];
}

guardMain(async () => {
  const input = await readInput();
  const cmd = String(input.tool_input?.command ?? '');
  if (!cmd) allowSilently();
  const policy = loadPolicy();
  const override = overrideOn(policy);

  for (const [re, why] of RULES) {
    if (re.test(cmd)) deny(`${why} (command: ${cmd.slice(0, 160)})`);
  }

  // Writes to protected/legacy paths through the shell.
  if (!override && WRITE_OPS.test(cmd)) {
    const tokens = cmd.split(/[\s;&|<>()'"`]+/).filter(Boolean).map((t) => t.replace(/^\.\//, ''));
    for (const t of tokens) {
      const isWritableException = matchesAny(t, policy.agentWritable);
      const prot = !isWritableException && matchesAny(t, policy.protected);
      const legacy = matchesAny(t, policy.legacy) && !legacyOn(policy);
      if (prot || legacy) deny(`Shell command would modify a ${prot ? 'protected' : 'legacy'} path (${t}). Those files are changed by humans only.`);
    }
  }

  // Package installs and one-off runners must use approved packages.
  let approved;
  try {
    approved = loadJson('docs/takeaway/reference/approved-deps.json');
  } catch {
    approved = { npm: {}, tools: { list: [] } };
  }
  const npmOk = new Set(Object.keys(approved.npm ?? {}));
  const toolOk = new Set(approved.tools?.list ?? []);
  for (const m of cmd.matchAll(INSTALL)) {
    const specs = m[1].split(/\s+/).filter(Boolean);
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      if (FLAG_WITH_VALUE.has(spec)) {
        i++;
        continue;
      }
      if (/--registry|registry\.|https?:|git\+|github:|file:|link:/.test(spec)) deny(`Installing from a custom registry/URL/path is not allowed (${spec}).`);
      const name = pkgName(spec);
      if (!name || name.startsWith('@ppos/') || spec.includes('workspace:')) continue;
      if (!npmOk.has(name)) deny(`Package "${name}" is not in docs/takeaway/reference/approved-deps.json. Never guess package names; request it in PROGRESS.md and stop.`);
    }
  }
  for (const m of cmd.matchAll(RUNNERS)) {
    const name = pkgName(m[1]);
    if (name && !toolOk.has(name) && !npmOk.has(name)) deny(`"${name}" is not an approved tool for npx/dlx (approved-deps.json → tools.list).`);
  }

  // sed/awk/head/tail ranges on index.html larger than 400 lines.
  if (/index\.html/.test(cmd)) {
    const range = cmd.match(/sed\s+-n\s+['"]?(\d+),(\d+)p/);
    if (range && Number(range[2]) - Number(range[1]) > 400) deny('Read at most 400 lines of index.html at a time.');
    const ht = cmd.match(/\b(head|tail)\s+-n?\s*\+?(\d+)/);
    if (ht && Number(ht[2]) > 400) deny('Read at most 400 lines of index.html at a time.');
  }
  allowSilently();
});
