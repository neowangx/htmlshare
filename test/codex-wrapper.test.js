import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;

test("K-03 Codex wrapper is generated from SKILL.md key sections", () => {
  const skill = readFileSync(join(repoRoot, "SKILL.md"), "utf8");
  const codex = readFileSync(join(repoRoot, "agents", "codex", "AGENTS.md"), "utf8");

  for (const heading of ["When To Use", "Publish Flow", "Enhancement Rules", "Failure Fallbacks", "Response Template"]) {
    assert.match(codex, new RegExp(`## ${heading}`));
  }
  for (const phrase of [
    "htmlshare publish <file.md> --enhanced <enhanced.json>",
    "Never change facts",
    "URL: <url>",
    "CODE: <code|none>"
  ]) {
    assert.match(skill, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(codex, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(codex, /codex-cli 0\.142\.5/);
  assert.match(codex, /~\/\.codex\/AGENTS\.md/);
});

test("K-04 Hermes and OpenClaw wrappers are generated from SKILL.md key sections", () => {
  const skill = readFileSync(join(repoRoot, "SKILL.md"), "utf8");
  for (const [agent, basis] of [["hermes", "Hermes Agent v0.18.0"], ["openclaw", "~/.openclaw/skills"]]) {
    const wrapper = readFileSync(join(repoRoot, "agents", agent, "SKILL.md"), "utf8");
    assert.match(wrapper, /^---\nname: htmlshare/m);
    assert.match(wrapper, new RegExp(basis.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    for (const phrase of [
      "htmlshare publish <file.md> --enhanced <enhanced.json>",
      "Never change facts",
      "URL: <url>",
      "CODE: <code|none>"
    ]) {
      assert.match(skill, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(wrapper, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});

test("K-03/K-04 wrapper generation is idempotent", () => {
  const before = readFileSync(join(repoRoot, "agents", "codex", "AGENTS.md"), "utf8");
  const beforeHermes = readFileSync(join(repoRoot, "agents", "hermes", "SKILL.md"), "utf8");
  const beforeOpenClaw = readFileSync(join(repoRoot, "agents", "openclaw", "SKILL.md"), "utf8");
  execFileSync(process.execPath, [join(repoRoot, "scripts", "generate-agent-wrappers.js")], { cwd: repoRoot });
  const after = readFileSync(join(repoRoot, "agents", "codex", "AGENTS.md"), "utf8");
  const afterHermes = readFileSync(join(repoRoot, "agents", "hermes", "SKILL.md"), "utf8");
  const afterOpenClaw = readFileSync(join(repoRoot, "agents", "openclaw", "SKILL.md"), "utf8");

  assert.equal(after, before);
  assert.equal(afterHermes, beforeHermes);
  assert.equal(afterOpenClaw, beforeOpenClaw);
});
