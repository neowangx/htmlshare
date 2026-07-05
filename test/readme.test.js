import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, normalize } from "node:path";
import { test } from "node:test";

const repoRoot = new URL("..", import.meta.url).pathname;
const readmePath = join(repoRoot, "README.md");
const readme = readFileSync(readmePath, "utf8");

function bashBlocks(markdown) {
  return [...markdown.matchAll(/```bash\n([\s\S]*?)\n```/g)].map((match) => match[1].trim());
}

function localLinks(markdown) {
  return [...markdown.matchAll(/\[[^\]]+\]\((?!https?:|mailto:|#)([^)]+)\)/g)].map((match) => match[1]);
}

test("G-01 README bash command blocks are executable", () => {
  for (const command of bashBlocks(readme)) {
    execSync(command, {
      cwd: repoRoot,
      env: {
        ...process.env,
        HOME: mkdtempSync(join(tmpdir(), "htmlshare-readme-home-"))
      },
      stdio: "pipe",
      shell: "/bin/bash",
      timeout: 30000
    });
  }
});

test("G-01 README local links and screenshot assets exist", () => {
  for (const link of localLinks(readme)) {
    const pathOnly = link.split("#")[0];
    if (!pathOnly) continue;
    const target = normalize(join(dirname(readmePath), pathOnly));
    assert.ok(target.startsWith(repoRoot), `link escapes repo: ${link}`);
    assert.equal(existsSync(target), true, `missing README link: ${link}`);
  }

  assert.equal(existsSync(join(repoRoot, "examples", "screenshots", "overview.svg")), true);
});

test("G-01 README states cloud boundary, free quota, and access-code honesty", () => {
  assert.match(readme, /official hosted cloud server implementation is not part of the open-source product/i);
  assert.match(readme, /100MB free storage/);
  assert.match(readme, /lightweight sharing protection, not strong secrecy/i);
  assert.match(readme, /faithful original view is always/);
});
