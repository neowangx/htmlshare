# htmlshare

Publish AI-generated Markdown or self-contained HTML as a polished shareable page: readable layout, faithful original view, stable link, and a lightweight access code.

![htmlshare page overview](examples/screenshots/overview.svg)

## 30-Second Start

Install from a local checkout:

```bash
HOME="$(mktemp -d)" HTMLSHARE_SOURCE_DIR="$PWD" HTMLSHARE_INSTALL_DIR="$(mktemp -d)/htmlshare" bash ./install.sh
```

Check the CLI:

```bash
node ./bin/htmlshare.js --help
```

After install, ask your agent to share a file, or run `htmlshare publish ./note.md`. htmlshare keeps a faithful original view and, for Markdown, lets the host agent add an enhanced reading view.

Official Studio/cloud is the default zero-setup path: sign in with `htmlshare login`, publish without managing a server, and start with 100MB free storage. Need more space? Upgrade the official service, or configure your own Vercel, Cloudflare, or compatible self-hosted target.

## What Is Open Source

This repository contains the cross-agent skill, CLI, local configuration, templates, styles, static adapters, cloud/selfhost protocol adapters, and the protocol documentation. The official hosted cloud server implementation is not part of the open-source product. If you use the official Studio/cloud option, the open-source CLI talks to that service through the documented API.

If you want to run your own compatible endpoint, see [server/README.md](server/README.md). Content responsibility belongs to the person publishing and the platform they choose.

htmlshare can coexist with mdshare. Commands, config, cache, and manifest paths are separate.

## Targets

| Target | Best For | Setup | Access Code |
|---|---|---|---|
| official cloud | zero operations, stable default sharing | `htmlshare login` | server-side gate |
| Vercel | static hosting on your own account | Vercel CLI login | static encrypted shell |
| Cloudflare Pages | static hosting on your own account | Wrangler login | static encrypted shell |
| selfhost | your own compatible server | base URL + upload token | server-side gate |

Official cloud starts with 100MB free storage. Larger official quotas are paid; Vercel and Cloudflare usage depends on your own accounts.

## Templates And Styles

Templates organize information. Styles change the visual theme. They are independent.

| Template | Slots |
|---|---|
| `generic` | `body` |
| `meeting` | `conclusions`, `actions`, `open_issues`, `discussion` |
| `proposal` | `summary`, `problem`, `solution`, `plan`, `risks` |
| `tutorial` | `overview`, `prerequisites`, `steps`, `faq` |
| `release` | `highlights`, `changes`, `upgrade_notes` |

| Style | Use When |
|---|---|
| `clinical` | business, meetings, proposals; the default |
| `minimal` | long text, notes, essays |
| `editorial` | public reading, tutorials, announcements |
| `darktech` | code-heavy developer material |

## Safety Notes

Access codes are lightweight sharing protection, not strong secrecy. Do not publish credentials, legal evidence, medical/financial secrets, or anything that must never leave your machine.

Enhanced pages are reading aids. Facts, numbers, names, dates, commitments, and code blocks must stay exact, and the faithful original view is always the fallback source of truth.

HTML direct upload preserves the file you provide. If you publish arbitrary HTML, responsibility for that HTML belongs to you.

## Useful Commands

Inspect current config:

```bash
HOME="$(mktemp -d)" node ./bin/htmlshare.js config show
```

Typical installed usage:

- `htmlshare login`
- `htmlshare publish ./note.md`
- `htmlshare list`
- `htmlshare unpublish ./note.md --yes`
- `htmlshare config selfhost --base-url https://share.example.com --token <token>`
- `htmlshare config defaults style minimal`

## FAQ

**What if enhancement fails?**
htmlshare publishes the faithful original version and reports the reason.

**What if the agent changes a fact?**
That is a bad enhancement. The faithful original view is always present and should be treated as authoritative.

**Can I update a link?**
Yes. Publishing the same source to the same target updates the existing manifest entry when the adapter supports stable ids.

**Can I revoke a page?**
Use `htmlshare unpublish`. Static platforms can have CDN cache delay; server-side targets can remove access immediately.

**Can I use my own server?**
Yes. Run a compatible self-hosted endpoint or implement the API in [docs/04-数据模型与API契约.md](docs/04-数据模型与API契约.md).

## 中文简介

htmlshare 是一个跨 agent 的开源发布 skill：把 AI 生成的 Markdown 或自包含 HTML 变成可分享网页，返回链接和访问码。Markdown 会保留「原文版」，也可以由宿主 agent 生成「增强版」方便阅读。

默认路径是官方 Studio/云服务：用户不用配置服务器，登录后获得 100MB 免费空间；更多空间需要付费扩容，也可以改用自己的 Vercel、Cloudflare 或兼容自托管服务。官方云服务端代码不作为开源产品发布，开源仓提供 CLI、skill、模板/风格、设置项、适配器和协议。
