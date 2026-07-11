import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { validateA2UI } from "../src/compose.js";
import { convertFaithful } from "../src/convert.js";
import { list as listStyles } from "../src/styles/registry.js";
import { COMPONENT_TYPES } from "../src/a2ui/catalog.js";

const repoRoot = new URL("..", import.meta.url).pathname;
const skill = readFileSync(join(repoRoot, "SKILL.md"), "utf8");
const contract = readFileSync(join(repoRoot, "docs", "04-数据模型与API契约.md"), "utf8");
const fixtures = join(repoRoot, "test", "fixtures", "docs05");

function contractEnum(label) {
  const match = contract.match(new RegExp(`- \\*\\*${label}\\*\\* \`([^\`\\n]+)\``));
  assert.ok(match, `missing docs/04 enum: ${label}`);
  return match[1].split("|").map((item) => item.trim());
}

function loadDoc(name) {
  const md = readFileSync(join(fixtures, `${name}.md`), "utf8");
  const enhanced = JSON.parse(readFileSync(join(fixtures, `${name}.enhanced.json`), "utf8"));
  return { md, enhanced };
}

test("K-05 docs/04 theme enum matches the styles registry and SKILL.md", () => {
  const themes = contractEnum("主题");
  assert.deepEqual(listStyles(), themes);
  for (const theme of themes) assert.match(skill, new RegExp(`\`${theme}\``));
});

test("K-05 docs/04 component enum is backed by the catalog and advertised in SKILL.md", () => {
  const components = contractEnum("组件");
  assert.ok(components.length >= 12, "component list should be substantial");
  for (const component of components) {
    assert.ok(COMPONENT_TYPES.includes(component), `docs/04 advertises unknown component ${component}`);
    assert.match(skill, new RegExp(`\`${component}\``), `SKILL.md missing component ${component}`);
  }
});

test("K-05 SKILL.md carries the A2UI authoring guidance and fallbacks", () => {
  for (const phrase of [
    "compose an A2UI component tree",
    "Containers (`Column`, `Row`, `Grid`, `Card`, `Tabs`) reference children by id",
    "Never change facts and never drop information",
    "Use `Chart` only when the source has real numeric series",
    "Use `Table` only when the source has real two-dimensional data",
    "If enhancement takes more than 60 seconds"
  ]) {
    assert.match(skill, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("K-05 docs/05 sample A/B/C fixtures render as valid, sanitized A2UI", () => {
  const cases = ["sample-a-meeting", "sample-b-tutorial", "sample-c-generic"];
  for (const name of cases) {
    const { md, enhanced } = loadDoc(name);
    assert.equal(enhanced.protocol, "a2ui/0.9-static", `${name} protocol`);
    const faithful = convertFaithful(md, name);
    const result = validateA2UI(enhanced, faithful.html);
    assert.equal(result.ok, true, `${name} render ok`);
    assert.doesNotMatch(result.html, /<script| on\w+=/i, `${name} sanitized`);
    // Every referenced component id resolves — no dangling-reference warnings.
    assert.ok(!result.warnings.some((w) => /A3|A4/.test(w)), `${name} has no missing/unknown components: ${result.warnings.join("; ")}`);
  }
});

test("K-05 sample fixtures exercise a range of components", () => {
  const meeting = loadDoc("sample-a-meeting").enhanced;
  const types = new Set(meeting.components.map((c) => c.component));
  assert.ok(types.has("Table"), "meeting uses a Table for action items");
  assert.ok(types.has("Timeline"), "meeting uses a Timeline for discussion");

  const tutorial = loadDoc("sample-b-tutorial").enhanced;
  const steps = tutorial.components.find((c) => c.component === "List" && c.ordered);
  assert.ok(steps && steps.items.length >= 3, "tutorial has an ordered step list");

  const generic = loadDoc("sample-c-generic").enhanced;
  assert.ok(generic.components.some((c) => c.component === "Quote"), "generic essay uses a Quote");
});
