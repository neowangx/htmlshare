# 04 数据模型与 API 契约

> **本文件是所有端解耦的唯一契约。** 实现中发现契约有误：先改本文件 + docs/00 变更记录留痕，再改代码（AGENTS.md 契约纪律）。
> 必读前置：docs/00（D3/D4/D8/D9/D13）

## 1. 通用约定

- 编码 UTF-8；时间一律 ISO 8601 UTC 字符串。
- 分享 id：6 位 `[a-z0-9]`，服务端/CLI 生成时排除易混字符 `l,o,0,1`。
- 访问码：服务端目标默认 4 位数字；静态目标默认 8 位 Crockford Base32，展示格式 `XXXX-XXXX`（连字符仅展示，校验前剥离，D4）。
- 错误响应统一：`{ "error": "<错误码>", "message": "<人话>" }`。

**错误码总表**（各端共用，不得私加同义码）：

| HTTP | error | 含义 |
|------|-------|------|
| 400 | INVALID_INPUT | 请求体/参数不合法 |
| 401 | UNAUTHORIZED | token 缺失或无效 |
| 402 | PLAN_REQUIRED | 需付费计划（仅 cloud） |
| 403 | QUOTA_EXCEEDED | 超配额（仅 cloud） |
| 404 | NOT_FOUND | id 不存在或已撤回 |
| 409 | ID_CONFLICT | 显式指定的 id 已被占用 |
| 413 | TOO_LARGE | 超单页体积上限 |
| 410 | EXPIRED | 分享已过期（页面到期），或设备码已过期（cloud 登录流程） |
| 428 | AUTH_PENDING | 设备码尚未激活（仅 cloud 登录流程） |
| 429 | RATE_LIMITED | 解锁尝试/请求过频 |
| 500 | INTERNAL | 服务端错误 |

## 2. CLI 本地数据

### 2.1 config.json（`~/.config/htmlshare/config.json`，全部可选）

```json
{
  "defaultTarget": "vercel",            // selfhost|cloud|vercel|cloudflare
  "defaults": { "template": "auto", "style": "auto", "code": "auto" },
                                        // code: auto|none|<固定码>
  "selfhost": { "baseUrl": "https://x.example.com", "uploadToken": "..." },
  "cloud":    { "baseUrl": "https://htmlshare.app", "token": "..." },
  "vercel":   { "project": "htmlshare-pages" },
  "cloudflare": { "project": "htmlshare-pages" },
  "footerBadge": true
}
```

### 2.2 manifest.json（`~/.config/htmlshare/manifest.json`）

```json
{ "entries": [ {
    "source": "/abs/path/会议纪要.md",
    "target": "vercel",
    "id": "k3f9m2",
    "url": "https://htmlshare-pages-x.vercel.app/s/k3f9m2/",
    "code": "7XK4Q2NM",                 // --public 时为 null
    "title": "产品评审会纪要",
    "template": "meeting", "style": "clinical",
    "expiresAt": "2026-08-01T00:00:00.000Z", // 无过期为 null
    "createdAt": "...", "updatedAt": "..."
} ] }
```
键规则：`source+target` 唯一；同源文件重发 → 复用 entry（D8）。`expiresAt` 由 `--expires`/发布时确认设置，`htmlshare sweep` 据此清理已过期分享。

### 2.3 静态站点镜像（`~/.local/share/htmlshare/sites/<target>/<project>/`）

```
s/<id>/index.html      # 每份分享一个目录（明文或加密壳）
index.html             # project 根：空白页（禁止列目录）
```

## 3. CLI 命令契约

```
htmlshare publish <file> [--target T] [--template X] [--style Y]
                         [--code C | --public] [--title S] [--force]
                         [--enhanced <enhanced.json>]   # 宿主 agent 产出（D6）
htmlshare list [--json]
htmlshare unpublish <file|id> [--yes]
htmlshare config [target|selfhost|show]
```
- 成功时 stdout 最后两行固定为 `URL: <url>` 与 `CODE: <code|none>`（供 agent 可靠提取）。
- 退出码：0 成功；2 输入错误；3 无可用目标；4 上传失败（产物已暂存）；5 撤回未确认。

## 4. 增强片段契约（agent → CLI，A2UI 静态子集，D6）

增强内容采用 **A2UI v0.9 协议的静态子集**（见 docs/11）：模型输出一棵组件树（扁平列表 + ID 引用建树），CLI 在发布时解析数据绑定、丢弃交互，渲染成单文件静态 HTML。完整组件与主题枚举见 §8。

```json
{
  "protocol": "a2ui/0.9-static",
  "theme": "clinical",                 // 见 §8 主题枚举；也可省略，由 --style 决定
  "title": "产品评审会纪要",
  "root": "c0",
  "dataModel": { "rate": "92%" },      // 可选：Dynamic 属性 { "$path": "/rate" } 的取值来源
  "components": [
    { "id": "c0", "component": "Column", "children": ["hero", "stat"] },
    { "id": "hero", "component": "Hero", "kicker": "产品评审", "headline": "Q3 评审结论" },
    { "id": "stat", "component": "StatGrid", "items": [ { "value": { "$path": "/rate" }, "label": "完成率" } ] }
  ]
}
```

- **不变量**：模型只给类型化组件 + 结构化属性；HTML 全部由渲染器产出。唯一自由文本入口是 `RichText`/`Callout` 的 html 字段，强制走 sanitize 白名单。
- **降级（D6）**：JSON 非法 / `root` 缺失 / `components` 为空 → 回退忠实版；未知组件 / 悬空 ID 引用 → 跳过并告警；`Chart` 数据不可用 → 降级为表格；音视频/Lottie → 降级为链接或静态图。发布永不因增强失败而中断。

## 5. 适配器接口（src/adapters/*，D3）

```js
// 每个适配器导出（伪代码签名，实现语言 JS）
export const name = 'vercel';
export async function detect()  // → { available: bool, reason?: string }（不抛异常）
export async function publish({ html, id, meta })
        // html: 最终单文件字符串（静态目标已含加密壳）
        // id: manifest 复用的 id 或 null（由适配器生成并返回）
        // meta: { title, encrypted: bool, code: string|null }
        // → { id, url }   失败抛 AdapterError(code, message)，code 用 §1 错误码
export async function unpublish({ id })   // → void，幂等
```
服务端类适配器把 `code` 传给服务端存储；静态类适配器忽略 `meta.code`（码已封装进加密壳）。

## 6. 服务端 HTTP API（selfhost 与 cloud 同构，D9）

### 6.1 核心（两端一致）

**POST /api/pages** — 新建。`Authorization: Bearer <token>`
```json
{ "html": "<!doctype html>...", "id": null, "code": "4821",
  "title": "...", "expiresAt": "2026-08-01T00:00:00.000Z",  // 可选，无过期为 null
  "meta": { "template": "meeting", "style": "clinical" } }
```
→ 201 `{ "id": "k3f9m2", "url": "https://.../s/k3f9m2/", "version": 1 }`
错误：401 / 409（显式 id 冲突）/ 413 / 403(仅 cloud)；`expiresAt` 非法 → 400

**PUT /api/pages/{id}** — 更新内容（码不变；含 `"code"` 字段则同时改码；含 `"expiresAt"` 字段则同时改期，缺省保留）→ 200 `{ "version": 2 }`

**PATCH /api/pages/{id}/meta** （Bearer）— 只改元数据不发新版本。`{ "expiresAt": "..."|null }` → 200 `{ "id", "expiresAt" }`；用于 `htmlshare expire`。

**DELETE /api/pages/{id}** — 撤回（软删 7 天后清除）→ 204

**GET /api/pages/{id}/meta** （Bearer）→ 200 `{ "id","title","version","createdAt","updatedAt","expiresAt": null,"hasCode": true }`；已过期 → 410 EXPIRED（并软删入 7 天宽限）

**GET /s/{id}/** — 无码页面直接返回 HTML；有码返回门禁页（含 CSRF 无关的纯表单）。已过期 → 410「链接已过期」页（首次访问即软删，宽限期从到期时刻起算）。
**POST /s/{id}/unlock** — `{ "code": "4821" }`
→ 200 返回内容 HTML + `Set-Cookie: hs_<id>=<会话签名>; Path=/s/<id>; HttpOnly; SameSite=Strict; Max-Age=86400`
→ 403 `{"error":"INVALID_INPUT","message":"访问码不正确"}`；429 限速（默认 5 次/分/IP）。

### 6.2 cloud 独有（选装，selfhost 返回 404 即可）

**POST /api/auth/device** → 201 `{ "deviceCode":"...", "userCode":"HXK-29P", "verificationUrl":"https://<BASE_URL>/activate", "expiresIn":600, "interval":5 }`
**POST /api/auth/token** `{ "deviceCode":"..." }` → 200 `{ "token":"..." }` | 428 `{"error":"AUTH_PENDING"}` | 410 过期
（激活页流程：用户浏览器打开 verificationUrl → 输 userCode + 邮箱 → 邮件验证码 → 绑定并放行 token。）
**GET /api/me** （Bearer）→ `{ "email","plan":"free|pro","usage":{"pages":12,"limitPages":20} }`
**GET /api/pages?limit&offset** （Bearer）→ 自己的页面列表（字段同 meta）。

## 7. 服务端数据模型

### 7.1 selfhost（文件系统，D13）

```
data/<id>/meta.json   { id, title, codeHash(scrypt), createdAt, updatedAt,
                        deletedAt|null, expiresAt|null, versions: [{n, at, bytes}] }
data/<id>/v<n>.html
```

### 7.2 cloud（SQLite + 文件系统）

```sql
users  (id PK, email UNIQUE, plan TEXT DEFAULT 'free', token_hash,
        created_at, last_active_at)
pages  (id TEXT PK, owner_id → users, title, code_hash, bytes,
        version INT, created_at, updated_at, deleted_at NULL)
versions (page_id, n, bytes, created_at, PRIMARY KEY(page_id, n))  -- 内容仍在文件系统
usage_events (id PK, owner_id, kind TEXT/*publish|view*/, page_id, at)
```
索引：`pages(owner_id)`、`usage_events(owner_id, at)`。

## 8. A2UI 组件 / 主题枚举（跨文档统一，禁止别名）

- **主题** `clinical|minimal|editorial|darktech`（另有 auto，表示交给 CLI 或 A2UI theme 决定）
- **组件** `Text|RichText|Column|Row|Grid|Card|Divider|List|Table|Image|Hero|StatGrid|Callout|Quote|Timeline|Tabs|Chart|Button`
- **容器**（用 `children: [id...]` 引用子组件）：`Column`（纵排）、`Row`（横排）、`Grid`（自适应网格）、`Card`（面板）、`Tabs`（CSS-only 标签页，`tabs:[{label,children}]`）。
- **内容**：`Text{text,variant:h1|h2|h3|body|caption}`、`RichText{html}`、`List{items[],ordered?}`、`Table{headers[],rows[][]}`、`Divider`、`Image{src,alt}`（仅 https/data 源）。
- **强调块**：`Hero{kicker?,headline,meta?}`、`StatGrid{items:[{value,label}]}`、`Callout{tone:info|warning|success|danger,html}`、`Quote{text,cite?}`、`Timeline{items:[{title,detail?,time?}]}`。
- **数据可视化**：`Chart{kind:line|bar|pie,series:[{label,value}]}` → 发布时内联 SVG。
- **降级**：`Button{text,href?}`（无 URL 则降级为静态标签）；`Audio/Video/Lottie` 降级为链接。
- 公共区：`title`、双模式（增强/原文）开关、页脚由包壳层统一提供。

## 9. 静态加密包格式（encrypt.js ↔ 壳内解密 JS）

单文件 HTML 内嵌：
```html
<script type="application/json" id="hs-vault">
{ "v": 1, "kdf": "PBKDF2-SHA256", "iter": 600000,
  "salt": "<b64 16B>", "iv": "<b64 12B>", "ct": "<b64 密文>" }
</script>
```
- 明文 = 完整内容页 HTML（gzip 后加密：`ct = AES-256-GCM(gzip(html))`，壳内用 DecompressionStream 解压）。
- key = PBKDF2(码去连字符转大写, salt, iter)。GCM 认证失败 = 码错。
- 参数只可上调不可下调（D4）；`v` 字段为兼容演进预留。

## 10. 发布产物页面内约定

- 双模式开关：`#hs-toggle` 元素，两版内容分别在 `#hs-enhanced` 与 `#hs-faithful`，切换仅改 `hidden` 属性；无增强版时不渲染开关。
- 页脚固定 `.hs-footer`（footerBadge=false 时整块不输出）；`<meta name="robots" content="noindex">` 恒在。
