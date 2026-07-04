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
