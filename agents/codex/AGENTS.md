# htmlshare

Generated from ../../SKILL.md by scripts/generate-agent-wrappers.js.
Codex CLI basis: verified locally against codex-cli 0.142.5 on 2026-07-04; user-level instructions are loaded from ~/.codex/AGENTS.md, so install.sh injects this snippet there.

## When To Use

Use this skill when the user wants to publish, share, or update a Markdown/HTML artifact created by an agent. It supports Markdown enhancement, faithful original view, HTML direct upload, stable links, and lightweight access protection.

Do not use it for strong secrets, private credentials, legal evidence, or anything that should never leave the machine.

## Publish Flow

1. Identify the source file. If the user has not named one, ask for the file path.
2. If the file ends in `.html` or `.htm`, upload it directly without rewriting it:

```bash
htmlshare publish <file.html>
```

3. If the file is Markdown, decide whether to create an enhanced view. Default to enhanced unless the user asks for faithful-only or time is tight.
4. For enhancement, **compose an A2UI component tree** that fits the content — pick the components each section actually needs instead of a fixed template. Choose one theme. If the user explicitly sets `--style` or a config default, obey it.

Themes: `clinical`, `minimal`, `editorial`, `darktech`.

Components: `Text`, `RichText`, `Column`, `Row`, `Grid`, `Card`, `Divider`, `List`, `Table`, `Image`, `Hero`, `StatGrid`, `Callout`, `Quote`, `Timeline`, `Tabs`, `Chart`, `Button`.

5. Write `a2ui.json` next to a temporary working file using the A2UI static subset (a flat component list linked by id; containers reference children by id; `{ "$path": "/x" }` reads from `dataModel`):

```json
{
  "protocol": "a2ui/0.9-static",
  "theme": "clinical",
  "title": "产品评审会纪要",
  "root": "c0",
  "dataModel": { "rate": "92%" },
  "components": [
    { "id": "c0", "component": "Column", "children": ["hero", "stat", "note"] },
    { "id": "hero", "component": "Hero", "kicker": "产品评审", "headline": "Q3 评审结论", "meta": "2026-07-11" },
    { "id": "stat", "component": "StatGrid", "items": [{ "value": { "$path": "/rate" }, "label": "完成率" }] },
    { "id": "note", "component": "RichText", "html": "<p>正文，仅白名单标签。</p>" }
  ]
}
```

6. Run:

```bash
htmlshare publish <file.md> --enhanced <a2ui.json>
```

If enhancement takes more than 60 seconds, skip it and run:

```bash
htmlshare publish <file.md>
```

## Enhancement Rules

Red lines:

- Never change facts: numbers, dates, amounts, names, conclusions, and commitments must remain exact.
- Never drop information. Every original information point must remain available in the enhanced view, using `<details>` only for background, process detail, raw notes, or appendices.
- Never add opinions, interpretations, conclusions, or facts not present in the original. TL;DR items may summarize only what the source already says.
- Preserve code blocks, quotes, and links exactly.

Compose the tree to fit the content. Start with a top-level `Column`; a lead `Hero` for the title/context is usually right; then add the components each part needs. Containers (`Column`, `Row`, `Grid`, `Card`, `Tabs`) reference children by id.

Component reference:

| Component | Use for |
|---|---|
| `Text{text,variant}` | headings (`h1`/`h2`/`h3`), body paragraphs, captions |
| `RichText{html}` | prose with inline markup; only sanitize-whitelist tags survive |
| `List{items,ordered?}` | bullet or numbered points |
| `Table{headers,rows}` | real two-dimensional data (e.g. owner / task / deadline) |
| `Hero{kicker,headline,meta}` | the document's lead banner |
| `StatGrid{items:[{value,label}]}` | a few headline numbers |
| `Callout{tone,html}` | a highlighted note — `info`/`warning`/`success`/`danger` |
| `Quote{text,cite}` | a pulled quote |
| `Timeline{items:[{title,detail,time}]}` | ordered events / discussion points |
| `Tabs{tabs:[{label,children}]}` | alternative views side by side (CSS-only, no JS) |
| `Chart{kind,series:[{label,value}]}` | numeric comparison — `bar`/`line`/`pie`, rendered as inline SVG |
| `Card`/`Row`/`Grid`/`Divider`/`Image`/`Button` | grouping, layout, media, links |

Theme selection, unless the user configured or requested a style:

| Theme | Use when |
|---|---|
| `clinical` | business/client-facing material, meetings, proposals; restrained professional card layout; default when unsure |
| `minimal` | pure text long reads, analysis, essays; typography does almost all the work |
| `editorial` | public-facing reading, tutorials, release announcements; stronger headline rhythm |
| `darktech` | code-heavy material, developer audience, prototype/demo companion notes |

Content rules:

- Never change facts and never drop information; the enhanced tree must carry every information point the source has.
- Only put HTML in `RichText`/`Callout` `html` fields, and only sanitize-whitelist tags — everything else is structured props, never raw HTML.
- Use `Table` only when the source has real two-dimensional data. Do not force prose into a table.
- Use `Chart` only when the source has real numeric series; otherwise use `StatGrid` or `List`.
- Use card groups (`Grid` of `Card`) only when there are at least 3 similar items.
- Local image, audio, video, poster, subtitle, download-link, and CSS `url(...)` references may be relative to the source Markdown/HTML file. The publisher embeds them into the final HTML, so they upload and expire/delete with the page. Keep remote URLs unchanged; do not manually replace local files with temporary web links.

## Failure Fallbacks

If the agent cannot produce `enhanced.json`, including headless mode, a weak model, or a user request to skip enhancement, publish without `--enhanced` and say this share is the faithful original version.

If the A2UI JSON fails to validate (bad JSON, missing `root`/`components`, or unknown components), try once to fix it using the warning. If it still fails, publish without `--enhanced` and include one short reason.

If enhancement takes more than 60 seconds, stop enhancing and publish without `--enhanced`.

If the user requested a style that appears mismatched, obey the user and do not second-guess the choice.

If upload fails, report the failure and mention that the rendered artifact is cached for retry.

If a referenced local file is missing, unreadable, unsafe as an image (for example active SVG), or the local-resource total exceeds the collector limit, publishing stops before upload. Fix/remove the broken reference and retry; never claim a page was shared while keeping a known broken local link.

If no target is configured, first check whether someone has given the user an `hsi_` invite code — if so, that is the intended target: enroll with `htmlshare login <hsi_...>` (see **Cloud Invite** above) and publish there. Otherwise follow the CLI guidance: if the user has a VPS or server, help them configure `selfhost` first with `htmlshare config selfhost --base-url <url> --token <token>`; if they do not have a VPS or want to skip host setup, help them use Cloudflare Pages (`npx wrangler login`) or another available static target.

## Response Template

After publishing, relay the CLI's last two lines exactly, then add one short sentence about the protection level:

```text
URL: <url>
CODE: <code|none>
```

Tell the user that the access code is lightweight sharing protection, not strong secrecy.
