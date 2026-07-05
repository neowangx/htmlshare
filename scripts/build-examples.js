#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { composePage } from "../src/compose.js";
import { convertFaithful } from "../src/convert.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = join(root, "test", "fixtures", "docs05");
const sourceDir = join(root, "examples", "source");
const htmlDir = join(root, "examples", "html");

const sources = [
  ["sample-a-meeting", "meeting.md"],
  ["sample-b-tutorial", "tutorial.md"],
  ["sample-c-generic", "essay.md"]
];

const pages = [
  { fixture: "sample-a-meeting", file: "meeting-clinical.html", style: "clinical", label: "Meeting / clinical" },
  { fixture: "sample-b-tutorial", file: "tutorial-darktech.html", style: "darktech", label: "Tutorial / darktech" },
  { fixture: "sample-c-generic", file: "essay-minimal.html", style: "minimal", label: "Essay / minimal" },
  { fixture: "sample-c-generic", file: "essay-editorial.html", style: "editorial", label: "Essay / editorial" }
];

mkdirSync(sourceDir, { recursive: true });
mkdirSync(htmlDir, { recursive: true });

for (const [fixture, file] of sources) {
  const md = readFileSync(join(fixtureDir, `${fixture}.md`), "utf8");
  writeFileSync(join(sourceDir, file), md);
}

for (const page of pages) {
  const md = readFileSync(join(fixtureDir, `${page.fixture}.md`), "utf8");
  const enhanced = JSON.parse(readFileSync(join(fixtureDir, `${page.fixture}.enhanced.json`), "utf8"));
  enhanced.style = page.style;
  const faithful = convertFaithful(md, page.file);
  const { html, validation } = composePage({
    title: faithful.title,
    faithfulHtml: faithful.html,
    enhanced
  });
  if (!validation.ok) {
    throw new Error(`example validation failed: ${page.file} ${validation.errors.join(", ")}`);
  }
  writeFileSync(join(htmlDir, page.file), html);
}

const readme = `# htmlshare examples

Open these files directly in a browser. They are self-contained HTML with no external resources.

## Source Markdown

- [Meeting source](source/meeting.md)
- [Tutorial source](source/tutorial.md)
- [Essay source](source/essay.md)

## Rendered Pages

${pages.map((page) => `- [${page.label}](html/${page.file})`).join("\n")}

## Screenshot

- [Overview image](screenshots/overview.svg)
`;

writeFileSync(join(root, "examples", "README.md"), readme);
