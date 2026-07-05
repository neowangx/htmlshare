# TASKBOARD — 开发执行看板（单一事实源）

> 状态：todo｜doing｜done｜blocked。完成时附一行说明。卡片详情见 docs/06~09。
> 本文件只记录**开发执行**，规划进度在 PLAN.md，两者互不混写。

| 卡号 | 里程碑 | 任务 | 依赖 | 状态 | 完成说明 |
|------|--------|------|------|------|---------|
| C-01 | M0 | 仓库脚手架 | — | done | 建立 Node>=20 零构建脚手架；`npm install && npm test` 通过（3 tests）；git 初始化完成。 |
| C-02 | M0 | 忠实转换器移植 | C-01 | done | 移植转换与净化模块，导出 `convertFaithful(md) -> { html, title, headings }`；`npm test` 通过（17 tests）。 |
| C-03 | M0 | config/manifest 模块 | C-01 | done | 按 docs/04 §2 实现 `~/.config/htmlshare` config/manifest；覆盖空配置、upsert 幂等、路径隔离、损坏 JSON 保护；`npm test` 通过（26 tests）。 |
| C-04 | M1 | 双模式组装器 compose | C-02 | done | 实现单文件 compose 与 V1~V6 enhanced 校验；覆盖对抗样例、toggle、忠实区逐字节保持、HTML 直传；`npm test` 通过（35 tests）。 |
| U-01 | M1 | 设计方向样张（4 风格比选） | — | done | 生成 `prototype/u01/` 四风格样张；§7 可自证项测试通过（41 tests）；人工项待验：样张比选反馈与 Q6 确认写入 docs/00。 |
| U-02 | M1 | 高保真原型包（02A §5 全覆盖） | U-01 | done | 生成 `prototype/` 高保真包，覆盖 docs/02A §5 14/14；可点击切换/门禁状态/极端数据齐全；`npm test` 通过（47 tests）。 |
| U-03 | M1 | 客户确认门禁卡（阻塞全部界面实现卡） | U-02 | done | 用户确认 `prototype/index.html` 原型走查通过，结论已写入 docs/00 变更记录（2026-07-05）；D15 门禁解除。 |
| C-05 | M1 | 模板骨架 + generic | C-04, U-03 | done | 新增 `src/templates/registry.js` 与 `src/templates/generic/`，compose 接入模板 registry；generic 槽位、非法模板枚举错误、确定性渲染快照均有测试；`npm test` 通过（119 tests）。 |
| C-06 | M1 | 风格骨架 + clinical/minimal | C-05, U-03 | done | 新增 `src/styles/registry.js` 与 clinical/minimal token CSS，compose 接入 style registry 并让 CLI defaults/--style 真正影响页面；覆盖内联零外链、深浅色、reduced-motion、正文对比度 ≥4.5；`npm test` 通过（124 tests）；人工项待验：H16 视觉走查。 |
| P-01 | M1 | 适配器接口 + selfhost | C-03 | done | 实现 adapter registry/AdapterError/selfhost detect/publish/unpublish；mock HTTP 覆盖 Bearer/请求体/409/413/401；`npm test` 通过（53 tests），真实 server 联调按 S-05 补跑。 |
| S-01 | M1 | 服务端移植改名 | C-01 | done | 实现 htmlshare selfhost 基础 server：POST /api/pages、门禁页、unlock、scrypt codeHash、`data/<id>/meta.json + v1.html`；`PORT=0 node server/server.js` 启动测试通过；`npm test` 通过（57 tests）。 |
| S-02 | M1 | 门禁与限速完善 | S-01 | done | 补 unlock 内存滑窗限速、成功后 cookie 直通、Path/HttpOnly/SameSite/Max-Age 断言、跨 id 不串；`npm test` 通过（60 tests）。 |
| S-03 | M1 | REST 契约补齐 | S-02 | done | 补齐 PUT/DELETE/GET meta、统一错误码、413 体积上限、RETAIN_VERSIONS 滚动清理与软删不丢数据；`npm test` 通过（66 tests）。 |
| S-05 | M1 | 服务端回归套件 | S-03, P-01 | done | 新增真实 server × selfhost adapter 端到端 publish→update→unlock→unpublish 回归；修复 adapter 循环导入；`npm test` 通过（67 tests）。 |
| C-07 | M1 | publish CLI 编排 | C-03, C-04, P-01 | done | 实现 `htmlshare publish` COLLECT→RECORD 编排、HTML 直传、enhanced 读入、缓存断点、stdout `URL/CODE` 契约与退出码；`npm test` 通过（71 tests）。 |
| K-01 | M1 | SKILL.md v1 (Claude Code) | C-07 | done | 编写 Claude Code 主源 `SKILL.md`，含触发语料、宿主 agent 增强流程、60s 兜底、输出话术；结构/help 断言通过；`npm test` 通过（73 tests），人工项待验：Claude Code 实测话术体验。 |
| C-08 | M2 | 静态加密器 | C-04 | done | 实现 gzip+PBKDF2-SHA256(600k)+AES-256-GCM 静态加密壳、8 位 Crockford 访问码、WebCrypto 解密 UI；`npm test` 通过（78 tests）。 |
| C-09 | M2 | list / unpublish | C-07 | done | 实现 `list` 表格/JSON 与 `unpublish` 定位、确认、适配器调用、manifest 移除；修正 CLI flag 解析；`npm test` 通过（81 tests）。 |
| P-02 | M2 | Vercel 适配器 | P-01, C-08 | done | 实现 Vercel 静态镜像目录、deploy/unpublish 与 `npx vercel` mock 验收；`npm test` 通过（85 tests）；人工项待验：H1 登录后真实发布/撤回联调。 |
| P-03 | M2 | Cloudflare 适配器 | P-01, C-08 | done | 实现 Cloudflare Pages 静态镜像目录、deploy/unpublish 与 `npx wrangler` mock 验收；`npm test` 通过（89 tests）；人工项待验：H2 登录后真实发布/撤回联调。 |
| P-04 | M2 | 目标探测与首配引导 | P-01, P-02, P-03 | done | 实现 D7 目标自动探测 resolver、首次无目标三选一引导、自动记住 defaultTarget；覆盖 8 种探测矩阵与 CLI 集成；`npm test` 通过（95 tests）。 |
| S-04 | M2 | Docker 部署脚本 | S-03 | done | 增加多阶段非 root Dockerfile、持久卷部署脚本与结构测试；`docker build` 成功、容器 `/healthz` 冒烟通过、shellcheck 通过、`npm test` 通过（97 tests）；人工项待验：H3 真机部署。 |
| K-02 | M2 | install.sh 多 agent 安装 | K-01 | done | 实现一行安装器：clone/update 到 `~/.htmlshare`、`npm install --omit=dev`、安装 CLI symlink、Claude skill symlink，并为 Codex/OpenClaw/Hermes 留占位探测；干净 HOME 沙箱跑两遍幂等、shellcheck 通过、`npm test` 通过（99 tests）。 |
| K-03 | M2 | Codex 封装 | K-02 | done | 基于本机 codex-cli 0.142.5 与 `~/.codex/AGENTS.md` 约定生成 Codex 封装；安装器支持 marker 幂等注入；生成物与 SKILL.md 关键指令逐段对应；shellcheck 通过、`npm test` 通过（101 tests）；人工项待验：H4 Codex 真实发布。 |
| K-04 | M2 | OpenClaw/Hermes 封装 | K-02 | done | 基于本机 Hermes Agent v0.18.0 与 `~/.hermes/skills`、`~/.openclaw/skills` 目录约定生成 SKILL.md 封装；安装器支持 symlink 落位；生成物与 SKILL.md 关键指令逐段对应；shellcheck 通过、`npm test` 通过（102 tests）；人工项待验：H4 OpenClaw/Hermes 真实发布。 |
| C-10 | M3 | 模板 meeting | C-05, U-03 | done | 新增 meeting 专用模板 renderer：行动项 ≥3 条渲染负责人/事项/期限卡片组，discussion 默认 details 折叠，空 open_issues 不渲染标题，打印样式包含 details 展开规则；`npm test` 通过（128 tests）。 |
| C-11 | M3 | 模板 proposal | C-05, U-03 | done | 新增 proposal 专用模板 renderer：summary/problem/solution/plan/risks 槽位按序渲染，risks 仅在 ≥3 条结构化风险时表格化，否则保留原 HTML；`npm test` 通过（131 tests）。 |
| C-12 | M3 | 模板 tutorial | C-05, U-03 | done | 新增 tutorial 专用模板 renderer：overview/prerequisites/steps/faq 按序渲染，steps 保序编号，faq 自动转 details，代码块保持原样；`npm test` 通过（135 tests）。 |
| C-13 | M3 | 模板 release | C-05, U-03 | done | 新增 release 专用模板 renderer：highlights/changes/upgrade_notes 按序渲染，changes 支持新增/修复/破坏性/其他分组徽标，缺失 upgrade_notes 不渲染空标题；`npm test` 通过（138 tests）。 |
| C-14 | M3 | 风格 editorial + darktech | C-06, U-03 | done | 新增 editorial/darktech 两套 token 风格，style registry 补齐 4 枚举；覆盖 editorial/darktech 对比度、零外链与 4 风格 × 5 模板组合冒烟；`npm test` 通过（141 tests）；人工项待验：H5/H17 视觉走查。 |
| C-15 | M3 | 高级设置 config | C-07 | done | 实现 `config show/target/selfhost/defaults`，show 脱敏 token 后 4 位；publish 读取 defaults 与 footerBadge；覆盖设置写入、脱敏、默认模板/风格/访问码生效；`npm test` 通过（106 tests）。 |
| K-05 | M3 | SKILL.md 完整增强规则 | K-01, C-10~C-14 | todo | |
| G-02 | M4 | GitHub 仓库与 CI（CI 可 M1 后早启） | C-01; Q4 | blocked | Q4 GitHub 归属与仓库名未在 docs/00 确认；按截止点守卫冻结，不执行建仓/推送不可逆动作；见 NEEDS_HUMAN H6。 |
| G-01 | M4 | README 与文档 | K-05 | todo | |
| G-03 | M4 | examples 一键体验 | G-01 | todo | |
| G-04 | M4 | v0.1.0 发布 | G-01, G-02, G-03 | blocked | 依赖 G-02；当前受 Q4 GitHub 归属与仓库名确认冻结，见 NEEDS_HUMAN H6。 |
| V-01 | M5 | 私有仓初始化 + 多租户模型 | S-03 | done | 初始化兄弟私有仓 `../htmlshare-cloud`（git commit `05d9202`），复制开源 server 契约测试原样通过，新增 better-sqlite3 索引层 users/pages/versions/usage_events 与文件系统一致性断言；云仓 `npm test` 通过（15 tests）。 |
| V-02 | M5 | 设备码登录 | V-01 | done | 在 `../htmlshare-cloud` 实现设备码登录（commit `a00ab2c`）：/api/auth/device、/api/auth/token、/activate 邮箱验证码 outbox、一次性 token 与 token_hash 存储，上传端点接受用户 Bearer；云仓 `npm test` 通过（18 tests）。 |
| V-03 | M5 | 配额与用量 | V-02 | done | 在 `../htmlshare-cloud` 实现配额与用量（commit `ae32114`）：用户 token 发布归属、/api/me、free/pro env 限制、页数/体积拦截、删除释放配额、view usage_events；云仓 `npm test` 通过（21 tests）。 |
| V-04 | M5 | 计划限制与回收（Q3 截止点） | V-03 | todo | |
| V-05 | M5 | 用户控制台 | V-02 | done | 在 `../htmlshare-cloud` 实现最小用户控制台（commit `a17b340`）：邮箱验证码登录、页面列表、删除、重置访问码、owner 越权保护，服务端渲染无前端框架；云仓 `npm test` 通过（23 tests）。 |
| P-05 | M5 | cloud 适配器 + login | P-01, V-02 | done | 实现开源 cloud 适配器与 `htmlshare login` 设备码轮询，发布复用 selfhost REST 契约，402/403 返回升级/清理提示，弱耦合断言保护核心层不引入 cloud；`npm test` 通过（114 tests）。 |
| V-06 | M5 | 部署上线（Q1 截止点） | V-04, V-05 | blocked | 依赖 V-04，且 Q1 域名/上线路线未在 docs/00 确认；按截止点守卫冻结部署上线，不读取真实部署凭据；见 NEEDS_HUMAN H7。 |
| V-07 | M5 | 计费接入（Q2 截止点守卫） | V-06 | blocked | Q2 已确认采用微信收款 + 手动开通过渡方案；当前仅因依赖 V-06 未完成而冻结。 |

## 里程碑达成记录

（每个里程碑出口回归通过后在此追加一行）

- M0 地基：2026-07-04 达成。证据：`npm test` 通过（26 tests）；目录结构对齐 docs/03 §5；`git log` 含 C-01/C-02/C-03；运行路径隔离检查，代码/配置默认路径为 `htmlshare`，无 mdshare 路径残留。
- M2 静态平台 + 多 agent：2026-07-04 可自证项达成。证据：C-08/C-09/P-02/P-03/P-04/S-04/K-02/K-03/K-04 全部 done；`npm test` 通过（102 tests）；`docker build` + selfhost 容器 `/healthz` 冒烟通过；install.sh 干净 HOME 沙箱幂等安装通过；人工项待验：H1/H2/H3/H4 真实目标/agent 联调。
