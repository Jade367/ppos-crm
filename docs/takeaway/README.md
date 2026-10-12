# docs/takeaway 导航（从这里开始）

> 读者：老板（你）。写于 2026-10-11。
> 这一页只做导航：每份文件是干什么的、按什么顺序读、哪些东西被锁住以及为什么、护栏有哪些、P0–P1 任务清单、第一天怎么开始。
> 技术细节以 [`reference/architecture.md`](reference/architecture.md) 为准。任何中文文档和它冲突时，以它为准。

---

## 1. 阅读顺序

| 谁 | 读什么 | 为什么 |
|---|---|---|
| **你（第一次）** | ① [`01-upgrade-plan.md`](01-upgrade-plan.md) → ② [`03-execution-handbook.md`](03-execution-handbook.md) → ③ [`02-tech-roadmap.md`](02-tech-roadmap.md) | 先弄清做什么、为什么、什么时候（01）；再学会每天怎么指挥 GLM（03）；技术细节最后看，需要时再查（02） |
| **你（每天）** | [`PROGRESS.md`](PROGRESS.md)（先看 `## Blockers`）、[`prompts.md`](prompts.md)（复制英文提示词） | PROGRESS 是会话之间的共享记忆；提示词以 prompts.md 为准 |
| **GLM-5.3** | 只读 [`AGENTS.md`](../../AGENTS.md)（Claude Code 通过 [`CLAUDE.md`](../../CLAUDE.md) 自动加载）+ 当前这张任务卡 + 卡片 "Read first" 里列出的 `reference/` 文件 | 英文指令效果更好（GLM-5 研究里英文比中文高 9.5 个百分点，【同族信号】【未核实】）；上下文越短，质量越稳。01/02/03 是给人看的中文文件，除非卡片明确列出，GLM 不读 |

---

## 2. 每份文件是干什么的

| 文件 | 读者 / 语言 | 用途 | GLM 能改吗 |
|---|---|---|---|
| `README.md`（本页） | 你 / 中文 | 导航 | 否 |
| [`01-upgrade-plan.md`](01-upgrade-plan.md) | 你 / 中文 | 商业模式定稿（£149 开通费 + £39/月 + 每单 45p 服务费）、新发现（费用必须提前显示、CRM 数据库敞开等）、P0–P5 阶段和 KPI 门槛、风险、只有你能做的决定 | 否 |
| [`02-tech-roadmap.md`](02-tech-roadmap.md) | 你 / 中文 | 技术路线：架构图、选型理由、支付流程、订单状态机、安全模型、CI、测试策略、成本估算、CRM 加固方案 | 否 |
| [`03-execution-handbook.md`](03-execution-handbook.md) | 你 / 中文（给 GLM 的指令是英文） | GLM-5.3 执行手册：环境配置、每张卡的标准流程、tests-first / pass@2 / 审查三种协议、PR 审查清单、额度和节奏、故障处理 | 否 |
| [`prompts.md`](prompts.md) | 你 / 中文说明 + 英文提示词 | 提示词库，复制即用 | 否 |
| [`PROGRESS.md`](PROGRESS.md) | 共用 / 英文为主 | 共享记忆：Current、Blockers、Follow-ups、Proposed doc changes、Dependency requests、Done log | **能**（必须更新） |
| [`reference/architecture.md`](reference/architecture.md) | GLM + 审查人 / 英文 | 权威技术规格（FROZEN）。要改，先写 ADR，由你批准 | 否 |
| [`reference/stripe-endive.md`](reference/stripe-endive.md) | GLM / 英文 | Stripe API `2026-09-30.endive` + `stripe@23.0.0` 的已核实写法。写任何 Stripe 代码之前必读 | 否 |
| [`reference/uk-compliance.md`](reference/uk-compliance.md) | GLM / 英文 | 英国法规对产品行为的要求（规则编号 `UKC-*`）、P1-20 上线清单、律师和会计问题清单 | 否 |
| [`reference/glm-5.3-facts.md`](reference/glm-5.3-facts.md) | 你 / 中文 | GLM-5.3 事实档案（规格、价格、基准、弱点），带核实标记 | 否 |
| [`reference/versions.md`](reference/versions.md) | GLM / 英文 | 锁定的版本号，任务做到哪里补到哪里 | **能** |
| [`reference/approved-deps.json`](reference/approved-deps.json) | 机器 + GLM | 允许安装的依赖白名单。加新包只能由你来改 | 否 |
| `reference/environments.md` | 你 / 英文 | P0-00 由你创建：非机密的环境信息（DEV 项目 ref、网址、账号档位、CRM 止血记录）。永远不写密钥，不写 PROD 标识 | 否 |
| [`tasks/TEMPLATE.md`](tasks/TEMPLATE.md) | 规划会话 | 任务卡模板 | 否 |
| `tasks/<ID>-<slug>.md` | GLM / 英文 | 一张卡 = 一次会话（清单见第 6 节） | 否 |
| [`tasks/BACKLOG.md`](tasks/BACKLOG.md) | 规划会话 / 英文 | P2–P5 的大块需求（epic），还不是任务卡 | 否 |
| `tasks/proposed/` | 规划 / 审查会话写 | 草稿卡。你批准后移到 `tasks/` | **能** |
| [`acceptance/`](acceptance/manifest.json) | 机器 | 黄金验收测试源文件 + `manifest.json` | 否 |
| `acceptance-proposals/<ID>/` | tests-first 会话 A 写 | 测试提案（`proposal.json` + 测试文件），你审核后冻结 | **能** |
| `adr/` | GLM + 你 | 架构决定记录。ADR-0001 迁移流程（P0-02 写），ADR-0002 core 共享方式（P0-03 写）。改动冻结规格的 ADR 必须你批准 | **能** |
| `reviews/` | 审查会话写 | `P0-B1-crm-security.md`、`P1-19-security-run-a.md` / `-run-b.md`、`P1-20-go-live-runbook.md` | **能** |

---

## 3. 目录地图

```text
docs/takeaway/
├── README.md                    本页
├── 01-upgrade-plan.md           老板先读
├── 02-tech-roadmap.md
├── 03-execution-handbook.md
├── prompts.md
├── PROGRESS.md                  GLM 可写
├── reference/
│   ├── architecture.md          权威规格（FROZEN）
│   ├── stripe-endive.md
│   ├── uk-compliance.md
│   ├── glm-5.3-facts.md
│   ├── versions.md              GLM 可写
│   ├── approved-deps.json
│   └── environments.md          P0-00 由你创建
├── tasks/
│   ├── TEMPLATE.md
│   ├── BACKLOG.md               P2–P5 epic
│   ├── P0-00-human-setup.md … P1-20-pilot-go-live.md
│   └── proposed/                GLM 可写（草稿卡）
├── acceptance/                  黄金测试（受保护）
│   ├── manifest.json
│   ├── P0-02/rls_enabled.test.sql
│   ├── P1-01/pricing.acceptance.test.ts
│   └── P1-02/order-state.acceptance.test.ts
├── acceptance-proposals/        GLM 可写（tests-first 会话 A）
├── adr/                         GLM 可写
└── reviews/                     GLM 可写
```

仓库根目录里和本项目有关的还有：`AGENTS.md`、`CLAUDE.md`、`.claude/`（hooks 和项目设置）、`.github/`（CI 和 PR 模板）、`scripts/guards/`、`scripts/acceptance/`。代码将放在 `apps/`、`packages/`、`supabase/`、`e2e/`（P0-01 起创建）。

---

## 4. 哪些东西被锁住，为什么

路径规则只有一个来源：[`scripts/guards/policy.json`](../../scripts/guards/policy.json)。在你电脑上由 hook 逐次拦截，在 GitHub 上由 CI 的 `protected-paths.mjs` 再查一遍。

| 类别 | 路径 | 规则 | 为什么 |
|---|---|---|---|
| 受保护 | `AGENTS.md`、`CLAUDE.md`、`.npmrc`、`.claude/**`、`.github/**`、`scripts/guards/**`、`scripts/acceptance/**`、`docs/takeaway/**`、`**/tests/acceptance/**` | GLM 不能改。PR 里出现这类改动，CI 会失败，除非你给 PR 加标签 `protected-change-approved` | 规则、考题、计划都是你的决定。GLM 同系列有"改测试、改规则来让自己通过"的记录（GLM-5.2 实测 57–73%；5.3 无法核实），所以执行者不能改裁判 |
| 例外（GLM 可写） | `PROGRESS.md`、`reference/versions.md`、`acceptance-proposals/**`、`adr/**`、`tasks/proposed/**`、`reviews/**` | 可写 | 交接、记版本、写提案、写审查报告都需要它来写；这些只是"提议"，要你批准才生效 |
| 旧 CRM | `index.html`、`3d-packaging.html`、`supabase_schema.sql`、`migration_*.sql`、`import_*.sql` | 只读。只有你用 `PPOS_ALLOW_LEGACY=1` 启动会话才能改，且只能小步 `Edit` | 线上业务数据；`index.html` 约 22 万 token，超过 GLM 128K 的输出上限，整体重写必然被截断 |
| 只追加 | `supabase/migrations/**` | 已合入 main 的迁移不能改，只能新建 | 改历史迁移会让生产数据库和代码对不上 |
| 分段读取 | `index.html` | 每次 Read 不超过 400 行 | 防止整个文件塞满上下文 |
| 密钥文件 | `.env`、`.env.*`、`**/.env*`、`supabase/.temp/**`（`.env.example` 除外） | GLM 不能读 | GLM 读到的一切都会发给模型服务商（Z.ai，新加坡主体） |

**你自己要改受保护文件时：** 直接自己编辑，或者用 `PPOS_GUARD_OVERRIDE=1 claude` 启动一个维护会话（[`prompts.md`](prompts.md) §12）。然后建分支、开 PR、加标签 `protected-change-approved`（CI 会自动重跑），全绿后合并。这两个环境变量和这个标签**只有你能用**；GLM 加标签、合并 PR 都会被 `pre-bash` hook 拦截。本页和 `tasks/BACKLOG.md` 也在 `docs/takeaway/` 下，同样受保护。

---

## 5. 护栏清单

### 5.1 Claude Code hooks（GLM 每次调用工具时，在你电脑上运行）

由项目设置 `.claude/settings.json` 挂接（SessionStart：startup / resume / clear / compact；PreToolUse：`Edit|Write|MultiEdit|NotebookEdit`、`Read`、`Bash`；Stop）。这个设置文件同时设置 `CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000`（上下文到 20 万就压缩）、`CLAUDE_CODE_ATTRIBUTION_HEADER=0`，并用 `permissions.deny` 禁止 `Read(.env)`、`Read(.env.*)` 和强推（`git push --force` / `-f` / `--force-with-lease`）。如果仓库里没有它，先停下（P0-00 步骤 B4）。

| 文件 | 一句话 |
|---|---|
| [`.claude/hooks/pre-edit.mjs`](../../.claude/hooks/pre-edit.mjs) | Edit / Write / MultiEdit / NotebookEdit 之前：拦受保护文件、旧 CRM、已合并的迁移，以及对 `index.html` 整体 Write |
| [`.claude/hooks/pre-read.mjs`](../../.claude/hooks/pre-read.mjs) | Read 之前：拦密钥文件；读 `index.html` 必须带 `limit` ≤ 400 |
| [`.claude/hooks/pre-bash.mjs`](../../.claude/hooks/pre-bash.mjs) | shell 命令之前：拦强推、推 main、破坏性 git、`--no-verify`、递归删除根目录 / 家目录 / 仓库目录、`supabase login` / `logout` / `link` / `secrets set\|unset` / `db reset --linked` / `projects delete`、任何带 `--project-ref` 或 `--db-url` 的 supabase 命令、打印环境变量和密钥、读 `.env`、运行 `freeze.mjs`、`gh` 合并 / 加标签 / 批准、`curl … \| sh`、`cat index.html` 和一次超过 400 行的 sed / head / tail、用 shell 改受保护文件、安装未批准的包或用 npx / dlx 运行未批准的工具 |
| [`.claude/hooks/stop-verify.mjs`](../../.claude/hooks/stop-verify.mjs) | GLM 想结束时：如果代码目录有未提交改动，就跑 `pnpm verify:quick`（P0-01 之前跑 guards），失败就挡一次，并把错误贴回给它 |
| [`.claude/hooks/session-start.mjs`](../../.claude/hooks/session-start.mjs) | 会话开始、恢复、`/clear`、压缩之后：注入当前分支、最近 5 次提交、未提交文件、`PROGRESS.md` 的 Current 和 Blockers、6 条提醒 |
| [`.claude/hooks/hook-lib.mjs`](../../.claude/hooks/hook-lib.mjs) | 公共函数。hook 自身出错时会放行（故意的，避免一个 bug 卡死所有会话），由 CI 兜底 |

hook 只在 Claude Code 里起作用。换用其他工具时，只剩 CI 这道防线。

### 5.2 Guards（`scripts/guards/`，Node 脚本，没有依赖）

| 文件 | 一句话 |
|---|---|
| [`run-all.mjs`](../../scripts/guards/run-all.mjs) | 一次跑完下面四个（`pnpm guards`、Stop hook、CI 都用它）；加 `--with-protected-paths` 再跑第五个 |
| [`banned-patterns.mjs`](../../scripts/guards/banned-patterns.mjs) | 禁止已知的错误写法：过时的 Stripe 写法、`stripeAccount:` / `stripeContext:` 只能出现在 `supabase/functions/_shared/stripe.ts`（测试文件除外）、密钥明文、浏览器代码里出现服务端密钥、`innerHTML`、core 和函数里的浮点金额、core 里的时钟 / 随机数 / 网络调用、`.skip` / `.only`、pgTAP `skip()` / `todo()`、`@ts-ignore`、`eslint-disable`、引用 CRM 数据库 |
| [`cjk-lint.mjs`](../../scripts/guards/cjk-lint.mjs) | 顾客端、core、函数、迁移、e2e 里不能出现中日韩字符；只放行 `apps/merchant/src/i18n/zh-CN.ts` |
| [`acceptance-integrity.mjs`](../../scripts/guards/acceptance-integrity.mjs) | 已安装的黄金测试必须和源文件逐字节一致；`tests/acceptance/` 下不能有 manifest 以外的文件 |
| [`deps-allowlist.mjs`](../../scripts/guards/deps-allowlist.mjs) | 每个依赖必须在 `approved-deps.json` 里，并且是精确版本 |
| [`protected-paths.mjs`](../../scripts/guards/protected-paths.mjs) | PR 改了受保护文件、旧 CRM 或已合并的迁移，又没有你的标签 → 失败 |
| [`policy.json`](../../scripts/guards/policy.json) | 路径规则的唯一来源（第 4 节） |
| [`allowlist.json`](../../scripts/guards/allowlist.json) | `banned-patterns` 的人工例外（目前为空；代码里不允许写"忽略本行"） |

### 5.3 验收脚本（`scripts/acceptance/`）

| 文件 | 一句话 |
|---|---|
| [`install.mjs`](../../scripts/acceptance/install.mjs) | `pnpm acceptance:install <ID>`：把黄金测试原样复制到代码目录 |
| [`try-proposal.mjs`](../../scripts/acceptance/try-proposal.mjs) | `pnpm acceptance:try <ID>`：tests-first 会话 A 试跑测试提案，跑完删除副本 |
| [`freeze.mjs`](../../scripts/acceptance/freeze.mjs) | **只有你能跑**：`node scripts/acceptance/freeze.mjs <ID>`，把审核过的提案变成黄金测试并更新 manifest |

### 5.4 CI（[`.github/workflows/takeaway-ci.yml`](../../.github/workflows/takeaway-ci.yml)，每个 PR、每次推 main 都跑；对应代码还不存在时自动跳过）

| Job | 一句话 |
|---|---|
| `guards` | 跑全部 guards；PR 上另跑 `protected-paths`（需要你的标签才能通过） |
| `node` | `pnpm typecheck`、`pnpm lint`、`pnpm test`（含已安装的黄金测试） |
| `deno` | 对 `supabase/functions` 跑 `deno check` 和 `deno test` |
| `db` | `supabase start`、`supabase test db`（pgTAP）、`supabase db lint --level error` |
| `e2e` | Playwright，按角色、标签、文字断言 |

另外两道：GitHub 上 main 分支保护，要求这 5 个 job 全部通过才能合并（P0-00 步骤 C 由你设置）；PR 模板 [`.github/pull_request_template.md`](../../.github/pull_request_template.md) 要求贴出真实的 `pnpm verify` 输出。

### 5.5 黄金测试（规划者已写好，并做过变异测试）

| 任务 | 源文件 | 安装到 | 运行 |
|---|---|---|---|
| P0-02 | [`acceptance/P0-02/rls_enabled.test.sql`](acceptance/P0-02/rls_enabled.test.sql) | `supabase/tests/acceptance/` | `supabase test db` |
| P1-01 | [`acceptance/P1-01/pricing.acceptance.test.ts`](acceptance/P1-01/pricing.acceptance.test.ts) | `packages/core/tests/acceptance/` | `pnpm --filter @ppos/core test` |
| P1-02 | [`acceptance/P1-02/order-state.acceptance.test.ts`](acceptance/P1-02/order-state.acceptance.test.ts) | `packages/core/tests/acceptance/` | `pnpm --filter @ppos/core test` |

P1-01 和 P1-02 合计 66 个用例，已用参考实现全部跑通。tests-first 卡的测试，在你冻结之后也会加到这里（`manifest.json` 由 `freeze.mjs` 更新）。

---

## 6. 任务清单（P0–P1）

**模式说明：**

| 模式 | 意思 | 详见 |
|---|---|---|
| standard | 一次会话按卡做完 | 03 §E，prompts §2a |
| golden | 卡里带已写好的黄金测试，GLM 先安装、再实现 | 03 §E |
| tests-first | 会话 A 只写测试提案 → 你审核并运行 `freeze.mjs` → 会话 B 在测试锁定的情况下实现 | 03 §F.1，prompts §3a–3c |
| pass@2 | 两个互不相干的会话在不同 worktree / 分支各做一遍，留下通过测试、diff 更小更干净的那份 | 03 §F.2，prompts §4a（P1-12 的会话 B2 是 tests-first + pass@2：两个会话各自依次粘贴 4a、3c、2a） |
| review | 只读审查，只写 `reviews/` 和 `tasks/proposed/`，不改代码 | 03 §F.3，prompts §5a |
| spike | 技术试验，结论连同证据写成 ADR | 卡片 |
| human | 你来做 | 卡片 |

"强度"是启动参数：`claude --effort high` 或 `claude --effort max`。

**分两段会话的卡（决定 C20）：** P0-04、P1-06、P1-07、P1-08、P1-09、P1-10、P1-13、P1-15、P1-16、P1-17 在同一个分支上分 Session 1 / Session 2 两次会话做；P1-11、P1-14 的会话 B 分 B1 / B2 两次；P1-12 的会话 B1 是一次普通会话（自己一个 PR），会话 B2 用 pass@2。每段结束都有一次绿的检查点提交和 `PROGRESS.md` 交接；第 2 段用 prompts §8（续跑）开场（P1-12 的 B2 除外，它用 §4a）。具体怎么分，看卡片 Spec 里的 Sessions / Session steps。

| ID | 标题 | 依赖 | 模式 | 强度 | 卡片 |
|---|---|---|---|---|---|
| P0-00 | Human setup: accounts, environments, Claude Code + GLM config | — | human | — | [P0-00-human-setup.md](tasks/P0-00-human-setup.md) |
| P0-01 | Monorepo scaffold & workspace scripts | P0-00 | standard | high | [P0-01-monorepo-scaffold.md](tasks/P0-01-monorepo-scaffold.md) |
| P0-02 | Supabase local project, migration conventions & pgTAP harness | P0-01 | standard (golden test P0-02) | high | [P0-02-supabase-local.md](tasks/P0-02-supabase-local.md) |
| P0-03 | Spike: share packages/core with Deno edge functions + `_shared` skeleton | P0-01, P0-02 | standard (spike → ADR-0002) | max | [P0-03-core-deno-bridge-spike.md](tasks/P0-03-core-deno-bridge-spike.md) |
| P0-04 | App shells (storefront, merchant), design tokens, i18n, Playwright smoke | P0-01 | standard | high | [P0-04-app-shells.md](tasks/P0-04-app-shells.md) |
| P0-B1 | CRM security audit & lockdown plan (read-only) | P0-00 (stop-gap first) | review (writes reviews/ + tasks/proposed/) | max | [P0-B1-crm-security-audit.md](tasks/P0-B1-crm-security-audit.md) |
| P1-01 | Core: money & pricing engine | P0-01 | standard (golden P1-01) | max | [P1-01-core-pricing.md](tasks/P1-01-core-pricing.md) |
| P1-02 | Core: order state machine | P0-01 | standard (golden P1-02) | high | [P1-02-core-order-state.md](tasks/P1-02-core-order-state.md) |
| P1-03 | Core: opening hours & time slots (Europe/London, DST) | P0-01 | tests-first | max | [P1-03-core-hours-slots.md](tasks/P1-03-core-hours-slots.md) |
| P1-04 | Core: delivery zones (postcodes, radius) | P0-01 | tests-first | high | [P1-04-core-zones.md](tasks/P1-04-core-zones.md) |
| P1-05 | Database schema v1 + RLS + pgTAP tests | P0-02, P1-02 | tests-first | max | [P1-05-db-schema-rls.md](tasks/P1-05-db-schema-rls.md) |
| P1-06 | Merchant auth, shop membership & back-office shell | P1-05, P0-04 | standard | high | [P1-06-merchant-auth-shell.md](tasks/P1-06-merchant-auth-shell.md) |
| P1-07 | Menu builder with allergens & publish gate | P1-06, P1-01 | standard | high | [P1-07-menu-builder.md](tasks/P1-07-menu-builder.md) |
| P1-08 | Shop settings: hours, prep time, busy mode, zones, legal identity | P1-06, P1-03, P1-04, P1-01 | standard | high | [P1-08-shop-settings.md](tasks/P1-08-shop-settings.md) |
| P1-09 | Stripe Connect onboarding + webhook skeleton (account.updated) | P1-05, P1-06, P0-03 | standard | max | [P1-09-stripe-onboarding.md](tasks/P1-09-stripe-onboarding.md) |
| P1-10 | Storefront: menu, item sheet, basket with up-front service fee, fulfilment & slots | P1-01, P1-03, P1-04, P1-05, P0-04 | standard | high | [P1-10-storefront-menu-basket.md](tasks/P1-10-storefront-menu-basket.md) |
| P1-11 | create-checkout edge function (re-price, validate, hosted Checkout direct charge) | P1-09, P1-10, P1-02, P1-07 | tests-first | max | [P1-11-create-checkout.md](tasks/P1-11-create-checkout.md) |
| P1-12 | Stripe webhooks: payments, expiry, refunds, disputes, fee ledger | P1-11 | tests-first → B1 standard → B2 pass@2 | max | [P1-12-stripe-webhooks.md](tasks/P1-12-stripe-webhooks.md) |
| P1-13 | Merchant live orders screen (realtime, alarm, accept/reject, ticket print) | P1-12, P1-06 | standard | max (Session 1) / high (Session 2) | [P1-13-merchant-live-orders.md](tasks/P1-13-merchant-live-orders.md) |
| P1-14 | cron-tick: outbox, SMS/voice escalation, auto-reject + refund, expiry | P1-12, P1-13, P1-08 | tests-first | max | [P1-14-cron-tick-escalation.md](tasks/P1-14-cron-tick-escalation.md) |
| P1-15 | Refunds from the back office | P1-12, P1-13, P1-06 | standard | max | [P1-15-refunds.md](tasks/P1-15-refunds.md) |
| P1-16 | Customer order status page & notifications | P1-12, P1-14, P1-10 | standard | high | [P1-16-order-status-notifications.md](tasks/P1-16-order-status-notifications.md) |
| P1-17 | Legal pages & compliance UI | P1-10, P1-08 | standard | high | [P1-17-legal-compliance-ui.md](tasks/P1-17-legal-compliance-ui.md) |
| P1-18 | Reports v1 (daily summary, fees, refunds, CSV) | P1-12, P1-15 | standard | high | [P1-18-reports-v1.md](tasks/P1-18-reports-v1.md) |
| P1-19 | Security review pass (findings only) | P1-01…P1-18 | review, run twice independently | max | [P1-19-security-review.md](tasks/P1-19-security-review.md) |
| P1-20 | Pilot go-live checklist | P1-19 (+ its Critical/High fix cards); P0-B2, P0-B3, P0-B4 merged (go-live gate) | human + agent | high | [P1-20-pilot-go-live.md](tasks/P1-20-pilot-go-live.md) |

**顺序规则：** 依赖还没合并进 main 的卡不要开始。建议顺序：P0-00（你）→ P0-B1（只读，可以和 P0-01 前后脚）→ P0-01 → P0-02、P0-04 → P0-03 → P1-01 至 P1-04（都只依赖 P0-01，可以按顺序一张张做）→ P1-05 → 其余按依赖列往下走。CRM 加固卡 P0-B2 起由 P0-B1 提出，经你批准后执行，需要用 `PPOS_ALLOW_LEGACY=1` 启动。CRM 加固卡 P0-B2…B4 必须在 P1-20 上线前全部合并（上线门槛，architecture §15；P0-B3 包括撤销 anon 之后轮换 CRM 的 API key）。

**P2–P5 还没有任务卡。** 大块需求见 [`tasks/BACKLOG.md`](tasks/BACKLOG.md)。到时用规划会话（prompts §6）把一个 epic 拆成草稿卡，写到 `tasks/proposed/`，由你批准后移进 `tasks/`。

---

## 7. 第一天怎么开始（5 步）

1. **今天先给 CRM 止血。** 现在任何拿到 CRM 页面地址的人都能读、改、删全部客户和订单数据。按 [`01-upgrade-plan.md`](01-upgrade-plan.md) §3.6 和 P0-00 步骤 H：先导出备份所有表 → 给 CRM 页面加访问限制（托管层密码或 IP 白名单）→ 确认 GitHub 仓库是 Private → 提醒员工不要转发链接。结果记进 `environments.md`。
2. **做 P0-00（你的设置任务）。** 照 [`tasks/P0-00-human-setup.md`](tasks/P0-00-human-setup.md) 和 03 手册 §D 一步步做：（macOS）`brew install coreutils` → 订阅 Z.ai Coding Plan（建议 Pro；价格未经实时核实，以 z.ai/subscribe 为准）→ 运行 `npx @z_ai/coding-helper` → 在 `~/.claude/settings.json` 里把 OPUS 和 SONNET 槽位改成 `glm-5.3[1m]`、HAIKU 改成 `glm-5.3-flash[1m]`（helper 默认三个都是 Flash）→ 建标签 `protected-change-approved` + GitHub 主分支保护（要求 5 个 CI 检查通过；**不要**要求 approval，你不能批准自己的 PR）→ Supabase 在伦敦区建 `takeaway-dev` 和 `takeaway-prod`，**两个项目放在两个不同的 Supabase organization**，Agent 这台电脑上的 Supabase CLI 只登录 DEV 那个账号（它不能是 PROD organization 的成员）→ Stripe 平台账户开 Connect 和 sandbox，Connect 支付方式只开银行卡、Apple Pay、Google Pay 和 Link（延迟到账的方式全部关闭）→ 写 `environments.md`（只写 DEV 的非机密信息，不写任何 PROD 标识）和仓库根目录的 `.env.local`。Vercel、Twilio、Resend 可以晚点。
3. **验证护栏（约 5 分钟）。** 在仓库目录运行 `node scripts/guards/run-all.mjs`，最后一行应是 `All guards passed.`。再运行 `claude`：`/status` 显示 `glm-5.3[1m]` 和 `api.z.ai`；`/hooks` 列出 SessionStart、PreToolUse、Stop；粘贴 03 手册 §D.6 的护栏测试，应看到 `[ppos guard]` 开头的拒绝。
4. **第一个 GLM 会话：P0-B1（CRM 安全审计，只读）。** `claude --effort max`，粘贴 [`prompts.md`](prompts.md) §5a（`<ID>` 换成 `P0-B1`，`<a|b>` 换成 `a`）。它会写出 `reviews/P0-B1-crm-security.md` 和 `tasks/proposed/P0-B2…` 草稿卡。你读报告，把同意的卡通过 PR（加标签）移进 `tasks/`。注意：这次审计会读 `index.html`，CRM 的地址和 key 会发送给 Z.ai；按 P0-00 步骤 H 的说明，B3 完成后轮换 CRM 的 key。
5. **然后做 P0-01（代码仓库骨架）。** 避开高峰时段（周一至周五，英国冬令时 06:00–10:00、夏令时 07:00–11:00，未经实时核实），`claude --effort high`，先粘贴 [`prompts.md`](prompts.md) §2b，再粘贴 §2a（`<ID>` 换成 `P0-01`）。GLM 开出 PR 后，按 03 手册 §G 审查：CI 全绿、Evidence 里贴了真实输出、只改了卡片列出的文件。合并后看 `PROGRESS.md` 的 Done log，再开下一张卡。同时把 01 计划 §7 的问题清单发给律师和会计，要固定报价。

**每天记住三件事：** 一次会话只做一张卡，做完开 PR 就停；GLM 说"完成了"不算数，CI 全绿和贴出的命令输出才算；钱、登录、数据库权限、Stripe、数据库迁移，永远用 `glm-5.3`，绝不用 Flash。
