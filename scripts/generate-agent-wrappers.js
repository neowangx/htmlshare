#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(join(root, "SKILL.md"), "utf8");

function section(name) {
  const match = skill.match(new RegExp(`## ${name}\\n\\n([\\s\\S]*?)(?=\\n## |\\n$)`));
  if (!match) throw new Error(`Missing SKILL.md section: ${name}`);
  return match[1].trim();
}

const codex = `# htmlshare

Generated from ../../SKILL.md by scripts/generate-agent-wrappers.js.
Codex CLI basis: verified locally against codex-cli 0.142.5 on 2026-07-04; user-level instructions are loaded from ~/.codex/AGENTS.md, so install.sh injects this snippet there.

## When To Use

${section("When To Use")}

## Publish Flow

${section("Publish Flow")}

## Enhancement Rules

${section("Enhancement Rules")}

## Failure Fallbacks

${section("Failure Fallbacks")}

## Response Template

${section("Response Template")}
`;

const codexPath = join(root, "agents", "codex", "AGENTS.md");
mkdirSync(dirname(codexPath), { recursive: true });
writeFileSync(codexPath, codex);

function skillWrapper(agentName, basis) {
  return `---
name: htmlshare
description: Publish AI-generated Markdown or self-contained HTML as a polished shareable web page with a stable link and access code.
disable-model-invocation: true
---

# htmlshare

Generated from ../../SKILL.md by scripts/generate-agent-wrappers.js.
${basis}

## When To Use

${section("When To Use")}

## Publish Flow

${section("Publish Flow")}

## Enhancement Rules

${section("Enhancement Rules")}

## Failure Fallbacks

${section("Failure Fallbacks")}

## Response Template

${section("Response Template")}
`;
}

const wrappers = [
  ["hermes", "Hermes basis: verified locally against Hermes Agent v0.18.0 (2026.7.1); install.sh symlinks this skill into ~/.hermes/skills/htmlshare."],
  ["openclaw", "OpenClaw basis: no local version command was available on 2026-07-04, but ~/.openclaw/skills is present and uses SKILL.md skill folders; install.sh symlinks this skill into ~/.openclaw/skills/htmlshare."]
];

for (const [name, basis] of wrappers) {
  const path = join(root, "agents", name, "SKILL.md");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, skillWrapper(name, basis));
}
