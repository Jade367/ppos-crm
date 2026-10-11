// Fails on code patterns that are known-wrong for this project (stale Stripe APIs, secrets,
// test focus/skip, type/lint suppression, impure core, browser-side secrets).
// Exceptions are human-approved entries in scripts/guards/allowlist.json — there is no inline suppression.
import { loadJson, matchesAny, readText, report, walk } from './lib.mjs';

const CODE_DIRS = ['apps', 'packages', 'supabase', 'e2e', 'scripts', 'docs', '.github'];
const CODE_EXT = /\.(c|m)?(t|j)sx?$|\.sql$|\.json$|\.html$|\.md$|\.ya?ml$|\.toml$/;
const TEST_FILE = /(\.test|\.spec)\.(t|j)sx?$|\.test\.sql$/;

/** @type {Array<{id:string, re:RegExp, include:string[], exclude?:string[], fileMustContain?:RegExp, onlyTests?:boolean, message:string}>} */
const RULES = [
  { id: 'stripe-payment-method-types', re: /\bpayment_method_types\b/, include: ['supabase/functions/**', 'apps/**', 'packages/**'], message: 'payment_method_types was removed from Checkout/PaymentIntent/SetupIntent create params in API 2026-09-30.endive. Configure payment methods in the Stripe Dashboard (Connect settings).' },
  { id: 'stripe-ui-mode-legacy', re: /ui_mode\s*:\s*['"`](hosted|embedded|custom)['"`]/, include: ['supabase/functions/**', 'apps/**', 'packages/**'], message: "Checkout ui_mode values were renamed: use 'hosted_page' (or 'embedded_page' / 'elements')." },
  { id: 'stripe-account-type', re: /\btype\s*:\s*['"`](standard|express|custom)['"`]/, include: ['supabase/functions/**'], fileMustContain: /accounts\.create/, message: "Do not create accounts with `type`. Use controller properties (see reference/stripe-endive.md)." },
  { id: 'stripe-no-new', re: /(?<!new\s+)(?<![\w.$])Stripe\(/, include: ['supabase/functions/**', 'packages/**', 'apps/**'], message: 'stripe-node >= 22 must be constructed with `new Stripe(key, {...})`.' },
  { id: 'stripe-sync-construct-event', re: /\.constructEvent\s*\(/, include: ['supabase/functions/**'], message: 'Use `await stripe.webhooks.constructEventAsync(rawBody, sig, secret)` in Deno (SubtleCrypto is async-only).' },
  { id: 'stripe-unpinned-import', re: /esm\.sh\/stripe|deno\.land\/x\/stripe|npm:stripe(?!@23\.0\.0\b)/, include: ['supabase/**'], message: 'Import Stripe only as npm:stripe@23.0.0 (pinned; see reference/versions.md).' },
  { id: 'stripe-api-version', re: /apiVersion\s*:\s*['"`](?!2026-09-30\.endive['"`])/, include: ['supabase/functions/**', 'packages/**', 'apps/**'], message: "Stripe apiVersion must be '2026-09-30.endive'." },
  { id: 'stripe-init-embedded', re: /\binitEmbeddedCheckout\b/, include: ['apps/**', 'packages/**'], message: 'initEmbeddedCheckout was renamed createEmbeddedCheckoutPage (and the MVP uses hosted Checkout anyway).' },
  { id: 'stripe-tolerance-zero', re: /constructEventAsync\([^)]*,\s*0\s*[,)]/, include: ['supabase/functions/**'], message: 'tolerance 0 disables the timestamp check in stripe-node 23. Omit the tolerance argument.' },
  { id: 'secret-literal', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}|\bwhsec_[A-Za-z0-9]{16,}|\bsb_secret_[A-Za-z0-9_-]{16,}/, include: ['**'], message: 'Secret key literal in source. Use environment variables / Supabase secrets.' },
  { id: 'service-role-in-browser', re: /service_role|SERVICE_ROLE|sb_secret_|STRIPE_SECRET_KEY/, include: ['apps/**'], message: 'Browser apps must never reference service-role / secret keys.' },
  { id: 'unsafe-html', re: /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|document\.write\(/, include: ['apps/**'], message: 'Raw HTML injection is banned (XSS). Render with React.' },
  { id: 'money-float', re: /\bparseFloat\(|\.toFixed\(/, include: ['packages/core/src/**', 'supabase/functions/**'], message: 'Money is integer pence. Use packages/core money helpers / formatPence.' },
  { id: 'core-impure', re: /\bnew Date\(\s*\)|\bDate\.now\(|\bMath\.random\(|\bfetch\(|\bDeno\.|\bprocess\.env/, include: ['packages/core/src/**'], message: 'packages/core must be pure: pass time/randomness/config in as arguments; no I/O.' },
  { id: 'test-focus-skip', re: /\b(?:it|test|describe|suite)\.(?:only|skip|todo|fails|skipIf|runIf)\b|\bx(?:it|test|describe)\s*\(|\bf(?:it|describe)\s*\(/, include: ['**'], onlyTests: true, message: 'Focused/skipped/todo tests are not allowed. Fix the code, or escalate in PROGRESS.md.' },
  { id: 'pgtap-skip', re: /\bskip\s*\(|\btodo\s*\(/, include: ['supabase/tests/**'], message: 'pgTAP skip()/todo() is not allowed.' },
  { id: 'ts-suppress', re: /@ts-ignore|@ts-nocheck|@ts-expect-error/, include: ['apps/**', 'packages/**', 'supabase/functions/**', 'e2e/**'], message: 'Type errors must be fixed, not suppressed (types are how we catch hallucinated APIs).' },
  { id: 'eslint-disable', re: /eslint-disable/, include: ['apps/**', 'packages/**', 'supabase/functions/**', 'e2e/**'], message: 'Do not disable lint rules. Fix the code or ask for an allowlist entry.' },
  { id: 'deno-ignore', re: /deno-lint-ignore|deno-fmt-ignore-file|@ts-nocheck/, include: ['supabase/functions/**'], message: 'Do not suppress Deno lint/type checks.' },
  { id: 'crm-boundary', re: /ucnbikkkgxiwsnbzbbgm/, include: ['apps/**', 'packages/**', 'supabase/**', 'e2e/**'], message: 'The platform must not reference the legacy CRM Supabase project (architecture §12).' },
];

const allow = (() => {
  try {
    return loadJson('scripts/guards/allowlist.json').entries ?? [];
  } catch {
    return [];
  }
})();

const problems = [];
const files = walk(CODE_DIRS).filter((f) => CODE_EXT.test(f) && !f.startsWith('scripts/guards/') && !f.endsWith('package-lock.json') && !f.endsWith('pnpm-lock.yaml'));

for (const file of files) {
  const applicable = RULES.filter((r) => matchesAny(file, r.include) && !(r.exclude && matchesAny(file, r.exclude)) && (!r.onlyTests || TEST_FILE.test(file)));
  if (applicable.length === 0) continue;
  const text = readText(file);
  const lines = text.split('\n');
  for (const rule of applicable) {
    if (rule.fileMustContain && !rule.fileMustContain.test(text)) continue;
    if (allow.some((a) => a.rule === rule.id && a.file === file)) continue;
    lines.forEach((line, i) => {
      if (rule.re.test(line)) problems.push(`${file}:${i + 1} [${rule.id}] ${rule.message}`);
    });
  }
}

const ok = report('banned-patterns', problems);
process.exitCode = ok ? 0 : 1;
