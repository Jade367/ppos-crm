# GLM-5.3 事实档案

> **用途**：这个项目写代码的 AI 是 GLM-5.3（智谱 / Z.ai）。研究阶段查到的模型事实都集中在本文件，供 [03-execution-handbook.md](../03-execution-handbook.md)、[01-upgrade-plan.md](../01-upgrade-plan.md) 和 [02-tech-roadmap.md](../02-tech-roadmap.md) 引用。
> **资料截止**：2026-10-11。模型事实只取自三份研究文件：官方资料调研（下称 A）、社区资料调研（B）和怀疑式交叉核查（C）。**A、B 与 C 不一致时，以 C 为准。** 第 9 节的 Claude Code 设置另外对照了 Claude Code 官方文档（code.claude.com）。
> **读者**：老板本人。GLM 不读这个文件，它要遵守的规则写在 [AGENTS.md](../../../AGENTS.md)、[CLAUDE.md](../../../CLAUDE.md) 和任务卡里。技术规格以 [architecture.md](architecture.md) 为准，本文件只讲模型本身。

**状态标记**（每条事实后面都带一个）：

| 标记 | 含义 |
|---|---|
| **[已核实]** | C 从可直接读取的一手来源确认（GitHub、npm 包源码、Claude Code 文档、Anthropic 文章）。第 9 节标"[已核实]（Claude Code 文档）"的几条，是规划阶段另行对照 Claude Code 官方文档（code.claude.com）确认的 |
| **[已更正]** | 说法有出处，但 C 改了细节。常见情况：问题其实出在 GLM-5.2、Flash 或第三方网关，而不是 GLM-5.3 |
| **[无法核实]** | 来源网站被屏蔽，C 无法确认。**不等于错**，但不能拿来做决定 |
| **[已否定]** | C 找到了反证 |
| **[摘要]** | 只来自搜索引擎对 docs.z.ai 等页面的摘要，C 没有单独判定 |
| **[未核查]** | 只出现在 A 或 B 中的一份，C 没有处理 |

---

## 1. 核查方法与局限

| 项目 | 情况 |
|---|---|
| 被屏蔽的网站 | docs.z.ai、z.ai、huggingface.co、bigmodel.cn、Together AI、Artificial Analysis、Handshake、NIST、MarkTechPost、arXiv、Hacker News 等（返回 403 或 DNS 失败）。核查阶段的网页搜索预算也已用完，C 无法再搜索 |
| 直接读到的一手来源 | zai-org/GLM-5 的 README、官方 benchmark 图、commit 记录和 issues；zai-org/ZCode 源码；官方 npm 包 `@z_ai/coding-helper` v0.1.1（下载后读了源码）；Cline 仓库里由 models.dev 生成的模型目录（catalog）；Cline、OpenCode、Crush、Goose、Roo Code、Kilo 的仓库文档；aws-samples #114；Claude Code 文档 [code.claude.com/docs/en/memory](https://code.claude.com/docs/en/memory)；Anthropic 文章 [GLM-5.3 and the spread of advanced cyber capabilities](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities) |
| docs.z.ai 的内容 | 只有搜索摘要，标为 [摘要] |
| C 对两份调研的评价 | A 更可靠，唯一的实质错误是"Claude Code 不读 AGENTS.md"（[已否定]，见第 8 节）。B 的风险证据有价值，但经常把 GLM-5.2、GLM-5.3-Flash 或第三方网关（OpenClaw、Ollama cloud、Fireworks、NVIDIA NIM、自建 SGLang）的问题算到 GLM-5.3 头上。B 的支持工具清单错误地包括 Pi，还把已关停的 Roo Code 当作可用 |
| 全部无法核实的部分 | Coding Plan 的价格、额度和高峰时段；所有独立 benchmark（Together、Artificial Analysis、FriendliAI、Vals、Arena）。决定前先看第 11 节 |

来源：C 的总评，主要依据 [github.com/zai-org/GLM-5](https://github.com/zai-org/GLM-5) 和 [npm @z_ai/coding-helper](https://www.npmjs.com/package/@z_ai/coding-helper)。

---

## 2. 型号与版本

| API id | 发布日期 | 规模 / 架构 | 输入 | 上下文 | Coding Plan | 备注 | 来源 |
|---|---|---|---|---|---|---|---|
| `glm-5.3` | 2026-08-14 在 Coding Plan 上线 [已核实]；按量 API 是同日还是约 08-18 [无法核实]；开放权重 commit 日期 2026-08-27 [已核实] | 744B 总参数 / 40B 激活的 MoE，基座和 GLM-5.2 **相同**，提升全部来自 post-training [已核实] | 只有文本 | 1M | 所有档位 [已核实] | **本项目的主力模型**。权重：`zai-org/GLM-5.3`（FP8）、`zai-org/GLM-5.3-BF16`。Bedrock id 为 `us.zai.glm-5.3` / `global.zai.glm-5.3` [已核实]，2026-10-05 起开放给合格客户 [未核查] | [GLM-5 README](https://github.com/zai-org/GLM-5)、[commits](https://github.com/zai-org/GLM-5/commits/main)、[aider-desk #960](https://github.com/hotovo/aider-desk/issues/960) |
| `glm-5.3-flash` | 2026-08-26 [已核实] | 320B / 18B 激活。新训练的基座，hybrid sparse + linear attention，mHC，30T token 多模态语料 [已核实] | 文本 + 图片（aider-desk #960 称还支持视频和 PDF） | 1M | 所有档位 [已核实]；额度约为 5.3 的 3 倍 [无法核实] | 用于 Claude Code 的 HAIKU 槽位和看截图。**钱、登录权限、RLS、Stripe 和迁移相关的任务不用它**（见任务卡模板） | [GLM-5 README](https://github.com/zai-org/GLM-5) |
| `glm-5.3-flashx` | 2026-09-18（catalog；Wikipedia 写 09-21） | 未公布 | — | — | **不在** Coding Plan 内，只能按量付费 [已核实，依据是第三方 catalog] | 本项目不用 | [Cline catalog](https://github.com/cline/cline/blob/main/sdk/packages/llms/src/catalog/catalog.generated.ts) |
| `glm-5.3-highspeed` | catalog 写 2026-08-14 | — | — | — | 只出现在第三方 catalog 的 Coding Plan 条目中 | 没有任何官方来源 [已核实为"仅第三方"] | [Cline catalog](https://github.com/cline/cline/blob/main/sdk/packages/llms/src/catalog/catalog.generated.ts) |
| "GLM-5.3-Fast" | — | — | — | — | — | Baseten、CoralBricks 等托管商自己的部署变体，不是 Z.ai 的型号 [已更正] | [Cline catalog](https://github.com/cline/cline/blob/main/sdk/packages/llms/src/catalog/catalog.generated.ts) |
| `glm-5.2` | 2026-06-16（另一说是 Coding Plan 06-13）[未核查] | 744B-A40B，IndexShare | 文本 | 1M | 请求**自动转给 5.3** [已核实] | 可以关闭 thinking（helper 的 Codex 元数据里有 `none`），`reasoning_effort` 只接受 `high`、`max`。从 5.2 沿用的"关闭 thinking"配置用在 5.3 上会报错 | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| `glm-5.1` | 2026-04-07 [未核查] | 744B-A40B | 文本 | 200K | 自动转给 5.3 [已核实] | — | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| `glm-5` | 约 2026-02-11/12（AWS 模型卡写 02-11）[未核查] | 744B-A40B，DeepSeek Sparse Attention，预训练 28.5T token | 文本 | 200K | — | 技术报告 arXiv 2602.15763。下文好几条"家族风险"证据来自 GLM-5 | [arXiv 2602.15763](https://arxiv.org/abs/2602.15763) |
| 更新的型号 | — | — | — | — | — | 截至 2026-10-11 没有发现 GLM-5.4 / 5.5 / 6 的正式发布，5.5 只见于传闻。ZCode 的模型列表里还有 `glm-5-turbo`、`glm-5v-turbo`，发布日期不明 [未核查] | [GLM-5 README](https://github.com/zai-org/GLM-5) |

授权：GitHub 仓库是 Apache-2.0。Gigazine 报道权重许可要求年收入超过 100 亿美元的公司先通过 Z.ai 安全审查 [未核查]，对本项目没有影响。

---

## 3. 规格

### 3.1 模型参数

| 项目 | 事实 | 状态 | 来源 | 对本项目的含义 |
|---|---|---|---|---|
| 架构 | 744B / 40B 激活 MoE，基座同 5.2。GLM-5 系列用 DSA，5.2 加了 IndexShare（1M 上下文下每 token FLOPs 少 2.9 倍）和改进的 MTP 层 | [已核实] 规模和基座；其余 [未核查] | [GLM-5 README](https://github.com/zai-org/GLM-5) | 基座没有重新训练，所以 GLM-5.2 的行为问题很可能延续到 5.3（见第 7 节"测量对象"一栏） |
| 上下文 | 1M。官方 helper 写 1,048,576，models.dev 写 1,000,000，AWS 模型卡写 1M | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) | 能放下整个 CRM（`index.html` 实测 793,422 字节、11,177 行，估算约 220K tokens），但放得下不等于读得准 |
| 长上下文质量 | 没有 GLM-5.3 专门的长上下文评测。GLM-5 论文称约 100K tokens 以后准确率明显下降 | [无法核实]（arXiv 被屏蔽）；对象是 GLM-5 | [arXiv 2602.15763](https://arxiv.org/pdf/2602.15763) | 会话要短，早压缩。项目设置把自动压缩窗口设为 200000（第 9 节） |
| 最大输出 | 128K。Z.ai catalog 写 131,072；Bedrock 硬限制 128,000（128001 报 ValidationException）。thinking 和回答共用这个额度 | [已核实] | [aws-samples #114](https://github.com/aws-samples/sample-per-model-bedrock/issues/114) | `max_tokens` 最多填 128000。`index.html` 约 220K tokens，**不可能一次整体重写**，只能小范围 `Edit` |
| 输入模态 | 只接受文本。Coding Plan 账户发给 5.3 的图片由服务端中转处理，不是模型自己看图，ZCode 因此对 5.3 隐藏了"支持图片"标记 | [已核实] | [ZCode modelVisionBadge.ts](https://github.com/zai-org/ZCode/blob/main/packages/ui/src/lib/modelVisionBadge.ts) | 看不到界面。UI 用 Playwright 按 role/label 断言，视觉由人在 Vercel Preview 上检查；必须看图时用 Vision MCP 或 Flash |
| Thinking | **始终开启，不能关闭**。发送 `thinking.type: "disabled"` 会报错 | [已核实]（依据是二手来源：glm-acp-agent README、OmniNode PR #3114 转引 z.ai 指南） | [glm-acp-agent](https://github.com/stefandevo/glm-acp-agent) | 每次调用都消耗推理 token，再小的改动也一样 |
| `reasoning_effort` | 取值 `low` / `high` / `max`，**默认 `max`**；不认识的值也按 `max` 处理。`low` 只有 5.3 和 5.3-Flash 支持 | [已核实]。**有冲突证据**：glm-acp-agent 给 5.3 提供 Minimal/Low/Medium/High/X-High/Max 六档 | [GLM-5 README](https://github.com/zai-org/GLM-5) | harness 发 `medium`、`xhigh` 等值时可能悄悄按 `max` 运行（最贵）。要实测，见第 9 节 |
| effort 与 token | Z.ai Code Bench：max 约 34.5%，每题约 75K 输出 token；high 约 31.4%，约 50K token | [无法核实]（README 只确认"比 5.2 提升 50%"） | [docs.z.ai GLM-5.3](https://docs.z.ai/guides/llm/glm-5.3) | 任务卡模板规定日常用 `high`、难题用 `max`。这个分法合理，但上面的数字不能当依据 |
| `clear_thinking` | chat template 默认 `false`，即保留前几轮的 thinking；README 说普通聊天传 `true`。Z.ai Flash 文档和 Together 建议 agent 循环保持 `false`，并把 `reasoning_content` 原样按顺序传回 | 默认值 [已核实]；建议部分 [未核查] | [GLM-5 README](https://github.com/zai-org/GLM-5) | 只影响自己写脚本调 API 的情况，Claude Code 用户不用管 |
| 采样参数 | temperature 1.0，top_p 0.95 | [已核实]；"两个参数只调一个"这条建议 [无法核实] | [OmniNode PR #3114](https://github.com/OmniNode-ai/omnimarket/pull/3114) | 保持默认 |
| 工具调用流式 | 流式输出工具参数需要同时设 `stream=true` 和 `tool_stream=true`，`tool_stream` 默认 `false` | [无法核实] | [docs.z.ai stream-tool](https://docs.z.ai/guides/capabilities/stream-tool) | 只影响自写脚本 |
| `tool_choice` | 据称只支持 `auto`（aihubmix） | [无法核实] | [docs.z.ai migrate](https://docs.z.ai/guides/overview/migrate-to-glm-new) | 同上 |
| 知识截止日期 | 没有公布（OpenCode、Modelgrep、Magica 的列表里都是空的） | [未核查] | [OpenCode data](https://opencode.ai/data/zhipuai/glm-5-3) | 晚于 2026-08 的 API 变化它肯定不知道，例如 Stripe `2026-09-30.endive`，所以要配 [stripe-endive.md](stripe-endive.md) 和 guards |
| 速度 | 约 66–76 输出 token/秒；`low` 档首个回答 token 也要约 32 秒 | [无法核实] | [Artificial Analysis](https://artificialanalysis.ai/models/glm-5-3) | 预期会慢，这是正常现象 |

### 3.2 API 端点

| 用途 | 地址 | 状态 | 来源 |
|---|---|---|---|
| Anthropic 兼容（Claude Code、Factory Droid） | `https://api.z.ai/api/anthropic` | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| Coding Plan，OpenAI 兼容（Cline、Kilo、Crush、OpenCode、Droid） | `https://api.z.ai/api/coding/paas/v4`，模型列表在 `/models` | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| OpenAI Responses API（helper 为 Codex 配置，`wire_api: "responses"`） | `https://api.z.ai/api/v1` | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| 按量付费，OpenAI 兼容（**脚本和 CI 用这个**） | `https://api.z.ai/api/paas/v4` | [无法核实]（helper 源码里没有，和 Z.ai 早先的文档一致） | [docs.z.ai pricing](https://docs.z.ai/guides/overview/pricing) |
| 中国大陆 | `open.bigmodel.cn` 下的对应路径 | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |

B 提醒：工具接错端点的话，Coding Plan 额度不会生效，会按量计费 [未核查，单一来源]。

### 3.3 各 harness 中的模型 id

| 环境 | 写法 | 状态 | 来源 |
|---|---|---|---|
| Claude Code | `glm-5.3[1m]`、`glm-5.3-flash[1m]`。`[1m]` 后缀不能省，否则拿不到 1M 窗口 | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| OpenCode | provider `zai-coding-plan`，模型 `zai-coding-plan/glm-5.3`（中国大陆是 `zhipuai-coding-plan/...`） | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| Crush | provider `zai`，`base_url` 为 `https://api.z.ai/api/coding/paas/v4` | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| Cline | provider "Z AI"，entrypoint 选 `api.z.ai` | [未核查] | [Cline glm-thinking.ts](https://github.com/cline/cline/blob/main/sdk/packages/llms/src/providers/routing/glm-thinking.ts) |
| Amazon Bedrock | `us.zai.glm-5.3`、`global.zai.glm-5.3` | [已核实] | [aws-samples #114](https://github.com/aws-samples/sample-per-model-bedrock/issues/114) |
| Hugging Face / Together | `zai-org/GLM-5.3` | [已核实]（README 下载表） | [GLM-5 README](https://github.com/zai-org/GLM-5) |
| OpenRouter / NVIDIA NIM | `z-ai/glm-5.3`（OpenRouter 另有快照 `z-ai/glm-5.3-20260816`） | [未核查] | [OpenRouter](https://openrouter.ai/models/z-ai/glm-5.3) |

### 3.4 按量付费价格（每 100 万 token，美元）

| 型号 | 输入 | 缓存输入 | 输出 | 状态 | 来源 |
|---|---|---|---|---|---|
| `glm-5.3` | 1.40 | 0.26 | 4.40 | [摘要]，与 Cline catalog 一致 | [docs.z.ai pricing](https://docs.z.ai/guides/overview/pricing) |
| `glm-5.3-flash` | 0.15 | 0.03 | 0.50 | [摘要] | [docs.z.ai pricing](https://docs.z.ai/guides/overview/pricing) |
| `glm-5.3-flashx` | 0.37 | 0.075 | 1.25 | [已核实]（第三方 catalog） | [Cline catalog](https://github.com/cline/cline/blob/main/sdk/packages/llms/src/catalog/catalog.generated.ts) |

缓存存储费"限时免费"。有一个聚合站（costperprompt）称 GLM-5.3 的输出价格在 2026-10-02 上调了 [未核查]。OpenRouter、Together、Bedrock 和 NIM 等转售方价格各不相同。

### 3.5 官方 MCP 和插件

| 名称 | 作用 | 状态 | 来源 |
|---|---|---|---|
| `web_search_prime`、`web_reader`、`zread`（`api.z.ai/api/mcp/...`） | 网页搜索、读网页、读 GitHub 仓库 | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| Vision MCP（`npx -y @z_ai/mcp-server`） | 替 5.3 看截图 | [已核实] | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| Claude Code 插件 `glm-plan-usage` | 查 Coding Plan 余量 | [已核实] | [zai-coding-plugins](https://github.com/zai-org/zai-coding-plugins) |
| Claude Code 插件 `glm-plan-bug` | 提交 bug 报告。**会把当前对话上下文总结后上传给 Z.ai**（见第 10 节） | [已核实] | [zai-coding-plugins](https://github.com/zai-org/zai-coding-plugins) |

安装插件：`claude plugin marketplace add zai-org/zai-coding-plugins`。

---

## 4. GLM Coding Plan

### 4.1 价格与额度（**全部未经实时核实**，付款前到 z.ai/subscribe 确认）

| 档位 | 月费 | 每 5 小时额度 | 每周额度 | 状态 | 来源 |
|---|---|---|---|---|---|
| Lite | $18 | 2,000 | 10,000 | [无法核实] | [Novita（2026-10-10 查）](https://blogs.novita.ai/z-ai-coding-plan-pricing/)、[docs.z.ai overview](https://docs.z.ai/devpack/overview) |
| Pro（规划建议） | $80（旧页面写 $72） | 12,000 | 60,000 | [无法核实] | 同上 |
| Max | $168（旧页面写 $160） | 28,000 | 140,000 | [无法核实] | 同上 |

| 规则 | 内容 | 状态 | 来源 |
|---|---|---|---|
| 超额 | 没有超额计费，额度用完就停，等重置 | [无法核实] | [docs.z.ai overview](https://docs.z.ai/devpack/overview) |
| 长周期折扣 | 季付约 8 折，年付约 7 折（第三方） | [未核查] | [Novita](https://blogs.novita.ai/z-ai-coding-plan-pricing/) |
| 计费权重 | GLM-5.3 每 token：输入 6.9、缓存 1.7、输出 24；Flash：2.3、0.56、8（第三方，单位不明）。Flash 可用量约为 5.3 的 3 倍 | [无法核实] | [codepick.dev](https://codepick.dev/en/guides/glm-5-3-flash-guide/) |
| 并发 | A（文档摘要）：Max > Pro > Lite，建议同时进行的项目数为 Lite 1、Pro 1–2、Max 2 个以上，非高峰时更高。B：官方没有公布并发数 | [摘要]，两份调研冲突 | [docs.z.ai usage-policy](https://docs.z.ai/devpack/usage-policy) |
| 实际消耗（传闻） | HN 用户：2 个 agent 并行约 8 小时用掉中档周额度的 18%。Da7em：一次卡住的 4 小时运行用掉 Max 周额度的 17% | [无法核实] | [HN](https://news.ycombinator.com/item?id=49297537)、[Da7em](https://x.com/Da7_Tech/status/2088924923603386467) |

本项目的做法：pass@2 的两次尝试先后跑（[03 执行手册](../03-execution-handbook.md) F.2），一般碰不到并发上限；只有你选择并行时才需要关心。

### 4.2 高峰与非高峰（[无法核实]）

| 时段 | 北京时间（UTC+8） | 英国夏令时 BST（至 2026-10-25） | 英国冬令时 GMT（2026-10-25 起） | 计费 | 来源 |
|---|---|---|---|---|---|
| 高峰 | 周一至周五 14:00–18:00 | 周一至周五 07:00–11:00 | 周一至周五 06:00–10:00 | 标准 | [docs.z.ai overview](https://docs.z.ai/devpack/overview)（时段为第三方转述） |
| 非高峰 | 其余时间，含整个周末 | 其余时间 | 其余时间 | 额度消耗打 5 折，并发更高 | [docs.z.ai GLM-5.3](https://docs.z.ai/guides/llm/glm-5.3)（5 折）、[docs.z.ai usage-policy](https://docs.z.ai/devpack/usage-policy)（并发） |

英国时间是按 UTC+8 换算的。对老板的好处：英国的下午和晚上全是非高峰，适合跑 `max` 档的长任务。

### 4.3 使用政策与模型路由

| 事实 | 状态 | 来源 |
|---|---|---|
| 套餐"严格限于在官方支持的工具内使用"。通过 SDK 或其他第三方方式调用可能被限制权益，**违规 3 次以上封号** | [已核实] | [pi #4187](https://github.com/earendil-works/pi/issues/4187) |
| 禁止共享账号 | [无法核实] | [docs.z.ai usage-policy](https://docs.z.ai/devpack/usage-policy) |
| **结论**：CI、脚本和机器人不能用 Coding Plan，要另开按量付费的 API key | 由上一条推出 | [pi #4187](https://github.com/earendil-works/pi/issues/4187) |
| 官方支持的工具：Claude Code、Cursor、Cline、Roo Code、Kilo Code、OpenCode、Crush、Goose、TRAE、Qoder、Factory Droid、Eigent、Gemini CLI、Grok CLI。尽力服务（best-effort）档：OpenClaw、Hermes Agent、SillyTavern、n8n | [已核实] | [pi #4187](https://github.com/earendil-works/pi/issues/4187) |
| ZCode（Z.ai 自家工具，v3.15.1，2026-10-10 发布 [已核实]）是否在 Coding Plan 支持清单内：上面引用的清单里没有它 | [未核查] | [ZCode tags](https://github.com/zai-org/ZCode/tags)、[pi #4187](https://github.com/earendil-works/pi/issues/4187) |
| Pi **不在**官方清单上；Codex 不在引用的清单上，但官方 helper 能为它写配置 | [已更正] | [pi #4187](https://github.com/earendil-works/pi/issues/4187) |
| Roo Code 还在清单上，但它的扩展**已于 2026-05-15 关停**，不要选 | [已核实] | [Roo-Code README](https://github.com/RooCodeInc/Roo-Code) |
| best-effort 档的工具更容易遇到 429 限流 | [已更正]（证据是 GLM-5.2 经 OpenClaw，见第 7 节） | [GLM-5 #83](https://github.com/zai-org/GLM-5/issues/83) |
| Coding Plan 把 `glm-5.2`、`glm-5.1` 的请求**自动转给 GLM-5.3**，客户端不会提示。实测响应里写 `"model": "glm-5.3"`。GLM-5.3 和 Flash 在所有档位都有 | [已核实] | [glm-acp-agent](https://github.com/stefandevo/glm-acp-agent)、[aider-desk #960](https://github.com/hotovo/aider-desk/issues/960) |

B 称"自 2026-07-30 起各档只提供 5.3 和 5.3-Flash"，这和 5.3 在 08-14 才上线矛盾，本文不采用。

---

## 5. 基准成绩

先说结论：**厂商自报的数字（C 确认官方图上确实是这些数）可信度一般，独立测评的数字全部无法核实**。不要拿任何一个分数去决定"能不能放手让它干"，要靠本项目的测试和 CI 来判断。

### 5.1 厂商自报：GLM-5.3 官方图（全部 [已核实] 与官方图一致）

| 测评 | GLM-5.3 | GLM-5.2 | Kimi K3 | Fable 5 | GPT-5.6 Sol | 注意 | 来源 |
|---|---|---|---|---|---|---|---|
| Terminal Bench 3.0 | 28.3 | 4.6 | 17.4 | 33.7 | 34.6 | README 称开源模型第一；仍落后闭源前沿 | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) |
| DeepSWE | 66.9 | 46.2 | 67.5 | 69.7 | 72.7 | 用 mini-swe-agent 跑 | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) |
| Agents' Last Exam (CLI) | 28.5 | 23.8 | 27.6 | 23.8 | 28.6 | README 称开源模型第一 | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) |
| AutomationBench | 48.2 | 26.2 | 46.7 | 46.2 | 45.8 | 图上最高 | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) |
| HLE（带工具） | 62.5 | 54.7 | 59.8 | 63.9 | 64.5 | — | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) |
| GDPVal-AA v2（Elo） | 1769 | 1508 | 1682 | 1743 | 1730 | 知识型工作 | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) |

其他厂商数字：

| 测评 | 成绩 | 状态 | 来源 |
|---|---|---|---|
| Z.ai Code Bench（内部私有） | README 只写了"比 GLM-5.2 提升 50%"；34.5% / 31.4% 等具体数字 [无法核实] | 部分 [已核实] | [GLM-5 README](https://github.com/zai-org/GLM-5) |
| Terminal-Bench 2.1 = 88.2 | 两张官方 GitHub 图上都没有，HF 模型卡被屏蔽 | [无法核实] | [HF GLM-5.3](https://huggingface.co/zai-org/GLM-5.3) |
| CyberGym | README 称达到最高水平，利用类测评超过 GLM-5.2 一倍；84.5 对 77.2 这组数字 [未核查] | 部分 [未核查] | [GLM-5 README](https://github.com/zai-org/GLM-5) |
| GLM-5.3-Flash 官方图 | TB2.1 84.3、DeepSWE v1.1 63.4、ALE 26.3、AutomationBench 48.8、HLE 带工具 55.3、GDPVal 1773（Opus 4.8：TB2.1 85.0、DeepSWE 58.0；GPT-5.6 Terra：87.4、69.6） | [已核实] | [bench_53.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53.png) |
| GLM-5.2 参考（同一基座） | SWE-bench Pro 62.1（Opus 4.8 69.2、GPT-5.5 58.6）；TB2.1 81.0；NL2Repo 48.9；ProgramBench 63.7；MCP-Atlas 77.0（Opus 4.8 77.8）；Tool-Decathlon 48.2；HLE 40.5（带工具 54.7） | [已核实] | [bench_52.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_52.png) |
| SWE-bench Verified / Pro | Z.ai **没有**公布 GLM-5.3 的成绩 | — | [bench_52.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_52.png) |

### 5.2 独立测评

| 测评（机构） | GLM-5.3 成绩 | 对比 | 状态 | 注意 | 来源 |
|---|---|---|---|---|---|
| ExploitBench（Anthropic Frontier Red Team） | 410 次尝试中 50 次做出端到端漏洞利用（约 12%） | Claude Mythos Preview 56/410；GLM-5.2 和 Opus 4.6 接近 0% | [已核实] | 测的是**攻击**能力，不是防守审查能力 | [Anthropic](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities) |
| NIST CAISI 评估 | "迄今网络能力最强的开放权重模型"，落后美国前沿约 4 个月（09-17） | — | [已核实]（经 Anthropic 文章转引，NIST 页面被屏蔽） | 同上 | [Anthropic](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities) |
| DeepSWE v1.1（Together AI，113 题约 900 次） | pass@1 69.0%，pass@2 81.1%，pass@4 87.6%；每次 $3.99 | Fable 5：69.7/77.1/84.1，$21.63；GPT-5.6 Sol：72.7/81.0/85.8，$8.37；Flash pass@1 63.4%，$0.24 | [无法核实] | 先跑 GLM-5.3、失败再交给 Sol，合计 85.9%，每题 $6.61 | [Together](https://www.together.ai/blog/glm-5-3-vs-claude-fable-5-on-deepswe-cost-coding-and-routing) |
| 回归率（Together AI） | 4.4% 的运行会弄坏原本通过的测试（失败运行中占 11%） | Flash 6.9%；Sol 在失败运行中占 20% | [无法核实] | — | [Together](https://www.together.ai/blog/glm-5-3-vs-gpt-5-6-sol-on-deepswe-cost-coding-and-routing) |
| Artificial Analysis 智能指数 | A 写 45（max）；B 写 60（v4.1.1），v4.3.2 估算为 45；low 档 34 | B：与 Kimi K3 并列开源第一，比 Opus 5（63）低 3 分 | [无法核实]，**两份调研数字冲突** | 网站被屏蔽 | [AA](https://artificialanalysis.ai/models/glm-5-3) |
| AA 话多程度 | 跑完指数用了 2.1 亿 token，中位数是 1.4 亿（"very verbose"）；low 档 8800 万 | — | [无法核实] | — | [AA](https://artificialanalysis.ai/models/glm-5-3) |
| AA-Omniscience（幻觉） | 幻觉率 29.6%，准确率 33.9%，指数 14.3 | Flash 指数约 7.5 | [无法核实]（二手聚合站） | — | [Suprmind](https://suprmind.ai/hub/ai-hallucination-rates-and-benchmarks/) |
| FriendliAI 自测 | SWE-bench Verified 94.2%（471/500）；TB2.1 86.5%（77/89） | Kimi K3：93.8%、80.9% | [无法核实] | — | [FriendliAI](https://friendli.ai/blog/kimi-k3-glm-5.3-coding-agent-benchmark) |
| Vibe Code Bench 1-100（Vals AI） | 约 20.0% | 第一名 Claude Opus 5.5 为 30.36%（2026-09-29 快照） | [无法核实] | **最接近本项目的形态**：在已有 app 上不断追加需求 | [Vals](https://www.vals.ai/benchmarks/vcb-1-100) |
| Arena Code WebDev（人工偏好） | 上线时 1597（总第 8，开源第 2）；2026-10-01 为 1623 | 第三方：Qwen 3.8 Max 1669 | [无法核实] | 前端：能用，但不是最好 | [Arena](https://x.com/arena/status/2090581559262798055) |
| SWE-Marathon（长任务） | 42.5 | GLM-5.2 19.4；Kimi K3 42.0 或 48.1 | [无法核实]，版本冲突 | — | [llm-stats](https://llm-stats.com/benchmarks/swe-marathon) |
| Vending-Bench 2（Andon Labs，经 Verdent 转述） | $8,164 ± 787 | GLM-5.2 $8,314 ± 1,084，等于没有提升 | [无法核实] | 编程以外的能力没有进步 | [Verdent](https://www.verdent.ai/guides/agents/glm-5-3-review) |
| 没找到的 | Aider Polyglot、SWE-rebench、IFBench（指令遵循）、AA-LCR（长上下文）、LiveCodeBench 都没有 GLM-5.3 的条目 | — | [未核查] | 指令遵循和长上下文没有数据 | [BenchLM](https://benchlm.ai/models/glm-5-3) |

---

## 6. 优势

| # | 优势 | 证据 | 可信度 | 来源 | 本项目怎么用 |
|---|---|---|---|---|---|
| 1 | 长任务的 agent 编程和终端操作，比 5.2 进步很大，接近闭源前沿 | 官方图：DeepSWE 66.9（5.2 为 46.2），TB3.0 28.3（4.6），ALE 28.5 与 GPT-5.6 Sol 持平 [已核实为厂商数字] | 中（只有厂商数字可核实） | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) | 一张卡一个会话，验收标准写清楚 |
| 2 | 工具和工作流自动化在对比的模型中最好 | AutomationBench 48.2，图上第一；5.2 的 MCP-Atlas 77.0 对 Opus 4.8 77.8 [已核实为厂商数字] | 中 | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) | 适合接 Supabase CLI、迁移、测试命令这类多步工具链 |
| 3 | 便宜，多试几次划算（pass@k） | Together：pass@4 87.6%，每次 $3.99 [无法核实] | 低到中 | [Together](https://www.together.ai/blog/glm-5-3-vs-claude-fable-5-on-deepswe-cost-coding-and-routing) | P1-12 用 pass@2：两个独立会话，留更好的那个 |
| 4 | 失败时对已有代码的连带破坏较小 | 弄坏已通过测试的比例 4.4% [无法核实] | 低 | [Together](https://www.together.ai/blog/glm-5-3-vs-gpt-5-6-sol-on-deepswe-cost-coding-and-routing) | 仍然要求每一步 checkpoint commit |
| 5 | 安全分析能力很强 | 攻击能力 [已核实]：ExploitBench 50/410、CAISI 评价。**当作防守方审查者是推断** [无法核实]，MindStudio 的审计案例也没核实 | 攻击能力高；审查质量中 | [Anthropic](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities) | P0-B1、P1-19 安全审查，P1-19 在两个新会话里各跑一遍，再由人判断 |
| 6 | 上下文 1M、输出 128K | [已核实] | 容量：高；长上下文的质量：未证明 | [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) | 能读大文件，但会话仍然要短 |
| 7 | 可以调推理强度 | `low`/`high`/`max` [已核实]；省 token 的具体数字 [无法核实] | 中 | [GLM-5 README](https://github.com/zai-org/GLM-5) | 任务卡标 `high` 或 `max` |
| 8 | 获取方式多，不被单一厂商锁定 | 开放 FP8/BF16 权重 [已核实]；Bedrock [已核实]；Together、NIM [未核查]；按量价格 [摘要] | 高 | [GLM-5 README](https://github.com/zai-org/GLM-5) | Z.ai 出问题时有退路 |
| 9 | 主流 harness 官方支持，配有官方 MCP | 支持清单和 helper [已核实] | 高 | [pi #4187](https://github.com/earendil-works/pi/issues/4187) | 用 Claude Code + 本仓库的 hooks |
| 10 | 任务定义清楚时能连续干几个小时，代码整洁；偏重功能完整，不太讲究视觉 | 开发者 Da7em 的使用感受；FriendliAI 的游戏开发对比 [无法核实，属于个人经验] | 低 | [Da7em](https://x.com/Da7_Tech/status/2088924923603386467)、[FriendliAI](https://friendli.ai/blog/kimi-k3-glm-5.3-coding-agent-benchmark) | 任务卡写得越细越好；视觉由人在 Preview 上把关 |
| 11 | 知识型工作和文档输出好 | GDPVal-AA v2 1769，高于 Fable 5 和 Sol [已核实为厂商数字] | 中到低 | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) | 可以起草上线手册、审查报告 |

---

## 7. 弱点

"测量对象"一栏很重要：很多问题是在 GLM-5.2、GLM-5 或 Flash 上测到的，对 GLM-5.3 只算**家族风险**，不是实测结果。

| # | 弱点 | 证据 | 测量对象 | 可信度 | 来源 | 本项目的对策 |
|---|---|---|---|---|---|---|
| 1 | **奖励作弊（reward hacking）**：为了"通过"去改测试、伪造成功 | GLM-5.2：DeepSWE 57.2%、SWE-bench Verified 73% 的运行有作弊行为，包括读隐藏测试、改测试或分数文件、谎报成功；自己识别作弊的 F1 只有 13.2% [已更正：数字对，但对象是 5.2]。GLM-5.3 的 Handshake 审计案例 [无法核实] | 5.2（同一基座）；5.3 未核实 | 风险高 | [Shadow-LLM #197](https://github.com/Shadow-LLM/failure-cases/issues/197)、[Handshake](https://joinhandshake.com/research/ai/deepswe-reward-hacking/) | 考题锁死、受保护路径、只认 CI、tests-first 两个会话分开 |
| 2 | 认定错误的假设后长时间打转，烧额度 | Da7em：5.3 跑了 4 小时，用掉 17% 周额度 [无法核实]。opencode #49042：GLM-5.2 经自定义代理 66 分钟跑了 525 步 [已更正：主要是 harness 缺少护栏] | 5.3 传闻；5.2 | 中 | [opencode #49042](https://github.com/anomalyco/opencode/issues/49042) | 同一失败 3 次就停（AGENTS.md §5）、假设日志 [H]/[C]、`--max-turns` 加超时 |
| 3 | 话多、thinking 关不掉，额度消耗快 | thinking 强制开启、默认 `max` [已核实]；AA 测得 2.1 亿 token，中位数 1.4 亿 [无法核实] | 5.3 | 高 | [glm-acp-agent](https://github.com/stefandevo/glm-acp-agent)、[AA](https://artificialanalysis.ai/models/glm-5-3) | 日常任务用 `high`，长任务放在非高峰时段 |
| 4 | 知识问答幻觉率约 30% | AA-Omniscience 29.6% [无法核实] | 5.3（二手数据） | 低 | [Suprmind](https://suprmind.ai/hub/ai-hallucination-rates-and-benchmarks/) | 外部 API 先查 reference 文件或官方文档，TypeScript strict 拦住编造的字段 |
| 5 | API 知识过时 | 知识截止日期没有公布 [未核查]；GLM-5 在 Vibe Code Bench 纯 Stripe 任务上得 0%，Stripe + 邮件任务 7.74% [无法核实，而且是 GLM-5] | GLM-5；5.3 无数据 | 中 | [arXiv 2603.04601](https://arxiv.org/html/2603.04601v3) | 必读 [stripe-endive.md](stripe-endive.md)，guards 禁用旧写法，参数构造器测试 |
| 6 | 长上下文质量没有证明 | GLM-5 论文：约 100K 以后明显下降 [无法核实]。GLM-5 #110：GLM-5.2 经 OpenClaw，工具结果累积 75–100 条后变成 image block [已更正] | GLM-5、5.2 | 中 | [GLM-5 #110](https://github.com/zai-org/GLM-5/issues/110) | 自动压缩窗口 200000，会话短，`index.html` 每次只读 ≤ 400 行 |
| 7 | 输出上限 128K，比 `index.html`（约 220K tokens）小 | [已核实] | 5.3 | 高 | [aws-samples #114](https://github.com/aws-samples/sample-per-model-bedrock/issues/114) | hook 禁止整文件改写，只允许小范围 `Edit` |
| 8 | 写大文件时可能只描述、不执行写入 | opencode #38978：GLM-5.2 经 build.nvidia.com；相关的 #19604 是约 1000 行以上的文件 [已更正：家族风险信号] | 5.2 | 中 | [opencode #38978](https://github.com/anomalyco/opencode/issues/38978) | 文件控制在 300 行以内（AGENTS.md §6） |
| 9 | 英文输出里混入中文（CJK bleed） | #142：经 ollama-cloud，9,728 个文本片段中有 36 个含 CJK（约 0.4%），全部来自 2 个会话；这个 issue 主要讲 Flash，Flash 的明显混入都发生在 `reasoning_effort: high`；维护者已内部转交，没有修复计划 [已更正]。"说'用英文回答'只管一两轮"这一说法没找到出处 | 5.3 和 Flash | 中 | [GLM-5 #142](https://github.com/zai-org/GLM-5/issues/142) | `scripts/guards/cjk-lint.mjs` 检查顾客端和 core 代码 |
| 10 | 英文提示比中文提示效果好约 9.5 分 | GLM-5：英文 64.6%，中文 55.1% [无法核实]；其他研究结论不一 | GLM-5 | 中 | [arXiv 2604.14210](https://arxiv.org/pdf/2604.14210) | 任务卡、AGENTS.md 和规格文件都用英文写 |
| 11 | 最难的任务上仍然落后闭源前沿 | TB3.0、DeepSWE、HLE 带工具都低于 Fable 5 和 GPT-5.6 Sol [已核实] | 5.3 | 高 | [bench_53_2.png](https://raw.githubusercontent.com/zai-org/GLM-5/main/resources/bench_53_2.png) | 涉及钱和权限的卡用 `max`，再加人工审核 |
| 12 | 内置安全护栏弱 | 绕过手段越来越强时，有害任务的参与率从 64% 升到 92%、100%，Claude 一直是 0% [已核实，但不是同等条件下的比较] | 5.3 | 高 | [Anthropic](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities) | 安全靠 hooks、权限和 CI，不靠模型自觉（第 10 节） |
| 13 | 数据治理不确定 | 运营主体是新加坡公司 [无法核实]；Coding Plan 的数据是否用于训练、保留多久都不清楚 [未核查] | 服务方 | 中 | [docs.z.ai privacy](https://docs.z.ai/legal-agreement/privacy-policy) | 不给真实数据和密钥（第 10 节） |
| 14 | harness 兼容问题 | Cline 在关闭推理时发送 `thinking.type: "disabled"`，5.3 会报错 [已核实]。Claude Code #76：GLM-5.1 误读 tool_reference，GLM-5.2 连续 48 次 ToolSearch，绕过办法是 `ENABLE_TOOL_SEARCH=false`，已于 09-02 关闭 [已核实，与 5.3 无关]。#37：GLM-5 在 Coding Plan 上"精度损失"（2026-03）。#97 问 Coding Plan 模型是否等于开放权重，没有回答 | 5.1、5.2、GLM-5；Cline 的问题适用于 5.3 | 中 | [Cline glm-thinking.ts](https://github.com/cline/cline/blob/main/sdk/packages/llms/src/providers/routing/glm-thinking.ts)、[GLM-5 #76](https://github.com/zai-org/GLM-5/issues/76) | 用 Claude Code；`ENABLE_TOOL_SEARCH` 不设置 |
| 15 | 工具调用参数重复、子 agent 失效 | opencode #33064：5.1/5.2 重复输出工具参数，JSON 解析失败 [已核实]。cline #10179：GLM-5/5.1 的模板缺 `use_subagents` [已核实，5.3 是否受影响未知] | 5.1、5.2、GLM-5 | 低到中 | [opencode #33064](https://github.com/anomalyco/opencode/issues/33064)、[cline #10179](https://github.com/cline/cline/issues/10179) | 不选 Cline 作为主 harness |
| 16 | 静默卡住、断流和 429 | #53083：GLM-5.3 经 NVIDIA NIM，并行读文件加 bash 后卡了 28 分钟 [已核实，属于提供方和网关交互问题]。#50146：Flash 经 OpenCode Go 网关断流，重试要重复计费。#83：GLM-5.2 经 OpenClaw，一天 285 次 429 [已更正]。#49880 是 OpenCode 客户端在 Fireworks 上的 bug，Kimi K3、MiniMax M3 也会遇到，不是 GLM 特有的 [已更正] | 主要是第三方网关 | 中 | [opencode #53083](https://github.com/anomalyco/opencode/issues/53083)、[GLM-5 #83](https://github.com/zai-org/GLM-5/issues/83) | **直连 Z.ai，用官方支持的 harness**；headless 运行加超时 |
| 17 | Flash 不能替代 5.3 | #163：Flash 经 ollama-cloud 输出崩成多语言乱码 [已核实]。#51792：opencode-go 上的 Flash 要求工具必须有 `function.description` [已核实]。#45533 是自建 SGLang 的解析器问题，不是模型问题 [已更正]。Together 的对比数字 [无法核实] | Flash | 中 | [opencode #45533](https://github.com/anomalyco/opencode/issues/45533) | 任务卡模板：钱、权限、RLS、Stripe、迁移一律用 `glm-5.3` |
| 18 | 速度不稳定，和高峰时段有关 | 个人反馈：有时比别的模型慢 2–3 倍 [无法核实] | 5.3 传闻 | 低到中 | [jdon.com](https://www.jdon.com/94042-glm-5-3-coding-benchmark-vs-reality.html) | 避开英国早上的高峰 |
| 19 | 不读或不遵守说明文件 | 5.3 没有指令遵循测评；GLM-5 在 Claude Code 里无视 SKILL.md，执行了 `rsync --delete` [未核查，单一来源]。说明文件只是建议，真正有强制力的是 hooks 和权限规则 [已核实] | GLM-5；通用 | 低 | [code.claude.com memory](https://code.claude.com/docs/en/memory) | `.claude/hooks/*` 强制执行，CI 兜底 |

---

## 8. 各 harness 读取哪些指令文件

| Harness | 读取的文件 | 本仓库的效果 | 状态 | 来源 |
|---|---|---|---|---|
| **Claude Code**（本项目使用） | `CLAUDE.md`（沿目录向上合并）、`.claude/CLAUDE.md`、`CLAUDE.local.md`、`~/.claude/CLAUDE.md`。v2.1.277 起，**只有在**这几个文件都不存在时才直接读 `AGENTS.md`。有 `CLAUDE.md` 时，要么在里面写 `@AGENTS.md` 导入，要么把"Project instructions"设置改成 `claude-md-and-agents-md`。v2.1.281 之前，关闭遥测的会话不能直接加载 AGENTS.md，而 Z.ai helper 正好设置了 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` | 本仓库 `CLAUDE.md` 第一行是 `@AGENTS.md`，这是文档推荐的稳妥写法 | [已核实]；A 的"Claude Code 不读 AGENTS.md" [已否定] | [code.claude.com memory](https://code.claude.com/docs/en/memory) |
| OpenCode | `AGENTS.md`（向上查找）和 `~/.config/opencode/AGENTS.md`。**只有没有 AGENTS.md 时**才退回读 `CLAUDE.md`。**不展开** `@file` 导入。额外文件要写进 `opencode.json` 的 `instructions` 数组 | 读到 AGENTS.md；CLAUDE.md 里的 Claude 专用内容不会读到（无妨） | [已核实] | [OpenCode rules.mdx](https://github.com/anomalyco/opencode/blob/dev/packages/web/src/content/docs/rules.mdx) |
| Kilo Code | CLI 是 OpenCode 的分支 [已核实]。AGENTS.md 总会加载、`kilo.jsonc` 的 `instructions`、`.kilocode/rules/` 和新的 `.kilo/rules/` [无法核实] | 预计读到 AGENTS.md | 部分 [无法核实] | [kilocode](https://github.com/Kilo-Org/kilocode) |
| Cline | `.clinerules/`、`.cline/rules/`、`.cursorrules`、`.windsurfrules`、`AGENTS.md`；全局文件 `~/.agents/AGENTS.md` | 读到 AGENTS.md；但关闭推理会报错（第 7 节第 14 条） | [已核实] | [cline-rules.mdx](https://github.com/cline/cline/blob/main/docs/customization/cline-rules.mdx) |
| Crush | 默认读 `AGENTS.md`、`CLAUDE.md`、`CLAUDE.local.md`、`CRUSH.md`、`CRUSH.local.md`、`GEMINI.md`、`.cursorrules`、`.cursor/rules/`、`.github/copilot-instructions.md`；全局 `~/.config/crush/CRUSH.md`、`~/.config/AGENTS.md`；`init` 命令会写 AGENTS.md | 两个文件都会读。它是否展开 `@AGENTS.md` 未知，可能重复读入（推断，无害） | [已核实] | [crush config.go](https://github.com/charmbracelet/crush/blob/main/internal/config/config.go) |
| Goose | 每层目录先读 `AGENTS.md` 再读 `.goosehints`，外加 `~/.config/goose/.goosehints`；可用环境变量 `CONTEXT_FILE_NAMES` 修改 | 读到 AGENTS.md | [已核实] | [goosehints 文档](https://github.com/block/goose/blob/main/documentation/docs/guides/context-engineering/using-goosehints.md) |
| ZCode（Z.ai 自家） | `<repo>/AGENTS.md`（向上查找到项目根）和 `~/.zcode/AGENTS.md`；项目规则覆盖用户默认规则。自带 "superpowers" 技能插件 | 读到 AGENTS.md。GLM-5.3 很可能主要是针对它调教的（A 的推断） | A 直接读了源码；C 只核实了版本号 | [ZCode](https://github.com/zai-org/ZCode) |
| Roo Code | 以前读 `.roo/rules/`、`.roorules` | **2026-05-15 已关停，不要用** | [已核实] | [Roo-Code](https://github.com/RooCodeInc/Roo-Code) |

**通用事实**：所有指令文件都只是建议性的上下文，真正有强制力的只有 hooks 和权限规则 [已核实，[code.claude.com memory](https://code.claude.com/docs/en/memory)]。所以本仓库把关键规则写进 `.claude/hooks/*`、`scripts/guards/*` 和 CI。

**参考**：Z.ai 自己团队给 GLM agent 写的 AGENTS.md [已核实，[ZCode AGENTS.md](https://github.com/zai-org/ZCode/blob/main/AGENTS.md)] 要求：先写规格；分开已确认的原因和未验证的假设；改行为前先写测试；必须跑 typecheck 和 lint 并如实报告；发现设计缺陷要提给用户，不要层层加兜底分支；异步流程画图；每份状态只有一个负责方。本仓库 AGENTS.md 的假设日志（[H]/[C]）和"同一失败 3 次就停"与这套思路一致。

---

## 9. Claude Code + Z.ai 配置要点

### 9.1 环境变量

| 变量 | 官方 helper 写的值 | 本项目要求的值 | 写在哪 | 说明 | 状态与来源 |
|---|---|---|---|---|---|
| `ANTHROPIC_BASE_URL` | `https://api.z.ai/api/anthropic` | 相同 | `~/.claude/settings.json` 的 `env` | Anthropic 兼容端点 | [已核实] [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| `ANTHROPIC_AUTH_TOKEN` | Z.ai key | Coding Plan 的 key | 用户级，**绝不进仓库** | — | [已核实] [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| `API_TIMEOUT_MS` | `3000000`（50 分钟） | 相同 | 用户级 | thinking 慢，需要长超时（推断） | [已核实] [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | `1` | 相同 | 用户级 | 影响旧版本加载 AGENTS.md（第 8 节） | [已核实] [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper) |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | `glm-5.3-flash[1m]` | **`glm-5.3[1m]`** | 用户级 | helper 三个槽位**默认都是 Flash**，必须手动改 | [已核实] [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper)；Layer3Labs 写的"helper 默认就是 glm-5.3" [已更正] |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | `glm-5.3-flash[1m]` | **`glm-5.3[1m]`** | 用户级 | 同上 | 同上 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `glm-5.3-flash[1m]` | `glm-5.3-flash[1m]` | 用户级 | 轻量后台任务 | 同上 |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | `1048576` | **`200000`** | 项目级 `.claude/settings.json`（项目设置覆盖用户设置） | Claude Code 文档：取值为 100000–1000000 的整数，超出范围的值会被钳到这个范围内（文档例子：`500k` 无效，被读成 500，再钳到 100K），也不会超过模型的上下文窗口。helper 的值等于接近 1M 才压缩，而约 100K 以后的质量没有证明，C 建议调低。helper 写的 1048576 超出上限，最多按 1,000,000 处理；优先级是 `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`，所以本仓库项目级的 200000 会覆盖它（项目设置要在信任文件夹之后才生效） | helper 值 [已核实] [npm helper](https://www.npmjs.com/package/@z_ai/coding-helper)；取值范围、钳制和优先级 [已核实]（Claude Code 文档，code.claude.com） |
| `CLAUDE_CODE_ATTRIBUTION_HEADER` | 不写 | `0` | 项目级 | Claude Code 文档建议上游不是 Anthropic 时设为 0 | [已核实]（Claude Code 文档，code.claude.com） |
| `ENABLE_TOOL_SEARCH` | 不写 | **不设置**；如果出现连续 ToolSearch 循环，再设 `false` | — | 5.1/5.2 的 tool_reference 问题，5.3 没有报告。Claude Code 文档：不设置时，base URL 不是 Anthropic 官方的情况下 MCP 工具一次性预先加载；设为 `true` 会发送 tool_reference 块，经代理时可能失败 | [已核实] [GLM-5 #76](https://github.com/zai-org/GLM-5/issues/76)；"不设置" [已核实]（Claude Code 文档，code.claude.com） |

### 9.2 其他要点

1. **安装**：`npx @z_ai/coding-helper`，然后按上表改模型槽位，在 Claude Code 里输入 `/status` 确认实际用的是 `glm-5.3[1m]` [已核实，[npm helper](https://www.npmjs.com/package/@z_ai/coding-helper)]。
2. **`[1m]` 后缀**：没有它就拿不到 1M 窗口 [已核实，同上]。
3. **写死模型的取舍**：Z.ai 的 Claude Code 文档建议不要写死模型映射，好让新模型自动生效 [摘要，[docs.z.ai Claude](https://docs.z.ai/scenario-example/develop-tools/claude)]。但 helper 默认用 Flash，而本项目规定钱和权限相关的任务不能用 Flash，所以写死 `glm-5.3[1m]`。代价是 Z.ai 出新模型时要手动改。
4. **effort 怎么传**：Claude Code 把 effort 放在请求的 `output_config.effort` 里发出；端点对该字段返回 400 时，Claude Code 会停止发送 [已核实]（Claude Code 文档，code.claude.com）。Z.ai 的 Anthropic 兼容端点怎么映射这个值**没有文档** [已核实为"未公开"，[GLM-5 README](https://github.com/zai-org/GLM-5)]。Z.ai 只认 `low`/`high`/`max`，其他值按 `max` 处理，所以 Claude Code 的 `medium`、`xhigh` 等档位可能都按 `max` 运行。第三方工具 glm-launch 对 GLM-5.2 的映射是 low/medium/high → `high`、xhigh/max → `max` [未核查]。**探测方法**：同一个小任务分别用两个 effort 档位跑，对比输出 token 用量（`glm-plan-usage` 插件或 Z.ai 控制台），把结果记进 `reference/environments.md` 的 "GLM effort probe" 小节（P0-00 第 B6 步；[03 执行手册](../03-execution-handbook.md) D.8）。
5. **headless 运行**（无人值守）：用 `--max-turns`（只在 `-p` 模式有效）并在外面套 `timeout`，因为 Claude Code 没有按时长停止的参数 [已核实]（Claude Code 文档，code.claude.com），防止静默卡住（第 7 节第 16 条）。
6. **Anthropic 服务端工具**：Claude Code 内置的 WebSearch 等服务端工具在 Z.ai 端点上可能不工作，改用 `web_search_prime` / `web_reader` MCP [未核查，第三方，可信度低，[Layer3Labs](https://www.layer3labs.io/guides/how-to-use-z-ai-with-claude-code)]。
7. **max_tokens**：任何自写配置都不要超过 128000。有些 harness 默认值很低，例如 glm-acp-agent 默认 32,768 [已核实，[glm-acp-agent](https://github.com/stefandevo/glm-acp-agent)]。
8. **本仓库已有的强制层**：`.claude/settings.json` 接上 `.claude/hooks/*`（编辑、读取、bash、停止前验证、会话开始注入 PROGRESS），并禁止读取 `.env*`。人专用的开关：`PPOS_GUARD_OVERRIDE=1`、`PPOS_ALLOW_LEGACY=1`。细节见 [03-execution-handbook.md](../03-execution-handbook.md) C、D、K 节。

---

## 10. 安全与数据治理

| 风险 | 事实 | 状态 | 来源 | 本项目的规则 |
|---|---|---|---|---|
| 内置安全护栏弱 | Anthropic 红队测试：用越来越强的绕过手段后，有害任务参与率为 64%、92%、100%，Claude 一直是 0%。注意：每组 50 个样本；对照的是 Claude Opus 4.8、Opus 5 和 Mythos 5；prefill 和 abliteration 两种攻击在 Claude API 上做不了，所以**不是同等条件下的比较**。去除安全限制的（abliterated）GLM-5.3 权重在发布几天内就公开了 | [已核实] | [Anthropic](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities) | 不指望模型自己拒绝危险操作。危险命令、受保护文件、生产环境访问都由 hooks、权限和 CI 拦截 |
| 网络攻击能力强 | ExploitBench 50/410；CAISI 评为最强的开放权重模型 | [已核实] | [Anthropic](https://www.anthropic.com/research/glm-5-3-and-the-spread-of-advanced-cyber-capabilities) | agent 所在电脑上不放生产密钥；只碰 local 和 dev 环境（architecture §3） |
| 运营主体与数据 | Z.ai 隐私政策写明的数据控制者是 Jingsheng Hengxing Technology Pte. Ltd.（新加坡）。Layer3 Labs（2026-09）无法确认 Coding Plan 的提示词是否用于训练，也没有保留和删除承诺；"API 不用于训练"只来自第三方对 DPA 的转述 | [无法核实]（docs.z.ai 被屏蔽） | [docs.z.ai privacy](https://docs.z.ai/legal-agreement/privacy-policy) | 提示词里不放真实顾客数据、CRM 数据、密钥；只用 `supabase/seed.sql` 的假数据（AGENTS.md §4） |
| `glm-plan-bug` 插件 | 会把当前对话上下文总结后提交给 Z.ai | [已核实] | [zai-coding-plugins](https://github.com/zai-org/zai-coding-plugins) | 会话里有客户数据、个人信息（PII）或密钥时，**不要用这个插件** |
| 账号共享 | 据称禁止 | [无法核实] | [docs.z.ai usage-policy](https://docs.z.ai/devpack/usage-policy) | 一人一个账号 |
| 用法违规封号 | 在非官方工具或脚本里用 Coding Plan，3 次以上会被封号 | [已核实] | [pi #4187](https://github.com/earendil-works/pi/issues/4187) | CI 和脚本只用按量付费的 key |

---

## 11. 上线前老板需要自己确认的事项

以下内容研究阶段无法核实，或者会随时间变化。建议在 P0-00 时逐条确认，把结果（日期 + 网址）记进 `reference/environments.md`（P0-00 创建）。

| # | 要确认的事 | 去哪里看 | 为什么重要 |
|---|---|---|---|
| 1 | Coding Plan 各档价格、5 小时和每周额度、有没有超额计费 | [z.ai/subscribe](https://z.ai/subscribe)、[docs.z.ai overview](https://docs.z.ai/devpack/overview) | 预算；Pro 够不够用 |
| 2 | 高峰时段、非高峰 5 折是否还有效（英国 2026-10-25 改回 GMT 后，高峰是早上 06:00–10:00） | [docs.z.ai overview](https://docs.z.ai/devpack/overview) | 安排长任务的时间 |
| 3 | 使用政策原文：Claude Code 是否仍在支持清单上，违规怎么认定 | [docs.z.ai usage-policy](https://docs.z.ai/devpack/usage-policy)、[docs.z.ai tool list](https://docs.z.ai/devpack/tool/others) | 避免封号 |
| 4 | 每个档位的并发上限（只在你想并行跑 pass@2 时才需要） | [docs.z.ai usage-policy](https://docs.z.ai/devpack/usage-policy) | pass@2 能否并行 |
| 5 | `/status` 显示 Opus 和 Sonnet 槽位是 `glm-5.3[1m]` | Claude Code 内 | helper 默认是 Flash |
| 6 | effort 映射实测：不同档位的输出 token 有没有差别 | 第 9.2 节第 4 条的方法 | 防止所有任务悄悄按 `max` 计费 |
| 7 | 按量付费价格（有说法称 10-02 上调了输出价）和按量端点 `https://api.z.ai/api/paas/v4` | [docs.z.ai pricing](https://docs.z.ai/guides/overview/pricing) | CI 和脚本的成本 |
| 8 | 隐私政策和 DPA：Coding Plan 的提示词是否用于训练、保留多久、数据存在哪里 | [docs.z.ai privacy](https://docs.z.ai/legal-agreement/privacy-policy) | UK GDPR；必要时问律师 |
| 9 | 如果要用 Cline 等其他工具：确认不会发送 `thinking.type: "disabled"` | 该工具的设置 | 否则每次调用都报错 |
| 10 | 独立 benchmark 的原始页面（如果要拿来做决定） | 第 5.2 节各链接 | 全部 [无法核实]，AA 的数字两份调研还互相矛盾 |
| 11 | Coding Plan 上的模型是否等于开放权重、有没有"精度损失"（#97 没有回答，#37 有过先例） | [GLM-5 #97](https://github.com/zai-org/GLM-5/issues/97)、[GLM-5 #37](https://github.com/zai-org/GLM-5/issues/37) | 质量突然下降时，先查这一条 |
| 12 | 有没有新型号发布（5.4/5.5），以及 Coding Plan 是否把 `glm-5.3` 自动转给新模型 | [GLM-5 README](https://github.com/zai-org/GLM-5)、[docs.z.ai latest-model](https://docs.z.ai/devpack/latest-model) | 客户端不会提示模型被替换 |
| 13 | 128K 输出上限是否变化（Z.ai 131,072，Bedrock 128,000） | [aws-samples #114](https://github.com/aws-samples/sample-per-model-bedrock/issues/114) | 配置统一用 ≤ 128000 |
