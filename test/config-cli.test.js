import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { run } from "../src/cli/publish.js";
import { loadConfig } from "../src/lib/config.js";
import { loadManifest } from "../src/lib/manifest.js";

function harness() {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-config-cli-"));
  const configDir = join(root, "config");
  const cacheDir = join(root, "cache");
  const out = [];
  const err = [];
  return {
    root,
    configDir,
    cacheDir,
    stdout: { write: (value) => out.push(value) },
    stderr: { write: (value) => err.push(value) },
    out: () => out.join(""),
    err: () => err.join("")
  };
}

function adapter() {
  const calls = [];
  return {
    name: "selfhost",
    calls,
    async detect() { return { available: true }; },
    async publish(input) {
      calls.push(input);
      return { id: "abc234", url: "https://selfhost/s/abc234/" };
    }
  };
}

test("C-15 config target and selfhost write config.json", async () => {
  const h = harness();

  assert.equal(await run(["config", "target", "vercel"], { configDir: h.configDir, stdout: h.stdout, stderr: h.stderr }), 0);
  assert.equal(await run(["config", "selfhost", "--base-url", "https://x.example.com/", "--token", "SECRET1234"], {
    configDir: h.configDir,
    stdout: h.stdout,
    stderr: h.stderr
  }), 0);

  assert.deepEqual(loadConfig(h.configDir), {
    defaultTarget: "vercel",
    selfhost: { baseUrl: "https://x.example.com", uploadToken: "SECRET1234" }
  });
});

test("C-15 config show redacts token values", async () => {
  const h = harness();
  await run(["config", "selfhost", "--base-url", "https://x.example.com", "--token", "SECRET1234"], {
    configDir: h.configDir,
    stdout: h.stdout,
    stderr: h.stderr
  });
  const code = await run(["config", "show"], { configDir: h.configDir, stdout: h.stdout, stderr: h.stderr });

  assert.equal(code, 0);
  assert.match(h.out(), /\*\*\*1234/);
  assert.doesNotMatch(h.out(), /SECRET1234/);
});

test("C-15 config defaults set values and publish reads them", async () => {
  const h = harness();
  const mock = adapter();
  const file = join(h.root, "proposal.md");
  writeFileSync(file, "# Proposal\n\nBody");

  assert.equal(await run(["config", "target", "selfhost"], { configDir: h.configDir, stdout: h.stdout, stderr: h.stderr }), 0);
  assert.equal(await run(["config", "defaults", "style", "minimal"], { configDir: h.configDir, stdout: h.stdout, stderr: h.stderr }), 0);
  assert.equal(await run(["config", "defaults", "code", "2468"], { configDir: h.configDir, stdout: h.stdout, stderr: h.stderr }), 0);

  const code = await run(["publish", file, "--no-expires"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    adapters: { selfhost: mock },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.equal(mock.calls[0].meta.style, "minimal");
  assert.equal(mock.calls[0].meta.code, "2468");
  assert.equal(loadManifest(h.configDir).entries[0].style, "minimal");
});

test("C-15 config defaults rejects the removed template key", async () => {
  const h = harness();
  assert.equal(await run(["config", "defaults", "template", "proposal"], { configDir: h.configDir, stdout: h.stdout, stderr: h.stderr }), 2);
  assert.match(h.err(), /style\|code/);
});

test("C-15 config footerBadge false affects composed page", async () => {
  const h = harness();
  const mock = adapter();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# Note\n\nBody");
  mkdirSync(h.configDir, { recursive: true });
  writeFileSync(join(h.configDir, "config.json"), JSON.stringify({
    defaultTarget: "selfhost",
    footerBadge: false
  }));

  const code = await run(["publish", file, "--public"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    adapters: { selfhost: mock },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.doesNotMatch(mock.calls[0].html, /<footer class="hs-footer">/);
});
