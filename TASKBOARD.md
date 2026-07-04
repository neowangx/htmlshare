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
| U-03 | M1 | 客户确认门禁卡（阻塞全部界面实现卡） | U-02 | blocked | 等待人工走查 `prototype/index.html` 并将确认结论写入 docs/00；见 NEEDS_HUMAN H13。 |
| C-05 | M1 | 模板骨架 + generic | C-04, U-03 | todo | |
| C-06 | M1 | 风格骨架 + clinical/minimal | C-05, U-03 | todo | |
| P-01 | M1 | 适配器接口 + selfhost | C-03 | done | 实现 adapter registry/AdapterError/selfhost detect/publish/unpublish；mock HTTP 覆盖 Bearer/请求体/409/413/401；`npm test` 通过（53 tests），真实 server 联调按 S-05 补跑。 |
| S-01 | M1 | 服务端移植改名 | C-01 | done | 实现 htmlshare selfhost 基础 server：POST /api/pages、门禁页、unlock、scrypt codeHash、`data/<id>/meta.json + v1.html`；`PORT=0 node server/server.js` 启动测试通过；`npm test` 通过（57 tests）。 |
| S-02 | M1 | 门禁与限速完善 | S-01 | done | 补 unlock 内存滑窗限速、成功后 cookie 直通、Path/HttpOnly/SameSite/Max-Age 断言、跨 id 不串；`npm test` 通过（60 tests）。 |
| S-03 | M1 | REST 契约补齐 | S-02 | done | 补齐 PUT/DELETE/GET meta、统一错误码、413 体积上限、RETAIN_VERSIONS 滚动清理与软删不丢数据；`npm test` 通过（66 tests）。 |
| S-05 | M1 | 服务端回归套件 | S-03, P-01 | todo | |
| C-07 | M1 | publish CLI 编排 | C-03, C-04, P-01 | todo | |
| K-01 | M1 | SKILL.md v1 (Claude Code) | C-07 | todo | |
| C-08 | M2 | 静态加密器 | C-04 | todo | |
| C-09 | M2 | list / unpublish | C-07 | todo | |
| P-02 | M2 | Vercel 适配器 | P-01, C-08 | todo | |
| P-03 | M2 | Cloudflare 适配器 | P-01, C-08 | todo | |
| P-04 | M2 | 目标探测与首配引导 | P-01, P-02, P-03 | todo | |
| S-04 | M2 | Docker 部署脚本 | S-03 | todo | |
| K-02 | M2 | install.sh 多 agent 安装 | K-01 | todo | |
| K-03 | M2 | Codex 封装 | K-02 | todo | |
| K-04 | M2 | OpenClaw/Hermes 封装 | K-02 | todo | |
| C-10 | M3 | 模板 meeting | C-05, U-03 | todo | |
| C-11 | M3 | 模板 proposal | C-05, U-03 | todo | |
| C-12 | M3 | 模板 tutorial | C-05, U-03 | todo | |
| C-13 | M3 | 模板 release | C-05, U-03 | todo | |
| C-14 | M3 | 风格 editorial + darktech | C-06, U-03 | todo | |
| C-15 | M3 | 高级设置 config | C-07 | todo | |
| K-05 | M3 | SKILL.md 完整增强规则 | K-01, C-10~C-14 | todo | |
| G-02 | M4 | GitHub 仓库与 CI（CI 可 M1 后早启） | C-01; Q4 | todo | |
| G-01 | M4 | README 与文档 | K-05 | todo | |
| G-03 | M4 | examples 一键体验 | G-01 | todo | |
| G-04 | M4 | v0.1.0 发布 | G-01, G-02, G-03 | todo | |
| V-01 | M5 | 私有仓初始化 + 多租户模型 | S-03 | todo | |
| V-02 | M5 | 设备码登录 | V-01 | todo | |
| V-03 | M5 | 配额与用量 | V-02 | todo | |
| V-04 | M5 | 计划限制与回收（Q3 截止点） | V-03 | todo | |
| V-05 | M5 | 用户控制台 | V-02 | todo | |
| P-05 | M5 | cloud 适配器 + login | P-01, V-02 | todo | |
| V-06 | M5 | 部署上线（Q1 截止点） | V-04, V-05 | todo | |
| V-07 | M5 | 计费接入（Q2 截止点守卫） | V-06 | todo | |

## 里程碑达成记录

（每个里程碑出口回归通过后在此追加一行）

- M0 地基：2026-07-04 达成。证据：`npm test` 通过（26 tests）；目录结构对齐 docs/03 §5；`git log` 含 C-01/C-02/C-03；运行路径隔离检查，代码/配置默认路径为 `htmlshare`，无 mdshare 路径残留。
