---
name: htmlshare
description: Publish AI-generated Markdown or self-contained HTML as a polished shareable web page with a stable link and access code. Use when the user says share/publish this markdown, generate a link, 发出去给人看, 分享这个 md/HTML, 发布 AI 产出物, or asks for a readable web page version of agent output.
---

# htmlshare

Turn a local Markdown or HTML file into a shareable page and return the link plus access code.

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
4. For enhancement, choose one template and one style. If the user explicitly sets `--template`, `--style`, or config defaults, obey the user even when the content appears mismatched.

Templates: `generic`, `meeting`, `proposal`, `tutorial`, `release`.
Styles: `clinical`, `minimal`, `editorial`, `darktech`.

5. Write `enhanced.json` next to a temporary working file using this schema:

```json
{
  "version": 1,
  "template": "meeting",
  "style": "clinical",
  "title": "产品评审会纪要",
  "tldr": ["定了：Q3 主打 X", "待定：预算周五前批"],
  "sections": [{ "slot": "conclusions", "html": "<ul><li>...</li></ul>" }]
}
```

6. Run:

```bash
htmlshare publish <file.md> --enhanced <enhanced.json>
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

Template rubric, checked from top to bottom. The first template with any 2 matching signals wins. If fewer than 2 signals match, use `generic`.

| Template | Signals |
|---|---|
| `meeting` | attendees/time/place; decisions or action-item language such as "决定", "负责", "截止"; content proceeds by speaker or agenda topic; title contains meeting/notes/review/sync wording such as "会议", "纪要", "评审", "同步" |
| `proposal` | states a problem and proposes a solution; has sections such as goal/solution/plan/budget/risk; tries to persuade a decision maker |
| `tutorial` | proceeds through numbered steps; has prerequisites or environment requirements; mainly imperative instructions such as run/click/install |
| `release` | starts with a version or date; includes change lists such as added/fixed/breaking changes; includes upgrade notes |
| `generic` | none of the above, including essays, analysis, notes, and mixed content |

Slot sets must match the selected template exactly:

| Template | Slots |
|---|---|
| `generic` | `body` |
| `meeting` | `conclusions`, `actions`, `open_issues`, `discussion` |
| `proposal` | `summary`, `problem`, `solution`, `plan`, `risks` |
| `tutorial` | `overview`, `prerequisites`, `steps`, `faq` |
| `release` | `highlights`, `changes`, `upgrade_notes` |

Style selection, unless the user configured or requested a style:

| Style | Use when |
|---|---|
| `clinical` | business/client-facing material, meetings, proposals; restrained professional card layout; default when unsure |
| `minimal` | pure text long reads, analysis, essays; typography does almost all the work |
| `editorial` | public-facing reading, tutorials, release announcements; stronger headline rhythm |
| `darktech` | code-heavy material, developer audience, prototype/demo companion notes |

Content rules:

- TL;DR must contain 1 to 5 items. Choose what the reader most needs to take away: conclusions first, then actions, then key data. Each item MUST be 40 characters or fewer (the CLI truncates longer items and warns).
- Fill only slots that have source content. Omit empty slots; never invent material to fill a slot.
- Use `<details>` only for process/background/raw/appendix content. Never hide primary conclusions, actions, risks, upgrade steps, or required instructions.
- Use card groups only when there are at least 3 similar items.
- Use tables only when the source has real two-dimensional data. Do not force prose into a table.
- For meeting/proposal action items, extract owner, task, and deadline and join them with a full-width pipe `｜` in that order inside each `<li>`, e.g. `<li>Alice｜提交预算方案｜周五前</li>`. The CLI splits on `｜` to render the owner/task/deadline card; a list item without pipes renders as task-only with owner/deadline shown as `未指定`. If a field is genuinely missing, write `未指定`; do not guess.
- For tutorial FAQ items, join question and answer with `｜`, e.g. `<li>如何回滚？｜执行 rollback 命令</li>`. For release change items, prefix with a label and separator so they group, e.g. `修复：登录失败` or `Fixed: login bug`.

## Failure Fallbacks

If the agent cannot produce `enhanced.json`, including headless mode, a weak model, or a user request to skip enhancement, publish without `--enhanced` and say this share is the faithful original version.

If `enhanced.json` validation fails because JSON/schema or template/style enum checks fail, try once to fix it using the validation error. If it still fails, publish without `--enhanced` and include one short reason.

If enhancement takes more than 60 seconds, stop enhancing and publish without `--enhanced`.

If the user requested a template or style that appears mismatched, obey the user and do not second-guess the choice.

If upload fails, report the failure and mention that the rendered artifact is cached for retry.

If no target is configured, follow the CLI guidance and help the user configure selfhost/cloud/Vercel/Cloudflare.

## Response Template

After publishing, relay the CLI's last two lines exactly, then add one short sentence about the protection level:

```text
URL: <url>
CODE: <code|none>
```

Tell the user that the access code is lightweight sharing protection, not strong secrecy.
