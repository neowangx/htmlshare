---
name: htmlshare
description: Publish AI-generated Markdown or self-contained HTML as a polished shareable web page with a stable link and access code. Use when the user says share/publish this markdown, generate a link, 发出去给人看, 分享这个 md/HTML, 发布 AI 产出物, or asks for a readable web page version of agent output.
disable-model-invocation: true
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
4. For enhancement, choose one template and one style:

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

Never change facts: numbers, dates, amounts, names, conclusions, and commitments must remain exact.

Never drop information. Every original information point must remain available in the enhanced view, using `<details>` for background or process detail when useful.

Never add opinions, interpretations, or facts not present in the original.

Use TL;DR for the reader's most useful takeaways: conclusions first, then actions, then key data. Keep 1 to 5 items.

Only use tables when the source has real two-dimensional data. Only use card groups when there are at least 3 similar items. Preserve code blocks, quotes, and links exactly.

For meeting/proposal action items, extract owner, task, and deadline. If missing, write `未指定`; do not guess.

## Failure Fallbacks

If `enhanced.json` validation fails, try once to fix it. If it still fails, publish without `--enhanced`.

If upload fails, report the failure and mention that the rendered artifact is cached for retry.

If no target is configured, follow the CLI guidance and help the user configure selfhost/cloud/Vercel/Cloudflare.

## Response Template

After publishing, relay the CLI's last two lines exactly, then add one short sentence about the protection level:

```text
URL: <url>
CODE: <code|none>
```

Tell the user that the access code is lightweight sharing protection, not strong secrecy.
