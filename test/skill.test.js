import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { run } from "../src/cli/publish.js";

const skill = readFileSync(new URL("../SKILL.md", import.meta.url), "utf8");

test("K-01 SKILL.md has required frontmatter", () => {
  assert.match(skill, /^---\n/);
  assert.match(skill, /\nname: htmlshare\n/);
  assert.match(skill, /\ndescription: .+share\/publish this markdown/);
  // Model invocation stays enabled so the trigger corpus in the description actually fires
  // (K-01 触发词). See docs/00 change log 2026-07-06.
  assert.doesNotMatch(skill, /disable-model-invocation:\s*true/);
});

test("K-01 referenced CLI commands exist in help", async () => {
  let output = "";
  const code = await run(["--help"], {
    stdout: { write: (value) => { output += value; } },
    stderr: { write: () => {} }
  });
  assert.equal(code, 0);
  assert.match(output, /htmlshare publish <file>/);
  assert.match(skill, /htmlshare publish <file\.md>/);
  assert.match(skill, /htmlshare publish <file\.html>/);
});
