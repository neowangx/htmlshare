# htmlshare

[English](README.md) | [简体中文](README.zh-CN.md)

把 AI 生成的 Markdown 或自包含 HTML 发布成精心设计的可分享网页：有清晰排版、原文忠实视图、稳定链接和轻量访问码。

![htmlshare 页面概览](examples/screenshots/overview.svg)

## 30 秒开始

一行安装。脚本会自动探测 Claude Code、Codex、OpenClaw 和 Hermes，并安装到对应 agent：

```sh
curl -fsSL https://raw.githubusercontent.com/neowangx/htmlshare/main/install.sh | bash
```

确保 `~/.local/bin` 已在 `PATH` 中，然后对你的 agent 说：

```text
分享 ./note.md
```

如果你已经 clone 了本仓库，也可以从本地源码安装：

```bash
HTMLSHARE_SOURCE_DIR="$PWD" bash ./install.sh
```

检查 CLI：

```bash
htmlshare --help
```

安装后可以让 agent 帮你分享文件，也可以直接运行：

```bash
htmlshare publish ./note.md
```

官方 Studio/云服务是默认零配置路径：运行 `htmlshare login` 登录后，不需要自己搭服务器即可发布，并获得 100MB 免费空间。需要更多空间时，可以升级官方服务；也可以切换到自己的 Vercel、Cloudflare 或兼容自托管服务。

## 开源范围

本仓库包含跨 agent skill、CLI、本地配置、模板、风格、静态托管适配器、云/自托管协议适配器，以及协议文档。

官方托管云服务端实现不包含在这个开源产品里。选择官方 Studio/云服务时，开源 CLI 会通过文档化 API 与官方服务通信。

如果你想运行自己的兼容服务端，请看 [server/README.md](server/README.md)。发布内容的责任属于发布者，以及发布者选择的平台。

htmlshare 可以和 mdshare 共存。命令、配置、缓存和 manifest 路径都是分开的。

## 发布目标

| 目标 | 适合场景 | 需要配置 | 访问码 |
|---|---|---|---|
| official cloud | 零运维、默认稳定分享 | `htmlshare login` | 服务端门禁 |
| Vercel | 用自己的 Vercel 账号静态托管 | Vercel CLI 登录 | 静态加密壳 |
| Cloudflare Pages | 用自己的 Cloudflare 账号静态托管 | Wrangler 登录 | 静态加密壳 |
| selfhost | 你自己的兼容服务端 | base URL + upload token | 服务端门禁 |

官方云默认提供 100MB 免费空间。更大的官方配额需要付费；Vercel 和 Cloudflare 的用量取决于你自己的账号。

## 模板与风格

模板负责信息结构，风格负责视觉呈现。二者互相独立。

| 模板 | 槽位 |
|---|---|
| `generic` | `body` |
| `meeting` | `conclusions`, `actions`, `open_issues`, `discussion` |
| `proposal` | `summary`, `problem`, `solution`, `plan`, `risks` |
| `tutorial` | `overview`, `prerequisites`, `steps`, `faq` |
| `release` | `highlights`, `changes`, `upgrade_notes` |

| 风格 | 适合内容 |
|---|---|
| `clinical` | 商务、会议、方案；默认风格 |
| `minimal` | 长文、笔记、随笔 |
| `editorial` | 面向公开阅读的教程、公告、发布说明 |
| `darktech` | 代码较多的开发者材料 |

## 安全说明

访问码是轻量分享保护，不是强安全机制。不要发布凭据、法律证据、医疗/金融机密，或任何绝不能离开本机的内容。

增强版页面只是阅读辅助。事实、数字、姓名、日期、承诺和代码块必须保持准确；原文忠实视图始终是兜底事实来源。

直接发布 HTML 时，htmlshare 会保留你提供的 HTML。任意 HTML 的内容与安全责任由你自己承担。

## 常用命令

查看当前配置：

```bash
htmlshare config show
```

常用操作：

- `htmlshare login`
- `htmlshare publish ./note.md`
- `htmlshare list`
- `htmlshare unpublish ./note.md --yes`
- `htmlshare config selfhost --base-url https://share.example.com --token <token>`
- `htmlshare config defaults style minimal`

## 常见问题

**增强失败怎么办？**

htmlshare 会发布原文忠实版，并报告原因。

**如果 agent 改错事实怎么办？**

这是不合格增强。原文忠实视图始终存在，并应作为权威版本。

**能更新同一个链接吗？**

可以。同一个源文件发布到同一目标时，如果适配器支持稳定 id，会更新现有 manifest 记录。

**能撤回页面吗？**

可以。运行 `htmlshare unpublish`。静态平台可能有 CDN 缓存延迟；服务端目标可以立即移除访问。

**网络中断会丢失转换结果吗？**

不会。转换产物会缓存；再次发布同一文件时会复用缓存，只重试上传。

**Vercel/Cloudflare 登录过期怎么办？**

CLI 会报 `UNAUTHORIZED` 上传错误。重新运行 `npx vercel login` 或 `npx wrangler login` 后再发布，缓存产物会被复用。

**忘了访问码怎么办？**

运行 `htmlshare list`，`code` 列会显示这台机器发布过的页面访问码。

**页面超过免费单页限制怎么办？**

本地图片会被内联为 data URI，可能让页面变大。可以压缩或移除大图，或者发布到更高配额的目标。过大的图片会保留为链接并给出 warning，不会静默内联。

**官方云不可用怎么办？**

切换目标：`htmlshare publish ./note.md --target vercel`，也可以用 `cloudflare` 或 `selfhost`。各目标配置互相独立，一个目标不可用不会阻塞其他目标。

**可以用自己的服务器吗？**

可以。运行兼容自托管端点，或按 [docs/04-数据模型与API契约.md](docs/04-数据模型与API契约.md) 实现 API。
