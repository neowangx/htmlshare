import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const repoRoot = new URL("..", import.meta.url);

test("runs on Node.js 20 or newer", () => {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  assert.ok(major >= 20, `expected Node.js >=20, got ${process.version}`);
});

test("repository scaffold matches the planned top-level layout", () => {
  for (const path of ["bin", "src", "server", "agents", "examples", "test", "docs"]) {
    assert.equal(existsSync(join(repoRoot.pathname, path)), true, `${path} should exist`);
  }
});

test("CLI placeholder is executable through node", () => {
  const output = execFileSync(process.execPath, [join(repoRoot.pathname, "bin/htmlshare.js"), "--version"], {
    encoding: "utf8"
  });

  assert.match(output, /^htmlshare 0\.0\.0/);
});
