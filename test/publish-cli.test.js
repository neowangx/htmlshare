import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { run } from "../src/cli/publish.js";
import { AdapterError } from "../src/adapters/errors.js";

function harness() {
  const root = mkdtempSync(join(tmpdir(), "htmlshare-cli-"));
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

function mockAdapter(results = {}) {
  const calls = [];
  return {
    calls,
    name: "mock",
    async detect() { return { available: true }; },
    async publish(input) {
      calls.push(input);
      if (results.fail) throw new AdapterError("INTERNAL", "mock upload failed");
      return { id: input.id || "abc234", url: "https://mock/s/abc234/", version: input.id ? 2 : 1 };
    }
  };
}

test("publish md without enhanced outputs URL and CODE contract", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# 标题\n\n正文");

  const code = await run(["publish", file, "--target", "mock", "--code", "4821"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: adapter },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.match(adapter.calls[0].html, /id="hs-faithful"/);
  assert.match(h.out(), /URL: https:\/\/mock\/s\/abc234\/\nCODE: 4821\n$/);
});

test("publish md with valid enhanced renders dual mode", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "meeting.md");
  const enhanced = join(h.root, "enhanced.json");
  writeFileSync(file, "# 会纪要\n\n## 结论\n\n我们确认继续推进，内容足够长以通过增强长度比例校验。");
  writeFileSync(enhanced, JSON.stringify({
    version: 1,
    template: "generic",
    style: "clinical",
    title: "会纪要",
    tldr: ["确认继续推进"],
    sections: [{ slot: "body", html: "<p>我们确认继续推进，内容足够长以通过增强长度比例校验，并保留原文对照。</p>" }]
  }));

  const code = await run(["publish", file, "--target", "mock", "--code", "4821", "--enhanced", enhanced], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: adapter },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.match(adapter.calls[0].html, /id="hs-toggle"/);
  assert.match(adapter.calls[0].html, /id="hs-enhanced"/);
});

test("publish html direct passes input through", async () => {
  const h = harness();
  const adapter = mockAdapter();
  const file = join(h.root, "page.html");
  writeFileSync(file, "<!doctype html><h1>Raw</h1>");

  const code = await run(["publish", file, "--target", "mock", "--public"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: adapter },
    stdout: h.stdout,
    stderr: h.stderr
  });

  assert.equal(code, 0);
  assert.equal(adapter.calls[0].html, "<!doctype html><h1>Raw</h1>");
  assert.match(h.out(), /CODE: none\n$/);
});

test("upload failure exits 4, keeps cache, and rerun skips convert", async () => {
  const h = harness();
  const file = join(h.root, "note.md");
  writeFileSync(file, "# Cached\n\n正文");

  const failed = await run(["publish", file, "--target", "mock", "--code", "4821"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: mockAdapter({ fail: true }) },
    stdout: h.stdout,
    stderr: h.stderr
  });
  assert.equal(failed, 4);
  assert.match(h.err(), /CONVERT: markdown/);

  const successAdapter = mockAdapter();
  const rerun = await run(["publish", file, "--target", "mock", "--code", "4821"], {
    configDir: h.configDir,
    cacheDir: h.cacheDir,
    config: { defaultTarget: "mock" },
    adapters: { mock: successAdapter },
    stdout: h.stdout,
    stderr: h.stderr
  });
  assert.equal(rerun, 0);
  assert.match(h.err(), /CACHE: hit CONVERT/);
  assert.match(readFileSync(join(h.configDir, "manifest.json"), "utf8"), /abc234/);
});
