# htmlshare / htmlshare-cloud 实现度与代码审查报告

日期：2026-07-06　审查基线：开源仓 `npm test` 151/151 全绿，云仓 27/27 全绿。
方法：5 路并行审查（核心层 / CLI 与适配器 / 开源服务端 / 云服务端 / skill 与发布物），逐条对照 docs/00·04·05·06·07·08 设计要求，关键缺陷均已实测复现。

> **修复状态（2026-07-06 更新）**：本报告全部 P0/中等/理解偏差/冗余项已在分支 `fix/review-2026-07-06`（两仓同名分支）修复，并补充回归测试。修复后开源仓 `npm test` 161/161、云仓 31/31 全绿；服务端契约测试 s01~s03 两仓仍逐字节一致（D9）。详见 docs/00 变更记录 2026-07-06 两条。

> 一句话结论：**架子扎实、测试全绿，但"绿"掩盖了产品级断裂。** 有 5 个必须在任何真实发布/上线前修复的阻断项，其中 3 个直接击穿"访问码保护"这一核心安全承诺，2 个是可被直接利用的服务端漏洞。测试没抓住它们，是因为测试大多在验证"算法/文本片段"，而非"端到端真实路径"。

---

## 一、阻断级问题（P0 — 发布/上线前必修）

### B1. 静态加密壳在浏览器里永远无法解密（HTML 实体转义 bug）
`src/encrypt.js:54`
```js
<script type="application/json" id="hs-vault">${escapeHtml(vaultJson(vault))}</script>
```
`<script>` 是 HTML raw-text 元素，浏览器**不解码实体**。vault 里的 `"` 被 `escapeHtml` 转成 `&quot;`，壳内 JS `JSON.parse(...textContent)` 拿到字面 `&quot;`，解析必失败。
**实测**：生成壳的 vault 内容为 `{&quot;v&quot;:1,...}`，`JSON.parse` 报 `Expected property name`。→ 任何加密页面输对访问码也只会显示"访问码不正确或页面已损坏"。
测试盲区：`test/encrypt.test.js` 直接拿返回的 `vault` 对象解密，从未从壳 HTML 里解析 vault。
修复：vault 只含 base64 与固定键，无需转义；如防 `</script>` 注入，把 `<` 替换为 `<` 即可。

### B2. 静态目标加密完全未接线 —— 打印了 CODE，页面却是明文（D4 静态轨形同虚设）
`src/cli/publish.js:241` 硬编码 `encrypted: false`；全仓库除测试外**零处调用 `encryptHtml`/`generateStaticCode`**；`src/adapters/vercel.js`、`cloudflare.js` 不引用 `code`/`encrypt`。
后果：`htmlshare publish x.md --target vercel` 会打印 `CODE: 4821` 并写进 manifest，但上线的是**明文 HTML**，任何拿到 URL 的人无需码即可打开。这违反 D4（静态目标 8 位 Crockford + 客户端加密）与"链接+访问码"统一体验，属**安全承诺失实**。
附带：静态目标码应为 8 位 Crockford，`randomCode()` 恒生成 4 位数字。
（核心层、CLI 两路独立复现，指向同一根因。）

### B3. 服务端 SESSION_SECRET 有公开硬编码默认值 → 门禁可被完全绕过
`server/server.js:63`　`const secret = options.secret || process.env.SESSION_SECRET || "htmlshare-dev-secret";`
`UPLOAD_TOKEN` 缺失会 `exit(1)`，但 `SESSION_SECRET` 缺失静默回退到开源代码里写死的字符串；`server/.env.example` 与 `server/deploy.sh` 都未设它。
后果：会话 cookie 由 `signSession(secret,{id,exp})` HMAC 签名。任何人用公开默认 secret 自算签名，构造 `Cookie: hs_<id>=<伪造>`，即可 `GET /s/<id>/` 拿到受保护内容，**无需访问码**。所有走 deploy.sh 的部署共用同一可预测密钥，D4 服务端限速防爆破被架空。
修复：secret 缺失即拒绝启动，写入 .env.example 与 deploy.sh。

### B4. POST /api/pages 的 body.id 未校验 → 路径穿越写任意文件（两仓同源）
`server/lib/store.js`（开源与云仓 `createPage` 一致）+ `server/server.js`
PUT/DELETE/GET 路由用正则 `[a-z0-9]{6}` 约束 id，但 **POST 从请求体取 id 且完全不校验**。
**实测**：`join('/srv/data','../../tmp/evil')` → `/tmp/evil`。携带合法 token 的客户端发 `{"id":"../../../tmp/evil","html":"..."}` 即可在 data 目录外写 `meta.json`/`v1.html`（鉴权后沙箱逃逸/任意文件写）。云仓因任意免费用户皆有 token，风险更高。
修复：`createPage` 入口对显式 id 断言 `^[a-z0-9]{6}$`（并排除 l/o/0/1），非法即 400。

### B5. 云端邮箱/控制台验证码可暴力破解 → 账号接管
`server/lib/auth.js:159` `confirmConsoleLogin`、`:183` `confirmEmailVerification`
验证码 6 位数字（~20 bit），有效期 10 分钟，但**失败不消费、不计数、不锁定**；`/activate` 与 `/console/verify` **未挂任何限速器**（`createUnlockLimiter` 只用于 `/s/{id}/unlock`，已核实）。
后果：10 分钟内穷举百万组合（~1667 次/秒）即可冒名 `/activate` 拿受害者 Bearer token，或登录控制台删光其页面、重置访问码。直接违反 V-02/V-05"验证码安全（熵、过期、尝试次数）"。
修复：每 code 限 5 次尝试后失效 + 对两个端点加 IP/邮箱级限速。

---

## 二、中等问题（真实使用中大面积退化）

### CLI / 编排层
- **C1 网络不可达崩溃且退出码错误**：`selfhost.js:47`/`cloud.js:43` 的 `fetch` 拒绝未包装为 AdapterError，`publish.js` catch 只认 AdapterError，其余 rethrow 到顶层。实测 `TypeError: fetch failed`、exit 1（契约应为 4）。服务器不可达是最常见故障却直接崩。
- **C2 缓存键不含渲染参数**：`publish.js:45-48` cacheKey 仅 `路径:mtime:size`。二次带 `--enhanced`/`--style` 重发命中旧产物，且 title 退化为文件名并以错误 title PUT 到服务端。
- **C3 重发布每次换码并覆盖服务端旧码**：`chooseCode()` 不读既有 entry 的 code，PUT body 恒含 code。契约 §6.1 是"码不变"，实现等于每次改码，已分享的码全部失效（D8 稳定分享被打掉一半）。
- **C4 用户 `--style`/`--template` 被 enhanced.json 覆盖**：`compose.js:180` `hasEnhanced ? enhanced.style : style`，实测 `--style minimal` + `enhanced.style=clinical` → 输出 clinical。`--template` 仅写进 manifest 不影响渲染。违反 D5/docs05 §3"用户指定无条件服从"。
- **C5 增强降级静默 + 损坏 enhanced.json 崩溃**：`publish.js:71` 裸 `JSON.parse` 无 try（损坏即 SyntaxError/exit 1，违反 D6"照常成功"）；V1/V2/V6 失败时丢弃 `page.validation`，无一行原因输出。SKILL.md 指示 agent"用 validation error 重试一次"，但 CLI 从不输出该 error —— **SKILL.md 的降级/重试指令在当前 CLI 上是空转的**。
- **C6 静态"稳定链接"真实环境大概率破功**：`parseDeployUrl` 取 stdout 最后一个 URL，真实 `wrangler pages deploy` 输出带 hash 的部署 URL，每次 manifest 里 URL 会变。测试用刻意构造的 mock stdout 掩盖。P-02/P-03 的"两次 URL 不变"是人工项 H1/H2，未验、风险未闭环。
- **C7 其它**：`--target 未知名` 崩溃（应 exit 2）；unpublish 在 TTY 下无二次确认；unpublish 按 id 定位被 defaultTarget 过滤会误报 not found；上传无重试（状态机要求重试 2 次）；Cloudflare 首次发布不创建 project；`--force` 语义被挪用为"跳缓存"而非契约的"超限仍发布"；unpublish 遇 404 抛错不幂等。

### 核心层
- **K1 TOC/锚点全断链**：`sanitize.js:56` allowedAttributes 无 `id`，markdown-it-anchor 加的 heading id 被剥，`[[toc]]` 链接指向不存在的锚点，页内跳转全失效。anchor/toc 两个插件实质无效。
- **K2 图片 data URI 内联缺失（D12）**：相对路径 `<img src="photo.png">` 原样穿透，无内联、无体积告警。含本地图片的 md 发布后是破图 + 非自包含页面。
- **K3 模板管道分隔是未记载的私有协议**：meeting/tutorial/proposal 按 `｜|` 切负责人/事项/期限，但 docs/04 Schema 与 SKILL.md 都没告诉 agent 要用管道格式。agent 产出自然语句时，每张卡渲染成"未指定"。测试全用管道数据喂，掩盖互操作断裂。
- **K4 模板 li 重组剥光富文本**：meeting/tutorial/release 的 `stripTags` 把 li 内 `<code>`/`<a>`/`<strong>` 剥成纯文本，与"代码/链接原样保留"冲突。
- **K5 代码高亮视觉不存在**：sanitize 放行 `hljs-*` class，但 compose 与 4 个 style 文件里 `hljs-` 出现 0 次，无一行高亮 CSS。C-14"darktech 代码高亮优先"未落实。
- **K6 release 变更分类正则吞字**：`修复了登录问题` → `了登录问题`；`Fixed the bug` → `ed the bug`。测试样例全带冒号，未覆盖。
- **K7 打印展开折叠无效**：`details:not([open])>*{display:block}` 无法覆盖 UA shadow DOM 的隐藏，应改 `beforeprint` 加 open 属性。

### 服务端 / 云端
- **S1 `.dockerignore` 位置错误完全失效**：构建上下文是仓库根，Docker 只读根目录 `.dockerignore`，放在 `server/` 下的规则不生效 → `data/`、`.git/`、`node_modules/`、`server/test/` 全被打进上下文/镜像。应移到仓库根。
- **S2 软删缺 7 天物理清除**：docs/04 §6.1 承诺"软删 7 天后清除"，两仓均只写 `deletedAt` 标志，无任何清理调度，数据无限堆积。
- **S3 Bearer token 用 `===` 非恒时比较**（server.js:55），访问码/会话都用了 timingSafeEqual，唯独最高权限的上传 token 没用。
- **S4 限速在反代后退化**：两仓都用 `req.socket.remoteAddress` 且不解析 X-Forwarded-For（防伪造是对的），但 Caddy/nginx 后所有访客共用一个限速桶，"5 次/分/IP"失效且正常用户互相牵连。需文档明确受信任反代下的 XFF 策略。
- **S5 镜像装了服务端用不到的 CLI 依赖**（markdown-it/sanitize-html/highlight.js），server 代码零 npm 运行依赖，违反 D14 极简。
- **V1 CLI 与控制台共用单一 `token_hash`（互踢下线）**：`users` 表仅一列 token_hash，设备码登录与邮箱控制台登录都 UPDATE 同一列 → 登录一个踢掉另一个，多设备也只留最后一个。控制台 cookie 里还存明文 API token，偷 cookie = 全量 API 权限。应 token 与会话分表。
- **V2 浏览计数同步执行且异常会 500**：`server.js:301` `recordUsage` 同步、无 try/catch，写库失败会被外层 catch 变 500，页面打不开。V-03 明确要求"异步写、失败仅日志、不阻塞"。
- **V3 存储配额只按最新版字节计**：`pages.bytes` 只存最新版大小，但磁盘每页保留至多 20 个历史版本，100MB 免费额度最坏对应约 20× 真实占用。应按所有保留版本累计计费。
- **V4 控制台登录泄露邮箱是否注册**（404 vs 200 可枚举）；每请求新开 SQLite 连接并重跑 migrate、未设 busy_timeout/WAL，高并发易 SQLITE_BUSY。

### skill / 发布物
- **P1 README 没有 D11 的 curl 一行安装**：全文 grep 无 `curl`（已核实）。README 的"30 秒上手"是装进临时 HOME 的测试友好版，命令一结束即全丢，真实用户照做得到空安装。属"教实现迁就测试"。
- **P2 `disable-model-invocation: true` 与触发语料自相矛盾**（SKILL.md:4，已核实）：设了该开关，精心写的中英触发语料不会自动触发，只能显式 `/htmlshare`，与 K-01"触发词"验收冲突。若有意（外发动作要求显式调用），应在 docs/00 留决策痕。
- **P3 install.sh 三家探测不一致 + 覆盖/误删风险**：Claude 要求 skills 目录已存在否则静默漏装；`rm -rf "$INSTALL_DIR"` 无条件执行（指向已有非 git 目录会删光，触碰数据丢失红线）；`ln -sfn` 目标是真实目录时会把链接建进目录内部致升级后静默失效。
- **P4 Codex 注入不幂等**：每次安装向 `~/.codex/AGENTS.md` 累积一个空行（沙箱实测 3 次每轮多一空行）。K-02 验收是"跑两遍幂等"，测试只 grep marker 计数测不出累积。
- **P5 README FAQ 缺 E5（忘记访问码 → list 可查码）**等 G-01 要求条目；`examples/screenshots/overview.svg` 是虚构手绘示意图，非 G-01 要求的真实产出截图（门禁页、4 风格拼图缺失）。
- **P6 server/README 泄漏内部运维约定**（server/README.md:35 让用户"读 ~/.claude/infrastructure.md"），发布前应剥离（呼应 D16"release 前检查开源包泄漏"）。

---

## 三、理解偏差（与设计意图不符，非纯 bug）

- **D6 降级链路整体空转**：设计核心卖点是"agent 增强失败 → 降级忠实版 + 告知原因 + agent 可重试"。实现里 CLI 丢弃 validation、不输出原因、损坏输入直接崩，使 D6 的失败兜底与 SKILL.md 的重试指令都无法真正发生。这是对 D6 的系统性理解偏差。
- **D4 双轨保密**：把"服务端轨"（4 位码 + 服务端门禁）实现得不错，但"静态轨"（客户端加密 + 8 位码）从加密壳 bug 到未接线整条断裂，等于只实现了一半却对用户宣称两轨统一体验。
- **D5 正交但用户指定未优先**：模板×风格正交体系实现得好，但"用户 `--style/--template` 无条件服从"被 enhanced.json 反向覆盖，优先级理解反了。
- **D3 分层方向**：`templates/registry.js`、`styles/registry.js` 从 `adapters/errors.js` 引 `AdapterError` —— core 层反向依赖 adapters 层，且模板查找错误本不是"适配器错误"。错误类应下沉到 lib。
- **D16 官方云默认项未落地到引导**：`resolve.js` 首配三选一仍是 Vercel/Cloudflare/自托管，无官方云/`login` 入口（Q5 注明可延后，但 D16 已锁定）。

---

## 四、冗余 / 死代码

- `store.js` 两仓 `Object.hasOwn({code},"code")` 恒为真，等价于 `code !== undefined`。
- `pages.js` `gatePage(id,{error})` 的 error 参数从不传入（死参数）。
- 核心层 `github-markdown-css` 全仓零引用（死依赖）；`convert.js` 双重 parse；`headings[].slug` 无消费方且与 anchor slug 算法不一致；`escapeHtml` 在 convert/encrypt 重复实现。
- CLI：`cloud.js` 与 `selfhost.js` 约 70 行近乎逐字复制（弱耦合只禁反向 import，cloud→selfhost 复用合法）；`vercel.js`/`cloudflare.js` 成对复制；`state.json` 只写不读。
- 云仓 `code.js`/`cookie.js`/`ratelimit.js`/`pages.js` 与开源仓逐字节重复（D9 弱耦合的代价）—— 意味着 B4 这类修复要手动同步两处，建议加一致性回归校验。

---

## 五、确认无误的亮点（做得对的地方）

- **加密原语本身正确**：salt 16B/IV 12B 每次独立随机、PBKDF2-SHA256 恒 600k 有断言、GCM tag 拼接顺序符合 WebCrypto、Crockford 无模偏差 40 bit 熵达标 —— 只可惜被 B1/B2 整体架空。
- **sanitize 白名单真实收紧**：`allowedSchemes:[]`、SVG data URI 显式拦截、protocol-relative 关闭，对抗用例是真实攻击面测试。
- **V1~V6 校验器与 docs/05 §5 处置表逐条对应**，对抗样例 D 落实到位。
- **config/manifest 达标**：原子写 temp+rename、损坏 JSON 报错保原文、幂等 upsert、路径隔离无 mdshare 残留。
- **D9 协议同构性通过**：云仓 s01~s03 契约测试与开源仓逐字节一致（已 diff 确认），核心端点路径/响应/错误码完全一致，cloud 仅叠加 403 QUOTA_EXCEEDED。
- **云端安全基本盘扎实**：SQL 全参数化、token 一次性 + sha256 存储、越权(IDOR)校验完整、回收逻辑(180+14 天/访问豁免/软删可恢复)由时间注入测试验证、配额检查在同步事务内无 TOCTOU。
- **服务端亮点**：体积上限流式检查（防大 body DoS）、访问码 scrypt + timingSafeEqual、跨 id cookie 隔离、RETAIN_VERSIONS 滚动清理正确、Docker 非 root + 持久卷 + deploy.sh 用 printf %q 转义。
- **枚举防漂移设计出色**：skill-enhancement 测试从 docs/04 §8 原文解析枚举，三方(契约/registry/SKILL.md)一致性断言；三份 agent 封装由生成器产出并在测试中重跑断言字节相等，不存在人肉维护重复段落。
- **README D16 三项声明齐全且被测试锁定**；examples 零外链自证到位；package.json 依赖符合 D14 白名单。

---

## 六、修复优先级建议

1. **先修 5 个 P0**（B1→B2→B5→B3→B4）：都是可被直接利用或使核心承诺失实的问题，且现有测试完全没覆盖。B1+B2 建议一并做（补加密接线 + 修壳转义 + 从壳解析 vault 的端到端测试）。
2. **再修 D6 降级链路**（C5）：把原始字符串交给 `validateEnhanced`，stderr 输出 `ENHANCED: <原因>` 一行，让 SKILL.md 的重试指令生效。
3. **然后**：C1/C2/C3/C4（CLI 真实路径）、S1/V1/V2（部署与云端体验）、K1/K2（自包含与锚点）。
4. **文档/发布物**：README 补 curl 安装与 E5 FAQ、剥离 server/README 内部约定、P2 的 disable-model-invocation 拍板留痕。

> 测试策略反思：当前测试大量在断言"文本片段存在"（grep hljs、grep details[open]、grep 管道数据），而非"端到端真实行为"（浏览器能否解密、agent 自然产出能否渲染、静态目标是否真加密）。建议对 B1/B2/K3 这类补"从最终产物反向验证"的测试。
