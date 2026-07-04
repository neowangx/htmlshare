import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { run } from "../src/cli/publish.js";
import { loadManifest, upsert } from "../src/lib/manifest.js";

function harness() {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-manage-"));
  const configDir = join(root, "config");
  const out = [];
  const err = [];
  return {
    root,
    configDir,
    stdout: { write: (value) => out.push(value) },
    stderr: { write: (value) => err.push(value) },
    stdin: { isTTY: false },
    out: () => out.join(""),
    err: () => err.join("")
  };
}

function seed(configDir, root) {
  const source = join(root, "note.md");
  writeFileSync(source, "# Note");
  upsert({
    source,
    target: "mock",
    id: "abc234",
    url: "https://mock/s/abc234/",
    code: "4821",
    title: "Note",
    template: "generic",
    style: "clinical",
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T01:00:00.000Z"
  }, configDir);
  return source;
}

test("list --json outputs parseable manifest entries", async () => {
  const h = harness();
  seed(h.configDir, h.root);
  const code = await run(["list", "--json"], { configDir: h.configDir, stdout: h.stdout, stderr: h.stderr });
  assert.equal(code, 0);
  const rows = JSON.parse(h.out());
  assert.equal(rows[0].title, "Note");
  assert.equal(rows[0].target, "mock");
  assert.equal(rows[0].url, "https://mock/s/abc234/");
  assert.equal(rows[0].updatedAt, "2026-07-04T01:00:00.000Z");
  assert.equal(rows[0].code, "4821");
});

test("unpublish without --yes in non-TTY exits 5", async () => {
  const h = harness();
  seed(h.configDir, h.root);
  const code = await run(["unpublish", "abc234"], {
    configDir: h.configDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: { async unpublish() { throw new Error("should not call"); } } },
    stdout: h.stdout,
    stderr: h.stderr,
    stdin: h.stdin
  });
  assert.equal(code, 5);
  assert.match(h.err(), /需要确认/);
});

test("unpublish --yes calls adapter and removes manifest entry", async () => {
  const h = harness();
  const source = seed(h.configDir, h.root);
  const calls = [];
  const code = await run(["unpublish", source, "--yes"], {
    configDir: h.configDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: { async unpublish(input) { calls.push(input); } } },
    stdout: h.stdout,
    stderr: h.stderr,
    stdin: h.stdin
  });
  assert.equal(code, 0);
  assert.deepEqual(calls.map((call) => call.id), ["abc234"]);
  assert.deepEqual(loadManifest(h.configDir).entries, []);
  assert.match(h.out(), /UNPUBLISHED: abc234/);
});
