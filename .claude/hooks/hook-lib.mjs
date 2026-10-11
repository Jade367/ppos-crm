// Helpers for Claude Code hooks. Hooks enforce rules that instruction files (AGENTS.md) can only ask for.
// Contract (Claude Code docs, hooks): JSON on stdin; for PreToolUse print
// {"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}
// and exit 0 to block. Exit 0 with no output = no decision (normal permission rules apply).
import { readFileSync } from 'node:fs';

export async function readInput() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    return {};
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

export function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `[ppos guard] ${reason}` },
    }),
  );
  process.exit(0);
}

export function allowSilently() {
  process.exit(0);
}

export const overrideOn = (policy) => process.env[policy.overrideEnv] === '1';
export const legacyOn = (policy) => process.env[policy.legacyEnv] === '1';

/** Fail open on internal hook errors so a bug in a guard never bricks a session; CI is the backstop. */
export function guardMain(fn) {
  fn().catch((err) => {
    process.stderr.write(`[ppos guard] internal error (allowing): ${err?.stack ?? err}\n`);
    process.exit(0);
  });
}
