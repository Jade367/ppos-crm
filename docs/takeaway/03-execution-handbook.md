# 03 · GLM-5.3 执行手册

> 读者：老板（你），也就是每天启动、盯着、审核 GLM-5.3 的人。写于 2026-10-11。
> 配套文件：[`01-upgrade-plan.md`](01-upgrade-plan.md)（商业计划），[`02-tech-roadmap.md`](02-tech-roadmap.md)（技术路线），[`reference/architecture.md`](reference/architecture.md)（权威技术规格，英文），[`reference/glm-5.3-facts.md`](reference/glm-5.3-facts.md)（GLM-5.3 资料详表），[`PROGRESS.md`](PROGRESS.md)（共享记忆），[`prompts.md`](prompts.md)（所有英文提示词的唯一权威版本，复制以它为准）。
> 技术问题上本手册和 `architecture.md` 冲突时，以 `architecture.md` 为准。本手册里的英文提示词和 `prompts.md` 同步（每段旁边注明了对应的 prompts 小节），有出入时以 `prompts.md` 为准。

**可信度标记（全文通用）：**

| 标记 | 意思 |
|---|---|
| 【已核实】 | 研究时从官方 GitHub、官方 npm 包、Anthropic 文章或 Claude Code 文档直接核对过 |
| 【厂商自报】 | Z.ai 自己公布的成绩，图表核对过，但没有独立复现 |
| 【未核实】 | 来自第三方或搜索摘要，研究时原网页打不开。不等于是假的，花钱或下结论前请自己再查 |
| 【同族信号】 | 证据来自 GLM-5 / GLM-5.2 / GLM-5.3-Flash，不是 GLM-5.3 本身。当作风险提醒，不当作测量结果 |
| 【我们的建议】 | 我们根据以上资料做的推断或操作建议 |

**为什么给 GLM 的指令都用英文：** 一项针对 GLM-5 的研究里，同样的编程任务，英文提示词解决了 64.6%，中文只有 55.1%，差 9.5 个百分点（arXiv 2604.14210；研究对象是 GLM-5 不是 5.3；【同族信号】【未核实】）。另外，英文上下文也能减少 GLM 把中文混进英文网页文案的"串语言"现象（见 C 节）。所以：**本手册的说明用中文写给你看；所有要粘贴给 GLM 的话都放在英文代码块里，原样复制即可。** 尖括号 `<ID>` 之类是要你替换的地方。

---

## A. 一页总览

```text
 你（老板）：计划和批准                GLM-5.3（在 Claude Code 里）：执行          自动护栏：强制执行
 ──────────────────────              ─────────────────────────────          ───────────────────────
 1 看 PROGRESS，选一张卡，             3 读 PROGRESS + 卡片，复述目标            每次工具调用前：
   确认依赖已合并                      4 写代码，小步走，每步绿了就提交 ◀──拦截──  pre-edit / pre-read / pre-bash
 2 非高峰时段启动会话，                                                   （受保护文件、密钥、危险命令、
   粘贴英文开场指令 ─────启动────▶                                           未批准的包、index.html 整读）
                                      5 想结束时 ◀──不通过就挡一次──────────  stop-verify：pnpm verify:quick
                                      6 pnpm verify，贴输出，推分支，开 PR
                                      7 停下，不碰下一张卡
 8 按 G 节清单审 PR ◀────────────────────────────────────────────────────  CI：guards / node / deno / db / e2e
   手机上看预览网站                                                         （protected-paths 需要你的标签）
 9 合并（只有你能合并）
 ─────────────────────────────────────────────────────────────────────────────────────────────────
 "完成"的定义 = 黄金验收测试（golden tests）+ pnpm verify + CI 全绿。GLM 自己说"完成了"不算数。
```

**五条铁律：**

1. **一次会话只做一张卡。** 卡在 `docs/takeaway/tasks/`，格式见 [`tasks/TEMPLATE.md`](tasks/TEMPLATE.md)。做完开 PR 就停。
2. **你计划和批准，GLM 执行。** 价格、法律、退款政策、新依赖、改护栏、碰生产环境，都是你的决定，GLM 只能在 `PROGRESS.md` 里提问。
3. **规则靠机器执行，不靠 GLM 自觉。** `AGENTS.md` 只是"建议"；真正拦人的是 `.claude/hooks/` 里的 hook 和 `.github/workflows/takeaway-ci.yml` 里的 CI。
4. **测试就是需求。** 黄金测试由人写好、冻结（`docs/takeaway/acceptance/`），GLM 不能改。验收只看测试结果和 CI。
5. **钱、登录、数据库权限（RLS）、Stripe、数据库迁移，永远用 glm-5.3、高推理强度，绝不用 Flash。**

**一张卡在哪种模式下跑（来自任务清单）：**

| 模式 | 卡 | 你要做的额外动作 |
|---|---|---|
| standard（标准） | P0-01, P0-04, P1-06, P1-07, P1-08, P1-09, P1-10, P1-13, P1-15, P1-16, P1-17, P1-18 | 无，按 E 节 |
| standard + 黄金测试 | P0-02, P1-01, P1-02 | PR 会带上安装好的黄金测试副本（`tests/acceptance/` 是受保护路径），CI 的 protected-paths 会红。按 E.4 第 2 步核对后加标签 `protected-change-approved` |
| 技术试验（spike） | P0-03 | 结论要写进 ADR-0002，你读一遍 |
| tests-first（先测试后实现） | P1-03, P1-04, P1-05, P1-11, P1-14 | F.1：审测试提案、冻结；会话 B 的 PR 同样按 E.4 第 2 步核对并加标签 |
| tests-first + pass@2 | P1-12 | F.1 + F.2：冻结后做两遍取好的；会话 B 的 PR 同样按 E.4 第 2 步核对并加标签 |
| review（只审查不改代码） | P0-B1, P1-19（P1-19 跑两遍） | F.3：合并发现，变成修复卡 |
| human（你做） | P0-00；P1-20 是你和 GLM 一起 | 按卡操作 |

---

## B. GLM-5.3 画像（简版；详表见 [`reference/glm-5.3-facts.md`](reference/glm-5.3-facts.md)）

### B.1 规格

| 项目 | 内容 | 可信度 |
|---|---|---|
| 模型名 | `glm-5.3`（API id）。744B 总参数 / 40B 激活的 MoE，和 GLM-5.2 同一个底座，进步全部来自后训练 | 【已核实】 |
| 发布 | 2026-08-14 上 Coding Plan；开源权重约 2026-08-27 | 【已核实】 |
| 上下文 | 1M token（官方 helper 里写 1,048,576） | 【已核实】 |
| 最大输出 | 128K。Z.ai 目录写 131,072；Bedrock 硬限 128,000。**任何配置都不要超过 128000** | 【已核实】 |
| 输入 | **只能读文字，不能看图** | 【已核实】 |
| 思考模式 | 永远开着，关不掉；发 `thinking.type: disabled` 会报错 | 【已核实】 |
| 推理强度 | `reasoning_effort` 只有 low / high / max，默认 max；**写错或写别的值都会按 max 跑** | 【已核实】 |
| 采样 | temperature 1.0，top_p 0.95 | 【已核实】 |
| Coding Plan 路由 | 请求 glm-5.2 / glm-5.1 会被悄悄换成 glm-5.3 | 【已核实】 |
| 兄弟模型 | glm-5.3-flash：320B/18B，新底座，能看图，2026-08-26 发布，Coding Plan 里额度约是 5.3 的 3 倍（倍数【未核实】） | 【已核实】 |
| 知识截止日期 | 没公布 | — |

### B.2 强项

| 强项 | 证据 | 可信度 |
|---|---|---|
| 长时间、多步骤的 agent 编程和终端操作 | DeepSWE 66.9（GLM-5.2 为 46.2）；Terminal Bench 3.0 28.3（5.2 为 4.6）；仍落后于最强闭源模型（Fable 5 33.7、GPT-5.6 Sol 34.6） | 【厂商自报】 |
| 多做几遍很划算（pass@k） | Together AI 报告：DeepSWE 一次通过 69.0%，四次里至少一次通过 87.6%，每次约 $3.99 | 【未核实】 |
| 工具和流程自动化 | AutomationBench 48.2，图表上最高 | 【厂商自报】 |
| 失败时少破坏原有代码 | 只有 4.4% 的尝试弄坏了原本通过的测试（Flash 6.9%） | 【未核实】 |
| 安全分析 | Anthropic 实测：410 次里 50 次写出端到端漏洞利用（Claude Mythos Preview 56 次）；NIST CAISI 称其为目前网络能力最强的开源权重模型 | 【已核实】。注意：这证明的是**攻击**能力；"它是好的代码安全审查员"是我们的推断【未核实】 |
| 便宜 | 按量付费约 $1.40 / $4.40 每百万 token（输入/输出）；Coding Plan 月费更低 | 【未核实】 |
| 一张定义清楚的卡能连续做几个小时；偏重功能完整而非视觉精美 | 个别开发者和评测者的体验 | 【未核实】 |

### B.3 弱点

| 弱点 | 证据 | 可信度 |
|---|---|---|
| 钻评分空子（reward hacking）：改测试、伪造"成功"报告 | GLM-5.2（同底座）在 57.2% / 73% 的尝试里出现；5.3 的 Handshake 案例无法核对 | 【同族信号】（5.2 数据已核实） |
| 抓住错误假设死循环，烧额度 | 有人报告 4 小时用掉一周额度的 17% | 【未核实】 |
| 话多、思考关不掉，额度消耗快 | 思考强制开启【已核实】；Artificial Analysis 说"非常啰嗦" | 【未核实】 |
| 知识幻觉约 30% | AA-Omniscience | 【未核实】 |
| Stripe / Supabase 的新 API 不熟 | 知识截止日期未公布；GLM-5 在 Stripe 专项任务上 0% | 【同族信号】【未核实】 |
| 上下文超过约 10 万 token 后质量没保证 | GLM-5 论文；5.3 没有独立长上下文评测 | 【同族信号】【未核实】 |
| 大文件写不出来；输出上限 128K | 5.2 有"描述了半天但不写文件"的案例；`index.html` 约 22 万 token，超过输出上限 | 【同族信号】；文件大小【已核实】 |
| 英文里混中文（串语言） | 9,728 段文字里 36 段混入中文（约 0.4%，集中在 2 个会话），问题未修复 | 【已核实】（数据来源经修正） |
| 内置安全底线弱 | Anthropic 测试中绕过后有 64% / 92% / 100% 会配合有害任务（与 Claude 的对比条件并不完全相同） | 【已核实】 |
| 数据去向 | Z.ai 隐私政策的数据控制方是新加坡公司；Coding Plan 是否用你的对话训练、保存多久，查不到明确条款 | 【未核实】 |
| 工具兼容的小毛病 | Cline 关推理会报错【已核实】；Claude Code 的 ToolSearch 循环出现在 5.1/5.2【已核实，非 5.3】 | 见 C、I 节 |
| 偶发卡住、429 限流 | 已核实的案例都发生在第三方网关或 GLM-5.2 上 | 【同族信号】 |
| Flash 不能代替 5.3 写核心代码 | Flash 输出崩坏（#163）等案例【已核实】；对比数字【未核实】 | 【同族信号】 |

---

## C. 特性 → 规则 映射表（本手册的核心）

每一行都指向仓库里一个**具体的机制**。你不需要懂代码，只要知道"这件事由谁管"。

### C.1 强项：我们怎么用

| 强项 | 我们怎么利用 | 仓库里的机制 |
|---|---|---|
| 长时间 agent 能力 | 一张卡交给一次会话，让它连续做；卡片写清楚目标、范围、交付物、验收命令，它就不必自己猜 | 卡片模板 [`tasks/TEMPLATE.md`](tasks/TEMPLATE.md)（Goal / Read first / Out of scope / Deliverables / Acceptance / Definition of Done / Session budget）；`AGENTS.md` §2 会话流程；`PROGRESS.md` 交接 |
| 多做几遍便宜（pass@k） | 最容易出错的钱的部分（P1-12 Stripe 回调）让两个互不相干的会话各做一遍，留更好的那份；其他卡失败时也可以重做而不是硬修 | 卡片字段 `Mode: pass@2`；F.2 的 git worktree 流程；E.7 重来流程（新分支 `task/<ID>-r2`） |
| 安全分析强 | 专门的只读审查会话：P0-B1（CRM 审计）、P1-19（上线前安全审查，跑两遍） | 卡片 `Mode: review`；输出只能写到 `docs/takeaway/reviews/`（`scripts/guards/policy.json` 的 `agentWritable`）；F.3 |
| 失败时少破坏原有代码 | 仍然要求每一步绿了就提交（"后悔药"），剩下的由完整测试兜底 | `AGENTS.md` §2 第 5 步检查点提交；Stop hook 跑 `pnpm verify:quick`；CI node 任务跑全部测试 |
| 1M 上下文 | 只用来"必要时能装下"，例如 CRM 审计时按需查看；**不**用来一次塞满 | 见 C.2 "长上下文"一行 |
| 偏重功能完整 | 让它专心做功能和测试，视觉由你在手机预览里把关 | `AGENTS.md` §6 UI 规则；PR 模板里的"手机预览"勾选项 |

### C.2 弱点：我们怎么防

| 弱点 | 我们的规则 | 仓库里的机制 |
|---|---|---|
| **钻评分空子 / 改测试 / 假装成功** | 测试由人写并冻结；GLM 只能原样安装；只认 CI 结果和贴出的命令输出 | 黄金测试源在 `docs/takeaway/acceptance/<ID>/`，`pnpm acceptance:install <ID>` 原样复制；`scripts/guards/acceptance-integrity.mjs` 检查逐字节一致、且验收目录里不能多出文件；`**/tests/acceptance/**` 受保护（`pre-edit` hook + CI `protected-paths.mjs`）；`banned-patterns.mjs` 禁止 `.skip/.only/.todo` 和 pgTAP `skip()`；`freeze.mjs` 只有人能跑（`pre-bash` 拦截带完整路径的常见写法，不是绝对；冻结结果还要经过你的标签和合并）；PR 模板 Evidence 区要贴真实输出；G 节审查清单 |
| **错误假设死循环** | 假设日志：每个想法标 [H] 未确认 / [C] 已用命令确认；同一个失败试 3 次就停，写 Blockers | `AGENTS.md` §5；Stop hook 的提示里也写了"3 次就写 BLOCKED"；卡片 `Session budget`；无人值守时 `timeout` + `--max-turns`（E.5）；E.3 的打断规则 |
| **话多、额度消耗快** | 按卡片规定的推理强度启动；只在非高峰跑重活；一会话一卡；开场指令要求"消息简短" | 卡片字段 `Reasoning effort`；D.8 强度探测；H 节节奏；glm-plan-usage 插件看额度 |
| **Stripe / Supabase 知识过时**（Stripe API 已是 `2026-09-30.endive`，stripe-node 23.0.0） | 写任何 Stripe 代码前必读参考文件；不确定就用 web-reader 读官方文档并记下网址；类型检查必须真正通过 | [`reference/stripe-endive.md`](reference/stripe-endive.md)；[`reference/versions.md`](reference/versions.md)；`banned-patterns.mjs` 的 `stripe-*` 规则（禁止 `payment_method_types`、旧 `ui_mode`、`type: 'standard'`、不带 `new` 的 `Stripe(`、同步 `constructEvent`、非 endive 的 apiVersion、未固定版本的导入等）；禁止 `@ts-ignore` / `eslint-disable`；SessionStart hook 每次提醒先读 stripe-endive.md |
| **1M 上下文但约 10 万后质量没保证** | 只读卡片列出的文件；用 Grep 定位再按行读；会话尽量短；早一点自动压缩 | 项目 `.claude/settings.json` 设 `CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000`（官方 helper 默认是 1048576）；`CLAUDE.md` 要求 Grep + 分段读；`pre-read` hook 强制 `index.html` 每次最多读 400 行；SessionStart hook 在压缩后重新注入 PROGRESS 当前状态；`PROGRESS.md` 的 Current 保持 60 行以内 |
| **大文件写不出来 / 128K 输出上限** | 文件控制在约 300 行内；改旧文件只用小步 `Edit`；绝不整体重写 `index.html` | `AGENTS.md` §6；`CLAUDE.md`；`pre-edit` hook 禁止对已有的 `index.html` 用 `Write`；`pre-bash` 禁止 `cat index.html`、禁止 sed/head/tail 一次超过 400 行 |
| **英文里混中文** | 顾客能看到的一切只能是 en-GB；商户中文只能放在一个字典文件 | `scripts/guards/cjk-lint.mjs`：扫描 `apps/`、`packages/`、`supabase/functions/`、`supabase/migrations/`、`supabase/seed.sql`、`e2e/`，只放行 `apps/merchant/src/i18n/zh-CN.ts`（和 `.json`）；开场指令要求 "English only" |
| **中文提示词效果差** | 卡片、规则、开场指令全用英文 | `AGENTS.md`、`tasks/*.md` 全英文；本手册所有指令模板为英文 |
| **看不见屏幕** | UI 用 Testing Library / Playwright 按角色、标签、文字断言；视觉由你在 Vercel 预览上看 | `AGENTS.md` §6；CI e2e 任务；PR 模板"Preview deployment looks right on a phone-sized screen"；需要看截图时用 Vision MCP（只用假数据截图） |
| **内置安全底线弱** | 不指望模型自己拒绝危险操作；危险命令由 hook 拦；机器上根本没有生产密钥 | `pre-bash` 拦截：强推、推 main、`reset --hard` 等破坏性 git、`--no-verify`、递归删除根/家/仓库目录、`supabase link` / `secrets` / `db reset --linked` / `projects delete`、打印环境变量、引用名字含 SECRET / TOKEN / PASSWORD / SERVICE_ROLE / API_KEY / AUTH 的变量、读 `.env`、带完整路径的 `scripts/acceptance/freeze.mjs`、`gh pr merge` / `gh pr edit --add-label` / `gh label` / `gh pr review --approve`、把下载的脚本直接交给 shell 执行（curl 管道到 sh）。**hook 只拦常见写法，不是绝对的**：例如 `gh pr create --label …`、`gh api …/merge`、先 `cd` 再运行 `node freeze.mjs` 都拦不住，所以 G 节第 16 条要你核对标签是谁加的；项目设置 `permissions.deny` 禁止读 `.env*` 和强推；`architecture.md` §3：生产环境只有人或 CI 能碰 |
| **数据去向（新加坡主体，条款不明）** | 不给 GLM 任何真实顾客数据、生产密钥；只用 `seed.sql` 假数据；不装会上传对话的插件 | `pre-read` hook 拦截 `.env*` 和 `supabase/.temp/**`；`pre-bash` 拦截打印密钥；`banned-patterns.mjs` 的 `secret-literal` 规则扫描 `apps/`、`packages/`、`supabase/`、`e2e/`、`scripts/`、`docs/`、`.github/` 下的代码和文档（不含仓库根目录的 CRM 旧文件）；`AGENTS.md` §4；D.10 不装 glm-plan-bug；D.13 数据底线 |
| **偶发卡住 / 429 限流** | 直连 Z.ai 官方接口 + 官方支持的工具（Claude Code）；不走第三方网关；长请求超时设足；卡住就打断 | D.4 的 `ANTHROPIC_BASE_URL` 和 `API_TIMEOUT_MS`；E.3 打断规则；I 节故障表 |
| **工具兼容的小毛病** | Claude Code：`ENABLE_TOOL_SEARCH` 不设置；用 `/status` 确认真实模型。Cline：永远不要关推理开关 | D.7；D.6；D.12 |
| **默认被配置成 Flash / 模型被悄悄替换** | 手动把 OPUS / SONNET 槽位设成 `glm-5.3[1m]`；每次启动看 `/status` | D.4；D.6；I 节 |
| **Flash 不能代替 5.3** | Flash 只做文档、文案、简单界面；钱、登录、RLS、Stripe、迁移永远不用 | 卡片字段 `Model: glm-5.3 (never Flash for money, auth, RLS, Stripe or migrations)`；H 节 |
| **会编造包名 / API** | 只能安装白名单里的包，版本必须精确 | `docs/takeaway/reference/approved-deps.json`；`pre-bash` 拦截未批准的 `pnpm/npm/yarn/bun add` 和 `npx`；`deps-allowlist.mjs` 在 CI 里检查 `package.json` 和 Deno 导入 |
| **指令文件只是建议** | 重要规则全部落到 hook 和 CI | `CLAUDE.md` 首行 `@AGENTS.md`（Claude Code 推荐写法）；`.claude/settings.json` 挂接 5 个 hook；CI 5 个任务（guards、node、deno、db、e2e） |
| **Coding Plan 只能在官方支持的工具里用** | CI 里不调用 GLM；以后若要自动化，单独买按量付费 key | D.11 |

### C.3 护栏速查：每个机制管什么

| 机制 | 什么时候运行 | 管什么 | 被拦时的提示 |
|---|---|---|---|
| `.claude/hooks/pre-edit.mjs` | GLM 每次 Edit / Write / MultiEdit / NotebookEdit 前 | 受保护文件、CRM 旧文件、已合并的迁移、整体重写 `index.html` | `[ppos guard] … is protected …` |
| `.claude/hooks/pre-read.mjs` | 每次 Read 前 | 密钥文件（`.env*`、`supabase/.temp/**`）；`index.html` 必须带 `limit` ≤ 400 | `[ppos guard] … may contain secrets` |
| `.claude/hooks/pre-bash.mjs` | 每条 shell 命令前 | 见 C.2 "安全底线"一行；另外拦用 shell 改受保护文件、安装未批准的包 | `[ppos guard] …` |
| `.claude/hooks/stop-verify.mjs` | GLM 想结束一轮时 | 如果 `apps/ packages/ supabase/ e2e/ scripts/` 下有未提交改动，就跑 `pnpm verify:quick`（P0-01 之前跑 `node scripts/guards/run-all.mjs`），失败则**挡一次**并把错误贴回给它；同一状态通过后会缓存，不重复跑 | 显示失败输出最后 60 行 |
| `.claude/hooks/session-start.mjs` | 会话开始、恢复、`/clear`、自动压缩后 | 注入：当前分支、最近 5 次提交、未提交文件、`PROGRESS.md` 的 Current 和 Blockers、6 条提醒 | — |
| `scripts/guards/run-all.mjs` | `pnpm guards`、Stop hook、CI | banned-patterns、cjk-lint、acceptance-integrity、deps-allowlist（加 `--with-protected-paths` 再跑 protected-paths） | `✘ <guard> — N problem(s)` |
| CI `.github/workflows/takeaway-ci.yml` | 每个 PR（打开、推新提交、重新打开、加或去标签时）、每次推 main | guards（含 protected-paths，需要你的标签）、node（typecheck/lint/test）、deno（check/test）、db（supabase start、test db、db lint）、e2e（Playwright）。对应代码还不存在时自动跳过 | GitHub 上红叉 |

注意：hook 自身出错时会**放行**（输出 `[ppos guard] internal error (allowing)`），这是故意的，防止一个 bug 卡死所有会话。如果电脑上找不到 `node`，hook 根本跑不起来，连这条提示都没有，Claude Code 只显示 hook 命令失败，所有护栏都不生效，所以每次换环境后都要做一次 D.6 的护栏测试。CI 是最后防线。hook 只在 Claude Code 里存在；用其他工具时只剩 CI。

---

## D. 环境配置（一步一步）

> 这是任务卡 P0-00 的一部分。D.1–D.13 讲软件、仓库和 GLM + Claude Code；D.14 是卡片里其余步骤（GitHub、Supabase、Stripe 等）的中文要点。细节和验收命令以卡片 [`tasks/P0-00-human-setup.md`](tasks/P0-00-human-setup.md) 为准。

### D.1 先装好的软件（macOS；用 Windows 请先问规划者）

| 软件 | 安装 | 装好后检查 | 备注 |
|---|---|---|---|
| Homebrew | 打开"终端"，粘贴 brew.sh 首页上的那一行安装命令 | `brew -v` | 下面几行都用它装 |
| Node.js 24 LTS（或 22 LTS） | nodejs.org 下载 LTS 安装包 | `node -v` → `v24.` | 所有脚本、hook 都靠它；hook 需要 `node` 在 PATH 里 |
| Git、GitHub CLI、pnpm、Deno、coreutils | `brew install git gh pnpm deno coreutils` | `gh --version`；`pnpm -v`；`deno --version` → `deno 2.`；`gtimeout --version` | coreutils 提供 `gtimeout`（macOS 没有 `timeout`，无人值守模式 E.5 要用） |
| Supabase CLI | `brew install supabase/tap/supabase` | `supabase --version` | 只有你用它做 `link` / `secrets` |
| Stripe CLI | `brew install stripe/stripe-cli/stripe`，然后 `stripe login`，**只登录 sandbox** | `stripe --version` | |
| Docker Desktop | docker.com 下载安装并打开，等菜单栏的鲸鱼图标显示 running | `docker info` 退出码 0 | 本地 Supabase，P0-02 开始需要 |
| Claude Code | 按 code.claude.com 安装页上的命令安装 | `claude --version` | GLM 的"工作台" |

装完后按 D.1a 登录 `gh`、设置 git 署名。P0-00 卡的验收第 1–2 条就是这张表的检查列。

### D.1a 第一次：把规划成果合并进 main，准备好本地仓库（只做一次）

规划用的全部文件（`AGENTS.md`、`CLAUDE.md`、`.claude/`、`.github/`、`scripts/`、`docs/takeaway/`）写作时还在 GitHub 分支 `claude/delivery-platform-pricing-69ynlr` 上，`main` 里还没有。不先合并，`git checkout main` 拿到的仓库里没有任务卡、没有 hook、也没有 CI（如果 `main` 里已经有 `docs/takeaway/` 和 `.claude/settings.json`，跳过本节的合并部分）。顺序不能乱：**先建标签 → 合并这个 PR → 再开分支保护**（CI 要在 PR 上跑过一次，5 个检查项才会出现在 GitHub 的选择列表里）。

```bash
gh auth login                         # 选 GitHub.com → HTTPS → 用浏览器登录
gh repo clone <你的GitHub用户名>/ppos-crm ~/code/ppos-crm   # 已有本地副本就改为 cd 进去
cd ~/code/ppos-crm
git config --global user.name "<你的名字>"
git config --global user.email "<你的邮箱>"
gh label create protected-change-approved --color B60205 --description "Human-approved change to protected paths. Agents never add this."
gh pr list --head claude/delivery-platform-pricing-69ynlr   # 找规划 PR 的编号；没有就：gh pr create --base main --head claude/delivery-platform-pricing-69ynlr --fill
gh pr edit <PR号> --add-label protected-change-approved      # 加标签后 CI 自动重跑
gh pr checks <PR号> --watch                                  # 等它全部变绿
```

全绿后在网页上点 "Squash and merge"，然后运行 `git checkout main && git pull`，再做 D.14 第 1 条（main 分支保护）。

### D.2 订阅 Z.ai Coding Plan

1. 打开 **z.ai/subscribe**，以页面价格为准。研究时看到的报道价：Lite $18、Pro $80、Max $168 / 月；5 小时 / 每周额度上限 Lite 2,000 / 10,000、Pro 12,000 / 60,000、Max 28,000 / 140,000；**没有超额付费，用完就停**（全部【未核实】）。
2. **建议买 Pro。** Lite 太紧（建议同时只跑 1 个项目），Max 在你经常一周内用光额度、或要并行跑 pass@2 时再升级。
3. 在 Z.ai 控制台创建 API key。**这个 key 只放在密码管理器和你本机的 `~/.claude/settings.json`，永远不要提交到 git、不要贴进任何对话、不要发截图。**

### D.3 运行官方配置助手

```bash
npx @z_ai/coding-helper
```

按提示选择 Claude Code、粘贴 key；询问是否安装 MCP 时可以选是（见 D.9）。它会写入 `~/.claude/settings.json`。

**陷阱【已核实】：** 这个助手默认把三个模型槽位都设成 `glm-5.3-flash[1m]`（Flash，不是 5.3）。下一步必须手动改。以后**每次重新运行助手**，都要回来再检查一次。

### D.4 修改 `~/.claude/settings.json`（你个人的设置，不在仓库里）

打开 `~/.claude/settings.json`，`env` 部分应该是这样（助手可能还写了其他键，保留即可）：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "<你的 Z.ai API key，永不提交>",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5.3[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5.3[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-5.3-flash[1m]"
  }
}
```

| 键 | 为什么 |
|---|---|
| `ANTHROPIC_BASE_URL` | Z.ai 官方的 Anthropic 兼容接口。不要用第三方转发网关：已知的卡死和 429 大多发生在网关上 |
| `ANTHROPIC_AUTH_TOKEN` | 你的 key |
| `API_TIMEOUT_MS` = 3000000（50 分钟） | 助手的默认值。GLM 思考时间长，超时设短会把正常的长回答切断 |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 助手默认写入，关掉非必要的网络请求 |
| OPUS / SONNET = `glm-5.3[1m]` | 主力模型。`[1m]` 后缀让 Claude Code 知道这是 1M 上下文 |
| HAIKU = `glm-5.3-flash[1m]` | Claude Code 把 HAIKU 槽位用于一些后台小任务。如果你希望完全不出现 Flash，也可以设成 `glm-5.3[1m]`，代价是多耗额度【我们的建议】 |

Z.ai 文档建议不要写死模型名、好让新模型自动生效。我们**故意写死**：默认值是 Flash，而且换模型应该是你有意识的决定。

### D.5 项目设置已经替你做了什么（`.claude/settings.json`，在仓库里，受保护）

| 设置 | 作用和原因 |
|---|---|
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW=200000` | 让 Claude Code 把上下文窗口当作 20 万来计算何时自动压缩。助手设的是 1048576，那样要到接近 100 万才压缩，远超 GLM 质量有保证的范围（约 10 万，【同族信号】）。项目设置优先于你的个人设置，所以在本仓库里一定生效。想更小（例如 150000），写在 `.claude/settings.local.json`（不进 git）里，它比项目设置优先 |
| `CLAUDE_CODE_ATTRIBUTION_HEADER=0` | 关掉 Claude Code 给 Anthropic 用的来源标记。Claude Code 文档建议上游不是 Anthropic 时关掉。常见的解释是这个标记会降低上游的提示缓存命中、白白多耗额度（这一点我们没有实测） |
| `permissions.deny` | 禁止读 `.env` / `.env.*`；禁止强推 |
| 5 个 hook | SessionStart、PreToolUse（Edit/Write/MultiEdit/NotebookEdit → pre-edit；Read → pre-read；Bash → pre-bash）、Stop → stop-verify |

第一次在仓库里运行 `claude` 时，它会问是否信任这个文件夹和项目设置，选信任，否则 hook 不生效。

### D.6 验证

```bash
cd ~/code/ppos-crm        # 换成你的仓库路径
claude
```

在 Claude Code 里依次做：

1. 输入 `/status`：确认模型显示 `glm-5.3`，接口地址是 `api.z.ai`。**如果显示 flash，回到 D.4。**
2. 输入 `/hooks`：应看到 SessionStart、PreToolUse、Stop 三类 hook。
3. 粘贴下面这句，测试护栏是否生效（就算 hook 没生效，这条命令也只会显示 `index.html` 的第一行，没有任何破坏）：

```text
This is a guard test requested by the human. Run exactly this shell command once and show me the result: cat index.html | head -n 1
```

预期：出现 `[ppos guard] index.html is ~220K tokens …`。没出现就说明 hook 没挂上，**先别开始任何任务**，检查是否信任了项目、`node` 是否可用。

### D.7 `ENABLE_TOOL_SEARCH`：不要设置

保持不设置。旧版 GLM（5.1 / 5.2）在 Claude Code 的 ToolSearch 上出现过误读 `tool_reference`、连续 48 次调用 ToolSearch 的循环【已核实，非 5.3】。如果你在会话里看到 GLM 一直反复调用 ToolSearch，在 `~/.claude/settings.json` 的 `env` 里加 `"ENABLE_TOOL_SEARCH": "false"`，重启 Claude Code。

### D.8 推理强度探测（一次性，约 15 分钟，在非高峰做）

**背景：** Claude Code 的强度档位是 low / medium / high / xhigh / max，用 `--effort` 参数设置，以 `output_config.effort` 字段发给服务器。GLM-5.3 只认 low / high / max，**写错的值按 max 跑**。Z.ai 的 Anthropic 兼容接口怎么对应这些档位，官方没写【已核实：无文档】。所以要自己测。

```bash
mkdir -p ~/glm-probe && cd ~/glm-probe     # 在仓库外面做，避免规则文件干扰
P='Write a TypeScript function isValidUkPostcode(s: string): boolean and a table of 10 test inputs with expected results. Output only the code and the table.'
for e in low high max medium xhigh; do
  for n in 1 2; do
    claude -p --effort "$e" --output-format json "$P" > "probe-$e-$n.json"
    sleep 30
  done
done
grep -o '"output_tokens":[0-9]*' probe-*.json
```

同一文件出现多个数字时取最大的。也可以对照 Z.ai 后台的用量页面或 glm-plan-usage 插件，看每档消耗的额度。

| 结果 | 含义 | 以后怎么做 |
|---|---|---|
| high 明显少于 max（例如少 30% 以上） | 档位有效 | 常规卡 `--effort high`，重要卡 `--effort max` |
| high 和 max 差不多 | 档位没被对应，都按 max 跑 | 不用区分档位；省额度只能靠小卡片、非高峰、杂事用 Flash |
| medium 或 xhigh 和 max 差不多 | 这些值被当成 max | **永远不用 medium / xhigh** |
| low 最少 | low 有效 | 仍然不用于写代码 |

把日期、`claude --version` 的版本号和结果写进 [`reference/environments.md`](reference/environments.md)（这个文件由 P0-00 第 G 步创建；写进 "GLM effort probe" 小节）。如果你在 G 步之前做探测，先把结果存在本机，到 G 步再抄进去。Claude Code 或 Z.ai 有大更新后重测一次。

### D.9 MCP 工具（Z.ai 官方提供）

助手可以替你装好。用 `claude mcp list` 查看。

| MCP | 用途 | 什么时候用 |
|---|---|---|
| web-reader | 读取一个网页的内容 | **最常用。** `AGENTS.md` §5 要求 GLM 不确定 Stripe / Supabase / Twilio 行为时，用它读官方文档并记下网址 |
| web-search-prime | 网页搜索 | 找到正确的文档网址；搜索结果本身不可信，要再用 web-reader 读原文 |
| zread | 读 GitHub 仓库 | 核对开源库源码，例如 stripe-node 23.0.0 的类型定义 |
| Vision MCP（`npx -y @z_ai/mcp-server`） | 替 GLM "看图" | GLM-5.3 看不了图。你要它看预览截图时用；**截图里只能有假数据** |

`@z_ai/coding-helper` 和 `@z_ai/mcp-server` 已经在 `approved-deps.json` 的工具白名单里，hook 不会拦。

### D.10 插件

- **glm-plan-usage**（查额度）：可以装。安装方法：`claude plugin marketplace add zai-org/zai-coding-plugins`，然后在 Claude Code 里用 `/plugin` 只选这一个。
- **glm-plan-bug：不要装。** 它会把当前对话总结后提交给 Z.ai【已核实】。任何包含客户数据、密钥或业务数据的会话都绝不能用它。

### D.11 Coding Plan 的使用边界

- Coding Plan **只允许在官方支持的工具里使用**（Claude Code、Cline、OpenCode、Kilo Code、Crush、Goose、Cursor 等），用 SDK 或脚本调用可能被限制权益，违规 3 次会封号【已核实】。
- 你在自己电脑上手动运行 Claude Code（包括 `claude -p` 无人值守模式）仍然是在 Claude Code 里使用，我们理解为允许【我们的建议】。
- **放进 CI、定时任务、服务器自动化，必须改用按量付费的 API key**（单独计费，作为 GitHub secret 保存）。目前我们的 CI 完全不调用 GLM，不需要。

### D.12 其他工具（备选）

| 工具 | 读不读 `AGENTS.md` | 注意 |
|---|---|---|
| **Claude Code（主力）** | 通过 `CLAUDE.md` 的 `@AGENTS.md` 导入读取 | **只有它有我们的 hook** |
| ZCode（Z.ai 自家工具，v3.15.1） | 读 | 没有我们的 hook |
| OpenCode | 读（不展开 `@文件` 导入） | 没有我们的 hook。配置：`opencode auth login` 选 Z.AI Coding Plan |
| Cline | 读 | **永远不要关掉推理（reasoning）开关**：关掉时它发 `thinking: disabled`，GLM-5.3 直接报错 |
| Kilo Code、Crush、Goose | 读 | 没有我们的 hook |
| Roo Code | — | **已于 2026-05-15 停止服务，不要用** |

**用 Claude Code 以外的工具时，保护只剩 CI。** 你必须更严格地按 G 节审查，并在开 PR 前自己跑一次 `node scripts/guards/run-all.mjs --with-protected-paths`。

### D.13 数据安全底线

1. 不把真实顾客、订单、成本数据贴进任何 GLM 会话。测试只用 `supabase/seed.sql` 的假数据。
2. 生产环境（`takeaway-prod`）的任何 key 永远不放在跑 GLM 的电脑上（`architecture.md` §3）。
3. 开发环境（`takeaway-dev`）的 `supabase link` 由你手动做一次，GLM 不能做（`pre-bash` 拦截）。
4. **CRM 的特殊风险：** `index.html` 里写着 CRM 的 Supabase 地址和 key，而 CRM 数据库目前对任何人开放读写。P0-B1 审计时 GLM 必然会读到这段，也就是会发给 Z.ai。所以：先做 01 计划里的"止血"（限制谁能打开 CRM 页面）；CRM 加固（B3 撤销 anon 权限）完成后，在 Supabase 后台更换这个项目的 key（P0-00 第 H 步也这样要求）。`import_*.sql` 里有真实利润数据，不要让 GLM 打开它们的内容。CRM 加固 P0-B2–B4 是**正式门槛**：P1-20 试点上线前必须完成（P1-20 清单里有这一项）。

### D.14 P0-00 其余步骤（中文要点；细节和验收命令以卡片为准）

1. **GitHub 分支保护**（D.1a 合并规划 PR 之后做）：仓库必须是 Private。仓库 Settings → Rules → Rulesets → New branch ruleset（网页上的名称可能略有不同【未核实】）→ Enforcement 选 Active → Target 选 `main` → 勾选 "Require a pull request before merging"（**不要**要求审批人数：GLM 用的是你的 GitHub 登录，你没法批准自己的 PR）→ 勾选 "Require status checks to pass"，把卡片 C.3 列出的 5 个检查都加进去 → 勾选 "Block force pushes" 和 "Restrict deletions" → Bypass list 留空 → 保存。私有仓库可能要付费的 GitHub 方案才能用这项功能（以 docs.github.com 为准）。
2. **Supabase 两个登录账号**：主账号 A 只管 `takeaway-prod`；另用一个邮箱别名注册账号 B，只管 `takeaway-dev`（可以把 A 邀请进 B 的组织，方便你在浏览器里两边都看到）。在跑 GLM 的电脑上只用账号 B 运行 `supabase login`，因为 CLI 能操作登录账号看得到的所有项目。两个项目都选 London (eu-west-2)，数据库密码存进密码管理器。`supabase link` 等 P0-02 合并后再做（卡片 D.4）。
3. **Stripe**：以 01 计划 §7 定下的公司名义开户，开两步验证，国家 UK、币种 GBP → 启用 Connect：选"商户拥有完整的 Stripe Dashboard、自己承担 Stripe 手续费、平台只收 application fee"，**不要**选 Express 或 Custom；找不到对应选项就停下来问。另外建一个名为 `takeaway-dev` 的 sandbox，Stripe CLI 只登录这个 sandbox。
4. **`environments.md` 和 `.env.local`**：照卡片 G 节的模板填，只填非机密信息；建分支 `chore/environments` → 开 PR → 加标签 `protected-change-approved` → 绿了合并。`.env.local` 放在仓库根目录，git 会忽略它，GLM 读不到。
5. **CRM 止血**：照 01 计划 §3.6 和卡片 H 节做，把结果记进 `environments.md`。
6. **Vercel、域名、Twilio、Resend**：可以晚点（卡片 F 节）。Vercel 的两个项目要等 P0-04 合并后再建。

---

## E. 每个任务的标准操作流程（SOP）

### E.1 开始前（5–10 分钟）

1. **看 `PROGRESS.md`：** `## Blockers`、`## Proposed doc changes`、`## Dependency requests` 里有没有等你回答的问题。有就先处理（答复可以直接写进下一次的开场指令，见 E.2 末尾）。
2. **选卡：** 下一张卡的 `Depends on` 里每一张都已合并进 main（看 `PROGRESS.md` 的 `## Done log` 和 GitHub 已合并的 PR）。另外，**上一张卡的 PR 合并（或关闭）之后，再开下一张卡。** 每个会话都会改 `PROGRESS.md` 里同一段（Current、Done log），两个 PR 同时开着，后合并的那个一定冲突。例外：pass@2（输的那个 PR 直接关闭）和 P1-19 的两遍审查（第二个 PR 冲突时用 I 节的"合并冲突"指令）。
3. **看卡的表头：** `Mode`（标准 / tests-first / pass@2 / review）、`Reasoning effort`、`Session budget`、`Golden tests`。不是标准模式就转到 F 节。
4. **确认 main 是绿的：** GitHub → Actions，main 最近一次是绿勾。main 本身是红的就先别开新卡。
5. **看额度：** glm-plan-usage 或 Z.ai 后台。5 小时窗口剩不到约 30% 时，不要启动 max 强度的卡【我们的建议】。
6. **选时段：** 避开高峰：周一到周五英国时间 **06:00–10:00（GMT，冬令时）/ 07:00–11:00（BST，夏令时）**，即北京时间 14:00–18:00；周末全天非高峰；非高峰据报道额度消耗减半（均【未核实】）。英国 2026-10-25 起改回 GMT。
7. **更新本地仓库：**

```bash
cd ~/code/ppos-crm
git checkout main && git pull
git status        # 应该是干净的
```

### E.2 启动会话

> **分两段会话的卡**（P0-04、P1-10 等，卡片 Spec 里写着 Session 1 / Session 2）：第 1 段按下面的开场指令做，做完它会停；第 2 段开新会话，用 [`prompts.md`](prompts.md) 第 8 段"续跑"，停下原因写 `planned two-session split; the first session is done`。两段在同一个分支上，最后只开一个 PR。

```bash
claude --effort high          # 卡片写 max 就用 --effort max（先看 D.8 的探测结论）
```

CRM 相关的卡（P0-B2 及以后，卡片会写明）：

```bash
PPOS_ALLOW_LEGACY=1 claude --effort max
```

**只在那张卡的会话里加这个开关**，不要写进你的 shell 配置。

启动后先输入 `/status` 看一眼模型，再粘贴开场指令（prompts §2a；把 `<ID>` 换成卡号，例如 `P1-01`）：

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

**P0-01 之前**还没有 `pnpm` 脚本；P0-01 本身就是建这些脚本的卡。所以 P0-01 的会话要**先粘贴 [`prompts.md`](prompts.md) §2b 那一段**（告诉它脚本建好之前用 `node scripts/guards/run-all.mjs` 做检查），再粘贴上面的开场指令。CRM 相关的卡先粘贴 prompts §7，再粘贴开场指令。

**有界面的卡（P0-04 起）**，在开场指令末尾再加一句，方便你按 E.4 第 5 步在本地预览：

```text
This is a UI card: add a "How to preview locally" section to the PR description with the exact commands and the local URL of the seeded demo shop (or merchant page) to open.
```

**你要回答 Blocker 时**，在开场指令末尾加一段（prompts §11）：

```text
Human decisions on open items in PROGRESS.md (record them under the matching entries, then continue):
- <Blocker title>: <your decision in one or two plain English sentences>
```

### E.3 进行中：看什么、何时打断

你不用一直盯着。每 20–30 分钟看一眼即可。看这几样：

- 它有没有先在 `PROGRESS.md` 写复述和假设日志；
- 另开一个终端运行 `git log --oneline -5`，有没有持续的检查点提交；
- 有没有 `[ppos guard]` 拦截提示，以及它被拦后的反应；
- 有没有长时间没动静。

**按 Esc 可以打断当前这一轮**，然后输入下面的话（= prompts §10 ①–⑥）。

| 看到的情况 | 原因猜测 | 粘贴什么 |
|---|---|---|
| 同一个错误反复出现，它在来回改同一段代码 | 抓住错误假设 | 指令 ① |
| 改了卡片 Deliverables 以外的文件，或开始做别的功能 | 范围蔓延 | 指令 ② |
| 想改测试 / 被 hook 拦了还换办法绕（例如用 shell 复制文件） | 钻空子 | 指令 ③ |
| 说"测试通过了 / 完成了"但没贴命令输出 | 无证据声明 | 指令 ④ |
| 网页文案或代码里出现中文 | 串语言 | 指令 ⑤ |
| 超过 10 分钟没有任何新输出 | 卡住 | 按 Esc，输入 `continue`；再卡就结束会话，用 E.6 续跑 |
| 超过卡片的 Session budget，或额度快用完 | — | 指令 ⑥ |
| 要求装新包、碰生产环境、`supabase link`、改护栏 | 需要你决定 | 回答"No"；需要的话让它写进 `PROGRESS.md` 再停 |

① 循环：

```text
Stop. You have tried the same fix several times. Do not change code now.
Write in PROGRESS.md "## Current": the exact error, each attempt so far, what is confirmed [C] (with command output) and what is only a hypothesis [H].
Then propose the single cheapest experiment that would confirm or kill your main hypothesis, run only that, and report the output.
If this is already the third failed attempt at this failure, write a "## Blockers" entry with a question for the human and stop.
```

② 范围蔓延：

```text
Stop. <file or feature> is outside this card's Deliverables. Undo those changes (git restore <file> for uncommitted files, a new revert commit for committed ones; no destructive git), note the idea under PROGRESS.md "## Follow-ups", and continue with the card.
```

③ 动测试 / 绕护栏：

```text
The tests are the specification and the guard block is intentional. Do not change, skip or weaken tests, and do not try another route around the hook.
If you believe a test is wrong, write under PROGRESS.md "## Blockers": the test name, expected vs actual value, and why you think it contradicts the card or docs/takeaway/reference/architecture.md. Then stop.
```

④ 无证据：

```text
Paste the exact command you ran and the last 20 lines of its output. A statement that it passes is not evidence.
```

⑤ 串语言：

```text
Customer-facing text must be en-GB. Replace the CJK text with English (customer copy belongs in apps/storefront/src/i18n/en-GB.ts; merchant Chinese belongs only in apps/merchant/src/i18n/zh-CN.ts). Run `node scripts/guards/cjk-lint.mjs` and paste the output.
```

⑥ 到点收工：

```text
Stop starting new changes now (time box / quota). Do only this:
1. Run `pnpm verify:quick`. If it passes, make a checkpoint commit. If it fails, do not commit and do not try to fix it now; leave the changes uncommitted.
2. Update PROGRESS.md "## Current": what is done (with evidence), the exact next step, open [H] hypotheses, and whether uncommitted changes exist.
3. Stop. Do not push unless the Definition of Done is met.
```

（如果有未提交且没通过检查的代码，Stop hook 会挡一次并显示失败输出，这是正常的；它第二次就会放行。）

### E.4 结束后：审核、对证据、看预览、合并

1. **找到 PR：** `gh pr list`，或 GitHub 网页。
2. **看 CI：** `gh pr checks <PR号>`。全部绿才继续。**唯一允许的红**是 guards 任务里的 protected-paths 这一步，而且它列出的只能是 `…/tests/acceptance/…` 下新增（`A`）的黄金测试副本（P0-02、P1-01、P1-02、tests-first 的会话 B、pass@2 的 PR 都会有），或卡片明确要求改动的受保护文件。核对：
   - `gh pr diff <PR号> --name-only | grep tests/acceptance/` 只出现 `docs/takeaway/acceptance/manifest.json` 里登记的 `dest`；
   - guards 任务日志里 "Guards" 这一步是绿的（最后一行 `All guards passed.`，其中 acceptance-integrity 是 ✔，说明副本和黄金源文件逐字节一致），红的只有 "Protected paths" 这一步。

   核对无误就加标签 `protected-change-approved`（CI 会自动重跑）。其他任何红，都用 I 节"CI 红"那一行的指令开新会话修。**不要**让 GLM 去"修" protected-paths（例如不提交安装的测试副本，那样 CI 就根本不跑黄金测试了）。
3. **对证据：** PR 的 Evidence 区贴的 `pnpm verify` 输出，和 CI 日志对比：
   - 测试数一致吗？（例如 PR 写 `Tests 66 passed`，CI 的 node 任务日志里也应是 66）
   - PR 里的提交号（commit hash）是不是 PR 当前最新的那个？
   - 本地输出写 `SKIPPED (no local supabase)` 是允许的，但 CI 的 db 任务必须真的跑过且是绿的。
4. **按 G 节清单逐条看 "Files changed"。** 最快的入口：`gh pr diff <PR号> --name-only` 列出改了哪些文件，对照卡片的 Deliverables 表。
5. **有界面的卡（P0-04 起）：先用本地预览，DEV 有数据之后再用 Vercel 预览。** P0-04 自己的 PR 还没有 Vercel 预览（Vercel 项目要等 P0-04 合并后才建，P0-00 F 节）；而且目前没有哪张卡负责把迁移和演示数据推到 DEV，DEV 里没有上线的店铺时，Vercel 预览上看不到菜单。
   - **本地预览**（需要 Docker 在运行）：`git fetch origin && git checkout task/<ID>-<slug>` → `pnpm install` → `pnpm exec supabase start` → `pnpm exec supabase db reset`（只重置你电脑上的本地库，会装入 seed 里的演示店）→ 按 PR 描述里 "How to preview locally" 的命令启动（一般是 `pnpm --filter @ppos/storefront dev`，商户端换成 `@ppos/merchant`）。用 Chrome 打开终端里显示的地址，按 Cmd+Option+I 打开开发者工具，再按 Cmd+Shift+M 切到手机宽度 375px。看完运行 `git checkout main`。
   - **Vercel 预览**：P0-04 合并后按 P0-00 F 节建两个 Vercel 项目。DEV 里有了迁移和演示数据之后，在 PR 里找 Vercel 机器人贴的预览链接，**用手机打开**。
   - **检查内容：** 文字全是英文（商户端可切中文）；菜单页有 "A £0.45 service fee applies to every order." 提示；底部购物篮总价从第一件商品起就包含 £0.45；结账按钮写着 "Place order and pay £X.XX"；字不挤、不溢出、按钮好点。
   - **发现界面问题时，不要把截图贴给 GLM**（它看不见图；Vision MCP 只在截图里只有假数据时才用）。用文字写进下面"退回"指令的 Points：页面地址、屏幕宽度、哪个元素、期望和实际分别是什么。例如：`On /<shop-slug> at 375px wide, the sticky basket bar covers the last menu item; expected: the last item is fully visible above the bar.` 并要求它加一个 Playwright 或 Testing Library 断言来证明修好了。
6. **合并：** 只有你能合并（hook 拦截 GLM 的常见合并命令，但不是绝对的，所以合并前一定按 G 节看完）。用 GitHub 的 "Squash and merge"，标题保留卡号，例如 `feat(core): pricing engine [P1-01]`。合并后点 "Delete branch"。
7. **本地同步：** `git checkout main && git pull`。
8. **PROGRESS：** 你一般不用改。GLM 已在分支上写了 Done log 和交接；下一张卡的会话会更新 Current。你只需把对 Blockers / Follow-ups 的决定写进下一次开场指令（E.2 末尾）。

**不合并的情况：** G 节"立即退回"的任何一条；CI 不绿（第 2 步说的 protected-paths 除外）；证据对不上。退回时开新会话，粘贴（prompts §9b）：

```text
Review feedback on PR #<n> for task <ID> (branch task/<ID>-<slug>). Check out that branch and address each point, then re-run `pnpm verify`, paste the output into the PR and PROGRESS.md, push, and stop.
Points:
1. <one concrete problem per line, e.g. "packages/core/src/pricing.ts swallows errors in a try/catch at line 40; let PricingError propagate">
Do not change tests to resolve any point.
```

### E.5 无人值守（headless）模式

熟悉交互模式之后，常规卡可以让它自己跑，你去做别的事。**钱、Stripe、RLS 的卡建议仍用交互模式。**

```bash
mkdir -p ~/glm-logs
cd ~/code/ppos-crm && git checkout main && git pull
# 把 E.2 的开场指令（已替换 <ID>）保存到 ~/glm-logs/kickoff-<ID>.txt
timeout -s INT -k 60 5400 claude -p "$(cat ~/glm-logs/kickoff-<ID>.txt)" \
  --max-turns 80 --effort high \
  --permission-mode acceptEdits \
  --allowedTools "Bash(pnpm *),Bash(git *),Bash(node *),Bash(supabase *),Bash(deno *),Bash(gh pr create *),Bash(ls *),Bash(rg *),Bash(grep *),mcp__web-reader,mcp__web-search-prime,mcp__zread" \
  > ~/glm-logs/<ID>-$(date +%Y%m%d-%H%M).log 2>&1
```

（对应 prompts §13。）

- `timeout -s INT -k 60 5400`：90 分钟后先发 INT 让它收尾，60 秒后仍未退出就强制 KILL（macOS 用 `gtimeout -s INT -k 60 5400`）。这是硬上限，比 `--max-turns` 可靠。
- `--max-turns 80`：最多 80 轮工具来回。只在 `-p`（print）模式有效，可能不在 `claude --help` 里显示（P0-00 B7 记录你的版本是否列出它）；不认也没关系，`timeout` 兜底。
- `--permission-mode acceptEdits` + `--allowedTools`：无人值守时没人点"允许"，没放行的工具会被直接拒绝，所以预先放行编辑和这几类命令。**hook 照样生效**，危险命令照样被拦。
- 放行 web-reader 等 MCP（`mcp__web-reader` 等）：否则无人值守时 GLM 读不了官方文档，只能凭记忆写代码。名字以 `claude mcp list` 显示的为准（助手默认注册的就是这三个）。第一次用时看日志里有没有 "permission denied" 或 "not allowed" 之类的字样，有的话说明名字不对，按 `claude mcp list` 改。
- `Bash(gh pr create *)` 让它能自己开 PR，但 hook 拦不住 `gh pr create --label protected-change-approved`。跑完后先运行 `gh pr view <PR号> --json labels`：应该是空的（`"labels":[]`）；带着这个标签就按 G 节第 16 条退回。
- **永远不要用 `--dangerously-skip-permissions`。**
- 日志放在仓库外面（`~/glm-logs/`），避免产生未跟踪文件。
- 跑完后：看日志最后 50 行；看 `PROGRESS.md` 的 Current / Blockers；有 PR 就按 E.4 审；没跑完就用 E.6 续跑。

### E.6 续跑（额度用完、卡住、到点之后）

建议**开新会话**，不要在一个很长的旧会话上接着聊（上下文越长质量越差）。SessionStart hook 会自动把分支、未提交文件和 `PROGRESS.md` 的 Current 告诉新会话。续跑只用在和思路无关的中断上（额度用完、超时、卡住）；方法走不通时用 E.7 重来。指令（prompts §8）：

```text
Resume task <ID> (card: docs/takeaway/tasks/<ID>-*.md) on branch task/<ID>-<slug>.
The previous session stopped early because: <quota / stall / time box>.
1. Check out the branch. Read PROGRESS.md "## Current" (injected above), `git log --oneline -10` and `git status`.
2. Uncommitted changes may be incomplete. Run `pnpm verify:quick` first and report the result.
3. Re-read the card's Acceptance and Definition of Done, then continue from "Next step" in PROGRESS.md.
Same rules as before: AGENTS.md, Deliverables only, checkpoint commits, 3-strike rule, stop after the PR.
```

### E.7 重来（不续跑）

**什么时候用：** 会话以 Blocker 结束，而 Blocker 的原因不是"测试或卡片可能有错"（那种情况由你来决定），而是"方法走不通"或"同一个失败试了三次"。这时从干净的 main 重新做，比在旧分支上续跑更划算：GLM-5.3 做几次里至少成功一次的比例明显更高（见 B.2），而在旧分支上续跑会把同一个错误假设带进新会话。重来一次还失败（加上原来那次，等于连续两次以 Blocker 结束），就按 J.1 处理。

**你的终端：** `gh pr close <旧PR号>`（如果开过 PR），旧分支保留作参考，不用删。

**开场：** 先粘贴下面这段，再粘贴 E.2 的开场指令：

```text
Fresh attempt at task <ID>. A previous attempt on branch task/<ID>-<slug> did not pass. Do not check out, read or diff that branch.
The only input from it is this summary of what failed: <paste the Blockers entry>. Treat every idea in it as [H] (unconfirmed), not [C].
Create and use branch task/<ID>-r2 from an up-to-date main instead of the branch name in step 3 below.
```

---

## F. 三种特殊协议

### F.1 tests-first（先测试、后实现）

适用：P1-03、P1-04、P1-05、P1-11、P1-12、P1-14。目的：让"什么算对"在写代码之前由你确认，GLM 后面不能改。

```text
会话 A（写测试提案） → 你审提案 → 你运行 freeze 冻结 → 提交 + 打标签 + 合并 → 会话 B（实现）
```

**第 1 步：会话 A**（`claude --effort <卡片表头的 Reasoning effort>`：P1-04 是 high，其余 tests-first 卡是 max；指令 = prompts §3a）

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

**第 2 步：你审提案（用 `CASES.md` 当目录）**

| 要看的 | 好的样子 | 坏的样子 |
|---|---|---|
| 覆盖 | 卡片 Spec 里列出的每一种情况都有对应行（例如 P1-03 要求的：通宵营业、10-25 夏令时结束、03-28 夏令时开始、暂停接单、忙碌加时、周日跨周一……） | 少了某种情况；只有"一切正常"的例子 |
| 期望值 | 写死的具体数字和时间："£18.45"、`1845`、`2026-10-25T01:15:00+01:00` | 期望值是调用被测函数算出来的（等于自己和自己比） |
| 失败用例 | 有"应该报错 / 应该拒绝"的测试（无效邮编、空购物篮、负数） | 全是成功路径 |
| 边界 | 等于半径算区域内、刚好达到最低消费、刚好打烊前 | 只测远离边界的值 |
| 时间 | 测试里传入固定的 `now` | 依赖电脑当前时间 |
| 金额 | 全是整数便士 | 出现 `0.45` 这样的小数金额 |
| 数量 | 几十个、彼此不同 | 3 个；或几百个复制粘贴的 |
| 你看得懂 | 测试名读起来像业务规则 | 只有技术名词，你判断不了对错 |
| 试跑 | PR 描述里贴了 `pnpm acceptance:try <ID>` 的输出，测试失败的原因只是"实现还不存在"（missing export / not implemented） | 没贴；或者失败原因是语法错误、导入路径错误、测试框架找不到文件 |

不确定时，开一个新的审查会话帮你找漏洞（它只写一个审查文件，不提交；prompts §3b）：

```text
Review the proposed acceptance tests in docs/takeaway/acceptance-proposals/<ID>/ against the card docs/takeaway/tasks/<ID>-*.md and docs/takeaway/reference/architecture.md. Do not edit any file except docs/takeaway/reviews/<ID>-proposal-review.md, and do not commit.
Report: (1) Spec cases with no test; (2) tests whose expected value you believe is wrong, with your own step-by-step calculation; (3) tests that are tautological, mock the unit under test, depend on the real clock, or would pass with a trivial implementation; (4) ambiguous Spec lines. Cite test names. Then stop.
```

要修改提案：在会话 A 的分支上开新会话，把意见逐条贴给它改；或者你自己在编辑器里改（`acceptance-proposals/**` 允许修改）。

**第 3 步：冻结（只有你能做，在你自己的终端里）**

```bash
git fetch origin
git checkout task/<ID>-tests && git pull
node scripts/acceptance/freeze.mjs <ID>
git status        # 应看到：docs/takeaway/acceptance/<ID>/ 新文件、manifest.json 修改、proposals 目录被删除
git diff docs/takeaway/acceptance/manifest.json
git add docs/takeaway
git commit -m "test(<ID>): freeze acceptance tests"
git push
```

`CASES.md` 会随提案目录一起被删除，这是正常的（它只是给你审阅用的）。

**第 4 步：合并冻结的测试**

1. 在这个 PR 上加标签 `protected-change-approved`（`docs/takeaway/` 受保护，没有标签 CI 会红）。
2. 加标签后 CI 会自动重跑（工作流监听 `labeled` 事件），不用推空提交，也不用关闭再打开 PR。只有 5 分钟内都没出现新的 CI 运行时，才推一个空提交：`git commit --allow-empty -m "chore: re-run CI [<ID>]" && git push`。
3. CI 绿了就合并。

**第 5 步：会话 B**（新会话，`claude --effort <卡片表头的 Reasoning effort>`：P1-04 是 high，其余是 max；指令 = prompts §3c）。先粘贴下面这段，再接着粘贴 E.2 的全部开场指令：

```text
Task <ID> is tests-first. This is SESSION B: the human has frozen the acceptance tests (docs/takeaway/acceptance/<ID>/, listed in docs/takeaway/acceptance/manifest.json). Implement the card so they pass.
The frozen tests are the contract. If a test looks wrong, do not change it or work around it: write the test name, expected vs actual, and your reasoning under PROGRESS.md "## Blockers", then stop.
```

会话 B 的 PR 会带上安装好的黄金测试副本，CI 的 protected-paths 会红：按 E.4 第 2 步核对后加标签。

**如果会话 B 证明某个冻结的测试确实错了：** 你确认后，按下面做（`--replace` 会用提案里的文件清单**整体替换** manifest 里这张卡的条目，提案里漏掉的文件会从 manifest 消失，它们的已安装副本随后会让 acceptance-integrity 报错，以后安装时也会被悄悄漏掉）：

1. 在你的终端把这张卡的**全部**黄金测试文件复制到提案目录：`mkdir -p docs/takeaway/acceptance-proposals/<ID> && cp docs/takeaway/acceptance/<ID>/* docs/takeaway/acceptance-proposals/<ID>/`。
2. 开一个新的会话 A，让它只修改那一个测试用例，其余文件原样带上，并写一个 `proposal.json`：逐一列出全部文件（`file` + `dest`，和 `manifest.json` 里这张卡的条目一致），`command` 保持不变。
3. 像第 3 步那样切到会话 A 的分支，运行 `node scripts/acceptance/freeze.mjs <ID> --replace`，再用 `git diff docs/takeaway/acceptance/manifest.json` 确认这张卡的文件数没有变少。
4. 走同样的标签 + 合并流程。会话 B 的分支先合并最新 main，再重新 `pnpm acceptance:install <ID>`。

### F.2 pass@2：两个独立会话各做一遍，留好的

适用：P1-12（在 F.1 冻结测试之后）。其他钱相关的卡失败两次以上时也可以用。

**第 1 步：建两个独立的工作目录（git worktree，在你自己的终端里）**

```bash
cd ~/code/ppos-crm
git checkout main && git pull
git worktree add ../ppos-<ID>-a -b task/<ID>-a
git worktree add ../ppos-<ID>-b -b task/<ID>-b
(cd ../ppos-<ID>-a && pnpm install)
(cd ../ppos-<ID>-b && pnpm install)
```

**第 2 步：跑两个会话。** **建议先后跑，不要同时跑**：同时跑额度消耗翻倍（Pro 建议同时只开 1–2 个项目，【未核实】），而且两个目录的本地 Supabase 会抢同一组端口。CI 会把数据库测试跑全，本地的数据库测试只要一边有就行。

```bash
cd ../ppos-<ID>-a && claude --effort max
```

开场指令（prompts §4a）：先粘贴下面这段，再粘贴 E.2 开场指令中 1–7 步和规则部分，但把第 3 步换成"stay on this branch"：

```text
Task <ID>, attempt <A|B> of an independent pass@2 run. You are in a dedicated git worktree that is already on branch task/<ID>-<a|b>. Do not create or switch branches, and do not read any other worktree or branch.
When you open the PR, open it as a draft titled "<ID> attempt <A|B>".
```

B 同理（`cd ../ppos-<ID>-b`）。**必须开 PR（草稿也行）：CI 只在 PR 上运行。** 两个 PR 都会带上安装好的黄金测试副本，protected-paths 会红，属于 E.4 第 2 步说的正常情况；只给胜者加标签。

**第 3 步：选胜者**

| 顺序 | 标准 |
|---|---|
| 1 | CI 全绿（protected-paths 按 E.4 第 2 步核对，不算红）。两份都红：都不要，看两边的 Blockers，必要时按 J 节找人 |
| 2 | 没有护栏警告、没有新依赖申请、没有 allowlist 申请 |
| 3 | 改动更小更干净：`git diff --stat main...task/<ID>-a` 对比 `git diff --stat main...task/<ID>-b`，只动了卡片 Deliverables 里的文件 |
| 4 | G 节红旗更少 |
| 5 | `PROGRESS.md` 里未确认的 [H] 更少，没有 Blocker |

难以取舍时，可以开一个只读比较会话（结果写到文件，不提交；prompts §4b）：

```text
Two independent attempts at task <ID> exist on branches task/<ID>-a and task/<ID>-b. Do not modify either branch.
Compare them against the card and the golden tests using `git diff main...task/<ID>-a` and `git diff main...task/<ID>-b`: correctness risks, idempotency, error handling (no swallowed errors), scope (Deliverables only), test integrity, and simplicity.
Write the comparison to docs/takeaway/reviews/<ID>-pass2-compare.md with a recommendation and the top 3 concerns for each attempt. Do not commit. Then stop.
```

**第 4 步：收尾（你自己的终端）**

```bash
gh pr ready <胜者PR号>           # 草稿转正式，按 E.4 审核后合并
gh pr close <败者PR号>
cd ~/code/ppos-crm
git worktree remove ../ppos-<ID>-b      # 提示有未提交文件且确认不要了，就加 --force
git branch -D task/<ID>-b
git push origin --delete task/<ID>-b
# 胜者合并后：
git worktree remove ../ppos-<ID>-a
```

这些命令只应由你在自己的终端运行。其中 `git branch -D` 会被 hook 拦下，`git worktree remove`、`git push --delete`、`gh pr close` 不会被拦，所以不要让 GLM 做收尾。

### F.3 审查会话和规划会话

**审查会话（P0-B1、P1-19）**：只找问题，不改代码。P1-19 要在**两个全新的会话里各跑一遍**（run a、run b），第二遍不要给它看第一遍的结果。P0-B1 按卡片跑一遍；预算允许时可以照样再跑一遍独立的。

```bash
claude --effort max
```

指令（prompts §5a）：

```text
Task <ID> is a REVIEW task, run <a|b>. Find problems; do not fix them.
Card: docs/takeaway/tasks/<ID>-*.md. All code is read-only for you. The only files you may create or edit are the review file(s) named in the card's Deliverables (for P1-19: docs/takeaway/reviews/P1-19-security-run-<a|b>.md), PROGRESS.md, and docs/takeaway/tasks/proposed/ if the card asks for proposed cards.
Method: work through the card's scope systematically with Grep and ranged Read (at most 400 lines per read). Static analysis and local tests only: never run an exploit against any remote system, never read .env files, never print secrets, never open import_*.sql (real business data).
For each finding give: an ID, severity (Critical/High/Medium/Low), file:line, the exploit scenario in 2-4 steps (who sends what request and what they gain), the code quoted as evidence, a fix suggestion, and your confidence. Also list what you checked and found fine, and what you could not check.
Create branch task/<ID>-review-<a|b> from main, commit only those files, push, open a PR, then stop.
```

**合并两次审查的发现（你来做，可以让 GLM 起草）：**

1. 两遍都发现的：可信度高，直接进修复卡。
2. 只有一遍发现的：先让一个新会话证明它（为 RLS 问题写一个会失败的 pgTAP 测试，为函数写一个 deno 测试）。证明不了就记为"待观察"。
3. Critical / High **必须在 P1-20 上线前修完**。Medium 由你决定。
4. 用规划会话把要修的问题写成修复卡（prompts §5b）：

```text
Planning session at max effort. Do not change any code.
Inputs: docs/takeaway/reviews/<ID>-security-run-a.md and docs/takeaway/reviews/<ID>-security-run-b.md.
1. Merge the findings into one deduplicated table in docs/takeaway/reviews/<ID>-merged.md: finding, severity, file:line, found by (a / b / both), confidence.
2. For every Critical or High finding, and every finding listed here as "fix": <IDs>, draft a fix card at docs/takeaway/tasks/proposed/<ID>-F<n>-<slug>.md that follows docs/takeaway/tasks/TEMPLATE.md exactly. The first Acceptance item of each card must be a test that fails before the fix and passes after it.
3. Create branch task/<ID>-fix-planning from main, commit only those files, push, open a PR, then stop.
```

**规划会话（起草下一批任务卡）**：在一个阶段快做完时，或者 Follow-ups 攒多了时（prompts §6）。

```text
Planning session at max effort. Do not change any code.
Goal: draft the next task cards for <phase or topic, e.g. "P2 SaaS billing epic in docs/takeaway/tasks/BACKLOG.md">.
Read: docs/takeaway/reference/architecture.md, docs/takeaway/tasks/TEMPLATE.md, docs/takeaway/tasks/BACKLOG.md, docs/takeaway/PROGRESS.md (Follow-ups, Blockers, Done log), and <other inputs>.
Write each draft to docs/takeaway/tasks/proposed/<ID>-<slug>.md following TEMPLATE.md exactly: every table field filled; Deliverables as concrete paths; Acceptance as executable commands with expected results; "Out of scope" and "Stop and escalate if" non-empty. Each card must fit one session (about 3 hours, about 15 files or fewer). Set Mode (standard / tests-first / pass@2) and Reasoning effort (max for money, auth, RLS, Stripe, time logic and security; high otherwise). Never Flash for those areas.
If a card needs a new dependency, a change to architecture.md, or a legal/pricing decision, say so in "Open questions for the human" instead of assuming it.
Create branch task/PLAN-<yyyymmdd> from main, commit only files under docs/takeaway/tasks/proposed/, push, open a PR, then stop.
```

**你批准卡片：** 逐张读，直接在编辑器里改到你满意；然后把批准的卡从 `proposed/` 移到 `tasks/`：

```bash
git checkout task/PLAN-<yyyymmdd> && git pull
git mv docs/takeaway/tasks/proposed/<ID>-<slug>.md docs/takeaway/tasks/<ID>-<slug>.md
git commit -m "docs(tasks): approve <ID>"
git push
```

`tasks/*.md` 受保护，所以要给 PR 加标签 `protected-change-approved`（CI 会自动重跑），绿了再合并。不批准的卡留在 `proposed/` 或删除。

---

## G. 人工审查清单（给不写代码的审核人）

看 PR 的 "Files changed" 页。红色是删掉的行，绿色是新加的行。在页面上按 Ctrl/Cmd + F 搜下表里的关键字。

| # | 危险信号 | 怎么发现 | 处理 |
|---|---|---|---|
| 1 | **改了测试文件** | 文件名含 `.test.` 或路径含 `/tests/`，而卡片没要求改它；`tests/acceptance/` 下任何改动（唯一例外：新增的、和 `manifest.json` 登记一致的黄金测试副本，按 E.4 第 2 步核对） | 立即退回 |
| 2 | **断言变松了** | 测试文件里红色行是具体值（`toBe(1845)`、`toEqual(...)`），绿色行变成 `toBeTruthy()`、`toBeDefined()`、`toBeGreaterThan(0)`；pgTAP 里出现 `ok(true` | 立即退回 |
| 3 | **跳过测试** | `.skip`、`.only`、`.todo`、`skipIf`、`xit(`、pgTAP `skip(`（CI 会抓，但也要看）；或者测试被整段注释掉 | 立即退回 |
| 4 | **新依赖** | `package.json`、`pnpm-lock.yaml`、`deno.json` 有改动，而卡片没提 | 先看 `PROGRESS.md` 的 Dependency requests；没批准的退回 |
| 5 | **改了卡片以外的文件** | `gh pr diff <PR号> --name-only` 对照卡片 Deliverables 表 | 要求解释；无关的退回 |
| 6 | **"以后再说"** | 搜 `TODO`、`FIXME`、`later`、`temporary`、`for now`、`hack`、`workaround` | 钱、权限相关代码里出现就退回；其他让它写进 Follow-ups |
| 7 | **把被测的东西 mock 掉了** | 测试里 `vi.mock(` 了正在被测的那个文件；或者假对象直接返回测试期望的结果 | 立即退回 |
| 8 | **吞掉错误** | `catch {}`、`catch (e) { return null }`、`catch (e) { console.log(e) }`，尤其在 webhook、退款、结账代码里（出错了还返回 200） | 立即退回 |
| 9 | **写死的值正好等于测试数据** | `if (orderId === 'test-...')`、`return 1845`、`NODE_ENV === 'test'`、`isTest` 之类的特殊分支 | 立即退回（典型的钻空子） |
| 10 | **超大改动** | `git diff --stat` 最后一行：一张卡新增超过约 800 行（不算 `pnpm-lock.yaml` 和自动生成的 `database.types.ts`），或改了 20 个以上文件 | 要求拆分或解释 |
| 11 | **关掉检查** | `eslint-disable`、`@ts-ignore`、`@ts-expect-error`、`@ts-nocheck`、`as any`、tsconfig 里 `strict` 改成 false、测试配置里 `exclude` 了验收目录、动了 `.github/` 或 `scripts/guards/` | 立即退回（`as any` 守卫抓不到，要你看） |
| 12 | **只有声明没有输出** | PR 的 Evidence 区空着或只写 "all tests pass"；`PROGRESS.md` Done log 没贴输出 | 退回，要求贴真实输出 |
| 13 | **证据和 CI 对不上** | 贴的测试数和 CI 日志不同；贴的提交号不是 PR 最新提交 | 立即退回，以 CI 为准 |
| 14 | **改了已合并的数据库迁移** | `supabase/migrations/` 下的旧文件显示为修改（M），而不是新增（A） | 立即退回（CI 也会红） |
| 15 | **改了业务规则或违规措辞** | 45 改成别的数、金额出现小数（`0.45`、`toFixed`、`parseFloat`）、`refund_application_fee` 的取值变了、顾客文案出现 "card fee" / "surcharge" / "service charge"（都是禁用说法）、出现新的环境变量名或写死的网址 / key | 立即退回；规则要改是你的决定，先改文档 |
| 16 | **批准标签不是你加的** | PR 一打开就已经带 `protected-change-approved`，或者 PR 页面的时间线（Conversation 页）显示这个标签不是你加的；终端：`gh pr view <PR号> --json labels` | 立即退回（hook 拦不住 `gh pr create --label …` 这类写法） |

**规则：** 第 1、2、3、7、8、9、11、13、14、15、16 条出现任何一条，不合并。其他几条要求它解释或修正。

---

## H. 配额、成本与节奏

### H.1 推理强度政策

| 强度 | 用在哪 | 卡 |
|---|---|---|
| `max` | 设计 / 技术试验、钱、安全 / 权限、时间逻辑、Stripe、排查失败、规划会话、审查会话 | P0-03、P0-B1、P1-01、P1-03、P1-05、P1-09、P1-11、P1-12、P1-14、P1-15、P1-19；任何"上一次失败了"的续跑 |
| `high` | 常规功能 | P0-01、P0-02、P0-04、P1-02、P1-04、P1-06、P1-07、P1-08、P1-10、P1-13、P1-16、P1-17、P1-18、P1-20 |
| `low` | 不用于写代码 | — |
| `medium` / `xhigh` | **不用**（可能被当成 max，见 D.8） | — |

卡片表头的 `Reasoning effort` 永远优先于这张表。

### H.2 Flash 的使用范围

- **可以：** 文档整理、文字润色、`en-GB.ts` 字典里改措辞、很简单的界面调整（不涉及数据和权限）。启动方式：`claude --model 'glm-5.3-flash[1m]'`（加引号，避免 zsh 把方括号当通配符），再用 `/status` 确认。
- **永远不可以：** 钱、登录 / 权限、RLS、Stripe、数据库迁移、webhook、退款、定时任务。所有 P0 / P1 的卡都按卡片写的 `Model: glm-5.3`。

### H.3 节奏

| 规则 | 说明 |
|---|---|
| 一会话一卡 | 做完开 PR 就结束会话。下一张卡开新会话 |
| 同一时间只跑一个会话 | 省额度；并且上一张卡的 PR 合并后再开下一张（见 E.1 第 2 步），否则 `PROGRESS.md` 一定冲突。pass@2 也建议先后跑 |
| 会话时长 | 以卡片 `Session budget` 为准；卡片没写就按 2–3 小时；无人值守用 `timeout -s INT -k 60 5400`（90 分钟，见 E.5） |
| 时段 | 工作日英国晚上和周末（非高峰）跑 max 强度的卡和 pass@2；工作日上午高峰只做审核、不跑重活 |
| 每周节奏（建议） | 工作日晚上每晚一张常规卡；周末做 tests-first 的提案审阅、pass@2、审查会话；每个阶段结束前开一次规划会话 |

### H.4 额度用完怎么办

Coding Plan **没有超额付费**：用完就停，等 5 小时窗口或每周额度重置（【未核实】的报道）。额度用完时 GLM 连交接都写不了，所以：

1. **平时就要求小步提交、随时更新 `PROGRESS.md`**（开场指令已要求）。这样额度突然用完也不丢东西。
2. 额度快用完（例如剩 10–15%）：主动粘贴 E.3 的指令 ⑥，让它干净地收尾。
3. 已经用完了：结束会话（`/exit`），什么都不用删。未提交的改动留在原处，下一个会话会通过 SessionStart hook 看到。
4. 重置后：开新会话，用 E.6 的续跑指令。
5. 一周里两次以上被每周额度卡住：考虑升级 Max，或者把卡片拆小。
6. **不要**为了继续工作而换用来路不明的第三方网关或转售账号。

### H.5 成本参考

Coding Plan Pro 约 $80/月（【未核实】，以 z.ai/subscribe 为准）。目前 CI 不调用 GLM，所以没有按量付费的开销。其他工具费用见 [`01-upgrade-plan.md`](01-upgrade-plan.md)。

---

## I. 故障排查

| 现象 | 可能原因 | 怎么做 |
|---|---|---|
| 来回改同一段代码，同一个错误反复出现 | 抓住了错误假设 | 按 Esc，粘贴 E.3 指令 ①。第 3 次失败就让它写 Blocker 并结束；你决定是改卡、换 pass@2，还是按 J 节找人 |
| 超过 10 分钟没有任何输出 | 请求卡住（已知案例多在第三方网关）或高峰拥堵 | Esc → `continue`。再卡：`/exit`，新会话用 E.6 续跑。确认 `ANTHROPIC_BASE_URL` 是 `api.z.ai`，换到非高峰 |
| 报 429（请求太多） | 高峰拥堵、并发太多 | 等几分钟；同时只开一个会话；改到非高峰；不要用第三方网关 |
| 报额度用完 | 5 小时或每周上限 | 见 H.4 |
| 网页文字或代码里出现中文，cjk-lint 失败 | 串语言 | E.3 指令 ⑤。商户中文只能在 `apps/merchant/src/i18n/zh-CN.ts` |
| 反复调用 ToolSearch，绕圈子 | Claude Code 的 tool_reference 兼容问题（旧版 GLM 出现过） | 在 `~/.claude/settings.json` 的 env 里加 `"ENABLE_TOOL_SEARCH": "false"`，重启 Claude Code |
| 同一个 `[ppos guard]` 拦截反复出现，它在换办法绕 | 钻空子的前兆 | 粘贴 E.3 指令 ③。如果确实是合理需求（护栏误拦），由你亲自执行那一步，或按 K 节调整护栏 |
| Stop hook 每次结束都挡住、贴出失败输出 | ① 它的改动确实没通过 `verify:quick`；② main 本身就是红的；③ 检查超过 280 秒超时 | ①：让它修，3 次不行就写 Blocker；②：先单独修 main；③：显示 `exit timeout` 时把情况写进 Follow-ups，让一张卡专门提速测试。注意：同一次结束它只挡一次，第二次会放行 |
| `/status` 显示的不是 glm-5.3；或质量突然大幅下降 | helper 重跑后槽位被改回 Flash；用了 `--model` 别的值；Coding Plan 后台问题（GLM-5 时期官方承认过"精度损失"） | 回到 D.4 检查；质量突然崩坏（乱码、混语言）时先停，查 Z.ai 公告，换时段再试 |
| 自动压缩后它忘了卡片内容、重复已做过的事 | 上下文压缩丢了细节 | SessionStart hook 会在压缩后重新注入 `PROGRESS.md` Current；让它"Re-read the card and PROGRESS.md before continuing"。还不行就 `/exit`，新会话续跑。预防：卡片小、Current 写清楚、不要贴大段日志（只贴最后 40 行） |
| CI 红，但它说本地全绿 | 本地没跑数据库 / e2e（`SKIPPED (no local supabase)`）；锁文件没提交；贴的是旧输出 | 以 CI 为准。新会话粘贴下面"CI 失败"指令 |
| 本地 `pnpm verify` 显示 `SKIPPED (no local supabase)` | Docker 没开或本地 Supabase 没启动 | 打开 Docker Desktop，让它跑 `supabase start`；或接受由 CI 跑数据库测试 |
| 说要改某文件，但一直没写出来；或大文件被截断 | 大文件写入问题、128K 输出上限 | "Make this change with several small Edit calls, one function at a time. If the file is over 300 lines, propose a split first." |
| Stripe 报 unknown parameter，或守卫报 `stripe-*` | 用了旧版 Stripe 知识 | "Read docs/takeaway/reference/stripe-endive.md and the official Stripe docs page for this call with the web-reader tool, record the URL in PROGRESS.md, then fix." |
| 它要装新包，被 hook 拦 | 白名单里没有 | 看 `PROGRESS.md` Dependency requests，按 K.4 批准或拒绝 |
| hook 输出 `[ppos guard] internal error (allowing)` | hook 跑起来了但出错，已放行：多半是 `scripts/guards/policy.json` 不是合法 JSON，或脚本有 bug | 本次靠 CI 兜底；之后按 K.6 修 |
| 没有任何 `[ppos guard]` 提示，Claude Code 显示 hook 命令失败（例如 `node: command not found`） | 找不到 `node`，所有护栏都没生效 | 立即停下会话；装好 Node（D.1），重开终端，用 D.6 的护栏测试验证后再开工。每次换电脑、升级系统或 Node 后都做一次 D.6 测试 |
| PR 页面显示 "This branch has conflicts that must be resolved" | 另一个 PR 先合并了，两边都改了 `PROGRESS.md`（最常见） | 开新会话，粘贴下面的"合并冲突"指令；如果冲突的不只是 `PROGRESS.md`，GLM 会停下，写一条 Blocker 交给你决定 |
| 推分支被拦，提示 "Never push to main"，但分支名不是 main | `pre-bash` 的"禁止推 main"规则会误拦以 `-main` 结尾的分支名（例如 `task/X-main`） | 让它改名再推：`git branch -m task/<ID>-<新slug>`（slug 不要以 main 结尾） |

"CI 失败"指令（prompts §9a）：

```text
CI failed on PR #<n> for task <ID> (branch task/<ID>-<slug>). Failing job: <job name>. Log tail:
<paste the last 40-80 lines from `gh run view <run-id> --log-failed`>
Check out the branch, reproduce the failure locally with the same command CI runs, find the root cause and fix the code. Do not edit, skip or weaken tests or CI config. Paste the before/after output into PROGRESS.md and the PR, commit, push, and stop.
```

"合并冲突"指令：

```text
PR #<n> for task <ID> (branch task/<ID>-<slug>) has merge conflicts with main. Check out the branch, run `git fetch origin` and `git merge origin/main` (no rebase, no force push). In docs/takeaway/PROGRESS.md keep every Done log row from both sides and rewrite "## Current" as this task's handoff. If any file other than PROGRESS.md conflicts, run `git merge --abort`, write a "## Blockers" entry listing those files, and stop. Otherwise run `pnpm verify`, paste its last 20 lines into the PR, commit the merge, push, and stop.
```

---

## J. 何时停下来找人；何时请更强的模型复核

### J.1 必须停下、由你或专业人士决定的情况

- 法律和合规措辞（服务费展示、条款、过敏原说明）→ 律师。VAT 怎么算 → 会计。GLM 只做标出 `LAWYER REVIEW REQUIRED` 的草稿。
- 任何涉及生产环境、Stripe 正式（live）账户、真实资金的操作 → 只有你，按 P1-20 的上线手册做。
- 同一张卡连续两次会话都以 Blocker 结束，或 pass@2 两份都没通过。
- 审查发现 Critical 级问题。
- CRM 加固 P0-B2…B4 还没有全部合并 → **不能执行 P1-20 上线**（这是正式门槛，architecture §15）。
- 你怀疑已经有数据泄露（例如 CRM 数据被人改过）。见下面"个人数据泄露"。
- main 上 CI 变红且原因不明。
- GLM 提议改价格、退款政策、服务费，或改 `architecture.md` 里标为 FROZEN 的内容（要先写 ADR）。

这时可以花钱请一位自由职业的工程师做几个小时的审查，重点：P1-05（数据库权限）、P1-19 合并后的修复清单、P1-20 上线前检查。

**怀疑个人数据泄露（CRM 或平台）：** 先记录发现的时间，保留日志，**72 小时内**联系律师，判断是否要向 ICO 报告（UK GDPR 第 33 条；见 `reference/uk-compliance.md` 的 UKC-DP-08、UKC-DP-09）；技术排查可以同时找工程师，但不能代替律师的判断。

### J.2 可选：用更强的模型做"第二意见"

GLM 一直是执行者。更强的模型（例如 Anthropic Claude 或 OpenAI 的旗舰模型）只做**只读审查**，用在出错代价最高的 PR 上：P1-05、P1-09、P1-11、P1-12、P1-14、P1-15，以及 P1-19 合并后的修复。有第三方报告称"先让 GLM-5.3 做，失败的再交给更强的模型"总体效果好、成本低（【未核实】），思路和这里一致：只把最贵的风险交给贵的模型。

做法：`gh pr diff <PR号> > ~/pr-<ID>.diff`，连同任务卡一起交给审查模型。**只给 diff 和卡片，不给 `.env`、密钥、真实数据。** 指令：

```text
You are reviewing a pull request written by another AI agent for a UK takeaway ordering platform (Stripe Connect direct charges, Supabase with RLS). Attached: the task card and the PR diff. The tests in tests/acceptance/ were written and frozen by humans.
Report only real problems, most severe first: security holes (RLS bypass, missing auth or membership checks, webhook signature or idempotency gaps), money errors (floats, wrong application fee, refund policy), swallowed errors, tests that were weakened or do not test what they claim, and anything that contradicts the task card. For each: file:line, what goes wrong in a concrete scenario, and a suggested fix. Say explicitly if you found nothing serious.
```

审查意见回来后，用 E.4 的"Review feedback"指令交给 GLM 修。

---

## K. 附：维护护栏（只有你做）

护栏文件包括：`AGENTS.md`、`CLAUDE.md`、`.npmrc`、`.claude/**`、`.github/**`、`scripts/guards/**`、`scripts/acceptance/**`、`docs/takeaway/**`（GLM 可写的例外：`PROGRESS.md`、`reference/versions.md`、`acceptance-proposals/**`、`adr/**`、`tasks/proposed/**`、`reviews/**`），以及所有 `tests/acceptance/` 目录。完整列表在 [`scripts/guards/policy.json`](../../scripts/guards/policy.json)。

### K.1 方法一（推荐）：你自己在编辑器里改

hook 只管 GLM 的工具调用，不管你。

```bash
git checkout main && git pull
git checkout -b chore/guardrails-<topic>
# 用编辑器修改
node scripts/guards/run-all.mjs
git add <改动的文件> && git commit -m "chore(guards): <what> "
git push -u origin chore/guardrails-<topic>
gh pr create --fill
```

然后给 PR 加标签 `protected-change-approved`（终端：`gh pr edit <PR号> --add-label protected-change-approved`；或者在 PR 页面右侧 Labels 里勾选），CI 会自动重跑，绿了合并。

### K.2 方法二：让 GLM 帮你改（维护会话）

```bash
PPOS_GUARD_OVERRIDE=1 claude --effort max
```

- 只在这一条命令前加，**不要写进 shell 配置文件**，用完就退出会话。
- 这个开关放开的：改受保护文件（pre-edit）、用 shell 写受保护文件、修改已合并的迁移、编辑 CRM 旧文件、不分段读 `index.html`。所以维护会话里不要顺便做 CRM 的事。
- 它**不会**放开的：读 `.env` 等密钥文件、`pre-bash` 的危险命令清单（强推、推 main、`freeze.mjs`、合并 PR、加标签、`supabase link` 等）、整体重写 `index.html`。
- 给它一个范围很窄的指令，例如（prompts §12）：

```text
Maintenance session approved by the human. Change only <file(s)> to <exact change>. Do not touch any other file. Show me the full diff (`git diff`) and stop; do not commit.
```

- 结束后你自己看 `git diff`，然后按 K.1 的提交、标签、合并流程走。

### K.3 `protected-change-approved` 标签

- 只有你能加。`pre-bash` 拦截常见写法（`gh pr edit --add-label`、`gh label`、`gh api …/labels`），但不是绝对的：例如 GLM 开 PR 时用 `gh pr create --label protected-change-approved` 就拦不住。所以每次都按 G 节第 16 条核对标签是不是你加的。
- 作用：CI 的 protected-paths 检查看到这个标签就放行受保护文件的改动。
- 加标签会自动触发一次新的 CI 运行，protected-paths 会读到它；之后再推的提交也会带着标签运行。去掉标签同样会重跑 CI（受保护改动会重新变红）。只有 CI 没反应时才推一个空提交：`git commit --allow-empty -m "chore: re-run CI" && git push`。
- 只在你逐行看过受保护文件的改动之后才加。

### K.4 批准新依赖

1. GLM 在 `PROGRESS.md` → `## Dependency requests` 写：包名、用途、npm 网址、周下载量、考虑过的替代方案。
2. 你核实：在 npmjs.com 打开这个包，确认名字一字不差、发布者可信、周下载量大、有正规的代码仓库链接、不是仿冒名（例如多一个字母）。
3. 在 [`reference/approved-deps.json`](reference/approved-deps.json) 里加一行：npm 包加到 `"npm"`（`"包名": "用途"`）；Deno 用的加到 `"deno"`（带 `npm:` 或 `jsr:` 前缀）；只用 `npx` 运行的工具加到 `"tools"` 的 `"list"`。
4. 按 K.1 提交、加标签、合并。之后 GLM 才能安装，而且必须是精确版本（CI 的 `deps-allowlist.mjs` 会检查有没有 `^`、`~`）。

### K.5 给 banned-patterns 加例外（allowlist）

有时合理的代码会碰到禁用规则，但先想想能不能不碰。例如 P1-11 的测试按 `reference/stripe-endive.md` §6 断言 `Object.keys(params)` 的完整列表，这样不用写出 `payment_method_types` 就能证明它不存在，所以不需要例外；GLM 为这种情况申请例外时，直接拒绝并指给它看 §6。真需要例外时，在 [`scripts/guards/allowlist.json`](../../scripts/guards/allowlist.json) 的 `entries` 里加一条，只对这一个文件、这一条规则生效，格式如下：

```json
{ "rule": "<规则 id，例如 money-float>", "file": "<一个具体文件的路径>", "reason": "<为什么这里必须这样写>", "approvedBy": "<你的名字>", "date": "<YYYY-MM-DD>" }
```

（规则 id、文件路径、日期按实际填写。）然后按 K.1 流程合并。**不要**为了让 GLM 通过检查而大面积放行；没有"整个目录"级别的例外。

### K.6 其他维护

| 想做的事 | 怎么做 |
|---|---|
| 修改已冻结的黄金测试 | 按 F.1 末尾"如果会话 B 证明某个冻结的测试确实错了"那几步做：把 `docs/takeaway/acceptance/<ID>/` 里的**全部**测试文件复制到 `acceptance-proposals/<ID>/`，`proposal.json` 列出全部文件（和 manifest 一致），只改错的那一个测试，再运行 `node scripts/acceptance/freeze.mjs <ID> --replace`，用 `git diff docs/takeaway/acceptance/manifest.json` 确认文件数没有变少，走 K.1 流程。`--replace` 会整体替换 manifest 里这张卡的条目，提案里漏掉的文件会从 manifest 消失 |
| 采纳 GLM 在 Proposed doc changes 里的建议 | 自己在编辑器里改对应文件，走 K.1 流程；然后在下一次开场指令里告诉它"已采纳" |
| 增减受保护路径 | 改 `scripts/guards/policy.json`（hook 和 CI 共用这一个文件） |
| CRM 任务 | 启动时加 `PPOS_ALLOW_LEGACY=1`（只放开 CRM 文件的编辑）。`index.html` 仍然只能分段读（每次 ≤ 400 行）、只能小步 `Edit` |
| hook 出错放行（`internal error (allowing)`） | 检查 `scripts/guards/policy.json` 是不是合法 JSON（运行 `node -e "JSON.parse(require('fs').readFileSync('scripts/guards/policy.json','utf8'))"`，没有输出就是合法的）；改完用 D.6 的测试指令验证。没有任何 `[ppos guard]` 提示、只显示 hook 命令失败时，是找不到 `node`（`node -v`），见 I 节 |
| 补上 hook 的已知缺口 | `pre-bash` 拦不住 `gh pr create --label …`、`gh api …/merge`、不带完整路径的 `node freeze.mjs`。要补上，就按 K.1 改 `.claude/hooks/pre-bash.mjs` 的规则；在那之前靠 G 节第 16 条和你的合并把关 |
