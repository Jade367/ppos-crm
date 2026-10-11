// Customer-facing code must be en-GB. GLM models occasionally leak Chinese text into English output
// ("language bleed"), so any CJK character outside the merchant zh-CN dictionary fails CI.
import { matchesAny, readText, report, walk } from './lib.mjs';

const SCAN = ['apps', 'packages', 'supabase/functions', 'supabase/migrations', 'supabase/seed.sql', 'e2e'];
const ALLOWED = ['apps/merchant/src/i18n/zh-CN.ts', 'apps/merchant/src/i18n/zh-CN.json'];
const TEXT_EXT = /\.(c|m)?(t|j)sx?$|\.json$|\.html$|\.css$|\.sql$|\.md$|\.webmanifest$/;
const CJK = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/;

const files = walk(SCAN.filter((d) => !d.endsWith('.sql')));
if (SCAN.includes('supabase/seed.sql')) files.push('supabase/seed.sql');

const problems = [];
for (const file of files) {
  if (!TEXT_EXT.test(file) || matchesAny(file, ALLOWED)) continue;
  let text;
  try {
    text = readText(file);
  } catch {
    continue;
  }
  text.split('\n').forEach((line, i) => {
    const m = line.match(CJK);
    if (m) problems.push(`${file}:${i + 1} contains CJK text ("${line.trim().slice(0, 60)}"). Customer-facing copy is en-GB only; merchant Chinese goes in apps/merchant/src/i18n/zh-CN.ts.`);
  });
}

const ok = report('cjk-lint', problems);
process.exitCode = ok ? 0 : 1;
