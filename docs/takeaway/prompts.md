# GLM-5.3 提示词库（复制即用）

> 给老板用。每段英文提示词直接复制进 Claude Code（已接 GLM-5.3），把 `<ID>`、`<slug>` 等尖括号换成实际值。
> 为什么提示词用英文：GLM 系列在英文指令下完成任务的比例更高（GLM-5 的一项研究里高 9.5 个百分点，【同族信号】【未核实】），而且代码、提交信息都要求英文。中文说明只给你看。
> 什么时候用哪一段、为什么这样做，详见 [`03-execution-handbook.md`](03-execution-handbook.md)。本文件是提示词的**唯一权威版本**，手册里的同名提示词如有出入，以本文件为准。

## 0. 速查：我现在该用哪一段？

| 情况 | 用 |
|---|---|
| 第一次开工（P0-01，仓库里还没有 `pnpm` 脚本） | 1 启动命令 + **2b** |
| 普通任务卡（standard，含有标准答案测试的 P0-02 / P1-01 / P1-02） | 1 + **2a** |
| 先出题后答题（tests-first）卡：P1-03、P1-04、P1-05、P1-11、P1-12、P1-14 | **3a**（会话 A）→ 可选 **3b**（审考题）→ 你冻结 → **3c**（会话 B） |
| 做两遍取好的（pass@2）：P1-12 的会话 B2（先按 3a 出题、你冻结、B1 用 3c + 2a 做完并合并之后） | **4a** + **3c** + **2a**（两个会话各一次）→ 可选 **4b**（比较） |
| 分两段会话的卡的第 2 段（卡片 Spec 里写了 Session 1 / Session 2 或 B1 / B2，例如 P0-04、P1-07、P1-10、P1-11 的 B2） | 1 + **8**（停下原因写 `planned two-session split; the first session is done`） |
| 审查卡：P0-B1、P1-19 | **5a**；合并两遍结果 → **5b** |
| 起草下一批任务卡 | **6** |
| 动 CRM 旧系统的卡（P0-B2 起） | 1 的 CRM 启动命令 + **7** |
| 上次没做完（额度、卡住、到点） | **8** |
| CI 红了 / 你审 PR 有意见 | **9a** / **9b** |
| 会话进行中要打断 | **10 ①–⑥** |
| 回答 GLM 写在 Blockers 里的问题 | **11**（附在开场提示词末尾） |
| 维护受保护文件（只有你决定时） | **12** |

---

## 1. 启动命令（在你的终端里）

```bash
cd ~/code/ppos-crm && git checkout main && git pull      # 换成你的仓库路径
claude --effort high      # 卡片表头写 Reasoning effort: max 时用 --effort max
```

动 CRM 旧系统的卡（卡片会写明，P0-B2 起）：

```bash
PPOS_ALLOW_LEGACY=1 claude --effort max
```

启动后先输入 `/status`，确认模型是 `glm-5.3`（不是 flash），再粘贴下面的提示词。

---

## 2a. 标准任务开场（最常用）

```text
You are executing exactly one task card in this repo: <ID>.
Card: the file matching docs/takeaway/tasks/<ID>-*.md

Follow AGENTS.md section 2 (session loop) in order:
1. Read the "## Current" and "## Blockers" context injected from docs/takeaway/PROGRESS.md, then read the card. Read only the files listed under "Read first"; find anything else with Grep and ranged Read.
2. Before writing code, write a 3-5 line restatement of the goal and the acceptance criteria into PROGRESS.md "## Current".
3. Create branch task/<ID>-<short-slug> from an up-to-date main (or continue it if it already exists).
4. If the card lists golden tests: run `pnpm acceptance:install <ID>`, run them, and confirm they fail for the expected reason before you implement anything.
5. Work in small steps. After each step that turns something green, run `pnpm verify:quick` and make a checkpoint commit: `feat(<scope>): <what> [<ID>]`.
6. Finish with `pnpm verify`. Paste its last 20 lines and the commit hash into PROGRESS.md "## Done log".
7. Push the branch, open a PR with .github/pull_request_template.md (paste the real `pnpm verify` output into Evidence), update the PROGRESS.md handoff, then stop. Do not start another task.

Rules that matter most here:
- Change only the paths in the card's Deliverables table. Anything else goes to PROGRESS.md "## Follow-ups".
- Never edit, skip or weaken a test. Never edit protected files. If a [ppos guard] hook blocks you, follow its message; do not try another route.
- Before writing any Stripe code, read docs/takeaway/reference/stripe-endive.md. For any other external API you are unsure about, read the official docs with the web-reader tool and record the URL. Do not rely on memory.
- Keep a hypothesis log in PROGRESS.md: [H] unconfirmed, [C] confirmed by <command/output>. After 3 failed attempts at the same failure, write a "## Blockers" entry and stop.
- "Done" needs pasted command output, not a statement.
- Write code, comments, commits and messages in English only. Keep your messages short; do not summarise files you have read.
```

## 2b. 第一次开工：P0-01（还没有 pnpm 脚本时）

先粘贴这一段，再接着粘贴 2a 的全部内容（把 `<ID>` 换成 `P0-01`）：

```text
Context for this first task: the pnpm workspace does not exist yet, so `pnpm verify:quick` and `pnpm verify` are not available until you create them in this task. Until then, use `node scripts/guards/run-all.mjs` as the quick check before each checkpoint commit. The root scripts you create must match docs/takeaway/reference/architecture.md section 13a exactly, because the hooks and CI call them by name.
```

---

## 3a. 先出题后答题 · 会话 A（只写考题，不写实现）

`claude --effort max`

```text
Task <ID> is tests-first. This is SESSION A: write acceptance-test PROPOSALS only. Do not write any implementation code.
Card: docs/takeaway/tasks/<ID>-*.md (read "Spec", "Acceptance" and "Read first").

1. Create branch task/<ID>-tests from an up-to-date main.
2. Write the proposed test files into docs/takeaway/acceptance-proposals/<ID>/, plus docs/takeaway/acceptance-proposals/<ID>/proposal.json in exactly this shape:
   {"command": "<command that runs them, e.g. pnpm --filter @ppos/core test>",
    "files": [{"file": "<name>.acceptance.test.ts", "dest": "<package path>/tests/acceptance/<name>.acceptance.test.ts"}]}
   Every dest must be inside a tests/acceptance/ directory. Import the code under test relative to the dest location (for packages/core: "../../src/index"), using the exact names and types in the card's Spec.
3. Cover every case listed in the card's Spec, plus boundaries and error cases. Each test name must read as a business rule. Expected values must be literals you wrote (integer pence, ISO times with UTC offsets), never values computed by the code under test. No mocks of the unit under test, no real clock (pass `now` in), no .skip/.only/.todo.
4. Dry-run the proposal with `pnpm acceptance:try <ID>` (or `node scripts/acceptance/try-proposal.mjs <ID>` if pnpm scripts are missing). The tests must FAIL only because the implementation is missing (missing export / not implemented) — never because of syntax errors, wrong import paths or test-runner setup. Fix the proposal until that is true. Paste the output into the PR description.
5. Write docs/takeaway/acceptance-proposals/<ID>/CASES.md: one row per test with the test name, the input in plain words, the expected result, and which Spec line it covers. List every Spec ambiguity as a question at the end.
6. Commit (`test(<ID>): propose acceptance tests`), push, open a PR titled "<ID> acceptance proposals (for human review)", update PROGRESS.md, and stop. A human will review and freeze these tests.
```

## 3b. （可选）请一个新会话帮你审考题

```text
Review the proposed acceptance tests in docs/takeaway/acceptance-proposals/<ID>/ against the card docs/takeaway/tasks/<ID>-*.md and docs/takeaway/reference/architecture.md. Do not edit any file except docs/takeaway/reviews/<ID>-proposal-review.md, and do not commit.
Report: (1) Spec cases with no test; (2) tests whose expected value you believe is wrong, with your own step-by-step calculation; (3) tests that are tautological, mock the unit under test, depend on the real clock, or would pass with a trivial implementation; (4) ambiguous Spec lines. Cite test names. Then stop.
```

**你冻结考题（在你自己的终端，GLM 不能做）：**

```bash
git fetch origin && git checkout task/<ID>-tests && git pull
node scripts/acceptance/freeze.mjs <ID>
git add docs/takeaway && git commit -m "test(<ID>): freeze acceptance tests" && git push
```

然后在这个 PR 上加标签 `protected-change-approved`（CI 会自动重跑），绿了就合并。

## 3c. 先出题后答题 · 会话 B（按冻结的考题实现）

`claude --effort max`。先粘贴这一段，再粘贴 2a 的全部内容：

```text
Task <ID> is tests-first. This is SESSION B: the human has frozen the acceptance tests (docs/takeaway/acceptance/<ID>/, listed in docs/takeaway/acceptance/manifest.json). Implement the card so they pass.
Before writing any implementation code, run `pnpm acceptance:install <ID>`, run the installed tests and confirm they fail only because the implementation is missing (paste the failing line into PROGRESS.md), unless the card's Session steps say this session must not install them (P1-12 session B1). Never edit the installed copies; commit them unchanged together with your implementation.
The frozen tests are the contract. If a test looks wrong, do not change it or work around it: write the test name, expected vs actual, and your reasoning under PROGRESS.md "## Blockers", then stop.
```

---

## 4a. 做两遍取好的（pass@2）

先在你的终端建两个互不干扰的工作目录：

```bash
git checkout main && git pull
git worktree add ../ppos-<ID>-a -b task/<ID>-a
git worktree add ../ppos-<ID>-b -b task/<ID>-b
(cd ../ppos-<ID>-a && pnpm install) && (cd ../ppos-<ID>-b && pnpm install)
```

**先后跑，不要同时跑**（同时跑额度翻倍，本地数据库端口也会冲突）。`.env.local` 被 git 忽略，不会出现在新工作目录里，先复制过去：`cp .env.local ../ppos-<ID>-a/ && cp .env.local ../ppos-<ID>-b/`。在每个目录里 `claude --effort max`，先粘贴这一段；卡片是 tests-first 时（P1-12 就是）接着粘贴 3c；最后粘贴 2a（把其中第 3 步理解为"留在当前分支"）：

```text
Task <ID>, attempt <A|B> of an independent pass@2 run. You are in a dedicated git worktree that is already on branch task/<ID>-<a|b>. Do not create or switch branches, and do not read any other worktree or branch.
When you open the PR, open it as a draft titled "<ID> attempt <A|B>".
```

## 4b. （可选）比较两份结果

```text
Two independent attempts at task <ID> exist on branches task/<ID>-a and task/<ID>-b. Do not modify either branch.
Compare them against the card and the golden tests using `git diff main...task/<ID>-a` and `git diff main...task/<ID>-b`: correctness risks, idempotency, error handling (no swallowed errors), scope (Deliverables only), test integrity, and simplicity.
Write the comparison to docs/takeaway/reviews/<ID>-pass2-compare.md with a recommendation and the top 3 concerns for each attempt. Do not commit. Then stop.
```

选胜者的顺序：CI 全绿 → 没有护栏警告和新依赖 → 改动更小、只动了卡片列出的文件 → 审查清单红旗更少。

---

## 5a. 审查卡（P0-B1 跑一次；P1-19 在两个全新会话里各跑一次，run a / run b，互不看结果）

P0-B1 只跑一次：`<a|b>` 填 `a`（分支就是 `task/P0-B1-review-a`）。

`claude --effort max`

```text
Task <ID> is a REVIEW task, run <a|b>. Find problems; do not fix them.
Card: docs/takeaway/tasks/<ID>-*.md. All code is read-only for you. The only files you may create or edit are the review file(s) named in the card's Deliverables (for P1-19: docs/takeaway/reviews/P1-19-security-run-<a|b>.md), PROGRESS.md, and docs/takeaway/tasks/proposed/ if the card asks for proposed cards.
Method: work through the card's scope systematically with Grep and ranged Read (at most 400 lines per read). Static analysis and local tests only: never run an exploit against any remote system, never read .env files, never print secrets, never open import_*.sql (real business data).
For each finding give: an ID, severity (Critical/High/Medium/Low), file:line, the exploit scenario in 2-4 steps (who sends what request and what they gain), the code quoted as evidence, a fix suggestion, and your confidence. Also list what you checked and found fine, and what you could not check.
Create branch task/<ID>-review-<a|b> from main, commit only those files, push, open a PR, then stop.
```

## 5b. 合并两遍审查 → 起草修复卡

```text
Planning session at max effort. Do not change any code.
Inputs: docs/takeaway/reviews/<ID>-security-run-a.md and docs/takeaway/reviews/<ID>-security-run-b.md.
1. Merge the findings into one deduplicated table in docs/takeaway/reviews/<ID>-merged.md: finding, severity, file:line, found by (a / b / both), confidence.
2. For every Critical or High finding, and every finding listed here as "fix": <IDs>, draft a fix card at docs/takeaway/tasks/proposed/<ID>-F<n>-<slug>.md that follows docs/takeaway/tasks/TEMPLATE.md exactly. The first Acceptance item of each card must be a test that fails before the fix and passes after it.
3. Create branch task/<ID>-fix-planning from main, commit only those files, push, open a PR, then stop.
```

---

## 6. 规划会话：起草下一批任务卡

`claude --effort max`

```text
Planning session at max effort. Do not change any code.
Goal: draft the next task cards for <phase or topic, e.g. "P2 SaaS billing epic in docs/takeaway/tasks/BACKLOG.md">.
Read: docs/takeaway/reference/architecture.md, docs/takeaway/tasks/TEMPLATE.md, docs/takeaway/tasks/BACKLOG.md, docs/takeaway/PROGRESS.md (Follow-ups, Blockers, Done log), and <other inputs>.
Write each draft to docs/takeaway/tasks/proposed/<ID>-<slug>.md following TEMPLATE.md exactly: every table field filled; Deliverables as concrete paths; Acceptance as executable commands with expected results; "Out of scope" and "Stop and escalate if" non-empty. Each card must fit one session (about 3 hours, about 15 files or fewer). If the Deliverables exceed about 15 files, split the card, or describe Session 1 / Session 2 inside it (each ending in a green checkpoint commit and a PROGRESS.md handoff; one branch, one PR), as P1-07 does. Set Mode to one of standard / tests-first / pass@2 / review / spike (→ ADR) / human, following BACKLOG.md rule 8. Tests-first cards must tell session A to dry-run the proposal with `pnpm acceptance:try <ID>` and paste the output; check installed golden tests with `node scripts/guards/run-all.mjs`, never with `git diff --exit-code main -- <path>/tests/acceptance`. Set Reasoning effort per docs/takeaway/03-execution-handbook.md H.1: max for money, Stripe, RLS/security design, time logic, spikes and reviews; high otherwise. Model is always glm-5.3, never Flash for money, auth, RLS, Stripe, migrations, webhooks or printing protocols.
If a card needs a new dependency, a change to architecture.md, or a legal/pricing decision, say so in "Open questions for the human" instead of assuming it.
Create branch task/PLAN-<yyyymmdd> from main, commit only files under docs/takeaway/tasks/proposed/, push, open a PR, then stop.
```

你批准：在编辑器里把卡改到满意 → `git mv docs/takeaway/tasks/proposed/<file> docs/takeaway/tasks/<file>` → 提交推送 → PR 加标签 `protected-change-approved` → 合并。

---

## 7. CRM 旧系统任务（P0-B2 起，用 `PPOS_ALLOW_LEGACY=1` 启动）

先粘贴这一段，再粘贴 2a：

```text
This task changes the legacy CRM (index.html and root SQL files), which holds live business data. Extra rules for this session:
- index.html is about 220K tokens. Locate code with `grep -n`, read at most 400 lines at a time, and change it only with small Edit calls. Never rewrite the file and never reformat unrelated code.
- Keep the bilingual UI string pattern ("中文 English") exactly as it is in the surrounding code; this rule overrides the English-only rule for index.html only.
- Never open import_*.sql (real business data). Never run SQL against any remote database; write migration files and step-by-step instructions for the human instead.
- There are no automated tests for the CRM. For every change, write a short manual test script (steps + expected result) into the PR description so the human can verify it in the browser.
```

---

## 8. 续跑（额度用完、卡住、到点后，开新会话）

分两段会话的卡（决定 C20）的第 2 段也用这一段：停下原因写 `planned two-session split; the first session is done`，GLM 会从 `PROGRESS.md` 里第 1 段写下的 "next: Session 2 …" 接着做。

```text
Resume task <ID> (card: docs/takeaway/tasks/<ID>-*.md) on branch task/<ID>-<slug>.
The previous session stopped early because: <quota / stall / time box>.
1. Check out the branch. Read PROGRESS.md "## Current" (injected above), `git log --oneline -10` and `git status`.
2. Uncommitted changes may be incomplete. Run `pnpm verify:quick` first and report the result.
3. Re-read the card's Acceptance and Definition of Done, then continue from "Next step" in PROGRESS.md.
Same rules as before: AGENTS.md, Deliverables only, checkpoint commits, 3-strike rule, stop after the PR.
```

---

## 9a. CI 失败

```text
CI failed on PR #<n> for task <ID> (branch task/<ID>-<slug>). Failing job: <job name>. Log tail:
<paste the last 40-80 lines from `gh run view <run-id> --log-failed`>
Check out the branch, reproduce the failure locally with the same command CI runs, find the root cause and fix the code. Do not edit, skip or weaken tests or CI config. Paste the before/after output into PROGRESS.md and the PR, commit, push, and stop.
```

## 9b. 你审 PR 后的修改意见

```text
Review feedback on PR #<n> for task <ID> (branch task/<ID>-<slug>). Check out that branch and address each point, then re-run `pnpm verify`, paste the output into the PR and PROGRESS.md, push, and stop.
Points:
1. <one concrete problem per line>
Do not change tests to resolve any point.
```

---

## 10. 会话进行中的打断指令（先按 Esc，再粘贴）

**① 原地打转（同一个错误反复出现）**

```text
Stop. You have tried the same fix several times. Do not change code now.
Write in PROGRESS.md "## Current": the exact error, each attempt so far, what is confirmed [C] (with command output) and what is only a hypothesis [H].
Then propose the single cheapest experiment that would confirm or kill your main hypothesis, run only that, and report the output.
If this is already the third failed attempt at this failure, write a "## Blockers" entry with a question for the human and stop.
```

**② 范围蔓延（改了卡片以外的文件）**

```text
Stop. <file or feature> is outside this card's Deliverables. Undo those changes (git restore <file> for uncommitted files, a new revert commit for committed ones; no destructive git), note the idea under PROGRESS.md "## Follow-ups", and continue with the card.
```

**③ 想改测试 / 想绕过护栏**

```text
The tests are the specification and the guard block is intentional. Do not change, skip or weaken tests, and do not try another route around the hook.
If you believe a test is wrong, write under PROGRESS.md "## Blockers": the test name, expected vs actual value, and why you think it contradicts the card or docs/takeaway/reference/architecture.md. Then stop.
```

**④ 说"完成了"但没有证据**

```text
Paste the exact command you ran and the last 20 lines of its output. A statement that it passes is not evidence.
```

**⑤ 顾客页面或代码里出现中文**

```text
Customer-facing text must be en-GB. Replace the CJK text with English (customer copy belongs in apps/storefront/src/i18n/en-GB.ts; merchant Chinese belongs only in apps/merchant/src/i18n/zh-CN.ts). Run `node scripts/guards/cjk-lint.mjs` and paste the output.
```

**⑥ 到点收工 / 额度快用完**

```text
Stop starting new changes now (time box / quota). Do only this:
1. Run `pnpm verify:quick`. If it passes, make a checkpoint commit. If it fails, do not commit and do not try to fix it now; leave the changes uncommitted.
2. Update PROGRESS.md "## Current": what is done (with evidence), the exact next step, open [H] hypotheses, and whether uncommitted changes exist.
3. Stop. Do not push unless the Definition of Done is met.
```

**其他常用一句话**

| 情况 | 粘贴 |
|---|---|
| 大文件写不出来 / 被截断 | `Make this change with several small Edit calls, one function at a time. If the file is over 300 lines, propose a split first.` |
| 写 Stripe 代码报未知参数 | `Read docs/takeaway/reference/stripe-endive.md and the official Stripe docs page for this call with the web-reader tool, record the URL in PROGRESS.md, then fix.` |
| 自动压缩后忘了卡片 | `Re-read the card and PROGRESS.md "## Current" before continuing.` |

---

## 11. 回答 Blockers（附在开场提示词末尾）

```text
Human decisions on open items in PROGRESS.md (record them under the matching entries, then continue):
- <Blocker title>: <your decision in one or two plain English sentences>
```

---

## 12. 维护受保护文件（只在你决定改护栏时）

```bash
PPOS_GUARD_OVERRIDE=1 claude --effort max
```

```text
Maintenance session approved by the human. Change only <file(s)> to <exact change>. Do not touch any other file. Show me the full diff (`git diff`) and stop; do not commit.
```

你自己看 `git diff`，提交、推送、开 PR、加标签 `protected-change-approved`、合并。

---

## 13. 无人值守模式（熟悉之后，常规卡用；钱 / Stripe / 权限相关的卡仍建议有人值守）

```bash
mkdir -p ~/glm-logs
cd ~/code/ppos-crm && git checkout main && git pull
# 把 2a（已替换 <ID>）保存为 ~/glm-logs/kickoff-<ID>.txt
timeout -s INT -k 60 5400 claude -p "$(cat ~/glm-logs/kickoff-<ID>.txt)" \
  --max-turns 80 --effort high \
  --permission-mode acceptEdits \
  --allowedTools "Bash(pnpm *),Bash(git *),Bash(node *),Bash(supabase *),Bash(deno *),Bash(gh pr create *),Bash(ls *),Bash(rg *),Bash(grep *),mcp__web-reader,mcp__web-search-prime,mcp__zread" \
  > ~/glm-logs/<ID>-$(date +%Y%m%d-%H%M).log 2>&1
```

macOS 先 `brew install coreutils`，用 `gtimeout -s INT -k 60 5400`（90 分钟后先发 INT 让它收尾，60 秒后仍未退出就强制结束）。卡片写 `Reasoning effort: max` 时把 `--effort high` 换成 `--effort max`。如果你的 Claude Code 不认 `--max-turns`（P0-00 步骤 B7 记录过），删掉这个参数，`timeout` 仍然是硬上限。MCP 工具名以 `claude mcp list` 显示的为准（不放行的话，GLM 无人值守时读不了官方文档）。跑完先运行 `gh pr view <PR号> --json labels`，结果必须是 `"labels":[]`；带着 `protected-change-approved` 就按 03 手册 G 节第 16 条退回。永远不要用 `--dangerously-skip-permissions`。护栏 hook 在这个模式下照样生效。
