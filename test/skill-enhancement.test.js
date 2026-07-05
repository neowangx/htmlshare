import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { validateEnhanced } from "../src/compose.js";
import { convertFaithful } from "../src/convert.js";
import { list as listStyles } from "../src/styles/registry.js";
import { list as listTemplates, TEMPLATE_SLOTS } from "../src/templates/registry.js";

const repoRoot = new URL("..", import.meta.url).pathname;
const skill = readFileSync(join(repoRoot, "SKILL.md"), "utf8");
const contract = readFileSync(join(repoRoot, "docs", "04-数据模型与API契约.md"), "utf8");
const fixtures = join(repoRoot, "test", "fixtures", "docs05");

function contractEnum(label) {
  const match = contract.match(new RegExp(`- \\*\\*${label}\\*\\* \`([^\\n]+)\``));
  assert.ok(match, `missing docs/04 enum: ${label}`);
  return match[1].split("|").map((item) => item.trim());
}

function loadCase(name) {
  const md = readFileSync(join(fixtures, `${name}.md`), "utf8");
  const enhanced = JSON.parse(readFileSync(join(fixtures, `${name}.enhanced.json`), "utf8"));
  return { md, enhanced };
}

test("K-05 SKILL.md template and style enums match docs/04 section 8 exactly", () => {
  const templates = contractEnum("模板");
  const styles = contractEnum("风格");

  assert.deepEqual(listTemplates(), templates);
  assert.deepEqual(listStyles(), styles);
  assert.match(skill, new RegExp(`Templates: \`${templates.join("`, `")}\`\\.`));
  assert.match(skill, new RegExp(`Styles: \`${styles.join("`, `")}\`\\.`));
});

test("K-05 SKILL.md includes complete docs/05 rubric, style table, slots, component rules, and fallbacks", () => {
  for (const phrase of [
    "The first template with any 2 matching signals wins",
    "If fewer than 2 signals match, use `generic`",
    "Slot sets must match the selected template exactly",
    "Use `<details>` only for process/background/raw/appendix content",
    "Use card groups only when there are at least 3 similar items",
    "Use tables only when the source has real two-dimensional data",
    "If enhancement takes more than 60 seconds",
    "If the user requested a template or style that appears mismatched, obey the user"
  ]) {
    assert.match(skill, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  for (const [template, slots] of Object.entries(TEMPLATE_SLOTS)) {
    assert.match(skill, new RegExp(`\\| \`${template}\` \\| \`${slots.join("`, `")}\` \\|`));
  }
});

test("K-05 docs/05 sample A/B/C enhanced fixtures prove rubric template decisions", () => {
  const cases = [
    ["sample-a-meeting", "meeting"],
    ["sample-b-tutorial", "tutorial"],
    ["sample-c-generic", "generic"]
  ];

  for (const [name, expectedTemplate] of cases) {
    const { md, enhanced } = loadCase(name);
    const faithful = convertFaithful(md, name);
    const result = validateEnhanced(enhanced, faithful.html);

    assert.equal(enhanced.template, expectedTemplate, `${name} template`);
    assert.equal(result.ok, true, `${name} validation`);
    assert.equal(result.enhanced.template, expectedTemplate, `${name} normalized template`);
    assert.doesNotMatch(JSON.stringify(result.enhanced.sections), /<script| on\w+=/i);
  }
});

test("K-05 sample-specific component rules hold", () => {
  const meeting = loadCase("sample-a-meeting").enhanced;
  assert.equal(meeting.sections.find((section) => section.slot === "actions").html.match(/<li>/g).length, 4);
  assert.match(meeting.sections.find((section) => section.slot === "discussion").html, /<details>/);

  const tutorial = loadCase("sample-b-tutorial").enhanced;
  assert.match(tutorial.sections.find((section) => section.slot === "steps").html, /<ol>/);
  assert.doesNotMatch(tutorial.sections.map((section) => section.html).join("\n"), /<table/i);

  const generic = loadCase("sample-c-generic").enhanced;
  assert.ok(generic.tldr.length <= 5);
  assert.doesNotMatch(generic.sections.map((section) => section.html).join("\n"), /<details>|<table/i);
});
