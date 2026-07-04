# 06 任务分解 — CLI 核心（C）/ 发布适配器（P）/ Skill 封装（K）

> 每卡自足：较弱模型只读「必读文档 + 卡片全文」即可完成。验收全部可自证（`node --test` 或可断言命令），需人工的已标注。
> 移植类任务的源码基线在 `~/Documents/claudeMini/mdshare/`（只读参考，**严禁修改该目录任何文件**，D1/D2）。
> 通用约束：D14 技术栈（零框架、零构建、deps 白名单）；所有新逻辑随卡配套 test/ 用例。

## 依赖关系图

```
C-01 ─┬─ C-02 ─── C-04 ─┬─ C-05 ── C-06 ─┬─ C-10 C-11 C-12 C-13（可并行）
      │                 │                └─ C-14
      ├─ C-03 ─┐        ├─ C-08
      │        ├─ C-07 ─┼─ C-09
      │        │        └─ K-01 ── K-02 ─┬─ K-03 K-04（可并行）── K-05
      │   P-01 ┘（需 S-01 联调）           │
      │   P-01 ── P-02 P-03（可并行，需 C-08）── P-04
      │   P-01 ── P-05（M5，需 V-02）
```
**可并行组**：{C-02, C-03}；{C-10..C-14}；{P-02, P-03}；{K-03, K-04}。并行开发用 git worktree 隔离，合并前重跑双方验收。

---

## C 系列 — CLI 核心

### C-01 仓库脚手架
- 里程碑 M0 ｜ 依赖：无 ｜ 必读：docs/03 §5、docs/00 D14
- **目标**：建立可跑空测试的仓库骨架。
- **步骤**：按 docs/03 §5 建目录（src/ bin/ server/ agents/ examples/ test/）；package.json（name=htmlshare, license=MIT, engines node>=20, scripts.test=`node --test`, deps 仅 markdown-it、markdown-it-anchor、markdown-it-highlightjs、markdown-it-toc-done-right、github-markdown-css、highlight.js、sanitize-html）；`git init` + .gitignore(node_modules, data, *.local)；test/smoke.test.js 断言 node ≥20。
- **验收**：`npm install && npm test` 通过；`git log` 有首个 commit；目录与 docs/03 §5 一致（ls 对照）。

### C-02 忠实转换器移植
- 里程碑 M0 ｜ 依赖 C-01 ｜ 必读：docs/04 §1、mdshare 的 convert.js 与 lib/sanitize.js、test/convert.test.js、test/sanitize.test.js
- **目标**：`src/convert.js`：md 字符串 → 净化后的忠实 HTML 片段（不含页面外壳）。
- **步骤**：复制 mdshare convert.js/sanitize.js 及其测试进新仓库；改模块路径与命名（mdshare→htmlshare）；导出 `convertFaithful(md) -> { html, title, headings }`；保持 sanitize 白名单不放宽（红线）。
- **验收**：移植测试全绿；新增断言：含 `<script>` 的 md 输入产出中无 script；同一输入两次输出逐字节一致（确定性）。

### C-03 config 与 manifest 模块
- 里程碑 M0 ｜ 依赖 C-01 ｜ 必读：docs/04 §2（逐字段）、mdshare lib/config.js、lib/manifest.js
- **目标**：`src/lib/config.js`、`src/lib/manifest.js` 按 docs/04 §2 Schema 读写 `~/.config/htmlshare/`。
- **步骤**：移植改造；路径必须是 `htmlshare`（严禁 mdshare 路径，用测试锁死）；manifest 实现 `findEntry(source, target)`、`upsert(entry)`、`remove`；config 全字段可缺省。
- **验收**：test 覆盖：空配置可用（零必填）；upsert 幂等；路径断言不含 "mdshare" 字样；损坏 JSON 时报错不清空原文件（数据丢失红线）。

### C-04 双模式组装器 compose
- 里程碑 M1 ｜ 依赖 C-02 ｜ 必读：docs/04 §4/§8/§10、docs/05 §5、docs/02 §3.4
- **目标**：`src/compose.js`：忠实 HTML +（可选）enhanced.json → 单文件 HTML（含 toggle、TL;DR、页脚、noindex）。
- **步骤**：实现 enhanced.json 校验器 V1~V6（docs/05 §5 的处置逐条实现）；组装 `#hs-enhanced`/`#hs-faithful`/`#hs-toggle`（docs/04 §10）；无增强输入 → 仅忠实版无开关；体检（体积、外链资源=0）；html 直传输入 → 原样返回不组装（仅供 encrypt 用）。
- **验收**：docs/05 样例 D 对抗用例逐条通过（V1~V5 各处置断言）；产出 HTML 无任何 `http(s)://` 资源引用（正则断言，锚链接除外）；toggle 存在性随增强有无正确变化；忠实区内容与 convertFaithful 输出逐字节一致。

### C-05 模板系统骨架 + generic 模板
- 里程碑 M1 ｜ 依赖 C-04 ｜ 必读：docs/04 §8、docs/02 §3.4、docs/05 §4
- **目标**：`src/templates/registry.js` + `src/templates/generic/`：模板=槽位集+结构 HTML 函数。
- **步骤**：registry 提供 `get(name) -> { slots: [...], render(sections, common) }`；未知名报错列出合法枚举；generic 实现 body 槽 + 公共区（tldr/title/页脚）；compose.js 接入 registry。
- **验收**：`get('generic').slots` 等于 docs/04 §8 定义；非法模板名错误信息含全部枚举值；渲染快照测试（固定输入 → 固定输出）。

### C-06 风格系统骨架 + clinical/minimal
- 里程碑 M1 ｜ 依赖 C-05 ｜ 必读：docs/04 §8、docs/02 §6（无障碍红线）、mdshare template.html（临床卡片风格参考）
- **目标**：`src/styles/registry.js` + clinical、minimal 两风格（CSS 变量主题，内联输出）。
- **步骤**：风格=导出 CSS 字符串（变量 + 组件样式）；clinical 参考 mdshare 现有冷调临床卡片风移植；minimal 黑白纯排版；两者均支持 `prefers-color-scheme` 双主题与 `prefers-reduced-motion`。
- **验收**：每风格产出页面用脚本断言：无外链字体/图片；对比度计算 ≥4.5:1（写一个 30 行以内的对比度断言工具函数，正文前景/背景变量代入）；快照测试。视觉走查标注**需人工**（进 NEEDS_HUMAN 视觉清单）。

### C-07 publish CLI 编排
- 里程碑 M1 ｜ 依赖 C-03、C-04、P-01 ｜ 必读：docs/04 §3（命令契约逐条）、docs/03 §3（状态机）、docs/02 §3.1/3.2
- **目标**：`bin/htmlshare.js` 的 `publish` 子命令按状态机编排全流程。
- **步骤**：实现 COLLECT→…→RECORD（docs/03 §3），含：.html 输入直传分支；`--enhanced` 读入；中间产物暂存于 `~/.cache/htmlshare/<hash>/` 支持断点重跑；stdout 末两行 `URL:`/`CODE:` 契约；退出码契约。
- **验收**：test 用 mock 适配器全流程跑通：①md 无增强 ②md 带合法 enhanced.json ③html 直传 ④上传失败退出码 4 且缓存保留、重跑跳过 CONVERT（以日志断言）；stdout 契约正则断言。

### C-08 静态加密器
- 里程碑 M2 ｜ 依赖 C-04 ｜ 必读：docs/04 §9（逐字段）、docs/00 D4、docs/02 §3.3
- **目标**：`src/encrypt.js`：内容页 HTML → 加密壳单文件（含门禁 UI 与内嵌解密 JS）。
- **步骤**：Node 侧 `node:crypto` 做 gzip+AES-256-GCM+PBKDF2(600k)；壳页内嵌 WebCrypto 解密（vault JSON per docs/04 §9）；访问码生成器（8 位 Crockford Base32，展示 XXXX-XXXX）；门禁 UI 按 docs/02 §3.3（自动聚焦/回车/粘贴清洗/错误态/强度小字）。
- **验收**：往返测试：加密→用 Node 模拟壳内算法解密→与原文一致；错码解密必败（GCM）；壳文件无外链；`iter>=600000` 常量断言；正确码含连字符/小写输入均可解。

### C-09 管理命令 list / unpublish
- 里程碑 M2 ｜ 依赖 C-07 ｜ 必读：docs/04 §3、docs/02 §3.5、E4/E5
- **目标**：`list`（表格+`--json`）与 `unpublish`（二次确认、调适配器 unpublish、更新 manifest）。
- **步骤**：list 展示 title/target/url/updatedAt/code；unpublish 支持文件路径或 id 定位；确认提示按 docs/02 §3.5 文案（含各目标生效时长告知）；`--yes` 跳确认。
- **验收**：test：mock 适配器下 unpublish 后 manifest 条目移除、适配器收到调用；无 `--yes` 且非 TTY 时退出码 5；list --json 输出可 JSON.parse 且字段齐。

### C-10 模板：meeting（会议纪要）
- 里程碑 M3 ｜ 依赖 C-05 ｜ 必读：docs/04 §8（槽位）、docs/02 §3.4（线框）、docs/05 §4（组件条件）
- **目标**：`src/templates/meeting/`：conclusions/actions/open_issues/discussion 四槽。
- **步骤**：actions 渲染为「负责人+事项+期限」卡片组（≥3 条时）；discussion 默认 `<details>` 折叠；打印样式展开折叠；空槽位不渲染标题。
- **验收**：快照测试；断言：discussion 在 details 内、缺 open_issues 输入时无空标题、打印 CSS 含 `details[open]` 规则。
（C-11 proposal、C-12 tutorial、C-13 release 同构：各自槽位见 docs/04 §8，组件条件见 docs/05 §4，验收同为快照+槽位断言。三卡与 C-10 互相独立可并行。）

### C-11 模板：proposal（方案提案）
- 里程碑 M3 ｜ 依赖 C-05 ｜ 必读同 C-10 ｜ 槽位 summary/problem/solution/plan/risks；risks 用表格仅当 ≥3 条同构。验收同构 C-10。

### C-12 模板：tutorial（教程指南）
- 里程碑 M3 ｜ 依赖 C-05 ｜ 必读同 C-10 ｜ 槽位 overview/prerequisites/steps/faq；steps 保序编号、代码块样式突出；faq 用 details。验收同构 C-10 + 步骤顺序断言。

### C-13 模板：release（发布公告）
- 里程碑 M3 ｜ 依赖 C-05 ｜ 必读同 C-10 ｜ 槽位 highlights/changes/upgrade_notes；changes 支持"新增/修复/破坏性"分组徽标。验收同构 C-10。

### C-14 风格：editorial + darktech
- 里程碑 M3 ｜ 依赖 C-06 ｜ 必读：docs/05 §3（适用信号）、docs/02 §6
- **目标**：补齐 4 风格。editorial：杂志感标题层级与阅读节奏；darktech：固定深色、代码高亮优先。
- **验收**：同 C-06（对比度断言、无外链、快照）；4 风格 × 5 模板共 20 组合渲染无异常（循环冒烟测试）。

### C-15 高级设置
- 里程碑 M3 ｜ 依赖 C-07 ｜ 必读：docs/04 §2.1、docs/01 F15
- **目标**：`config` 子命令：`show`、`target <t>`、`selfhost`（交互录入 baseUrl/token）、defaults 的 get/set。
- **验收**：test：set 后 config.json 字段正确、show 不泄漏 token 全文（脱敏显示后 4 位）；publish 读取 defaults 生效（mock 断言）。

---

## P 系列 — 发布适配器

### P-01 适配器接口 + selfhost 适配器
- 里程碑 M1 ｜ 依赖 C-03；联调依赖 S-01 ｜ 必读：docs/04 §5（接口逐字）、§6.1、mdshare lib/api.js
- **目标**：`src/adapters/index.js`（注册/查找/AdapterError）+ `selfhost.js` 完整实现 detect/publish/unpublish。
- **步骤**：detect=config 有 selfhost 段；publish 调 POST/PUT /api/pages（有 id 则 PUT）；错误码按 docs/04 §1 映射 AdapterError。
- **验收**：test 起本地 mock http 服务断言请求体与 Bearer 头；409/413/401 各自转为正确 AdapterError；**联调验收**（S-01 完成后补跑）：对真实 server 发布→curl 门禁页→unlock→拿到内容。

### P-02 Vercel 适配器
- 里程碑 M2 ｜ 依赖 P-01、C-08 ｜ 必读：docs/00 D8、docs/04 §2.3/§5、docs/03 §2（走官方 CLI 的理由）
- **目标**：`src/adapters/vercel.js`：站点镜像目录 + `npx vercel deploy --prod --yes` 部署。
- **步骤**：detect=`npx vercel whoami` 退出码；首次 publish 创建 project（config.vercel.project，默认 htmlshare-pages）与镜像目录（docs/04 §2.3 布局，根 index.html 空白页）；写入 `s/<id>/index.html` 后全量部署；从 CLI 输出解析生产 URL；unpublish=删目录重部署。
- **验收**：单测：镜像目录写入布局断言、vercel 命令以 mock child_process 断言参数；**联调验收（需人工一次：vercel login）**：真实发布两次 URL 不变（D8）、unpublish 后 404。

### P-03 Cloudflare Pages 适配器
- 里程碑 M2 ｜ 依赖 P-01、C-08 ｜ 必读同 P-02
- **目标**：`src/adapters/cloudflare.js`，机制与 P-02 同构（`npx wrangler pages deploy`）。
- **验收**：同构 P-02（mock 断言 + 一次需人工联调 wrangler login）。

### P-04 目标探测与首配引导
- 里程碑 M2 ｜ 依赖 P-01~P-03 ｜ 必读：docs/00 D7、docs/02 §3.1/3.2
- **目标**：`src/adapters/resolve.js`：按 D7 顺序探测；全无 → 输出 docs/02 §3.2 引导文案退出码 3；探测成功一次即写回 config.defaultTarget（提示"已记住"）。
- **验收**：test 枚举探测矩阵（8 种凭据组合）断言选择结果与 D7 一致；引导文案快照；记住行为断言。

### P-05 cloud 适配器
- 里程碑 M5 ｜ 依赖 P-01、V-02（云端设备码 API 就绪）｜ 必读：docs/04 §6.2、docs/00 D9
- **目标**：`src/adapters/cloud.js` = selfhost 逻辑复用 + `htmlshare login` 子命令（设备码轮询流程）。
- **步骤**：login：POST /api/auth/device → 展示 verificationUrl+userCode（尝试自动开浏览器）→ 按 interval 轮询 token → 存 config.cloud.token；publish 复用 selfhost 请求逻辑，402/403 错误给出升级/清理提示文案。
- **验收**：mock 服务测设备码全流程（pending→granted→过期三分支）；403 QUOTA_EXCEEDED 文案含 `list` 清理指引；**弱耦合断言：cloud.js 不被 core/其他适配器 import（依赖方向单测）**。

---

## K 系列 — Skill 封装与安装

### K-01 SKILL.md v1（Claude Code）
- 里程碑 M1 ｜ 依赖 C-07 ｜ 必读：docs/05 全文（母版）、docs/04 §3/§4、mdshare SKILL.md（体例参考）、docs/02 §3
- **目标**：可用的主源 SKILL.md：触发词、发布流程指令（agent 生成 enhanced.json → 调 CLI → 转达链接+码话术）、失败兜底指令（docs/05 §6）。
- **步骤**：frontmatter（name=htmlshare, description 含中英触发语料）；正文命令式：何时增强/何时直传/60s 放弃增强规则/输出话术模板（链接与码分两行便于分开转发）。
- **验收**：结构 lint（frontmatter 字段齐）；在 Claude Code 中实测一次 md 发布走通（**需人工确认输出话术体验**）；SKILL.md 中引用的每条命令在 CLI --help 中存在（脚本断言）。

### K-02 install.sh 多 agent 安装器
- 里程碑 M2 ｜ 依赖 K-01 ｜ 必读：docs/00 D11、mdshare install.sh
- **目标**：`curl -fsSL <raw url>/install.sh | bash` 一行安装：clone/更新到 `~/.htmlshare`，`npm install --omit=dev`，探测并安装到所有已装 agent。
- **步骤**：探测 `~/.claude/skills/`、`~/.codex/`、OpenClaw/Hermes 目录（K-03/K-04 提供各家落位规则，本卡先实现 Claude + 占位钩子）；已安装则更新；幂等；结尾打印「对你的 agent 说：分享 <某文件>」上手指引。
- **验收**：bash 严格模式（set -euo pipefail）；在干净 $HOME 沙箱目录跑两遍（幂等断言）；无 sudo；shellcheck 通过。

### K-03 Codex 封装
- 里程碑 M2 ｜ 依赖 K-02 ｜ 必读：docs/00 D11；Codex skill/AGENTS 注入约定（执行时查 Codex 当前版本文档，写明所依据的版本）
- **目标**：`agents/codex/`：从 SKILL.md 生成 Codex 可识别格式 + install.sh 落位逻辑。
- **验收**：生成物与 SKILL.md 关键指令逐段对应（生成脚本可重跑幂等）；在 Codex CLI 实测一次发布（**需人工**，进 NEEDS_HUMAN 联调清单）。

### K-04 OpenClaw / Hermes 封装
- 里程碑 M2 ｜ 依赖 K-02 ｜ 必读同 K-03（各自安装约定，执行时核实并记录版本）
- **目标**：`agents/openclaw/`、`agents/hermes/` 封装与落位。
- **验收**：同构 K-03（生成幂等 + 各一次人工联调）。

## U 系列 — 界面原型先行（2026-07-04 追加，见 docs/00 D15/Q6）

> 门禁规则：U-03 未 done，C-05/C-06/C-10~C-14 不得开工（依赖已在 TASKBOARD 更新）。C-01~C-04、C-07~C-09、P/S/K 各卡不受门禁约束，可与 U 系列并行。

### U-01 设计方向样张
- 里程碑 M1 ｜ 依赖：无（纯静态 HTML，不依赖任何代码卡）｜ 必读：docs/02A §1~§4、设计基准两份（notion / linear.app）
- **目标**：clinical 缺省 token 下的通用文档页样张 1 张 + minimal/editorial/darktech 各 1 张（同一内容四主题），交用户比选确认方向（Q6 在此点前可免费换向）。
- **验收**：4 张样张过 docs/02A §7 清单可自证项；用户反馈已收集并将结论写入 docs/00 变更记录（**需人工**）。

### U-02 高保真原型包
- 里程碑 M1 ｜ 依赖 U-01 ｜ 必读：docs/02A §5（覆盖清单逐项）、§4/§6/§7
- **目标**：纯静态 HTML 原型包 `prototype/`：覆盖 docs/02A §5 全部 14 项，含可点击的双模式切换与门禁三态演示；一条命令本地打开（`npx serve prototype` 或直接 file://）；作为 C 系列实现的黄金标杆入库。
- **验收**：覆盖清单 14/14 勾销（索引页逐项链接）；§7 可自证项全过（脚本断言 token/对比度/零外链）；负面清单逐条为否。

### U-03 客户确认门禁卡
- 里程碑 M1 ｜ 依赖 U-02 ｜ 必读：SKILL 升级版原型门禁协议（AGENTS.md）
- **目标**：打包交付原型（启动命令+逐页走查清单写入 NEEDS_HUMAN）→ 收集反馈 → 修改 → 再走查，直至用户明确确认；确认结论与日期记入 docs/00 变更记录。
- **验收**：docs/00 变更记录存在确认条目（**需人工**）；反馈修改轮次与内容在本卡完成说明留痕。等待期间执行 agent 只做不受门禁约束的卡，绝不空转。

### K-05 SKILL.md 完整增强规则
- 里程碑 M3 ｜ 依赖 K-01、C-10~C-14 ｜ 必读：docs/05 全文
- **目标**：把 docs/05 §2~§4/§6 完整落进 SKILL.md（rubric 表、风格表、组件条件、兜底），并同步到 agents/* 变体。
- **验收**：SKILL.md 中模板/风格枚举与 docs/04 §8 逐字一致（脚本 diff 断言）；用 docs/05 样例 A/B/C 的 md 在 Claude Code 实测三次，rubric 判定与预期一致（**判定结果可自证：enhanced.json 的 template 字段断言；版式质量需人工**）。
